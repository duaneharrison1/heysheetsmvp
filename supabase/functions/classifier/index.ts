import { Classification, Message, StoreData } from '../_shared/types.ts';

// ============================================================================
// STRUCTURED OUTPUT SCHEMA
// ============================================================================

const ClassificationSchema = {
  type: "object",
  properties: {
    needs_clarification: {
      type: "boolean",
      description: "True if confidence < 70 or missing required info"
    },
    clarification_question: {
      type: "string",
      description: "Specific question to ask if needs_clarification is true"
    },
    function_to_call: {
      type: "string",
      enum: ["get_store_info", "get_services", "get_products", "search_services", "search_products", "submit_lead", "get_misc_data", "check_availability", "create_booking", "get_booking_slots", "get_recommendations", "null"],
      description: "Function to execute based on intent"
    },
    extracted_params: {
      type: "object",
      properties: {
        info_type: { type: "string" },
        query: { type: "string" },
        category: { type: "string" },
        tab_name: { type: "string" },
        name: { type: "string" },
        email: { type: "string" },
        phone: { type: "string" },
        message: { type: "string" },
        service_name: { type: "string" },
        date: { type: "string" },
        time: { type: "string" },
        customer_name: { type: "string" },
        customer_email: { type: "string" },
        customer_phone: { type: "string" },
        // Prefill parameters for get_booking_slots
        prefill_date: { type: "string" },
        prefill_time: { type: "string" },
        prefill_name: { type: "string" },
        prefill_email: { type: "string" },
        prefill_phone: { type: "string" },
        // Recommendation parameters
        offering_type: { type: "string" },
        budget: { type: "string" },
        budget_max: { type: "number" },
        experience_level: { type: "string" },
        time_preference: { type: "string" },
        day_preference: { type: "string" },
        duration_preference: { type: "string" },
        goal: { type: "string" }
      },
      description: "Parameters extracted from user message for function calling"
    },
    
    user_language: {
      type: "string",
      description: "ISO 639-1 language code detected from user input (e.g., 'en', 'es', 'fr', 'ja', 'zh', 'de', 'pt', 'ko')"
    }
  },
  required: ["needs_clarification", "function_to_call", "extracted_params", "user_language"],
  additionalProperties: false
} as const;

// ============================================================================
// CLASSIFIER FUNCTION
// ============================================================================

export async function classifyIntent(
  messages: Message[],
  context?: { storeData?: StoreData },
  model?: string,
  options?: {
    reasoningEnabled?: boolean;
    includeStoreData?: boolean;  // For lean mode: false = don't include store overview in prompt
  }
): Promise<{ classification: Classification; usage: { input: number; output: number } }> {
  const OPENROUTER_API_KEY = Deno.env.get('OPENROUTER_API_KEY');

  if (!OPENROUTER_API_KEY) {
    throw new Error('OPENROUTER_API_KEY not configured');
  }

  // Log reasoning setting
  console.log(`[Classifier] reasoningEnabled: ${options?.reasoningEnabled ?? false}`);

  // Get last message
  const lastMessage = messages[messages.length - 1]?.content || '';

  // Build conversation history (last 3 turns for context windowing)
  const recentMessages = messages.slice(-6); // Last 3 user + 3 assistant messages
  const conversationHistory = recentMessages
    .map(m => `${m.role}: ${m.content}`)
    .join('\n');

  // NOTE: Classifier no longer receives store data to keep prompts lean
  // All matching is done by function execution (get_services, search_services, etc.)

  // Get today's date
  const today = new Date();
  const todayStr = today.toISOString().split('T')[0]; // YYYY-MM-DD
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = tomorrow.toISOString().split('T')[0];

  // Build classification prompt
  const classificationPrompt = `You are a tool classifier for a business chat assistant.

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

  // Call OpenRouter API with JSON object mode (more reliable than strict schema)
  // Strict json_schema mode can cause gibberish responses with OpenRouter
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout

  let response;
  try {
    response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://heysheets.com',
        'X-Title': 'HeySheets MVP'
      },
      body: JSON.stringify({
        model: model || 'x-ai/grok-4.1-fast', // Use selected model or default to Grok
        messages: [{ role: 'user', content: classificationPrompt }],
        response_format: { type: "json_object" }, // Looser mode - more reliable with OpenRouter
        temperature: 0.1, // Very low temp for consistency
        max_tokens: 500, // Limit response size
        // Pass reasoning setting from options (defaults to disabled)
        reasoning: { enabled: options?.reasoningEnabled ?? false },
      }),
      signal: controller.signal
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

  // Validate API response structure
  if (!result.choices || !result.choices[0] || !result.choices[0].message) {
    console.error('[Classifier] Invalid API response structure:', JSON.stringify(result, null, 2));
    throw new Error('OpenRouter API returned unexpected response format');
  }

  let rawContent = result.choices[0].message.content;

  // Check for empty or null content
  if (!rawContent) {
    console.error('[Classifier] Empty response from API');
    throw new Error('OpenRouter API returned empty response');
  }

  console.log('[Classifier] Raw LLM response (first 200 chars):', rawContent.substring(0, 200));

  // Clean up response - remove markdown code blocks if present
  rawContent = rawContent.trim();
  if (rawContent.startsWith('```json')) {
    rawContent = rawContent.replace(/^```json\s*/, '').replace(/\s*```$/, '');
  } else if (rawContent.startsWith('```')) {
    rawContent = rawContent.replace(/^```\s*/, '').replace(/\s*```$/, '');
  }

  let classification;
  try {
    classification = JSON.parse(rawContent);
  } catch (parseError) {
    console.error('[Classifier] Failed to parse JSON response');
    console.error('[Classifier] Raw content:', rawContent);
    console.error('[Classifier] Parse error:', parseError);

    // Check if response is completely garbled
    if (rawContent.length < 50 || !rawContent.includes('{')) {
      throw new Error(`LLM returned invalid response (possible API issue): ${rawContent.substring(0, 100)}`);
    }

    throw new Error(`Invalid JSON from LLM: ${parseError instanceof Error ? parseError.message : String(parseError)}`);
  }

  // Fallback: Transform old field names to new ones if needed
  if (!classification.function_to_call && classification.function) {
    console.warn('[Classifier] Detected old schema format, transforming...');
    classification.function_to_call = classification.function;
    delete classification.function;
  }
  if (!classification.extracted_params && classification.parameters) {
    classification.extracted_params = classification.parameters;
    delete classification.parameters;
  }
  // Default user_language to 'en' if not detected
  if (!classification.user_language) {
    classification.user_language = 'en';
  }

  // Validate required fields exist (function_to_call can be null for greetings, extracted_params can be empty {})
  if (!('function_to_call' in classification) || !('extracted_params' in classification)) {
    console.error('[Classifier] Invalid classification format:', classification);
    throw new Error('Classification missing required fields: function_to_call or extracted_params');
  }

  console.log('[Classifier] Result:', JSON.stringify(classification, null, 2));

  // Extract token usage from OpenRouter response
  const usage = result.usage || { prompt_tokens: 0, completion_tokens: 0 };
  console.log('[Classifier] Token usage:', usage);

  return {
    classification: classification as Classification,
    usage: {
      input: usage.prompt_tokens || 0,
      output: usage.completion_tokens || 0,
    },
  };
}
