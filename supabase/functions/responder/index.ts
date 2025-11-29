import { Classification, Message, FunctionResult, StoreConfig } from '../_shared/types.ts';

// ============================================================================
// RESPONDER FUNCTION
// ============================================================================

export interface ResponderResult {
  text: string;
  suggestions: string[];
  usage: { input: number; output: number };
}

export async function generateResponse(
  messages: Message[],
  classification: Classification,
  functionResult?: FunctionResult,
  store?: StoreConfig
): Promise<ResponderResult> {
  const OPENROUTER_API_KEY = Deno.env.get('OPENROUTER_API_KEY');

  if (!OPENROUTER_API_KEY) {
    throw new Error('OPENROUTER_API_KEY not configured');
  }

  // Build conversation history (last 3 turns for context windowing)
  const recentMessages = messages.slice(-6);
  const conversationHistory = recentMessages
    .map(m => `${m.role}: ${m.content}`)
    .join('\n');

  // Build store context
  const storeContext = `
Store Name: ${store?.name || 'Unknown'}
Store Type: ${store?.type || 'general'}
${store?.description ? `Description: ${store.description}` : ''}
`;

  // Build function result context
  let functionContext = '';
  if (functionResult) {
    if (functionResult.success) {
      // Handle both wrapped {success, data} and direct data formats
      const resultData = functionResult.data || functionResult;
      functionContext = `FUNCTION RESULT (Use this data in your response):
${JSON.stringify(resultData, null, 2)}

IMPORTANT: Present this data naturally and conversationally. Don't just list it - weave it into helpful dialogue.`;
    } else if (functionResult.needs_clarification) {
      // Handle clarification needed (not an error!)
      functionContext = `FUNCTION NEEDS MORE INFO:
${functionResult.message || 'Need more information to proceed'}

IMPORTANT: Ask for the missing information naturally and conversationally. This is NOT an error - just ask what you need to know.`;
    } else {
      functionContext = `FUNCTION ERROR:
${functionResult.error || 'Unknown error occurred'}

IMPORTANT: Apologize politely and guide the user on what to do next.`;
    }
  }

  // Build response generation prompt
  const responsePrompt = `You are a helpful, friendly business assistant for this store.

STORE CONTEXT:
${storeContext}

CONVERSATION HISTORY (recent turns only):
${conversationHistory}

USER INTENT: ${classification.intent}
CONFIDENCE: ${classification.confidence}

${functionContext}

Generate a helpful, natural, conversational response based on the above context.

RESPONSE GUIDELINES:
- Be warm, friendly, and professional
- Keep responses concise (under 200 words unless explaining complex details)
- If function data is available, USE IT and present it in a natural, engaging way
- If there was an error, apologize and guide the user
- For low confidence or needs_clarification, ask the clarification question naturally
- Use emojis sparingly and appropriately
- Don't mention internal system details (intents, functions, confidence scores)
- When availability/booking data is provided, present it clearly and guide the user to next steps

${classification.needs_clarification ? `CLARIFICATION NEEDED: ${classification.clarification_question}` : ''}

IMPORTANT: You must respond in JSON format with the following structure:
{
  "response": "Your natural conversational response here",
  "suggestions": ["2-4 short follow-up prompts the user might want to ask next"]
}

The suggestions should be:
- Brief (3-7 words each)
- Contextually relevant to your response and the conversation
- Actionable prompts that help the user continue the conversation
- Examples: "Show me more options", "What are the prices?", "Book this service", "Tell me about availability"

RESPOND WITH JSON ONLY:`;

  // Call OpenRouter API
  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://heysheets.com',
      'X-Title': 'HeySheets MVP'
    },
    body: JSON.stringify({
      model: 'anthropic/claude-3.5-sonnet',
      messages: [{ role: 'user', content: responsePrompt }],
      max_tokens: 600,
      temperature: 0.7 // Higher temperature for more natural, varied responses
    })
  });

  if (!response.ok) {
    const error = await response.text();
    console.error('[Responder] OpenRouter API error:', error);
    throw new Error(`Response generation failed: ${response.statusText}`);
  }

  const result = await response.json();
  const rawContent = result.choices[0].message.content;

  // Parse the JSON response
  let responseText = '';
  let suggestions: string[] = [];

  try {
    // Try to parse as JSON
    const parsed = JSON.parse(rawContent);
    responseText = parsed.response || rawContent;
    suggestions = Array.isArray(parsed.suggestions) ? parsed.suggestions.slice(0, 4) : [];
  } catch {
    // If JSON parsing fails, use raw content as response
    console.warn('[Responder] Failed to parse JSON response, using raw content');
    responseText = rawContent;
    // Generate default suggestions based on intent
    suggestions = getDefaultSuggestions(classification.intent);
  }

  // Extract token usage from OpenRouter response
  const usage = result.usage || { prompt_tokens: 0, completion_tokens: 0 };
  console.log('[Responder] Generated response');
  console.log('[Responder] Token usage:', usage);
  console.log('[Responder] Suggestions:', suggestions);

  return {
    text: responseText,
    suggestions,
    usage: {
      input: usage.prompt_tokens || 0,
      output: usage.completion_tokens || 0,
    },
  };
}

/**
 * Get default suggestions based on intent when JSON parsing fails
 */
function getDefaultSuggestions(intent: string): string[] {
  switch (intent) {
    case 'SERVICE_INQUIRY':
      return ['Book this service', 'Show pricing', 'Check availability'];
    case 'PRODUCT_INQUIRY':
      return ['Show more products', 'Check availability', 'Add to cart'];
    case 'INFO_REQUEST':
      return ['Show services', 'Contact information', 'Operating hours'];
    case 'BOOKING_REQUEST':
      return ['See available times', 'Change date', 'Confirm booking'];
    case 'GREETING':
      return ['Show me products', 'Show me services', 'Operating hours', 'Store information'];
    default:
      return ['Show products', 'Show services', 'Store information'];
  }
}