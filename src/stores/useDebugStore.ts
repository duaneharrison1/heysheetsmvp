import { create } from 'zustand'
import type { TestExecution, TestStepResult } from '@/qa/lib/types'

export interface Message {
  id: string
  type: 'user' | 'bot'
  content: string
  timestamp: number
}

export interface DebugStep {
  name: string
  function: 'classifier' | 'tools' | 'responder' | 'chat-completion' | 'google-sheet'
  status: 'success' | 'error' | 'skipped'
  duration: number
  result?: any
  error?: {
    message: string
    args?: Record<string, any>
  }
  functionCalled?: string // For tools step
}

export interface DebugRequest {
  id: string
  timestamp: number
  userMessage: string
  model: string

  // 🆕 ADD: Step-by-step breakdown
  steps?: DebugStep[]

  intent?: {
    detected: string
    confidence: number
    duration: number
    reasoning?: string
  }

  functionCalls?: Array<{
    name: string
    arguments: Record<string, any>
    result: {
      success: boolean
      data?: any
      error?: string
    }
    duration: number
    cacheHit?: boolean
  }>

  response?: {
    text: string
    richContent?: any
    duration: number
  }

  timings: {
    requestStart: number
    intentDuration?: number
    functionDuration?: number
    responseDuration?: number
    totalDuration?: number
  }

  tokens?: {
    classification?: { input: number; output: number }
    response?: { input: number; output: number }
    total: { input: number; output: number; cached: number }
  }

  cost?: {
    classification?: number
    response?: number
    total: number
  }

  status: 'pending' | 'classifying' | 'executing' | 'responding' | 'complete' | 'error'

  error?: {
    stage: string
    message: string
    stack?: string
  }
}

interface DebugStore {
  requests: DebugRequest[]
  messages: Message[]
  isVisible: boolean
  isPanelOpen: boolean
  selectedModel: string
  expandedRequests: Set<string>
  filters: {
    status: 'all' | 'pending' | 'complete' | 'error'
    model: 'all' | string
  }

  // NEW: Test mode state
  isTestMode: boolean
  selectedScenario: string | null
  currentTest: TestExecution | null
  evaluatorModel: string  // Default to chat model

  addRequest: (request: DebugRequest) => void
  updateRequest: (id: string, updates: Partial<DebugRequest>) => void
  addMessage: (message: Message) => void
  clearMessages: () => void
  setModel: (model: string) => void
  setFilter: (key: string, value: any) => void
  togglePanel: () => void
  clearHistory: () => void
  toggleRequestExpanded: (id: string) => void
  isRequestExpanded: (id: string) => boolean

  // NEW: Test methods
  setTestMode: (enabled: boolean) => void
  setSelectedScenario: (scenarioId: string | null) => void
  setEvaluatorModel: (model: string) => void
  startTest: (execution: TestExecution) => void
  updateTestExecution: (updates: Partial<TestExecution>) => void
  addTestResult: (result: TestStepResult) => void
  completeTest: () => void
  pauseTest: () => void
  stopTest: () => void

  getFilteredRequests: () => DebugRequest[]
  getAverageIntentTime: () => number
  getAverageResponseTime: () => number
  getMinMaxResponseTime: () => { min: number; max: number }
  getMinMaxIntentTime: () => { min: number; max: number }
  getTotalCost: () => number
  getCostBreakdown: () => { requests: number; inputTokens: number; outputTokens: number }
}

