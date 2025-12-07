import { Classification, Message, StoreData } from '../_shared/types.ts';

// ============================================================================
// STRUCTURED OUTPUT SCHEMA
// ============================================================================

const ClassificationSchema = {
  type: "object",
  properties: {
    intent: {
      type: "string",
      enum: ["SERVICE_INQUIRY", "PRODUCT_INQUIRY", "INFO_REQUEST", "BOOKING_REQUEST", "LEAD_GENERATION", "RECOMMENDATION_REQUEST", "GREETING", "OTHER"]
    },
    confidence: {
      type: "number",
      minimum: 0,
      maximum: 100,
      description: "Confidence level: 0-70 low (ask clarification), 70-85 medium (confirm), 85-100 high (proceed)"
    },
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
      enum: ["get_store_info", "get_services", "get_products", "submit_lead", "get_misc_data", "check_availability", "create_booking", "get_booking_slots", "get_recommendations", "null"],
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
    reasoning: {
      type: "string",
      description: "Brief explanation of classification decision"
    },
    user_language: {
      type: "string",
      description: "ISO 639-1 language code detected from user input (e.g., 'en', 'es', 'fr', 'ja', 'zh', 'de', 'pt', 'ko')"
    }
  },
  required: ["intent", "confidence", "needs_clarification", "function_to_call", "extracted_params", "reasoning", "user_language"],
  additionalProperties: false
} as const;

// ============================================================================
// CLASSIFIER FUNCTION
// ============================================================================

