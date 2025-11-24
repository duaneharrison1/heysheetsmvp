// Test Scenario Definition
export interface TestScenario {
  id: string
  name: string
  description: string
  storeId?: string  // Optional, use current store if not specified

  steps: TestStep[]

  evaluation?: {
    criteria: string[]  // Overall evaluation criteria
    minQualityScore?: number
  }
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

// Test Execution State
export interface TestExecution {
  testRunId: string
  scenarioId: string
  scenarioName: string
  status: 'running' | 'paused' | 'stopped' | 'complete' | 'error'

  currentStepIndex: number
  totalSteps: number

  startTime: number
  endTime?: number

  results: TestStepResult[]

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
  storeId: string

  timestamp: number
  duration: number  // milliseconds

  model: string
  evaluatorModel: string

  // Results
  totalSteps: number
  passedSteps: number
  failedSteps: number
  overallPassed: boolean

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
  steps: TestStepResult[]
}
