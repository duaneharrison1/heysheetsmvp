/**
 * CLASSIFIER MODULE
 * =================
 * Classifies user intent and extracts parameters for function calling.
 * Uses OpenRouter's native json_schema structured output for reliable parsing.
 */

import {
  Classification,
  ClassifierFunction,
  ExtractedParams,
  Message,
  StoreData,
} from '../_shared/types.ts';
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
// CLASSIFICATION SCHEMA
// ============================================================================

/** Valid function values for classification */
const VALID_FUNCTIONS = [
  'get_store_info',
  'get_services',
  'get_products',
  'search_services',
  'search_products',
  'submit_lead',
  'get_misc_data',
  'check_availability',
  'create_booking',
  'get_booking_slots',
  'get_recommendations',
  'null',
] as const;

/** Pre-computed prompt string - avoids JSON.stringify overhead at runtime */
const CLASSIFIER_PROMPT = `FUNCTIONS & PARAMS:

Select from the ${VALID_FUNCTIONS} and refer the instructions below for parameter extraction and usage guide

get_store_info(info_type) → info_type: hours|services|products|all
get_services → no params
get_products → no params
search_services(query) → query: search term
search_products(query) → query: search term
submit_lead → name, email, phone, message
get_misc_data(tab_name) → tab_name: FAQ, policies, etc.
check_availability → service_name, date (YYYY-MM-DD), time (HH:MM)
get_booking_slots → service_name, date, time
create_booking → service_name, date, time, name, email, phone, (ALL required)
get_recommendations → goal, experience_level, budget, budget_max, category, offering_type, time_preference, day_preference, duration_preference
null → conversational response, no tool needed


WHEN TO USE:
• Store info/hours/location/contact/"what do you offer" → get_store_info
• Browse all services/products → get_services or get_products
• Specific search terms ("beginner", "relaxing", "pottery for kids") → search_services/search_products
• Lead/contact form → submit_lead
• FAQ/policies/custom tabs → get_misc_data
• "Is X available at Y?" → check_availability
• Booking intent → get_booking_slots (NOT check_availability)
• User needs help deciding → get_recommendations
• Greetings/clarification/follow-up → null

RULES:
1. create_booking ONLY when name AND email are present
2. Dates: YYYY-MM-DD, Times: HH:MM
3. Extract ONLY explicitly stated info
4. user_language: ISO 639-1 code (default 'en')

OUTPUT JSON:
{"needs_clarification":bool,"clarification_question":str|null,"function_to_call":str|null,"extracted_params":{...},"user_language":"xx"}`;

// ============================================================================
// PROMPT BUILDER
// ============================================================================

/**
 * Builds classification prompt with behavioral rules and expected JSON format.
 */
function buildClassificationPrompt(
  conversationHistory: string,
  lastMessage: string,
  todayStr: string,
  tomorrowStr: string
): string {
  return `Classify intent. Today: ${todayStr}, Tomorrow: ${tomorrowStr}

HISTORY:
${conversationHistory || 'None'}

MESSAGE: "${lastMessage}"

${CLASSIFIER_PROMPT}
`;}

// ============================================================================
// RESPONSE PARSER
// ============================================================================

/**
 * Parses the LLM JSON response into a Classification object.
 */
function parseClassificationResponse(rawContent: string): Classification {
  const parsed = JSON.parse(rawContent);
  
  return {
    needs_clarification: parsed.needs_clarification ?? false,
    clarification_question: parsed.clarification_question ?? undefined,
    function_to_call: parsed.function_to_call === 'null' ? null : (parsed.function_to_call ?? null),
    extracted_params: parsed.extracted_params ?? {},
    user_language: parsed.user_language ?? 'en',
  };
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
  const OPENROUTER_API_KEY = Deno.env.get('OPENROUTER_API_KEY');
  if (!OPENROUTER_API_KEY) {
    throw new Error('OPENROUTER_API_KEY not configured');
  }

  console.log(`[Classifier] reasoningEnabled: ${options?.reasoningEnabled ?? false}`);

  // Build conversation context
  const lastMessage = messages[messages.length - 1]?.content || '';
  const recentMessages = messages.slice(-CLASSIFIER_MAX_CONTEXT_MESSAGES);
  const conversationHistory = recentMessages.map(m => `${m.role}: ${m.content}`).join('\n');

  // Get date context
  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = tomorrow.toISOString().split('T')[0];

  // Build prompt
  const prompt = buildClassificationPrompt(conversationHistory, lastMessage, todayStr, tomorrowStr);

  // Call OpenRouter API
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), CLASSIFIER_TIMEOUT_MS);

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
      }),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeoutId);
  }

  if (!response.ok) {
    const error = await response.text();
    console.error('[Classifier] OpenRouter API error:', error);
    throw new Error(`Classification failed: ${response.statusText}`);
  }

  const result = await response.json();

  // Validate response structure
  if (!result.choices?.[0]?.message?.content) {
    console.error('[Classifier] Invalid API response structure:', JSON.stringify(result, null, 2));
    throw new Error('OpenRouter API returned unexpected response format');
  }

  const rawContent = result.choices[0].message.content;
  if (!rawContent) {
    throw new Error('OpenRouter API returned empty response');
  }

  //console.log('[Classifier] Raw LLM response (first 200 chars):', rawContent.substring(0, 200));

  // Parse and validate classification
  const classification = parseClassificationResponse(rawContent);
  console.log('[Classifier] Result:', JSON.stringify(classification, null, 2));

  // Extract token usage
  const usage = result.usage || { prompt_tokens: 0, completion_tokens: 0 };
  console.log('[Classifier] Token usage:', usage);

  return {
    classification,
    usage: {
      input: usage.prompt_tokens || 0,
      output: usage.completion_tokens || 0,
    },
  };
}
