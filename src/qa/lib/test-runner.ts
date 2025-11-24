import { generateCorrelationId } from '@/lib/debug/correlation-id'
import { useDebugStore } from '@/stores/useDebugStore'
import type { TestScenario, TestExecution, TestStepResult, TestStep } from './types'
import { evaluateStepQuality, evaluateOverallQuality } from './evaluator'

export class TestRunner {
  private abortController: AbortController | null = null

  async runScenario(
    scenario: TestScenario,
    storeId: string,
    chatModel: string,
    evaluatorModel: string,
    onStepComplete?: (result: TestStepResult) => void
  ): Promise<TestExecution> {

    const testRunId = `test-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`

    const execution: TestExecution = {
      testRunId,
      scenarioId: scenario.id,
      scenarioName: scenario.name,
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

      // AI quality evaluation (using CHAT model - per-message)
      const quality = await evaluateStepQuality(
        step.userMessage,
        data.text,
        step.criteria || [],
        chatModel  // ← Use chat model for per-message eval
      )

      // Extract rich content (same logic as StorePage)
      const richContent = this.extractRichContent(data.functionResult)

      // Calculate passed status
      const passed = technical.intentCorrect &&
                     technical.confidenceOK &&
                     technical.functionsCorrect &&
                     technical.timingOK &&
                     technical.noErrors &&
                     (quality?.passed ?? true)

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
        intent: data.debug?.intent,
        functionCalls: data.debug?.functionCalls,
        tokens: data.debug?.tokens,
        cost: data.debug?.cost,
        steps: data.debug?.steps,
        status: 'complete',
        // 🆕 ADD TEST RESULT DATA
        testResult: {
          passed,
          technical: {
            intentCorrect: technical.intentCorrect,
            confidenceOK: technical.confidenceOK,
            functionsCorrect: technical.functionsCorrect,
            timingOK: technical.timingOK,
            noErrors: technical.noErrors,
          },
          quality: quality ? {
            score: quality.score,
            passed: quality.passed,
            reasoning: quality.reasoning,
          } : undefined,
        },
      })

      // Build result
      const result: TestStepResult = {
        stepId: step.id,
        stepIndex,
        userMessage: step.userMessage,
        botResponse: data.text,
        richContent,
        correlationId,
        technical,
        quality,
        passed,
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

    const intentCorrect = expectedIntents.includes(actual.intent)
    const confidenceOK = actual.confidence >= (expected.minConfidence || 85)

    const actualFunctions = actual.debug?.functionCalls?.map((f: any) => f.name) || []
    const functionsCorrect = expected.functions
      ? expected.functions.every((f: string) => actualFunctions.includes(f))
      : true

    const timingOK = timeMs <= (expected.maxTimeMs || 10000)
    const noErrors = !actual.error

    return {
      intentCorrect,
      intentActual: actual.intent,
      intentExpected: expectedIntents,

      confidenceOK,
      confidence: actual.confidence,
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
}