export const useDebugStore = create<DebugStore>((set, get) => ({
  requests: [],
  messages: [],
  isVisible: true,
  isPanelOpen: false, // Closed by default
  expandedRequests: new Set(),
  selectedModel: typeof localStorage !== 'undefined'
    ? localStorage.getItem('heysheets-debug-model') || 'anthropic/claude-3.5-sonnet'
    : 'anthropic/claude-3.5-sonnet',
  filters: { status: 'all', model: 'all' },

  // NEW: Test state
  isTestMode: false,
  selectedScenario: null,
  currentTest: null,
  evaluatorModel: 'x-ai/grok-4.1-fast', // Default evaluator model

  addRequest: (request) =>
    set((state) => {
      const newExpanded = new Set(state.expandedRequests)
      // Auto-expand the latest request (most recent)
      newExpanded.add(request.id)
      return {
        requests: [request, ...state.requests].slice(0, 100),
        expandedRequests: newExpanded,
      }
    }),

  updateRequest: (id, updates) =>
    set((state) => ({
      requests: state.requests.map((req) =>
        req.id === id ? { ...req, ...updates } : req
      ),
    })),

  addMessage: (message) =>
    set((state) => ({
      messages: [...state.messages, message],
    })),

  clearMessages: () => set({ messages: [] }),

  setModel: (model) => {
    set({ selectedModel: model })
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('heysheets-debug-model', model)
    }
  },

  setFilter: (key, value) =>
    set((state) => ({
      filters: { ...state.filters, [key]: value },
    })),

  togglePanel: () =>
    set((state) => ({ isPanelOpen: !state.isPanelOpen })),

  toggleRequestExpanded: (id) =>
    set((state) => {
      const newExpanded = new Set(state.expandedRequests)

      if (newExpanded.has(id)) {
        // User is closing it
        newExpanded.delete(id)
      } else {
        // User is opening it
        newExpanded.add(id)
      }

      return {
        expandedRequests: newExpanded,
      }
    }),

  isRequestExpanded: (id) => {
    return get().expandedRequests.has(id)
  },

  clearHistory: () => set({ requests: [], messages: [], expandedRequests: new Set() }),

  getFilteredRequests: () => {
    const { requests, filters } = get()
    return requests.filter(
      (req) =>
        (filters.status === 'all' || req.status === filters.status) &&
        (filters.model === 'all' || req.model === filters.model)
    )
  },

  getAverageIntentTime: () => {
    const requests = get().requests.filter((r) => r.timings.intentDuration)
    if (requests.length === 0) return 0
    const sum = requests.reduce((acc, r) => acc + (r.timings.intentDuration || 0), 0)
    return Math.round(sum / requests.length)
  },

  getAverageResponseTime: () => {
    const requests = get().requests.filter((r) => r.timings.totalDuration)
    if (requests.length === 0) return 0
    const sum = requests.reduce((acc, r) => acc + (r.timings.totalDuration || 0), 0)
    return Math.round(sum / requests.length)
  },

  getMinMaxResponseTime: () => {
    const requests = get().requests.filter((r) => r.timings.totalDuration)
    if (requests.length === 0) return { min: 0, max: 0 }
    const times = requests.map((r) => r.timings.totalDuration || 0)
    return {
      min: Math.round(Math.min(...times)),
      max: Math.round(Math.max(...times)),
    }
  },

  getMinMaxIntentTime: () => {
    const requests = get().requests.filter((r) => r.timings.intentDuration)
    if (requests.length === 0) return { min: 0, max: 0 }
    const times = requests.map((r) => r.timings.intentDuration || 0)
    return {
      min: Math.round(Math.min(...times)),
      max: Math.round(Math.max(...times)),
    }
  },

  getTotalCost: () => {
    return get().requests.reduce((acc, r) => acc + (r.cost?.total || 0), 0)
  },

  getCostBreakdown: () => {
    const requests = get().requests
    const inputTokens = requests.reduce((acc, r) => acc + (r.tokens?.total.input || 0), 0)
    const outputTokens = requests.reduce((acc, r) => acc + (r.tokens?.total.output || 0), 0)
    return {
      requests: requests.length,
      inputTokens,
      outputTokens,
    }
  },

  // NEW: Test methods
  setTestMode: (enabled) =>
    set({
      isTestMode: enabled,
      selectedScenario: enabled ? get().selectedScenario : null,
    }),

  setSelectedScenario: (scenarioId) => set({ selectedScenario: scenarioId }),

  setEvaluatorModel: (model) => set({ evaluatorModel: model }),

  startTest: (execution) =>
    set((state) => ({
      currentTest: execution,
      // Mark all requests from this test
      requests: state.requests.map((r) => ({
        ...r,
        testRunId: execution.testRunId,
      })),
    })),

  updateTestExecution: (updates) =>
    set((state) => ({
      currentTest: state.currentTest
        ? { ...state.currentTest, ...updates }
        : null,
    })),

  addTestResult: (result) =>
    set((state) => {
      if (!state.currentTest) return state

      return {
        currentTest: {
          ...state.currentTest,
          results: [...state.currentTest.results, result],
          currentStepIndex: state.currentTest.currentStepIndex + 1,
        },
      }
    }),

  completeTest: () =>
    set((state) => {
      if (!state.currentTest) return state

      return {
        currentTest: {
          ...state.currentTest,
          status: 'complete',
          endTime: Date.now(),
        },
      }
    }),

  pauseTest: () =>
    set((state) => ({
      currentTest: state.currentTest
        ? { ...state.currentTest, status: 'paused' }
        : null,
    })),

  stopTest: () =>
    set((state) => ({
      currentTest: state.currentTest
        ? { ...state.currentTest, status: 'stopped', endTime: Date.now() }
        : null,
    })),
}))
