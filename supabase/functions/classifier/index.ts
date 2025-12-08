/**
 * CLASSIFIER MODULE
 * =================
 * Classifies user intent and extracts parameters for function calling.
 * Uses structured JSON output for reliable parsing.
 */

import { Classification, Message, StoreData } from '../_shared/types.ts';
import {
  OPENROUTER_API_URL,
  HTTP_REFERER,
  APP_TITLE,
  DEFAULT_MODEL,
  CLASSIFIER_MAX_TOKENS,
  CLASSIFIER_TEMPERATURE,
  CLASSIFIER_TIMEOUT_MS,
  CLASSIFIER_MAX_CONTEXT_MESSAGES,
} from '../_shared/config.ts';
import { SLIM_PROMPT, VERBOSE_PROMPT } from './CLASSIFIER_PROMPT.ts';

// ============================================================================
// TYPES
// ============================================================================

export interface ClassifierOptions {
  /** Enable extended reasoning for supported models (adds latency) */
  reasoningEnabled?: boolean;
  /** Include store data in prompt (false for lean mode) */
  includeStoreData?: boolean;
}

export interface ClassifierResult {
  classification: Classification;
  usage: { input: number; output: number };
}

// ============================================================================
// CLASSIFIER PROMPT MANAGEMENT
// ============================================================================
//
// Prompts are defined in CLASSIFIER_PROMPT.ts (single source of truth)
// Editing: modify CLASSIFIER_PROMPT.ts directly - no code changes needed
//
// Available versions:
// - SLIM_PROMPT: Production (60% smaller, ~625 tokens saved per request)
// - VERBOSE_PROMPT: Reference documentation
//
// To switch versions:
// Change classifyIntent() call below from SLIM_PROMPT to VERBOSE_PROMPT()
//

// ============================================================================
// RESPONSE PARSER
// ============================================================================

function parseClassificationResponse(rawContent: string): Classification {
  
  // Clean up response
  let content = rawContent.trim();

  // Parse JSON
  let classification;
  try {
    classification = JSON.parse(content);
  } catch (parseError) {
    console.error('[Classifier] JSON parse failed:', content.substring(0, 100));
    throw new Error(`Invalid JSON from LLM: ${parseError instanceof Error ? parseError.message : String(parseError)}`);
  }

  // Default user_language to 'en' if not detected
  // if (!classification.user_language) {
  //   classification.user_language = 'en';
  // }

  // Validate required fields
  if (!('function_to_call' in classification) || !('extracted_params' in classification)) {
    console.error('[Classifier] Invalid classification format:', classification);
    throw new Error('Classification missing required fields: function_to_call or extracted_params');
  }

  return classification as Classification;
}

// ============================================================================
// MAIN FUNCTION
// ============================================================================

/**
 * Classifies user intent and extracts parameters for function calling.
 * @param messages - Conversation history
 * @param context - Optional context with store data
 * @param model - AI model to use (defaults to DEFAULT_MODEL)
 * @param options - Additional options (reasoning, includeStoreData)
 */
export async function classifyIntent(
  messages: Message[],
  context?: { storeData?: StoreData },
  model?: string,
  options?: ClassifierOptions
): Promise<ClassifierResult> {
  const classifierStart = performance.now();
  const timing: Record<string, number> = {};

  const OPENROUTER_API_KEY = Deno.env.get('OPENROUTER_API_KEY');
  if (!OPENROUTER_API_KEY) {
    throw new Error('OPENROUTER_API_KEY not configured');
  }

  console.log(`[Classifier] reasoningEnabled: ${options?.reasoningEnabled ?? false}`);

  // Build conversation context (with timing)
  const promptBuildStart = performance.now();
  const lastMessage = messages[messages.length - 1]?.content || '';
  const recentMessages = messages.slice(-CLASSIFIER_MAX_CONTEXT_MESSAGES);
  const conversationHistory = recentMessages.map(m => `${m.role}: ${m.content}`).join('\n');

  // Get date context
  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = tomorrow.toISOString().split('T')[0];

  // Build prompt from CLASSIFIER_PROMPT.ts (single source of truth)
  const prompt = SLIM_PROMPT(conversationHistory, lastMessage, todayStr, tomorrowStr);
  timing.promptBuild = performance.now() - promptBuildStart;

  // Call OpenRouter API (with timing)
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), CLASSIFIER_TIMEOUT_MS);

  const apiCallStart = performance.now();
  let response;
  try {
    response = await fetch(OPENROUTER_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': HTTP_REFERER,
        'X-Title': APP_TITLE,
      },
      body: JSON.stringify({
        model: model || DEFAULT_MODEL,
        messages: [{ role: 'user', content: prompt }],
        response_format: { type: 'json_object' },
        temperature: CLASSIFIER_TEMPERATURE,
        max_tokens: CLASSIFIER_MAX_TOKENS,
        reasoning: { enabled: false },
      }),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeoutId);
  }
  timing.apiCall = performance.now() - apiCallStart;

  if (!response.ok) {
    const error = await response.text();
    console.error('[Classifier] OpenRouter API error:', error);
    throw new Error(`Classification failed: ${response.statusText}`);
  }

  const parseStart = performance.now();
  const result = await response.json();
  timing.jsonParse = performance.now() - parseStart;

  // Minimal structural validation: ensure `content` exists and is non-empty
  const rawContent = result?.choices?.[0]?.message?.content;
  if (typeof rawContent !== 'string' || rawContent.trim().length === 0) {
    console.error('[Classifier] Missing or empty content in API response:', JSON.stringify(result?.choices?.[0] ?? result, null, 2));
    throw new Error('OpenRouter API returned unexpected or empty response');
  }

  console.log('[Classifier] Raw LLM response (first 200 chars):', rawContent.substring(0, 200));

  // Parse and validate classification (with timing)
  const classificationParseStart = performance.now();
  const classification = parseClassificationResponse(rawContent);
  timing.classificationParse = performance.now() - classificationParseStart;

  // Extract token usage
  const usage = result.usage || { prompt_tokens: 0, completion_tokens: 0 };

  const totalDuration = performance.now() - classifierStart;
  console.log(`[Classifier] ⏱️ TIMING: promptBuild=${timing.promptBuild.toFixed(0)}ms, apiCall=${timing.apiCall.toFixed(0)}ms, jsonParse=${timing.jsonParse.toFixed(0)}ms, classificationParse=${timing.classificationParse.toFixed(0)}ms, total=${totalDuration.toFixed(0)}ms`);

  return {
    classification,
    usage: {
      input: usage.prompt_tokens || 0,
      output: usage.completion_tokens || 0,
    },
  };
}