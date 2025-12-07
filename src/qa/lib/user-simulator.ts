/**
 * User Simulator - Generates realistic user messages using the evaluator model
 *
 * This is essentially the INVERSE of our chatbot:
 * - Chatbot: User message -> Bot response
 * - Simulator: Bot response -> User message
 */

import type { GoalBasedScenario } from './types'

interface SimulatorResult {
  message: string
  goalComplete: boolean
}

/**
 * Generate the initial user message to start the conversation
 */
export async function generateInitialMessage(
  scenario: GoalBasedScenario,
  evaluatorModel: string,
  storeId: string
): Promise<SimulatorResult> {

  const prompt = buildSimulatorPrompt(scenario, [], null, true)

  console.log('[UserSimulator] Generating initial message with model:', evaluatorModel)

  const response = await callEvaluatorModel(evaluatorModel, prompt, storeId)

  console.log('[UserSimulator] Initial message response:', response)

  return parseSimulatorResponse(response)
}

/**
 * Generate the next user message based on conversation history
 */
export async function generateNextMessage(
  scenario: GoalBasedScenario,
  conversationHistory: Array<{ role: 'user' | 'assistant', content: string }>,
  lastBotResponse: string,
  evaluatorModel: string,
  storeId: string
): Promise<SimulatorResult> {

  const prompt = buildSimulatorPrompt(scenario, conversationHistory, lastBotResponse, false)

  console.log('[UserSimulator] Generating next message, turn:', conversationHistory.length / 2 + 1)

  const response = await callEvaluatorModel(evaluatorModel, prompt, storeId)

  console.log('[UserSimulator] Next message response:', response)

  return parseSimulatorResponse(response)
}

/**
 * Build the prompt for the user simulator
 */
function buildSimulatorPrompt(
  scenario: GoalBasedScenario,
  history: Array<{ role: string, content: string }>,
  lastBotResponse: string | null,
  isInitial: boolean
): string {

  const personaDescriptions: Record<string, string> = {
    polite: 'Friendly and patient. Uses please/thank you. Takes time to explain clearly.',
    casual: 'Relaxed and informal. Might use slang, abbreviations. Conversational tone.',
    impatient: 'Brief and direct. Wants quick answers. May skip pleasantries.',
    confused: 'Uncertain about what they want. Asks clarifying questions. May change mind.',
    verbose: 'Gives lots of detail. Tends to ramble. Provides extra context.'
  }

  const randomnessDescriptions: Record<string, string> = {
    predictable: 'Follow a logical, straightforward path to the goal.',
    natural: 'Be realistic with some variation. Like a real person would chat.',
    chaotic: 'Be unpredictable. Might change topics, ask unrelated things, or get distracted.'
  }

  const persona = scenario.user.persona
  const language = scenario.user.language
  const behavior = scenario.user.behavior || { randomness: 'natural' }

  let prompt = `You are simulating a REAL CUSTOMER chatting with a business chatbot.

YOUR GOAL: ${scenario.goal.description}

YOUR PERSONA: ${persona.toUpperCase()}
${personaDescriptions[persona] || personaDescriptions.casual}

LANGUAGE: Write in ${language === 'en' ? 'English' : language === 'zh-HK' ? 'Cantonese (Hong Kong style)' : language === 'zh-TW' ? 'Traditional Chinese (Taiwan style)' : language === 'ja' ? 'Japanese' : 'English'}

BEHAVIOR:
- ${randomnessDescriptions[behavior.randomness || 'natural']}
${behavior.typos ? '- Include occasional typos (realistic mistakes)' : '- No typos'}
${behavior.emoji ? '- Use emojis naturally where appropriate' : '- No emojis'}

`

  if (isInitial) {
    prompt += `This is the START of the conversation. Generate your opening message to begin working toward your goal.

Remember: You're a real customer. Don't be robotic. Be natural for your persona.
`
  } else {
    prompt += `CONVERSATION SO FAR:
${history.map(m => `${m.role === 'user' ? 'You' : 'Bot'}: ${m.content}`).join('\n')}

BOT JUST SAID:
"${lastBotResponse}"

Generate your next message to continue toward your goal.
`
  }

  prompt += `
---

IMPORTANT RULES:
1. Stay in character as a ${persona} customer
2. Work toward your goal naturally
3. If you believe the goal has been ACHIEVED (e.g., booking confirmed, information received, lead submitted), respond with EXACTLY: [GOAL_COMPLETE]
4. Otherwise, respond with ONLY your customer message - nothing else

Success signals that might indicate goal completion: ${scenario.goal.successSignals?.join(', ') || 'confirmed, booked, created, submitted, done'}

YOUR RESPONSE (just the customer message OR [GOAL_COMPLETE]):`

  return prompt
}

/**
 * Call the LLM via qa-llm edge function (raw LLM call for QA testing)
 */
async function callEvaluatorModel(model: string, prompt: string, _storeId: string): Promise<string> {
  try {
    console.log('[UserSimulator] Calling qa-llm edge function with model:', model)

    const response = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/qa-llm`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({
          messages: [{ role: 'user', content: prompt }],
          model: model
        })
      }
    )

    if (!response.ok) {
      const errorText = await response.text()
      console.error('[UserSimulator] Edge function error:', response.status, errorText)
      return ''
    }

    const data = await response.json()
    console.log('[UserSimulator] Edge function response:', JSON.stringify(data).slice(0, 300))

    const text = data.text || ''

    if (!text) {
      console.error('[UserSimulator] No text in response, full data:', data)
    }

    return text
  } catch (error) {
    console.error('[UserSimulator] Error calling edge function:', error)
    return ''
  }
}

/**
 * Parse the simulator response to extract message and goal status
 */
function parseSimulatorResponse(response: string): SimulatorResult {
  const trimmed = response.trim()

  // Check for goal completion signal
  if (trimmed === '[GOAL_COMPLETE]' || trimmed.includes('[GOAL_COMPLETE]')) {
    return {
      message: '',
      goalComplete: true
    }
  }

  // Clean up any accidental prefixes the AI might add
  let message = trimmed
    .replace(/^(You|Customer|User|Me):\s*/i, '')
    .replace(/^["']|["']$/g, '')
    .trim()

  return {
    message,
    goalComplete: false
  }
}

/**
 * Check if bot response contains success signals
 */
export function checkSuccessSignals(
  botResponse: string,
  successSignals: string[]
): boolean {
  const lowerResponse = botResponse.toLowerCase()
  return successSignals.some(signal => lowerResponse.includes(signal.toLowerCase()))
}
