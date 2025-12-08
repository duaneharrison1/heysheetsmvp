/**
 * CLASSIFIER PROMPT - SINGLE SOURCE OF TRUTH
 * ==========================================
 *
 * This file defines the classification prompt used to determine user intent
 * and extract parameters. It's separated from the classifier logic for easy
 * editing and maintenance.
 *
 * To modify the prompt:
 * 1. Edit the SLIM_PROMPT constant below
 * 2. Save the file
 * 3. No code changes needed - index.ts imports from here
 *
 * Token metrics (slim version):
 * - Static text: ~248 tokens
 * - With context: ~408 tokens total
 * - Savings vs verbose: ~625 tokens per request (-60%)
 * - Cost savings: ~$0.125 per 1,000 requests (Grok 4.1 Fast)
 */

/**
 * Slim prompt for intent classification (PRODUCTION VERSION)
 * Optimized for cost/latency while maintaining accuracy.
 * Removes verbose explanations, keeps essential decision logic.
 */
export const SLIM_PROMPT = (
  conversationHistory: string,
  lastMessage: string,
  todayStr: string,
  tomorrowStr: string
) => `Classify user intent and extract parameters for function calling.

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

/**
 * Verbose prompt for reference and documentation
 * Used for understanding the original detailed specification
 * To use this instead of SLIM_PROMPT, update index.ts to call VERBOSE_PROMPT()
 */
export const VERBOSE_PROMPT = (
  conversationHistory: string,
  lastMessage: string,
  todayStr: string,
  tomorrowStr: string
) => `You are a tool classifier for a business chat assistant.

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
