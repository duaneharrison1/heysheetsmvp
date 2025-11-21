export const DEBUG_CONFIG = {
  enabled: import.meta.env.DEV,
  maxRequests: 100,

  models: [
    {
      id: 'anthropic/claude-3.5-sonnet',
      name: 'Claude 3.5 Sonnet',
      provider: 'anthropic',
      tier: 'smart',
      isDefault: true,
    },
    {
      id: 'x-ai/grok-beta',
      name: 'Grok Beta',
      provider: 'x-ai',
      tier: 'fast',
      isDefault: false,
    },
    {
      id: 'openai/gpt-4o-mini',
      name: 'GPT-4o Mini',
      provider: 'openai',
      tier: 'balanced',
      isDefault: false,
    },
  ],

  thresholds: {
    ttft: { good: 300, warning: 600, critical: 1000 },
    total: { good: 2000, warning: 3000, critical: 5000 },
  },

  pricing: {
    'anthropic/claude-3.5-sonnet': { input: 3.0, output: 15.0 },
    'x-ai/grok-beta': { input: 0.05, output: 0.15 },
    'openai/gpt-4o-mini': { input: 0.15, output: 0.60 },
  },
} as const
