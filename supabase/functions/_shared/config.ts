/**
 * SHARED CONFIGURATION
 * ====================
 * Centralized configuration for API settings, model defaults, and pricing.
 * Import this file to maintain consistency across classifier, responder, and orchestrator.
 */

// ============================================================================
// API CONFIGURATION
// ============================================================================

/** OpenRouter API endpoint */
export const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';

/** HTTP Referer for API requests */
export const HTTP_REFERER = 'https://heysheets.com';

/** Application title for API tracking */
export const APP_TITLE = 'HeySheets MVP';

// ============================================================================
// MODEL CONFIGURATION
// ============================================================================

/** Default model for all LLM calls (cost-effective, fast) */
export const DEFAULT_MODEL = 'x-ai/grok-4.1-fast';

/** Default: disable extended reasoning unless explicitly enabled */
export const DEFAULT_REASONING_ENABLED = false;

/** Default reasoning effort when reasoning is enabled */
export const DEFAULT_REASONING_EFFORT: 'low' | 'medium' | 'high' = 'low';

// ============================================================================
// CLASSIFIER CONFIGURATION
// ============================================================================

/** Max tokens for classifier response (structured JSON output) */
export const CLASSIFIER_MAX_TOKENS = 200;

/** Temperature for classifier (low for consistency) */
export const CLASSIFIER_TEMPERATURE = 0.1;

/** Classifier request timeout in milliseconds */
export const CLASSIFIER_TIMEOUT_MS = 30000;

/** Max conversation messages to include for classifier context */
export const CLASSIFIER_MAX_CONTEXT_MESSAGES = 6;

// ============================================================================
// RESPONDER CONFIGURATION
// ============================================================================

/** Max tokens for responder output */
export const RESPONDER_MAX_TOKENS = 400;

/** Temperature for responder (moderate for natural responses) */
export const RESPONDER_TEMPERATURE = 0.5;

/** Max conversation messages to include for responder context */
export const RESPONDER_MAX_CONTEXT_MESSAGES = 6;

// ============================================================================
// SIMPLE MODE CONFIGURATION
// ============================================================================

/** Max tokens for simple mode (raw LLM call) */
export const SIMPLE_MODE_MAX_TOKENS = 500;

/** Temperature for simple mode */
export const SIMPLE_MODE_TEMPERATURE = 0.7;

// ============================================================================
// MODEL PRICING (per million tokens)
// ============================================================================

export interface ModelPricing {
  input: number;
  output: number;
}

export const MODEL_PRICING: Record<string, ModelPricing> = {
  'anthropic/claude-sonnet-4.5': { input: 3.0, output: 15.0 },
  'google/gemini-3-pro-preview': { input: 2.0, output: 12.0 },
  'anthropic/claude-haiku-4.5': { input: 1.0, output: 5.0 },
  'openai/gpt-5.1': { input: 0.30, output: 1.20 },
  'openai/gpt-5.1-chat': { input: 0.30, output: 1.20 },
  'google/gemini-2.5-flash': { input: 0.30, output: 2.50 },
  'deepseek/deepseek-chat-v3.1': { input: 0.27, output: 1.10 },
  'minimax/minimax-m2': { input: 0.26, output: 1.02 },
  'qwen/qwen3-235b-a22b-2507': { input: 0.22, output: 0.95 },
  'x-ai/grok-4.1-fast': { input: 0.20, output: 0.50 },
  'openai/gpt-4o-mini': { input: 0.15, output: 0.60 },
};

/**
 * Get pricing for a model (defaults to Grok 4.1 Fast if not found)
 */
export function getModelPricing(model?: string): ModelPricing {
  if (!model) return MODEL_PRICING[DEFAULT_MODEL];
  return MODEL_PRICING[model] ?? MODEL_PRICING[DEFAULT_MODEL];
}

/**
 * Calculate cost from token usage
 */
export function calculateCost(
  inputTokens: number,
  outputTokens: number,
  model?: string
): number {
  const pricing = getModelPricing(model);
  return (inputTokens / 1_000_000) * pricing.input + (outputTokens / 1_000_000) * pricing.output;
}
