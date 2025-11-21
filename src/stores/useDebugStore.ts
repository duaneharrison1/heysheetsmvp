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

  getFilteredRequests: () => DebugRequest[]
  getAverageTTFT: () => number
  getTotalCost: () => number
}

export const useDebugStore = create<DebugStore>((set, get) => ({
  requests: [],
  isVisible: true,
  isPanelOpen: false, // Closed by default
  selectedModel: typeof localStorage !== 'undefined'
    ? localStorage.getItem('heysheets-debug-model') || 'anthropic/claude-3.5-sonnet'
    : 'anthropic/claude-3.5-sonnet',
  filters: { status: 'all', model: 'all' },

  addRequest: (request) =>
    set((state) => ({
      requests: [request, ...state.requests].slice(0, 100),
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

  clearHistory: () => set({ requests: [] }),

  getFilteredRequests: () => {
    const { requests, filters } = get()
    return requests.filter(
      (req) =>
        (filters.status === 'all' || req.status === filters.status) &&
        (filters.model === 'all' || req.model === filters.model)
    )
  },

  getAverageTTFT: () => {
    const requests = get().requests.filter((r) => r.timings.intentDuration)
    if (requests.length === 0) return 0
    const sum = requests.reduce((acc, r) => acc + (r.timings.intentDuration || 0), 0)
    return Math.round(sum / requests.length)
  },

  getTotalCost: () => {
    return get().requests.reduce((acc, r) => acc + (r.cost?.total || 0), 0)
  },
}))