export async function classifyIntent(
  messages: Message[],
  context?: { storeData?: StoreData },
  model?: string,
  options?: { reasoningEnabled?: boolean; includeStoreData?: boolean; architectureMode?: string; functionName?: string }
): Promise<{ classification: Classification; usage: { input: number; output: number } }> {
  const OPENROUTER_API_KEY = Deno.env.get('OPENROUTER_API_KEY');

  if (!OPENROUTER_API_KEY) {
    throw new Error('OPENROUTER_API_KEY not configured');
  }

  // Get last message
  const lastMessage = messages[messages.length - 1]?.content || '';

  // Build conversation history (last 3 turns for context windowing)
  const recentMessages = messages.slice(-6); // Last 3 user + 3 assistant messages
  const conversationHistory = recentMessages
    .map(m => `${m.role}: ${m.content}`)
    .join('\n');

  // Build store context
  let storeContext = '';
  if (context?.storeData) {
    const { services = [], products = [], hours = [] } = context.storeData;

    // Context windowing: Only include high-level overview
    storeContext = `
AVAILABLE SERVICES (${services.length} total):
${services.slice(0, 5).map(s => `- ${s.serviceName} (${s.category || 'General'}): $${s.price || 'N/A'}`).join('\n')}
${services.length > 5 ? `... and ${services.length - 5} more services` : ''}

AVAILABLE PRODUCTS (${products.length} total):
${products.slice(0, 5).map(p => `- ${p.name} (${p.category || 'General'}): $${p.price || 'N/A'}`).join('\n')}
${products.length > 5 ? `... and ${products.length - 5} more products` : ''}

BUSINESS HOURS:
${hours.map(h => `${h.day}: ${h.isOpen ? `${h.openTime} - ${h.closeTime}` : 'Closed'}`).join('\n')}
`;
  }

  // Get today's date
  const today = new Date();
  const todayStr = today.toISOString().split('T')[0]; // YYYY-MM-DD
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = tomorrow.toISOString().split('T')[0];

  // Build classification prompt
  const classificationPrompt = `You are an intent classifier for a business chat assistant.

CONVERSATION HISTORY (recent turns only):
${conversationHistory}

${storeContext}

CURRENT MESSAGE: "${lastMessage}"
TODAY'S DATE: ${todayStr}
TOMORROW'S DATE: ${tomorrowStr}

INTENTS:
- SERVICE_INQUIRY: User asking about services/classes (wants details or to browse)
- PRODUCT_INQUIRY: User asking about products for sale (wants details or to browse)
- INFO_REQUEST: User wants general store information (hours, location, contact, policies)
- BOOKING_REQUEST: User wants to book/schedule a service
- LEAD_GENERATION: User wants to be contacted or leave their information
- RECOMMENDATION_REQUEST: User wants personalized suggestions/recommendations (e.g., "what should I try?", "recommend something for a beginner", "help me choose")
- GREETING: Greeting, small talk, or social niceties
- OTHER: Unclear intent or off-topic

FUNCTIONS:
- get_store_info: Get store details, hours, general info (returns overview with all services/products)
- get_services: Search and filter services with semantic matching (user wants service details)
- get_products: Search and filter products with semantic matching (user wants product details)
- submit_lead: Capture user contact information and interest
- get_misc_data: Access custom tabs like FAQ, Policies, etc. (if user asks about topics not in standard tabs)
- check_availability: Check if a service is available at a specific date/time (requires service_name, date, time)
- create_booking: Create an actual booking with calendar invite (requires service_name, date, time, customer_name, customer_email)
- get_booking_slots: Show visual booking calendar with available times. Use when:
  * User wants to book but hasn't specified complete date/time
  * User says "book", "schedule", "reserve" without all details
  * Always prefer this over asking text questions about availability
  Parameters: service_name (required), prefill_date, prefill_time, prefill_name, prefill_email
  Extract any details user mentioned and pass as prefill_* params
- get_recommendations: Get personalized recommendations based on user preferences. Use when:
  * User asks for suggestions, recommendations, or help choosing
  * User says "what should I try?", "recommend something", "help me decide", "I'm new, what do you suggest?"
  * User describes their needs/goals and wants matching options
  Parameters: goal (what they're looking for), experience_level (beginner/intermediate/advanced), budget (low/medium/high), time_preference (morning/afternoon/evening), category

PARAMETER EXTRACTION RULES:
- info_type: 'hours' | 'services' | 'products' | 'all' (for get_store_info)
- query: User's search term or description (for get_services, get_products) - can be vague like "sake" or "beginner pottery"
- category: Specific category name if mentioned explicitly (for get_products)
- tab_name: Custom tab name if user asks about FAQ, Policies, etc. (for get_misc_data)
- name, email, phone, message: Contact details (for submit_lead)
- service_name: Service name for booking (for check_availability, create_booking)
- date: Date in YYYY-MM-DD format (for check_availability, create_booking) - parse relative dates like "tomorrow" or "next Monday"
- time: Time in HH:MM format (for check_availability, create_booking)
- customer_name, customer_email, customer_phone: Customer details (for create_booking)

FORM DATA EXTRACTION:
When the message contains key="value" patterns (e.g., 'submit_lead name="John" email="john@example.com"'), extract ALL key-value pairs into extracted_params. This includes any dynamic field names.

CONFIDENCE SCORING:
- 0-70 (LOW): Ambiguous intent, missing information, or unclear what user wants → needs_clarification = true
- 70-85 (MEDIUM): Likely intent identified but could use confirmation → needs_clarification = false, but suggest confirmation
- 85-100 (HIGH): Crystal clear intent and all required information present → needs_clarification = false

CRITICAL RULES:
1. For LEAD_GENERATION intent, ALWAYS call submit_lead (even if contact info is missing - the function will return a form)
2. Use get_services/get_products for browsing/searching (they handle semantic matching)
3. Use get_store_info for general questions ("what do you offer?", "tell me about your studio")
4. Parse relative dates ("tomorrow", "next Monday") into YYYY-MM-DD format
5. Extract query parameter generously - even vague terms like "sake", "beginner", "functional" are useful
6. If confidence < 70 AND not LEAD_GENERATION, provide a specific clarification_question
7. Never hallucinate information - only extract what user actually said
8. For RECOMMENDATION_REQUEST intent, ALWAYS call get_recommendations (even if preferences are sparse - the function will collect them)

BOOKING FLOW:
- If user wants to book a service → ALWAYS use get_booking_slots (shows visual calendar picker)
  * "Book pottery" → get_booking_slots(service_name="pottery")
  * "Book pottery Tuesday" → get_booking_slots(service_name="pottery", prefill_date="2025-12-02")
  * "Book pottery Tuesday 2pm" → get_booking_slots(service_name="pottery", prefill_date="2025-12-02", prefill_time="14:00")
  * "I'm Max, max@email.com, book pottery" → get_booking_slots with prefill_name and prefill_email
- If user asks "is X available on Y at Z?" → check_availability (just checking, not booking)
- If user provides ALL booking details in exact format "Book X on YYYY-MM-DD at HH:MM. Name: Y, Email: Z" → create_booking (this is from calendar UI)
- NEVER call create_booking without customer_name AND customer_email
- PREFER get_booking_slots over check_availability when user expresses intent to book

RECOMMENDATION FLOW:
- If user wants personalized suggestions → ALWAYS use get_recommendations
  * "What should I try?" → get_recommendations()
  * "I'm a beginner, what do you recommend?" → get_recommendations(experience_level="beginner")
  * "Recommend something relaxing under $50" → get_recommendations(goal="relaxing", budget="low", budget_max=50)
  * "Help me choose a class for evening" → get_recommendations(offering_type="services", time_preference="evening")
  * "What's good for fitness?" → get_recommendations(goal="fitness")
- Extract preferences generously: experience level, budget, time preference, and any stated goals/interests
- The function will show a preference form if not enough info is provided

LANGUAGE DETECTION:
- Detect the language of the user's CURRENT MESSAGE
- Use ISO 639-1 language codes (e.g., 'en' for English, 'es' for Spanish, 'fr' for French, 'ja' for Japanese, 'zh' for Chinese, 'de' for German, 'pt' for Portuguese, 'ko' for Korean)
- Default to 'en' if unsure

REQUIRED OUTPUT FORMAT (exact field names):
{
  "intent": "SERVICE_INQUIRY" | "PRODUCT_INQUIRY" | "INFO_REQUEST" | "BOOKING_REQUEST" | "LEAD_GENERATION" | "RECOMMENDATION_REQUEST" | "GREETING" | "OTHER",
  "confidence": 0-100,
  "needs_clarification": true | false,
  "clarification_question": "string or null",
  "function_to_call": "get_store_info" | "get_services" | "get_products" | "submit_lead" | "get_misc_data" | "check_availability" | "create_booking" | "get_booking_slots" | "get_recommendations" | null,
  "extracted_params": { /* object with extracted parameters */ },
  "reasoning": "string",
  "user_language": "ISO 639-1 code (e.g., 'en', 'es', 'fr', 'ja')"
}

CRITICAL: Use "function_to_call" NOT "function", and "extracted_params" NOT "parameters"!

RESPOND WITH JSON ONLY (no markdown, no explanations):`;

  // Call OpenRouter API with JSON object mode (more reliable than strict schema)
  // Strict json_schema mode can cause gibberish responses with OpenRouter
  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
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
      max_tokens: 500 // Limit response size
    })
  });

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
