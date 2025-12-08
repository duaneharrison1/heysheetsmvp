/**
 * RESPONDER MODULE
 * ================
 * Generates natural language responses based on classification and function results.
 * Uses OpenRouter API with configurable models.
 */

import { Classification, Message, FunctionResult, StoreConfig } from '../_shared/types.ts';
import { slimForResponder, slimConversationHistory } from '../_shared/slim.ts';
import {
  OPENROUTER_API_URL,
  DEFAULT_MODEL,
  RESPONDER_MAX_TOKENS,
  RESPONDER_TEMPERATURE,
  RESPONDER_MAX_CONTEXT_MESSAGES,
} from '../_shared/config.ts';

// ============================================================================
// TYPES
// ============================================================================

export interface ResponderOptions {
  /** Enable extended reasoning for supported models (adds latency) */
  reasoningEnabled?: boolean;
  /** Mode describing output formatting/architecture preferences */
  architectureMode?: string;
  /** Function name that was executed (for context) */
  functionName?: string;
}

export interface ResponderResult {
  text: string;
  suggestions: string[];
  usage: { input: number; output: number };
}

// ============================================================================
// PROMPT BUILDERS
// ============================================================================

/** Build store context string for prompt */
function buildStoreContext(store?: StoreConfig): string {
  if (!store) return 'Store: Unknown';
  const parts = [`Store: ${store.name || 'Unknown'}`, `Type: ${store.type || 'general'}`];
  if (store.description) parts.push(`About: ${store.description}`);
  return parts.join(' | ');
}

/** Build conversation history string (limited to recent messages, slimmed) */
function buildConversationHistory(messages: Message[]): string {
  const recentMessages = messages.slice(-RESPONDER_MAX_CONTEXT_MESSAGES);
  return slimConversationHistory(recentMessages);
}

/** Build function result context for prompt */
function buildFunctionContext(result?: FunctionResult, functionName?: string): string {
  if (!result) return '';

  const prefix = functionName ? `[${functionName}] ` : '';

  if (result.success) {
    // Use shared slim function for consistent token reduction
    const slimmedData = functionName
      ? slimForResponder(functionName, result.data || result)
      : result.data || result;
    // Compact JSON to save tokens
    return `\n\n${prefix}DATA:\n${JSON.stringify(slimmedData)}`;
  }

  if (result.needs_clarification) {
    return `\n\n${prefix}NEEDS INFO: ${result.message || 'More information required'}`;
  }

  return `\n\n${prefix}ERROR: ${result.error || 'Operation failed'}`;
}

/** Build language instruction if non-English */
function buildLanguageInstruction(language?: string): string {
  if (!language || language === 'en') return '';
  return `\n\nRespond entirely in ${language}.`;
}

/** Build complete prompt for response generation */
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

// ============================================================================
// REQUEST BUILDER
// ============================================================================

/** Build API request body */
function buildRequestBody(prompt: string, model: string): Record<string, unknown> {
  return {
    model,
    messages: [{ role: 'user', content: prompt }],
    max_tokens: RESPONDER_MAX_TOKENS,
    temperature: RESPONDER_TEMPERATURE,
    reasoning: { enabled: false },
  };
}

// ============================================================================
// RESPONSE PARSER
// ============================================================================

/** Parse API response and extract text/suggestions */
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

// ============================================================================
// MAIN FUNCTION
// ============================================================================

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
  const responderStart = performance.now();
  const timing: Record<string, number> = {};

  const OPENROUTER_API_KEY = Deno.env.get('OPENROUTER_API_KEY');
  if (!OPENROUTER_API_KEY) {
    throw new Error('OPENROUTER_API_KEY not configured');
  }

  // Build prompt and request (with timing)
  const promptBuildStart = performance.now();
  const prompt = buildPrompt(messages, classification, functionResult, store, options);
  const selectedModel = model || DEFAULT_MODEL;
  const requestBody = buildRequestBody(prompt, selectedModel);
  timing.promptBuild = performance.now() - promptBuildStart;

  // Call OpenRouter API (with timing)
  const apiCallStart = performance.now();
  const response = await fetch(OPENROUTER_API_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(requestBody),
  });
  timing.apiCall = performance.now() - apiCallStart;

  if (!response.ok) {
    const error = await response.text();
    console.error('[Responder] API error:', error);
    throw new Error(`Response generation failed: ${response.statusText}`);
  }

  const parseStart = performance.now();
  const result = await response.json();
  timing.jsonParse = performance.now() - parseStart;

  const responseParseStart = performance.now();
  const parsedResponse = parseResponse(result);
  timing.responseParse = performance.now() - responseParseStart;

  const totalDuration = performance.now() - responderStart;
  console.log(`[Responder] ⏱️ TIMING: promptBuild=${timing.promptBuild.toFixed(0)}ms, apiCall=${timing.apiCall.toFixed(0)}ms, jsonParse=${timing.jsonParse.toFixed(0)}ms, responseParse=${timing.responseParse.toFixed(0)}ms, total=${totalDuration.toFixed(0)}ms`);

  return parsedResponse;
}