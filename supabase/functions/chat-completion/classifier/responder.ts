// Generate conversational responses using function results

import { Classification } from './classifier.ts';

const OPENROUTER_API_KEY = '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';

export async function generateResponse(
  messages: Array<{ role: string; content: string }>,
  classification: Classification,
  functionResult: any,
  storeContext?: any
): Promise<string> {

  // Build conversation history
  const conversationHistory = messages
    .map(m => `${m.role}: ${m.content}`)
    .join('\n');

  // Build store context
  let contextInfo = '';
  if (storeContext) {
    contextInfo = `
STORE CONTEXT:
Store Name: ${storeContext.name || 'Unknown'}
Store Type: ${storeContext.type || 'general'}
`;
  }

  // Build function result context
  let functionContext = '';
  if (functionResult && functionResult.success) {
    functionContext = `
FUNCTION RESULT (Use this data in your response):
${JSON.stringify(functionResult, null, 2)}

IMPORTANT: Present this data naturally and conversationally.
- For products: Describe each one briefly with name and price
- For availability: List the available time slots clearly
- For bookings: Confirm all details (service, date, time, name)
- For store info: Present hours/location in a friendly way
`;
  } else if (functionResult && !functionResult.success) {
    functionContext = `
FUNCTION ERROR:
${functionResult.error}

IMPORTANT: Apologize politely and:
- If service not found: List available services
- If time not available: Show available times
- If missing info: Ask for the specific missing details
- Be helpful and guide the user to success
`;
  }

  // Build response prompt
  const responsePrompt = `You are a helpful business assistant for this store.

${contextInfo}

CONVERSATION HISTORY:
${conversationHistory}

USER INTENT: ${classification.intent}
CONFIDENCE: ${classification.confidence}

${functionContext}

Generate a helpful, natural, conversational response to the user.

RESPONSE GUIDELINES:
1. Be friendly and professional
2. Use the function result data if available
3. Present information clearly (use bold, lists, formatting)
4. If booking: Confirm all details explicitly
5. If showing products/services: Be descriptive but concise
6. If user needs to provide more info: Ask naturally (don't interrogate)
7. Keep responses under 200 words unless showing detailed data
8. Match the store's tone (professional for services, warm for products)
9. Always suggest next steps or ask if they need anything else

FORMATTING:
- Use **bold** for product/service names
- Use line breaks for readability
- Use bullet points for lists
- Use emojis sparingly (✅ for confirmations, 📅 for dates)

RESPOND NATURALLY (DO NOT include any system information or technical details):`;

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
        messages: [{ role: 'user', content: responsePrompt }],
        temperature: 0.7
      })
    });

    if (!response.ok) {
      throw new Error(`OpenRouter API error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices[0]?.message?.content;

    if (!content) {
      throw new Error('No response from LLM');
    }

    return content;

  } catch (error) {
    console.error('[Responder] Error:', error);
    return 'I apologize, but I encountered an error generating a response. Please try again.';
  }
}
