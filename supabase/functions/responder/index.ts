import { Classification, Message, FunctionResult, StoreConfig } from '../_shared/types.ts';

// ============================================================================
// RESPONDER FUNCTION
// Generates natural language responses using OpenRouter API
// ============================================================================

// ----------------------------------------------------------------------------
// CONFIGURATION
// ----------------------------------------------------------------------------

/** Default model for response generation (cost-effective, fast) */
export const DEFAULT_MODEL = 'x-ai/grok-4.1-fast';

/** Max recent messages to include (≈3 conversation turns) */
const MAX_CONTEXT_MESSAGES = 6;

/** Response token limit */
const MAX_TOKENS = 600;

/** Temperature for natural, varied responses */
const DEFAULT_TEMPERATURE = 0.5;

/** OpenRouter API endpoint */
const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';

// ----------------------------------------------------------------------------
// TYPES
// ----------------------------------------------------------------------------

export interface ResponderOptions {
  /** Enable extended reasoning for supported models (adds latency) */
  reasoningEnabled?: boolean;
  /** Mode describing output formatting/architecture preferences (informational) */
  architectureMode?: string;
  /** Function name that was executed (for context) */
  functionName?: string;
}

export interface ResponderResult {
  text: string;
  suggestions: string[];
  usage: { input: number; output: number };
}

// ----------------------------------------------------------------------------
// PROMPT BUILDING HELPERS
// ----------------------------------------------------------------------------

function buildStoreContext(store?: StoreConfig): string {
  if (!store) return 'Store: Unknown';
  const parts = [`Store: ${store.name || 'Unknown'}`, `Type: ${store.type || 'general'}`];
  if (store.description) parts.push(`About: ${store.description}`);
  return parts.join(' | ');
}

function buildConversationHistory(messages: Message[]): string {
  return messages
    .slice(-MAX_CONTEXT_MESSAGES)
    .map(m => `${m.role}: ${m.content}`)
    .join('\n');
}

function buildFunctionContext(result?: FunctionResult, functionName?: string): string {
  if (!result) return '';

  const prefix = functionName ? `[${functionName}] ` : '';

  if (result.success) {
    const data = result.data || result;
    return `\n\n${prefix}DATA:\n${JSON.stringify(data, null, 2)}`;
  }

  if (result.needs_clarification) {
    return `\n\n${prefix}NEEDS INFO: ${result.message || 'More information required'}`;
  }

  return `\n\n${prefix}ERROR: ${result.error || 'Operation failed'}`;
}

function buildLanguageInstruction(language?: string): string {
  if (!language || language === 'en') return '';
  return `\n\nRespond entirely in ${language}.`;
}

function buildPrompt(
  messages: Message[],
  classification: Classification,
  functionResult?: FunctionResult,
  store?: StoreConfig,
  options?: ResponderOptions
): string {
  const storeContext = buildStoreContext(store);
  const conversationHistory = buildConversationHistory(messages);
  const functionContext = buildFunctionContext(functionResult, options?.functionName);
  const languageInstruction = buildLanguageInstruction(classification.user_language);

  return `You are a helpful business assistant for ${store?.name || 'this store'}.

CONTEXT:
${storeContext}
Tool: ${classification.function_to_call || 'none'} | Language: ${classification.user_language || 'en'}

CONVERSATION:
${conversationHistory}
${functionContext}${languageInstruction}

INSTRUCTIONS:
- Be warm, concise (<200 words), and professional
- Present any data naturally; guide user to next steps
- If error occurred, apologize and help recover
- Never mention system internals (tools, functions)
- When listing services/products, show 3-4 highlights maximum, not the full list
- DO NOT include image URLs or markdown images in your response
- Use emojis sparingly and appropriately

Respond in JSON only:
{"response": "...", "suggestions": ["3-5 word follow-up", "another option", "third option"]}`;
}

// ----------------------------------------------------------------------------
// REQUEST BUILDING
// ----------------------------------------------------------------------------

function buildRequestBody(
  prompt: string,
  model: string,
  reasoningEnabled?: boolean
): Record<string, unknown> {
  const body: Record<string, unknown> = {
    model,
    messages: [{ role: 'user', content: prompt }],
    max_tokens: MAX_TOKENS,
    temperature: DEFAULT_TEMPERATURE,
  };

  // Enable extended reasoning for supported models (adds latency but improves quality)
  // See: https://openrouter.ai/docs/use-cases/reasoning
  if (reasoningEnabled) {
    body.reasoning = {
      effort: 'low', // 'low' | 'medium' | 'high'
    };
  }

  return body;
}

// ----------------------------------------------------------------------------
// RESPONSE PARSING
// ----------------------------------------------------------------------------

function parseResponse(result: Record<string, unknown>): ResponderResult {
  const choices = result.choices as Array<{ message: { content: string } }> | undefined;
  const rawContent = choices?.[0]?.message?.content || '';

  let text = rawContent;
  let suggestions: string[] = [];

  // Try JSON parse; extract from markdown fence if needed
  try {
    const jsonMatch = rawContent.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      text = parsed.response || rawContent;
      suggestions = Array.isArray(parsed.suggestions) ? parsed.suggestions.slice(0, 4) : [];
    }
  } catch {
    // Use raw content as fallback
  }

  const usage = (result.usage as { prompt_tokens?: number; completion_tokens?: number }) || {};

  return {
    text,
    suggestions,
    usage: {
      input: usage.prompt_tokens || 0,
      output: usage.completion_tokens || 0,
    },
  };
}

// ----------------------------------------------------------------------------
// MAIN FUNCTION
// ----------------------------------------------------------------------------

/**
 * Generates a conversational response based on context and function results.
 * @param messages - Conversation history
 * @param classification - User intent classification
 * @param functionResult - Optional result from executed function
 * @param store - Store configuration for context
 * @param model - AI model to use (defaults to DEFAULT_MODEL)
 * @param options - Additional options (reasoning, function name)
 */
export async function generateResponse(
  messages: Message[],
  classification: Classification,
  functionResult?: FunctionResult,
  store?: StoreConfig,
  model?: string,
  options?: ResponderOptions
): Promise<ResponderResult> {
  const OPENROUTER_API_KEY = Deno.env.get('OPENROUTER_API_KEY');
  if (!OPENROUTER_API_KEY) {
    throw new Error('OPENROUTER_API_KEY not configured');
  }

  // Build prompt components
  const prompt = buildPrompt(messages, classification, functionResult, store, options);
  const selectedModel = model || DEFAULT_MODEL;

  // Build request body with optional reasoning
  const requestBody = buildRequestBody(prompt, selectedModel, options?.reasoningEnabled);

  // Call OpenRouter API
  const response = await fetch(OPENROUTER_API_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const error = await response.text();
    console.error('[Responder] API error:', error);
    throw new Error(`Response generation failed: ${response.statusText}`);
  }

  const result = await response.json();
  return parseResponse(result);
}