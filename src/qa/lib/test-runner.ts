import { generateCorrelationId } from '@/lib/debug/correlation-id'
import { useDebugStore } from '@/stores/useDebugStore'
import type {
  TestScenario,
  ScriptedScenario,
  GoalBasedScenario,
  TestExecution,
  TestStepResult,
  TestStep,
  GoalBasedTurnResult,
  TestRunSummary
} from './types'
import { isGoalBasedScenario, isScriptedScenario } from './types'
import { evaluateStepQuality, evaluateOverallQuality } from './evaluator'
import {
  generateInitialMessage,
  generateNextMessage,
  checkSuccessSignals
} from './user-simulator'

export class TestRunner {
  private abortController: AbortController | null = null
  private storeId: string = ''

  // Main entry point - dispatches to scripted or goal-based
  async runScenario(
    scenario: TestScenario,
    storeId: string,
    chatModel: string,
    evaluatorModel: string,
    onStepComplete?: (result: TestStepResult) => void,
    onStepStart?: (userMessage: string, stepIndex: number) => void,
    callbacks?: {
      onTurnStart?: (turn: number, userMessage: string) => void
      onTurnComplete?: (result: GoalBasedTurnResult) => void
    }
  ): Promise<TestExecution> {
    this.storeId = storeId

    if (isGoalBasedScenario(scenario)) {
      return this.runGoalBasedScenario(
        scenario,
        storeId,
        chatModel,
        evaluatorModel,
        callbacks
      )
    } else {
      return this.runScriptedScenario(
        scenario as ScriptedScenario,
        storeId,
        chatModel,
        evaluatorModel,
        onStepComplete,
        onStepStart
      )
    }
  }

  // Run scripted scenario (existing logic)
  async runScriptedScenario(
    scenario: ScriptedScenario,
    storeId: string,
    chatModel: string,
    evaluatorModel: string,
    onStepComplete?: (result: TestStepResult) => void,
    onStepStart?: (userMessage: string, stepIndex: number) => void
  ): Promise<TestExecution> {

    const testRunId = `test-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`

    const execution: TestExecution = {
      testRunId,
      scenarioId: scenario.id,
      scenarioName: scenario.name,
      scenarioType: 'scripted',
      status: 'running',
      currentStepIndex: 0,
      totalSteps: scenario.steps.length,
      startTime: Date.now(),
      results: [],
      model: chatModel,
      evaluatorModel: evaluatorModel || chatModel  // Default to chat model
    }

    // Update store
    useDebugStore.getState().startTest(execution)

    // 🆕 ADD TEST SCENARIO CARD to timeline with detailed info
    const scenarioRequestId = `test-scenario-${testRunId}`
    const scenarioDetails = [
      `**${scenario.description || 'No description'}**`,
      '',
      `**Steps:** ${scenario.steps.length}`,
      '',
      '**Test Steps:**',
      ...scenario.steps.map((step, idx) => {
        const expectedIntent = Array.isArray(step.expected?.intent)
          ? step.expected.intent.join(' or ')
          : step.expected?.intent || 'any';
        return `${idx + 1}. "${step.userMessage}" (expects: ${expectedIntent})`;
      }),
      '',
      '**Success Criteria:**',
      ...(scenario.evaluation?.criteria || []).map(c => `• ${c}`),
      scenario.evaluation?.minQualityScore
        ? `• Min quality score: ${scenario.evaluation.minQualityScore}/100`
        : '',
    ].filter(Boolean).join('\n');

    useDebugStore.getState().addRequest({
      id: scenarioRequestId,
      timestamp: Date.now(),
      userMessage: `📋 Test Scenario: ${scenario.name}`,
      model: chatModel,
      timings: { requestStart: Date.now() },
      status: 'complete',
      response: {
        text: scenarioDetails,
        duration: 0,
      },
    })

    // Build conversation history
    const conversationHistory: Array<{ role: 'user' | 'assistant', content: string }> = []

    // Execute each step
    for (let i = 0; i < scenario.steps.length; i++) {
      const step = scenario.steps[i]

      // Check if paused/stopped
      const currentTest = useDebugStore.getState().currentTest
      if (currentTest?.status === 'paused') {
        await this.waitForResume()
      }
      if (currentTest?.status === 'stopped') {
        break
      }

      // 🆕 Notify UI that step is starting (show user message immediately)
      if (onStepStart) {
        onStepStart(step.userMessage, i)
      }

      // Execute step
      const result = await this.executeStep(
        step,
        i,
        storeId,
        chatModel,
        evaluatorModel || chatModel,
        conversationHistory
      )

      // Add to results
      execution.results.push(result)
      useDebugStore.getState().addTestResult(result)

      // Update conversation history
      conversationHistory.push(
        { role: 'user', content: step.userMessage },
        { role: 'assistant', content: result.botResponse }
      )

      // Callback
      if (onStepComplete) {
        onStepComplete(result)
      }
    }

    // Overall evaluation
    const overallEval = await evaluateOverallQuality(
      scenario,
      execution.results,
      conversationHistory,
      evaluatorModel || chatModel
    )

    // Store overall evaluation result
    execution.overallEvaluation = overallEval

    // Complete test
    execution.status = 'complete'
    execution.endTime = Date.now()

    useDebugStore.getState().completeTest()

    return execution
  }

