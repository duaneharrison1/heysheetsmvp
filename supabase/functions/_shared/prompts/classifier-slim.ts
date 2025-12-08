/**
 * CLASSIFIER SLIM PROMPT
 * ======================
 *
 * Optimized version of the classification prompt for cost/latency reduction.
 * Removes verbose explanations while maintaining accuracy.
 *
 * Token savings: ~60% reduction (~625 tokens per request)
 * Cost savings: ~$0.125 per 1,000 requests (Grok 4.1 Fast)
 */

/**
 * Build a slim classification prompt for intent detection
 */
export function buildSlimClassificationPrompt(
  conversationHistory: string,
  lastMessage: string,
  todayStr: string,
  tomorrowStr: string
): string {
  return `Classify user intent and extract parameters for function calling.

CONVERSATION: ${conversationHistory}
CURRENT: "${lastMessage}"
TODAY: ${todayStr} | TOMORROW: ${tomorrowStr}

FUNCTIONS:
- get_store_info: Store details, hours, info
- get_services: List all services
- get_products: List all products
- search_services: Search services (query param required)
- search_products: Search products (query param required)
- submit_lead: Capture contact info
- get_misc_data: Custom tabs/FAQ/Policies
- check_availability: Check availability at specific date/time
- create_booking: Create booking (requires service_name, date, time, customer_name, customer_email)
- get_booking_slots: Show booking calendar (use for booking intent)
- get_recommendations: Suggest items based on needs

BOOKING:
- "I want to book" or "Can I book" → get_booking_slots
- "Is X available on Y?" → check_availability
- Complete booking from calendar UI → create_booking (needs customer_name & customer_email)

PARAMS (by function):
- get_store_info: info_type ('hours'|'services'|'products'|'all')
- search_*: query (search term)
- get_products: category (optional)
- get_misc_data: tab_name (tab name)
- check_availability/create_booking: service_name, date (YYYY-MM-DD), time (HH:MM)
- create_booking: customer_name, customer_email, customer_phone (optional)
- get_booking_slots: prefill_date, prefill_time, prefill_name, prefill_email
- get_recommendations: goal, experience_level, budget, category, time_preference
- submit_lead: name, email, phone, message

EXTRACTION:
- Parse relative dates to YYYY-MM-DD format
- Extract only what user stated (no hallucination)
- For greetings: respond conversationally, no function

LANGUAGE: Detect user's language (ISO 639-1 code like 'en', 'es', 'fr', 'ja', etc.). Default: 'en'

OUTPUT JSON:
{
  "needs_clarification": boolean,
  "clarification_question": string|null,
  "function_to_call": string|null,
  "extracted_params": object,
  "user_language": string
}

JSON ONLY (no markdown, no explanations):`;
}
