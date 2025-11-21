import { create } from 'zustand'

export interface DebugRequest {
  id: string
  timestamp: number
  userMessage: string
  model: string

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
  isVisible: boolean
  isPanelOpen: boolean
  selectedModel: string
  expandedRequest: string | null
  userExpandedRequests: Set<string>
  filters: {
    status: 'all' | 'pending' | 'complete' | 'error'
    model: 'all' | string
  }

  addRequest: (request: DebugRequest) => void
  updateRequest: (id: string, updates: Partial<DebugRequest>) => void
  setModel: (model: string) => void
  setFilter: (key: string, value: any) => void
  togglePanel: () => void
  clearHistory: () => void
  toggleRequestExpanded: (id: string) => void

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
  isVisible: true,
  isPanelOpen: false, // Closed by default
  expandedRequest: null,
  userExpandedRequests: new Set(),
  selectedModel: typeof localStorage !== 'undefined'
    ? localStorage.getItem('heysheets-debug-model') || 'anthropic/claude-3.5-sonnet'
    : 'anthropic/claude-3.5-sonnet',
  filters: { status: 'all', model: 'all' },

  addRequest: (request) =>
    set((state) => ({
      requests: [request, ...state.requests].slice(0, 100),
      // Auto-expand the latest request (most recent)
      expandedRequest: request.id,
    })),

  updateRequest: (id, updates) =>
    set((state) => ({
      requests: state.requests.map((req) =>
        req.id === id ? { ...req, ...updates } : req
      ),
    })),

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
      const isCurrentlyExpanded = state.expandedRequest === id
      const newUserExpanded = new Set(state.userExpandedRequests)

      if (isCurrentlyExpanded) {
        // User is closing it
        newUserExpanded.delete(id)
        return {
          expandedRequest: null,
          userExpandedRequests: newUserExpanded,
        }
      } else {
        // User is opening it
        newUserExpanded.add(id)
        return {
          expandedRequest: id,
          userExpandedRequests: newUserExpanded,
        }
      }
    }),

  clearHistory: () => set({ requests: [], expandedRequest: null, userExpandedRequests: new Set() }),

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
}))