  private async executeStep(
    step: TestStep,
    stepIndex: number,
    storeId: string,
    chatModel: string,
    evaluatorModel: string,
    conversationHistory: Array<{ role: string, content: string }>
  ): Promise<TestStepResult> {

    const correlationId = generateCorrelationId()
    const stepStart = Date.now()

    // 🆕 ADD DEBUG REQUEST (like normal chat mode)
    useDebugStore.getState().addRequest({
      id: correlationId,
      timestamp: stepStart,
      userMessage: step.userMessage,
      model: chatModel,
      timings: { requestStart: stepStart },
      status: 'pending',
    })

    try {
      // Update status to classifying
      useDebugStore.getState().updateRequest(correlationId, { status: 'classifying' })

      // Call Edge Function
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat-completion`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
            'X-Request-ID': correlationId,
          },
          body: JSON.stringify({
            messages: [
              ...conversationHistory,
              { role: 'user', content: step.userMessage }
            ],
            storeId,
            model: chatModel,
          })
        }
      )

      const data = await response.json()
      const timeMs = Date.now() - stepStart

      // Technical validation
      const technical = this.validateTechnical(step.expected, data, timeMs)

      // Extract rich content (same logic as StorePage)
      const richContent = this.extractRichContent(data.functionResult)

      // Calculate passed status WITHOUT quality (will update async)
      // For now, only technical checks determine pass/fail
      const passedTechnical = technical.intentCorrect &&
                              technical.confidenceOK &&
                              technical.functionsCorrect &&
                              technical.noErrors

      // Calculate performance score based on timing (0-100)
      const performanceScore = this.calculatePerformanceScore(timeMs)

      // 🆕 UPDATE DEBUG REQUEST with response data (like normal chat mode) + test results
      useDebugStore.getState().updateRequest(correlationId, {
        response: {
          text: data.text,
          richContent,
          duration: 0,
        },
        timings: {
          requestStart: stepStart,
          totalDuration: timeMs,
          intentDuration: data.debug?.intentDuration,
          functionDuration: data.debug?.functionDuration,
          responseDuration: data.debug?.responseDuration,
        },
        toolSelection: data.debug?.toolSelection,
        functionCalls: data.debug?.functionCalls,
        tokens: data.debug?.tokens,
        cost: data.debug?.cost,
        steps: data.debug?.steps,
        status: 'complete',
        // 🆕 ADD TEST RESULT DATA (with full diagnostic info)
        testResult: {
          passed: passedTechnical,  // Initial pass based on technical only
          performanceScore,
          technical: {
            intentCorrect: technical.intentCorrect,
            intentActual: technical.intentActual,
            intentExpected: technical.intentExpected,
            confidenceOK: technical.confidenceOK,
            confidence: technical.confidence,
            minConfidence: technical.minConfidence,
            functionsCorrect: technical.functionsCorrect,
            functionsActual: technical.functionsActual,
            functionsExpected: technical.functionsExpected,
            timingOK: technical.timingOK,
            timeMs: technical.timeMs,
            maxTimeMs: technical.maxTimeMs,
            noErrors: technical.noErrors,
            error: technical.error,
          },
          quality: undefined,  // Will be updated async
        },
      })

      // 🚀 Run quality evaluation ASYNC (non-blocking)
      evaluateStepQuality(
        step.userMessage,
        data.text,
        step.criteria || [],
        chatModel
      ).then(quality => {
        if (quality) {
          // Update the request with quality score and recalculate passed
          const finalPassed = passedTechnical && quality.passed
          useDebugStore.getState().updateRequest(correlationId, {
            testResult: {
              passed: finalPassed,
              performanceScore,
              technical: {
                intentCorrect: technical.intentCorrect,
                intentActual: technical.intentActual,
                intentExpected: technical.intentExpected,
                confidenceOK: technical.confidenceOK,
                confidence: technical.confidence,
                minConfidence: technical.minConfidence,
                functionsCorrect: technical.functionsCorrect,
                functionsActual: technical.functionsActual,
                functionsExpected: technical.functionsExpected,
                timingOK: technical.timingOK,
                timeMs: technical.timeMs,
                maxTimeMs: technical.maxTimeMs,
                noErrors: technical.noErrors,
                error: technical.error,
              },
              quality: {
                score: quality.score,
                passed: quality.passed,
                reasoning: quality.reasoning,
              },
            },
          })
        }
      }).catch(err => {
        console.error('Quality evaluation failed:', err)
        // Keep technical-only result if quality eval fails
      })

      // Build result (quality will be updated async)
      const result: TestStepResult = {
        stepId: step.id,
        stepIndex,
        userMessage: step.userMessage,
        botResponse: data.text,
        richContent,
        correlationId,
        technical,
        quality: undefined,  // Will be updated async
        passed: passedTechnical,  // Initial pass based on technical only
        timestamp: Date.now()
      }

      return result

    } catch (error) {
      // 🆕 UPDATE DEBUG REQUEST with error
      useDebugStore.getState().updateRequest(correlationId, {
        status: 'error',
        error: {
          stage: 'request',
          message: error instanceof Error ? error.message : 'Unknown error',
          stack: error instanceof Error ? error.stack : undefined,
        },
      })

      // Handle error
      return this.createErrorResult(step, stepIndex, correlationId, error)
    }
  }

  private validateTechnical(expected: any, actual: any, timeMs: number) {
    const expectedIntents = Array.isArray(expected.intent)
      ? expected.intent
      : [expected.intent]

    // 🔧 FIX: Intent and confidence are in actual.debug, not actual directly
    const actualIntent = actual.debug?.intent?.detected || actual.intent
    const actualConfidence = actual.debug?.intent?.confidence || actual.confidence || 0

    const intentCorrect = expectedIntents.includes(actualIntent)
    const confidenceOK = actualConfidence >= (expected.minConfidence || 85)

    const actualFunctions = actual.debug?.functionCalls?.map((f: any) => f.name) || []
    const functionsCorrect = expected.functions
      ? expected.functions.every((f: string) => actualFunctions.includes(f))
      : true

    const timingOK = timeMs <= (expected.maxTimeMs || 10000)
    const noErrors = !actual.error

    return {
      intentCorrect,
      intentActual: actualIntent,
      intentExpected: expectedIntents,

      confidenceOK,
      confidence: actualConfidence,
      minConfidence: expected.minConfidence || 85,

      functionsCorrect,
      functionsActual: actualFunctions,
      functionsExpected: expected.functions || [],

      timingOK,
      timeMs,
      maxTimeMs: expected.maxTimeMs || 10000,

      noErrors,
      error: actual.error?.message
    }
  }

  private createErrorResult(step: TestStep, stepIndex: number, correlationId: string, error: any): TestStepResult {
    return {
      stepId: step.id,
      stepIndex,
      userMessage: step.userMessage,
      botResponse: '',
      correlationId,
      technical: {
        intentCorrect: false,
        intentActual: 'ERROR',
        intentExpected: step.expected.intent || '',
        confidenceOK: false,
        confidence: 0,
        minConfidence: step.expected.minConfidence || 85,
        functionsCorrect: false,
        functionsActual: [],
        functionsExpected: step.expected.functions || [],
        timingOK: false,
        timeMs: 0,
        maxTimeMs: step.expected.maxTimeMs || 10000,
        noErrors: false,
        error: error.message
      },
      passed: false,
      timestamp: Date.now()
    }
  }

  private extractRichContent(functionResult: any) {
    try {
      if (!functionResult) return undefined

      // Prefer explicit components array (products -> 'products', HoursList -> 'hours')
      if (Array.isArray(functionResult.components) && functionResult.components.length) {
        const productsComp = functionResult.components.find((c: any) => c.type === 'products' || c.type === 'Products')
        if (productsComp && productsComp.props && Array.isArray(productsComp.props.products)) {
          return { type: 'products', data: productsComp.props.products }
        }

        const servicesComp = functionResult.components.find((c: any) => c.type === 'services' || c.type === 'Services')
        if (servicesComp && servicesComp.props && Array.isArray(servicesComp.props.services)) {
          return { type: 'services', data: servicesComp.props.services }
        }

        const hoursComp = functionResult.components.find((c: any) => c.type === 'HoursList')
        if (hoursComp && hoursComp.props && Array.isArray(hoursComp.props.hours)) {
          return { type: 'hours', data: hoursComp.props.hours }
        }

        const leadFormComp = functionResult.components.find((c: any) => c.type === 'LeadForm')
        if (leadFormComp && leadFormComp.props) {
          return { type: 'lead_form', data: leadFormComp.props }
        }
      }

      // Fallback: if functionResult.data.hours exists
      if (functionResult.data && Array.isArray(functionResult.data.hours) && functionResult.data.hours.length) {
        return { type: 'hours', data: functionResult.data.hours }
      }

      // Fallback: if functionResult.data.products exists
      if (functionResult.data && Array.isArray(functionResult.data.products) && functionResult.data.products.length) {
        return { type: 'products', data: functionResult.data.products }
      }

      return undefined
    } catch (e) {
      console.error('Error extracting richContent from functionResult', e)
      return undefined
    }
  }

  private async waitForResume() {
    return new Promise<void>((resolve) => {
      const checkInterval = setInterval(() => {
        const status = useDebugStore.getState().currentTest?.status
        if (status !== 'paused') {
          clearInterval(checkInterval)
          resolve()
        }
      }, 100)
    })
  }

  pause() {
    useDebugStore.getState().pauseTest()
  }

  resume() {
    useDebugStore.getState().updateTestExecution({ status: 'running' })
  }

  stop() {
    useDebugStore.getState().stopTest()
  }

  /**
   * Calculate performance score based on response time
   * UX-focused tiered scoring system:
   * 🏆 Excellent (90-100): < 3s - Feels instant, delightful
   * ✅ Good (70-89): 3-5s - User stays engaged
   * ⚠️ Acceptable (50-69): 5-10s - Noticeable but tolerable
   * 🐌 Slow (25-49): 10-15s - User getting impatient (RED)
   * ❌ Unacceptable (0-24): > 15s - User frustrated (RED)
   */
  private calculatePerformanceScore(timeMs: number): number {
    const seconds = timeMs / 1000

    if (seconds < 3) {
      // Excellent: 90-100 (feels instant)
      return Math.max(90, Math.min(100, 100 - (seconds / 3) * 10))
    } else if (seconds < 5) {
      // Good: 70-89 (user stays engaged)
      return Math.max(70, Math.min(89, 89 - ((seconds - 3) / 2) * 19))
    } else if (seconds < 10) {
      // Acceptable: 50-69 (noticeable but tolerable)
      return Math.max(50, Math.min(69, 69 - ((seconds - 5) / 5) * 19))
    } else if (seconds < 15) {
      // Slow: 25-49 (user getting impatient) - RED WARNING
      return Math.max(25, Math.min(49, 49 - ((seconds - 10) / 5) * 24))
    } else {
      // Unacceptable: 0-24 (user frustrated) - RED WARNING
      return Math.max(0, Math.min(24, 24 - ((seconds - 15) / 10) * 24))
    }
  }

  /**
   * Get performance tier and color based on score
   */
  private getPerformanceTier(score: number): { tier: string; color: string; emoji: string } {
    if (score >= 90) return { tier: 'Excellent', color: 'green', emoji: '🏆' }
    if (score >= 70) return { tier: 'Good', color: 'blue', emoji: '✅' }
    if (score >= 50) return { tier: 'Acceptable', color: 'yellow', emoji: '⚠️' }
    if (score >= 25) return { tier: 'Slow', color: 'red', emoji: '🐌' }
    return { tier: 'Unacceptable', color: 'red', emoji: '❌' }
  }

  // ==========================================
  // GOAL-BASED TEST EXECUTION
  // ==========================================

  /**
   * Run a goal-based scenario where AI generates user messages
   */
  async runGoalBasedScenario(
    scenario: GoalBasedScenario,
    storeId: string,
    chatModel: string,
    evaluatorModel: string,
    callbacks?: {
      onTurnStart?: (turn: number, userMessage: string) => void
      onTurnComplete?: (result: GoalBasedTurnResult) => void
    }
  ): Promise<TestExecution> {

    const testRunId = `test-goal-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`

    const execution: TestExecution = {
      testRunId,
      scenarioId: scenario.id,
      scenarioName: scenario.name,
      scenarioType: 'goal-based',
      status: 'running',
      currentTurn: 0,
      maxTurns: scenario.limits.maxTurns,
      turns: [],
      goalAchieved: false,
      startTime: Date.now(),
      model: chatModel,
      evaluatorModel
    }

    // Update store
    useDebugStore.getState().startTest(execution)

    // Add test scenario card to timeline
    const scenarioRequestId = `test-scenario-${testRunId}`
    const scenarioDetails = [
      `**${scenario.description}**`,
      '',
      `**Type:** Goal-Based Test`,
      `**Goal:** ${scenario.goal.description}`,
      `**User Persona:** ${scenario.user.persona}`,
      `**Language:** ${scenario.user.language}`,
      `**Max Turns:** ${scenario.limits.maxTurns}`,
      '',
      '**Success Signals:**',
      ...(scenario.goal.successSignals || []).map(s => `• ${s}`),
      '',
      '**Evaluation Criteria:**',
      ...(scenario.evaluation?.criteria || []).map(c => `• ${c}`),
    ].filter(Boolean).join('\n')

    useDebugStore.getState().addRequest({
      id: scenarioRequestId,
      timestamp: Date.now(),
      userMessage: `🎯 Goal-Based Test: ${scenario.name}`,
      model: chatModel,
      timings: { requestStart: Date.now() },
      status: 'complete',
      response: {
        text: scenarioDetails,
        duration: 0,
      },
    })

    // Build conversation history
    const conversationHistory: Array<{ role: 'user' | 'assistant', content: string }> = []

    // Generate initial user message
    let simulatorResult = await generateInitialMessage(scenario, evaluatorModel, storeId)

    // Main conversation loop
    let turn = 0
    while (!simulatorResult.goalComplete && turn < scenario.limits.maxTurns) {
      const currentTest = useDebugStore.getState().currentTest

      // Check for pause/stop
      if (currentTest?.status === 'paused') {
        await this.waitForResume()
      }
      if (currentTest?.status === 'stopped') {
        break
      }

      const userMessage = simulatorResult.message

      // Callback: Turn starting
      callbacks?.onTurnStart?.(turn, userMessage)

      // Small delay for natural feel
      await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 1000))

      // Execute the turn (send to chatbot)
      const turnResult = await this.executeGoalBasedTurn(
        turn,
        userMessage,
        storeId,
        chatModel,
        conversationHistory
      )

      // Store turn result
      execution.turns!.push(turnResult)
      execution.currentTurn = turn + 1

      // Update conversation history
      conversationHistory.push(
        { role: 'user', content: userMessage },
        { role: 'assistant', content: turnResult.botResponse }
      )

      // Callback: Turn complete
      callbacks?.onTurnComplete?.(turnResult)

      // Update store
      useDebugStore.getState().updateTestExecution({
        currentTurn: turn + 1,
        turns: [...execution.turns!]
      })

      // Check for success signals in bot response
      if (scenario.goal.successSignals &&
          checkSuccessSignals(turnResult.botResponse, scenario.goal.successSignals)) {
        execution.goalAchieved = true
        break
      }

      // Generate next user message
      simulatorResult = await generateNextMessage(
        scenario,
        conversationHistory,
        turnResult.botResponse,
        evaluatorModel,
        storeId
      )

      // Check if AI signaled goal complete
      if (simulatorResult.goalComplete) {
        execution.goalAchieved = true
        break
      }

      turn++
    }

    // Run overall evaluation
    const overallEval = await evaluateOverallQuality(
      scenario,
      execution.turns!.map(t => ({
        stepId: `turn-${t.turnIndex}`,
        stepIndex: t.turnIndex,
        userMessage: t.userMessage,
        botResponse: t.botResponse,
        correlationId: t.correlationId,
        technical: {
          intentCorrect: true, // N/A for goal-based
          intentActual: t.technical.intent,
          intentExpected: '',
          confidenceOK: true,
          confidence: t.technical.confidence,
          minConfidence: 0,
          functionsCorrect: true,
          functionsActual: t.technical.functions,
          functionsExpected: [],
          timingOK: true,
          timeMs: t.technical.timeMs,
          maxTimeMs: 0,
          noErrors: true
        },
        passed: true,
        timestamp: t.timestamp
      })),
      conversationHistory,
      evaluatorModel,
      execution.goalAchieved  // Pass goal achievement status
    )

    // Store overall evaluation
    execution.overallEvaluation = overallEval

    // Complete execution
    execution.status = 'complete'
    execution.endTime = Date.now()
    execution.goalAchieved = execution.goalAchieved || overallEval.goalAchieved

    useDebugStore.getState().completeTest()

    return execution
  }

  /**
   * Execute a single turn in goal-based test
   */
  private async executeGoalBasedTurn(
    turnIndex: number,
    userMessage: string,
    storeId: string,
    chatModel: string,
    conversationHistory: Array<{ role: string, content: string }>
  ): Promise<GoalBasedTurnResult> {

    const correlationId = generateCorrelationId()
    const turnStart = Date.now()

    // Add debug request (like normal chat mode)
    useDebugStore.getState().addRequest({
      id: correlationId,
      timestamp: turnStart,
      userMessage: userMessage,
      model: chatModel,
      timings: { requestStart: turnStart },
      status: 'pending',
      goalBasedTurn: {
        turnIndex,
        userMessage,
        isSimulated: true
      }
    })

    try {
      // Update status to classifying
      useDebugStore.getState().updateRequest(correlationId, { status: 'classifying' })

      // Call Edge Function
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat-completion`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
            'X-Request-ID': correlationId,
          },
          body: JSON.stringify({
            messages: [
              ...conversationHistory,
              { role: 'user', content: userMessage }
            ],
            storeId,
            model: chatModel,
          })
        }
      )

      const data = await response.json()
      const timeMs = Date.now() - turnStart

      const performanceScore = this.calculatePerformanceScore(timeMs)

      // Update debug request with response
      useDebugStore.getState().updateRequest(correlationId, {
        response: {
          text: data.text,
          richContent: this.extractRichContent(data.functionResult),
          duration: 0,
        },
        timings: {
          requestStart: turnStart,
          totalDuration: timeMs,
          intentDuration: data.debug?.intentDuration,
          functionDuration: data.debug?.functionDuration,
          responseDuration: data.debug?.responseDuration,
        },
        toolSelection: data.debug?.toolSelection,
        functionCalls: data.debug?.functionCalls,
        tokens: data.debug?.tokens,
        cost: data.debug?.cost,
        steps: data.debug?.steps,
        status: 'complete',
        goalBasedTurn: {
          turnIndex,
          userMessage,
          isSimulated: true,
          performanceScore,
        }
      })

      return {
        turnIndex,
        userMessage,
        botResponse: data.text || '',
        correlationId,
        technical: {
          intent: data.debug?.toolSelection?.function || data.debug?.functionCalls?.[0]?.name || 'UNKNOWN',
          confidence: 90, // Classifier mode always 90
          functions: data.debug?.functionCalls?.map((f: any) => f.name) || [],
          timeMs,
          performanceScore
        },
        timestamp: Date.now()
      }

    } catch (error: any) {
      // Update debug request with error
      useDebugStore.getState().updateRequest(correlationId, {
        status: 'error',
        error: {
          stage: 'request',
          message: error.message || 'Unknown error',
          stack: error.stack,
        },
      })

      return {
        turnIndex,
        userMessage,
        botResponse: `Error: ${error.message}`,
        correlationId,
        technical: {
          intent: 'ERROR',
          confidence: 0,
          functions: [],
          timeMs: Date.now() - turnStart,
          performanceScore: 0
        },
        timestamp: Date.now()
      }
    }
  }
}
