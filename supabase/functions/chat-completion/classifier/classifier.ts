// Intent classification with parameter extraction

const OPENROUTER_API_KEY = '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';

export interface Classification {
  intent: string;
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  params: Record<string, any>;
  functionToCall?: string | null;
}

export async function classifyIntent(
  messages: Array<{ role: string; content: string }>,
  context?: any
): Promise<Classification> {
  const lastMessage = messages[messages.length - 1]?.content || '';

  // Build conversation history for context
  const conversationHistory = messages.slice(0, -1)
    .map(m => `${m.role}: ${m.content}`)
    .join('\n');

  // Build store context (if available)
  let storeContext = '';
  if (context?.storeData) {
    const services = context.storeData.services || [];
    const products = context.storeData.products || [];
    const hours = context.storeData.hours || [];

    if (services.length > 0) {
      storeContext += `\nAVAILABLE SERVICES:\n${JSON.stringify(services, null, 2)}`;
    }
    if (products.length > 0) {
      storeContext += `\nAVAILABLE PRODUCTS:\n${JSON.stringify(products, null, 2)}`;
    }
    if (hours.length > 0) {
      storeContext += `\nSTORE HOURS:\n${JSON.stringify(hours, null, 2)}`;
    }
  }

  // Get current date/time for relative date parsing
  const now = new Date();
  const today = now.toISOString().split('T')[0];
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = tomorrow.toISOString().split('T')[0];
  const currentTime = now.toTimeString().split(' ')[0].substring(0, 5);

  // Classification prompt
  const classificationPrompt = `You are an intent classifier for a business chat assistant.

CONVERSATION HISTORY:
${conversationHistory}

${storeContext}

CURRENT MESSAGE: "${lastMessage}"
TODAY'S DATE: ${today}
TOMORROW'S DATE: ${tomorrowStr}
CURRENT TIME: ${currentTime}

Your job is to:
1. Classify the user's intent
2. Extract any parameters mentioned
3. Recommend which function to call

INTENTS:
- BOOKING: User wants to schedule/book
- PRODUCT: User wants to browse/buy products
- INFO: User wants store information
- GREETING: Greeting or small talk
- OTHER: Unclear intent

FUNCTIONS:
- get_store_info: Get store details
- check_availability: Check time slots
- create_booking: Create booking (only when ALL info present)
- get_products: Get product catalog

PARAMETER EXTRACTION:
- service_name: Extract exact service name (match against AVAILABLE SERVICES)
- date: Convert to YYYY-MM-DD:
  * "today" → ${today}
  * "tomorrow" → ${tomorrowStr}
  * "next Monday" → calculate
- time: Convert to HH:MM (24-hour):
  * "2pm" → 14:00
  * "noon" → 12:00
- customer_name: Extract if provided
- email: Extract if provided (valid format)
- phone: Extract if provided

FUNCTION LOGIC:
- "what are your hours?" → get_store_info
- "show me products" → get_products
- user mentions service + date → check_availability
- ALL booking info present → create_booking
- missing info → null

RESPOND WITH JSON ONLY:
{
  "intent": "BOOKING|PRODUCT|INFO|GREETING|OTHER",
  "confidence": "HIGH|MEDIUM|LOW",
  "params": {
    "service_name": "string or null",
    "date": "YYYY-MM-DD or null",
    "time": "HH:MM or null",
    "customer_name": "string or null",
    "email": "string or null",
    "phone": "string or null"
  },
  "functionToCall": "function_name or null"
}`;

  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://heysheets.com',
        'X-Title': 'HeySheets'
      },
      body: JSON.stringify({
        model: 'anthropic/claude-3.5-sonnet',
        messages: [{ role: 'user', content: classificationPrompt }],
        temperature: 0.3
      })
    });

    if (!response.ok) {
      throw new Error(`OpenRouter API error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices[0]?.message?.content;

    if (!content) {
      throw new Error('No response from classification LLM');
    }

    // Parse JSON response (handle potential markdown wrapping)
    let jsonStr = content.trim();
    if (jsonStr.startsWith('```json')) {
      jsonStr = jsonStr.replace(/```json\n?/, '').replace(/\n?```$/, '');
    } else if (jsonStr.startsWith('```')) {
      jsonStr = jsonStr.replace(/```\n?/, '').replace(/\n?```$/, '');
    }

    const classification: Classification = JSON.parse(jsonStr);

    console.log('[Classifier] Result:', {
      intent: classification.intent,
      confidence: classification.confidence,
      function: classification.functionToCall
    });

    return classification;

  } catch (error) {
    console.error('[Classifier] Error:', error);

    // Fallback classification
    return {
      intent: 'OTHER',
      confidence: 'LOW',
      params: {},
      functionToCall: null
    };
  }
}
