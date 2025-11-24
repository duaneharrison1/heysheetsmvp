import type { TestScenario, TestStepResult, GoalBasedScenario } from './types'
import { isGoalBasedScenario } from './types'

export async function evaluateStepQuality(
  userMessage: string,
  botResponse: string,
  criteria: string[],
  model: string  // Chat model - used for per-message evaluation
): Promise<{ score: number; passed: boolean; reasoning: string; model: string } | null> {

  if (criteria.length === 0) {
    return null  // Skip evaluation if no criteria
  }

  const prompt = `You are evaluating a chatbot response. Be objective and constructive.

USER: "${userMessage}"
BOT: "${botResponse}"

EVALUATION CRITERIA:
${criteria.map((c, i) => `${i + 1}. ${c}`).join('\n')}

Evaluate the response:
1. Does it meet each criterion?
2. Is the response helpful and clear?
3. Overall quality score (0-100)

Respond with JSON only:
{
  "score": 85,
  "passed": true,
  "reasoning": "Response is clear and meets all criteria. Includes prices and friendly tone."
}

Scoring guide:
- 90-100: Excellent response
- 70-89: Good response
- 60-69: Acceptable
- Below 60: Poor

Be fair but critical.`

  try {
    // Use Supabase Edge Function instead of calling OpenRouter directly
    const response = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat-completion`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({
          messages: [{ role: 'user', content: prompt }],
          storeId: 'evaluation', // Dummy store ID for evaluation
          model,
          skipIntent: true  // Skip intent classification for evaluation
        })
      }
    )

    if (!response.ok) {
      const errorData = await response.json()
      console.error('Edge Function error:', response.status, errorData)
      return null
    }

    const data = await response.json()

    // Edge Function returns { text: string } format
    const text = data.text
    if (!text) {
      console.error('Invalid API response:', data)
      return null
    }

    // Extract JSON
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      throw new Error('No JSON in response')
    }

    const result = JSON.parse(jsonMatch[0])

    return {
      score: result.score,
      passed: result.passed,
      reasoning: result.reasoning,
      model
    }

  } catch (error) {
    console.error('Evaluation failed:', error)
    return null
  }
}

export async function evaluateOverallQuality(
  scenario: TestScenario,
  results: TestStepResult[],
  conversationHistory: Array<{ role: string, content: string }>,
  evaluatorModel: string,  // Evaluator model - used for overall evaluation
  goalAchieved?: boolean   // NEW: Pass in for goal-based tests
): Promise<{
  score: number
  passed: boolean
  reasoning: string
  conversationQuality: string
  goalAchieved: boolean
}> {

  const criteria = scenario.evaluation?.criteria || [
    'Conversation achieved its goal',
    'Responses were helpful and accurate',
    'Tone was appropriate and consistent'
  ]

  const conversationText = conversationHistory
    .map(msg => `${msg.role === 'user' ? 'User' : 'Bot'}: ${msg.content}`)
    .join('\n\n')

  // Build different prompts for scripted vs goal-based tests
  const isGoalBased = isGoalBasedScenario(scenario)

  let prompt: string

  if (isGoalBased) {
    const goalScenario = scenario as GoalBasedScenario
    prompt = `You are evaluating a chatbot conversation where an AI-simulated user was trying to achieve a goal.

SCENARIO TYPE: Goal-Based Test
GOAL: ${goalScenario.goal.description}
USER PERSONA: ${goalScenario.user.persona}
TURNS TAKEN: ${results.length}
MAX TURNS ALLOWED: ${goalScenario.limits.maxTurns}
GOAL ACHIEVED (by signal detection): ${goalAchieved ? 'Yes' : 'No/Unknown'}

CONVERSATION:
${conversationText}

EVALUATION CRITERIA:
${criteria.map((c, i) => `${i + 1}. ${c}`).join('\n')}

Evaluate the conversation:
1. Did the chatbot help the user achieve their goal?
2. Did the chatbot handle the user's persona appropriately?
3. Was the conversation natural and efficient?
4. Overall quality score (0-100)?

Respond with JSON only:
{
  "score": 85,
  "passed": true,
  "reasoning": "**Goal Achievement:** The chatbot successfully helped the user book a class. The booking was confirmed and details were provided.\\n\\n**Persona Handling:** The chatbot handled the casual tone well, matching the user's informal style.\\n\\n**Conversation Efficiency:** Completed in 4 turns, which is efficient for a booking flow.\\n\\n**Summary:** Excellent overall performance. The conversation achieved its goal efficiently while maintaining a friendly tone.",
  "conversationQuality": "good",
  "goalAchieved": true
}

conversationQuality options: "excellent", "good", "fair", "poor"
passed = true if score >= ${scenario.evaluation?.minQualityScore || 70} AND goal was achieved

Be thorough and fair.`
  } else {
    // Existing prompt for scripted tests
    prompt = `You are an expert evaluator assessing a complete chatbot conversation for quality.

SCENARIO: ${scenario.name}
${scenario.description}

CONVERSATION:
${conversationText}

EVALUATION CRITERIA:
${criteria.map((c, i) => `${i + 1}. ${c}`).join('\n')}

TECHNICAL RESULTS:
- Total steps: ${results.length}
- Steps passed: ${results.filter(r => r.passed).length}
- Steps failed: ${results.filter(r => !r.passed).length}

Provide a DETAILED evaluation with score breakdown:

1. **Goal Achievement** - Did the conversation achieve its intended purpose?
2. **Response Quality** - Were responses helpful, accurate, and appropriate?
3. **Conversation Flow** - Was the interaction natural and well-structured?
4. **Technical Accuracy** - Did the bot correctly identify intents and use appropriate functions?
5. **User Experience** - Would a real user be satisfied with this interaction?

Respond with JSON only:
{
  "score": 88,
  "passed": true,
  "reasoning": "**Goal Achievement (95/100):** The booking flow completed successfully. All required information was collected and the booking was confirmed.\\n\\n**Response Quality (90/100):** Responses were clear, friendly, and included all necessary details. One minor improvement: could have proactively mentioned cancellation policy.\\n\\n**Conversation Flow (85/100):** Natural progression through the booking steps. Slight delay in one transition but overall smooth.\\n\\n**Technical Accuracy (90/100):** All intents correctly identified. Functions executed without errors. High confidence scores throughout.\\n\\n**User Experience (88/100):** Professional and efficient interaction. User would likely be satisfied and complete the booking.\\n\\n**Summary:** Excellent overall performance. The conversation achieved its goal efficiently while maintaining a friendly, professional tone. Minor areas for improvement in proactive communication.",
  "conversationQuality": "excellent",
  "goalAchieved": true
}

**IMPORTANT FORMATTING:**
- Use \\n\\n for paragraph breaks in reasoning
- Use **bold** for section headings
- Include specific scores for each dimension (e.g., "Goal Achievement (95/100)")
- Provide specific examples from the conversation
- End with a brief summary paragraph

conversationQuality options: "excellent", "good", "fair", "poor"
passed = true if score >= ${scenario.evaluation?.minQualityScore || 70}

Be thorough, specific, and constructive.`
  }

  try {
    // Use Supabase Edge Function instead of calling OpenRouter directly
    const response = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat-completion`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({
          messages: [{ role: 'user', content: prompt }],
          storeId: 'evaluation', // Dummy store ID for evaluation
          model: evaluatorModel,
          skipIntent: true  // Skip intent classification for evaluation
        })
      }
    )

    if (!response.ok) {
      const errorData = await response.json()
      console.error('Edge Function error:', response.status, errorData)
      throw new Error(`API error: ${response.status}`)
    }

    const data = await response.json()

    // Edge Function returns { text: string } format
    const text = data.text
    if (!text) {
      console.error('Invalid API response:', data)
      throw new Error('Invalid API response structure')
    }

    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      throw new Error('No JSON in response')
    }

    const result = JSON.parse(jsonMatch[0])

    return result

  } catch (error) {
    console.error('Overall evaluation failed:', error)
    // Fallback - use goalAchieved parameter if provided (goal-based tests)
    const fallbackPassed = goalAchieved ?? results.every(r => r.passed)
    return {
      score: fallbackPassed ? 75 : 50,
      passed: fallbackPassed,
      reasoning: 'Evaluation failed, using goal achievement status',
      conversationQuality: fallbackPassed ? 'good' : 'fair',
      goalAchieved: fallbackPassed
    }
  }
}
