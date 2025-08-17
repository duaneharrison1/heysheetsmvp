import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { corsHeaders } from '../_shared/cors.ts'

const openaiApiKey = Deno.env.get('OPENAI_API_KEY')
const openaiModel = Deno.env.get('OPENAI_MODEL') || 'gpt-4o-mini'

// Function to estimate token count (rough approximation)
function estimateTokenCount(text: string): number {
  return Math.ceil((text || '').length / 4)
}

// Function to trim messages based on token count
function trimMessagesByTokens(messages: any[], maxTokens: number = 3000): any[] {
  let totalTokens = 0
  const trimmedMessages: any[] = []

  for (let i = messages.length - 1; i >= 0; i--) {
    const content = messages[i]?.content || ''
    const messageTokens = estimateTokenCount(content)

    if (totalTokens + messageTokens > maxTokens && trimmedMessages.length > 0) {
      break
    }

    trimmedMessages.unshift(messages[i])
    totalTokens += messageTokens
  }

  return trimmedMessages
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { messages, storeContext } = await req.json()

    if (!openaiApiKey) {
      throw new Error('OpenAI API key not configured')
    }

    console.log('Received messages:', messages?.length || 0)
    console.log('Store context:', storeContext?.name || 'No store context')

    const trimmedMessages = trimMessagesByTokens(messages || [], 3000)
    console.log('Trimmed messages from', messages?.length || 0, 'to', trimmedMessages.length)

    // Build spreadsheet info if available
    let spreadsheetInfo = ''
    if (storeContext?.spreadsheetData) {
      const { spreadsheetData } = storeContext

      if (spreadsheetData.hours && spreadsheetData.hours.length > 0) {
        spreadsheetInfo += '\n\nOperating Hours:\n'
        spreadsheetData.hours.forEach((hour: any) => {
          spreadsheetInfo += `- ${hour.day}: ${hour.isOpen === 'Yes' ? `${hour.openTime} - ${hour.closeTime}` : 'Closed'}${hour.notes ? ` (${hour.notes})` : ''}\n`
        })
      }

      if (spreadsheetData.products && spreadsheetData.products.length > 0) {
        spreadsheetInfo += '\n\nAvailable Products:\n'
        spreadsheetData.products.forEach((product: any) => {
          spreadsheetInfo += `- ${product.name} (${product.category}): $${product.price} - ${product.description || 'No description'} - Stock: ${product.stock || 'N/A'}\n`
        })
      }

      if (spreadsheetData.services && spreadsheetData.services.length > 0) {
        spreadsheetInfo += '\n\nAvailable Services:\n'
        spreadsheetData.services.forEach((service: any) => {
          spreadsheetInfo += `- ${service.serviceName} (${service.category}): $${service.price} - Duration: ${service.duration} minutes - ${service.description || 'No description'}\n`
        })
      }

      if (spreadsheetData.bookings && spreadsheetData.bookings.length > 0) {
        spreadsheetInfo += '\n\nUpcoming Bookings:\n'
        spreadsheetData.bookings.forEach((booking: any) => {
          spreadsheetInfo += `- ${booking.date} at ${booking.time}: ${booking.customerName} - ${booking.service} (${booking.status})\n`
        })
      }
    }

    const servicesList = (storeContext?.services || []).map((s: any) => `- ${s.text}`).join('\n')

    const systemMessage = {
      role: 'system',
      content: `You are a helpful chat assistant for ${storeContext?.name || 'the store'}, a ${storeContext?.type || 'business'} business.

Business Details:
- Name: ${storeContext?.name}
- Hours: ${storeContext?.hours}
- Address: ${storeContext?.address}
- Email: ${storeContext?.email}
- Website: ${storeContext?.website}
- Description: ${storeContext?.description}

Services offered:
${servicesList}

${spreadsheetInfo}

MANDATORY: When discussing products, you MUST end your response with exactly this JSON (copy the placeholder text exactly):
{"richContent": {"type": "products", "data": [product objects from spreadsheet]}}

When discussing services, you MUST end your response with exactly this JSON (copy the placeholder text exactly):
{"richContent": {"type": "services", "data": [service objects from spreadsheet]}}

When discussing hours, you MUST end your response with exactly this JSON (copy the placeholder text exactly):
{"richContent": {"type": "hours", "data": [hours objects from spreadsheet]}}

Example for products question:
User: "What products do you have?"
You: "Here are our available products: {"richContent": {"type": "products", "data": [product objects from spreadsheet]}}"

CRITICAL: Use the exact placeholder text "[product objects from spreadsheet]" - do NOT replace it with actual data or empty arrays.`
    }

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
        'Referer': 'https://heysheets.com',
        'X-Title': 'HeySheets Chat Assistant'
      },
      body: JSON.stringify({
        model: openaiModel,
        messages: [systemMessage, ...trimmedMessages],
        temperature: 0.7,
        max_tokens: 1000
      })
    })

    if (!response.ok) {
      let errText = ''
      try {
        errText = await response.text()
      } catch (e) {
        errText = '<failed to read error body>'
      }
      console.error('OpenAI API returned non-OK', response.status, errText)
      throw new Error(`OpenAI API error: ${response.status} - ${errText}`)
    }

    const data = await response.json()
    if (!data || !data.choices || !Array.isArray(data.choices) || data.choices.length === 0) {
      console.error('OpenAI response missing choices or empty:', JSON.stringify(data))
      throw new Error('OpenAI returned an unexpected response shape')
    }

    const aiResponse = data.choices[0]?.message?.content || data.choices[0]?.text || "I apologize, but I'm having trouble processing your request right now. Please try again."

    return new Response(JSON.stringify({ response: aiResponse }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200
    })
  } catch (error) {
    console.error('Error in chat-completion function:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
    return new Response(JSON.stringify({ error: 'Internal server error', message: errorMessage }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500
    })
  }
})