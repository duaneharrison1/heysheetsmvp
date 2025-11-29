// Scripted Scenario (existing - exact messages and per-step expectations)
export interface ScriptedScenario {
  id: string
  name: string
  description: string
  type?: 'scripted'  // Optional for backwards compatibility
  storeId?: string  // Optional, use current store if not specified

  steps: TestStep[]

  evaluation?: {
    criteria: string[]  // Overall evaluation criteria
    minQualityScore?: number
  }
}

// Goal-Based Scenario (AI generates user messages)
export interface GoalBasedScenario {
  id: string
  name: string
  description: string
  type: 'goal-based'

  goal: {
    description: string           // What the simulated user is trying to achieve
    successSignals?: string[]     // Words that indicate goal completion
  }

  user: {
    persona: 'polite' | 'casual' | 'impatient' | 'confused' | 'verbose'
    language: 'en' | 'zh-HK' | 'zh-TW' | 'ja'
    behavior?: {
      randomness?: 'predictable' | 'natural' | 'chaotic'
      typos?: boolean
      emoji?: boolean
    }
  }

  limits: {
    maxTurns: number              // Safety limit (default: 10)
  }

  evaluation: {
    criteria: string[]
    minQualityScore?: number      // Default: 70
  }
}

// Union type for both scenario types
export type TestScenario = ScriptedScenario | GoalBasedScenario

// Helper to check scenario type
export function isGoalBasedScenario(scenario: TestScenario): scenario is GoalBasedScenario {
  return scenario.type === 'goal-based'
}

export function isScriptedScenario(scenario: TestScenario): scenario is ScriptedScenario {
  return scenario.type !== 'goal-based'
}

export interface TestStep {
  id: string
  userMessage: string

  expected: {
    intent?: string | string[]  // Expected intent(s)
    minConfidence?: number      // Minimum confidence (default: 85)
    functions?: string[]         // Expected functions to be called
    maxTimeMs?: number           // Maximum response time

    // Content expectations
    responseContains?: string[]  // Keywords that should appear
    responseNotContains?: string[]

    // Rich content expectations
    richContentType?: string  // 'products' | 'services' | 'hours' | 'bookings'
    minItems?: number         // For lists (products, services)

    // Special validations
    calendarEventCreated?: boolean
    leadCaptured?: boolean
  }

  // Per-step evaluation criteria
  criteria?: string[]
}

// Goal-based execution result (different from scripted)
export interface GoalBasedTurnResult {
  turnIndex: number
  userMessage: string        // AI-generated message
  botResponse: string
  correlationId: string

  // Technical data (informational, not pass/fail)
  technical: {
    intent: string
    confidence: number
    functions: string[]
    timeMs: number
    performanceScore: number
  }

  timestamp: number
}

// Test Execution State - supports both scripted and goal-based
export interface TestExecution {
  testRunId: string
  scenarioId: string
  scenarioName: string
  scenarioType?: 'scripted' | 'goal-based'  // NEW
  status: 'running' | 'paused' | 'stopped' | 'complete' | 'error'

  // For scripted tests
  currentStepIndex?: number
  totalSteps?: number
  results?: TestStepResult[]

  // For goal-based tests
  currentTurn?: number
  maxTurns?: number
  turns?: GoalBasedTurnResult[]
  goalAchieved?: boolean

  startTime: number
  endTime?: number

  model: string           // Chat model used
  evaluatorModel: string  // Evaluator model used

  // Overall evaluation (after all steps complete)
  overallEvaluation?: {
    score: number
    passed: boolean
    reasoning: string
    conversationQuality: string  // "excellent" | "good" | "fair" | "poor"
    goalAchieved: boolean
  }
}

export interface TestStepResult {
  stepId: string
  stepIndex: number

  userMessage: string
  botResponse: string
  richContent?: any  // Rich content from bot response (products, services, etc.)

  correlationId: string  // Links to debug request

  // Technical validation
  technical: {
    intentCorrect: boolean
    intentActual: string
    intentExpected: string | string[]

    confidenceOK: boolean
    confidence: number
    minConfidence: number

    functionsCorrect: boolean
    functionsActual: string[]
    functionsExpected: string[]

    timingOK: boolean
    timeMs: number
    maxTimeMs: number

    noErrors: boolean
    error?: string
  }

  // AI quality evaluation (per-message)
  quality?: {
    score: number  // 0-100
    passed: boolean
    reasoning: string
    model: string  // Which model did the evaluation
  }

  // Overall result
  passed: boolean
  timestamp: number
}

export interface TestRunSummary {
  testRunId: string
  scenarioId: string
  scenarioName: string
  scenarioType?: 'scripted' | 'goal-based'  // NEW
  storeId: string

  timestamp: number
  duration: number  // milliseconds

  model: string
  evaluatorModel: string

  // Results (for scripted tests)
  totalSteps: number
  passedSteps: number
  failedSteps: number
  overallPassed: boolean

  // Goal-based specific
  totalTurns?: number
  goalAchieved?: boolean
  maxTurnsReached?: boolean

  // Performance
  avgQualityScore: number
  totalCost: number

  // Overall AI evaluation
  overallEvaluation?: {
    score: number
    passed: boolean
    reasoning: string
    conversationQuality: string  // "excellent" | "good" | "fair" | "poor"
    goalAchieved: boolean
  }

  // Full details
  steps?: TestStepResult[]      // For scripted tests
  turns?: GoalBasedTurnResult[] // For goal-based tests
}
