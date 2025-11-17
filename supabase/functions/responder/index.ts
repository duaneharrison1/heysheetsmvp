import type { Message, Classification } from '../chat-completion/types.ts';
import { getOpenRouterApiKey } from '../chat-completion/utils.ts';

/** generateResponse: create a friendly LLM reply using optional function results */
export async function generateResponse(
  messages: Message[],
  classification: Classification,
  functionResult: any,
  storeContext?: any
): Promise<string> {
  const conversationHistory = messages.map(m => `${m.role}: ${m.content}`).join('\n');

  let contextInfo = '';
  if (storeContext) {
    contextInfo = `STORE CONTEXT:\nStore Name: ${storeContext.name || 'Unknown'}\nStore Type: ${storeContext.type || 'general'}\n`;
  }

  let functionContext = '';
  if (functionResult && functionResult.success) {
    functionContext = `FUNCTION RESULT (Use this data in your response):\n${JSON.stringify(functionResult, null, 2)}\n\nIMPORTANT: Present this data naturally and conversationally.`;
  } else if (functionResult && !functionResult.success) {
    functionContext = `FUNCTION ERROR:\n${functionResult.error}\n\nIMPORTANT: Apologize politely and guide the user.`;
  }

  const responsePrompt = `You are a helpful business assistant for this store.

${contextInfo}

CONVERSATION HISTORY:
${conversationHistory}

USER INTENT: ${classification.intent}

${functionContext}

Generate a helpful, natural, conversational response. Be friendly, use the function result data if available, and keep it under 200 words.

RESPOND NATURALLY:`;

  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${getOpenRouterApiKey()}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://heysheets.com',
        'X-Title': 'HeySheets'
      },
      body: JSON.stringify({ model: 'anthropic/claude-3.5-sonnet', messages: [{ role: 'user', content: responsePrompt }], temperature: 0.7 })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OpenRouter API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    const content = data.choices[0]?.message?.content;
    if (!content) throw new Error('No response from LLM');
    return content;
  } catch (error) {
    console.error('[Responder] Error:', error);
    return 'I apologize, but I encountered an error. Please try again.';
  }
}
