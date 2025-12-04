/**
 * Model Reasoning Configuration
 *
 * Maps model IDs to their reasoning capabilities.
 * OpenRouter provides a unified `reasoning` parameter, but not all models support it.
 */

export interface ModelReasoningConfig {
  supportsReasoning: boolean;
  reasoningParam?: 'unified' | 'unified_enabled' | 'legacy_deepseek';
  defaultEffort?: 'low' | 'medium' | 'high';
}

export const MODEL_REASONING_CONFIG: Record<string, ModelReasoningConfig> = {
  // Models that DON'T support reasoning
  'openai/gpt-4o-mini': { supportsReasoning: false },
  'openai/gpt-4o': { supportsReasoning: false },
  'openai/gpt-4-turbo': { supportsReasoning: false },
  'meta-llama/llama-3.1-70b-instruct': { supportsReasoning: false },
  'google/gemini-flash-1.5': { supportsReasoning: false },

  // xAI Grok - use simple enabled flag (not effort)
  'x-ai/grok-2': {
    supportsReasoning: true,
    reasoningParam: 'unified_enabled',
  },
  'x-ai/grok-4.1-fast': {
    supportsReasoning: true,
    reasoningParam: 'unified_enabled',
  },

  // Anthropic - full support
  'anthropic/claude-3.5-sonnet': {
    supportsReasoning: true,
    reasoningParam: 'unified',
    defaultEffort: 'medium'
  },
  'anthropic/claude-3.7-sonnet': {
    supportsReasoning: true,
    reasoningParam: 'unified',
    defaultEffort: 'medium'
  },
  'anthropic/claude-sonnet-4': {
    supportsReasoning: true,
    reasoningParam: 'unified',
    defaultEffort: 'medium'
  },

  // DeepSeek - legacy parameter for R1, unified for chat
  'deepseek/deepseek-r1': {
    supportsReasoning: true,
    reasoningParam: 'legacy_deepseek'
  },
  'deepseek/deepseek-chat-v3.1': {
    supportsReasoning: true,
    reasoningParam: 'unified',
    defaultEffort: 'medium'
  },

  // Google thinking models
  'google/gemini-2.0-flash-thinking-exp': {
    supportsReasoning: true,
    reasoningParam: 'unified'
  },
};

/**
 * Check if a model supports reasoning
 */
export function modelSupportsReasoning(modelId: string): boolean {
  return MODEL_REASONING_CONFIG[modelId]?.supportsReasoning ?? false;
}

/**
 * Get reasoning config for a model
 */
export function getReasoningConfig(modelId: string): ModelReasoningConfig {
  return MODEL_REASONING_CONFIG[modelId] ?? { supportsReasoning: false };
}

/**
 * List of model IDs that support reasoning (for frontend use)
 */
export const MODELS_WITH_REASONING = Object.entries(MODEL_REASONING_CONFIG)
  .filter(([_, config]) => config.supportsReasoning)
  .map(([modelId]) => modelId);
