import { Classification, Message, FunctionResult, StoreConfig } from '../_shared/types.ts';

// ============================================================================
// RESPONDER FUNCTION
// ============================================================================

export async function generateResponse(
  messages: Message[],
  classification: Classification,
  functionResult?: FunctionResult,
  store?: StoreConfig,
  model?: string
): Promise<{ text: string; usage: { input: number; output: number } }> {
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

RESPOND NATURALLY:`;

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
      model: model || 'meta-llama/llama-3.1-70b-instruct', // Use selected model or default to Llama
      messages: [{ role: 'user', content: responsePrompt }],
      max_tokens: 500,
      temperature: 0.7 // Higher temperature for more natural, varied responses
    })
  });

  if (!response.ok) {
    const error = await response.text();
    console.error('[Responder] OpenRouter API error:', error);
    throw new Error(`Response generation failed: ${response.statusText}`);
  }

  const result = await response.json();
  const responseText = result.choices[0].message.content;

  // Extract token usage from OpenRouter response
  const usage = result.usage || { prompt_tokens: 0, completion_tokens: 0 };
  console.log('[Responder] Generated response');
  console.log('[Responder] Token usage:', usage);

  return {
    text: responseText,
    usage: {
      input: usage.prompt_tokens || 0,
      output: usage.completion_tokens || 0,
    },
  };
}
