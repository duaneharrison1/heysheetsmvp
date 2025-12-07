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
// PROMPT BUILDER
// ============================================================================

function buildClassificationPrompt(
  conversationHistory: string,
  lastMessage: string,
  todayStr: string,
  tomorrowStr: string
): string {
  return `You are a tool classifier for a business chat assistant.

CONVERSATION HISTORY (recent turns only):
${conversationHistory}

CURRENT MESSAGE: "${lastMessage}"
TODAY'S DATE: ${todayStr}
TOMORROW'S DATE: ${tomorrowStr}

FUNCTIONS:
- get_store_info: Get store details, hours, general info. Use for "what do you offer?", "tell me about your studio"
- get_services: Get ALL services (no filtering). Use when browsing all services.
- get_products: Get ALL products (no filtering). Use when browsing all products.
- search_services: Search services with semantic matching. Requires query param. Use for specific terms like "beginner", "relaxing", "pottery for kids".
- search_products: Search products with semantic matching. Requires query param.
- submit_lead: Capture contact info. ALWAYS call this for lead generation (returns form if info missing).
- get_misc_data: Access custom tabs (FAQ, Policies, etc.) for topics not in standard tabs.
- check_availability: Check if service available at specific date/time. Use ONLY for availability questions, NOT booking intent.
- create_booking: Create booking with calendar invite. ONLY use when ALL fields present: service_name, date, time, customer_name, customer_email.
- get_booking_slots: Show visual booking calendar. ALWAYS use for booking intent. Pass any mentioned details as prefill_* params.
- get_recommendations: Get personalized suggestions. ALWAYS use when user asks for recommendations, help choosing, or describes needs.

BOOKING RULES:
- Booking intent → get_booking_slots (NOT check_availability)
- "Is X available on Y at Z?" → check_availability
- Complete booking from calendar UI (all fields present) → create_booking
- NEVER call create_booking without customer_name AND customer_email

PARAMETERS:
- info_type: 'hours' | 'services' | 'products' | 'all' (get_store_info)
- query: Search term (search_services, search_products)
- category: Category name (get_products)
- tab_name: Custom tab name (get_misc_data)
- service_name, date (YYYY-MM-DD), time (HH:MM): For availability/booking
- customer_name, customer_email, customer_phone: For create_booking
- prefill_date, prefill_time, prefill_name, prefill_email: For get_booking_slots
- goal, experience_level, budget, budget_max, time_preference, category: For get_recommendations
- name, email, phone, message: For submit_lead

EXTRACTION RULES:
- Parse relative dates ("tomorrow", "next Monday") into YYYY-MM-DD
- Extract key="value" patterns into extracted_params
- Never hallucinate - only extract what user actually said
- For greetings ("hi", "hello"), respond conversationally without tools

LANGUAGE DETECTION:
- Detect the language of the user's CURRENT MESSAGE
- Use ISO 639-1 language codes (e.g., 'en' for English, 'es' for Spanish, 'fr' for French, 'ja' for Japanese, 'zh' for Chinese, 'de' for German, 'pt' for Portuguese, 'ko' for Korean)
- Default to 'en' if unsure

REQUIRED OUTPUT FORMAT (exact field names):
{
  "needs_clarification": true | false,
  "clarification_question": "string or null",
  "function_to_call": "get_store_info" | "get_services" | "get_products" | "search_services" | "search_products" | "submit_lead" | "get_misc_data" | "check_availability" | "create_booking" | "get_booking_slots" | "get_recommendations" | null,
  "extracted_params": { /* object with extracted parameters */ },
  "user_language": "ISO 639-1 code (e.g., 'en', 'es', 'fr', 'ja')"
}

CRITICAL: Use "function_to_call" NOT "function", and "extracted_params" NOT "parameters"!

RESPOND WITH JSON ONLY (no markdown, no explanations):`;
}

// ============================================================================
// RESPONSE PARSER
// ============================================================================

function parseClassificationResponse(rawContent: string): Classification {
  // Clean up response - remove markdown code blocks if present
  let content = rawContent.trim();
  if (content.startsWith('```json')) {
    content = content.replace(/^```json\s*/, '').replace(/\s*```$/, '');
  } else if (content.startsWith('```')) {
    content = content.replace(/^```\s*/, '').replace(/\s*```$/, '');
  }

  // Parse JSON
  let classification;
  try {
    classification = JSON.parse(content);
  } catch (parseError) {
    console.error('[Classifier] Failed to parse JSON response');
    console.error('[Classifier] Raw content:', content);

    if (content.length < 50 || !content.includes('{')) {
      throw new Error(`LLM returned invalid response: ${content.substring(0, 100)}`);
    }
    throw new Error(`Invalid JSON from LLM: ${parseError instanceof Error ? parseError.message : String(parseError)}`);
  }

  // Normalize field names (handle legacy format)
  if (!classification.extracted_params && classification.parameters) {
    classification.extracted_params = classification.parameters;
    delete classification.parameters;
  }

  // Default user_language to 'en' if not detected
  if (!classification.user_language) {
    classification.user_language = 'en';
  }

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
        reasoning: { enabled: false },
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

  console.log('[Classifier] Raw LLM response (first 200 chars):', rawContent.substring(0, 200));

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
