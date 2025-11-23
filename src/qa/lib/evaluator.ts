import type { TestScenario, TestStepResult } from './types'

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
    const response = await fetch(
      'https://openrouter.ai/api/v1/chat/completions',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_OPENROUTER_API_KEY}`,
        },
        body: JSON.stringify({
          model,  // Use chat model
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.2,  // Low temp for consistency
          max_tokens: 500
        })
      }
    )

    const data = await response.json()
    const text = data.choices[0].message.content

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
  evaluatorModel: string  // Evaluator model - used for overall evaluation
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

  const prompt = `You are evaluating a complete chatbot conversation for quality.

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

Evaluate the overall conversation quality:
1. Was the goal achieved?
2. How was the conversation quality?
3. Overall score (0-100)

Respond with JSON only:
{
  "score": 88,
  "passed": true,
  "reasoning": "Booking flow completed successfully. All steps passed. Conversation was natural and helpful.",
  "conversationQuality": "excellent",
  "goalAchieved": true
}

conversationQuality options: "excellent", "good", "fair", "poor"
passed = true if score >= ${scenario.evaluation?.minQualityScore || 70}

Be thorough and fair.`

  try {
    const response = await fetch(
      'https://openrouter.ai/api/v1/chat/completions',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_OPENROUTER_API_KEY}`,
        },
        body: JSON.stringify({
          model: evaluatorModel,  // Use evaluator model
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.2,
          max_tokens: 800
        })
      }
    )

    const data = await response.json()
    const text = data.choices[0].message.content

    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      throw new Error('No JSON in response')
    }

    const result = JSON.parse(jsonMatch[0])

    return result

  } catch (error) {
    console.error('Overall evaluation failed:', error)
    // Fallback
    const allPassed = results.every(r => r.passed)
    return {
      score: allPassed ? 75 : 50,
      passed: allPassed,
      reasoning: 'Evaluation failed, using technical results only',
      conversationQuality: allPassed ? 'good' : 'fair',
      goalAchieved: allPassed
    }
  }
}
