import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { corsHeaders } from '../_shared/cors.ts'

const openRouterApiKey = Deno.env.get('OPENROUTER_API_KEY')

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { messages, storeContext } = await req.json()

    if (!openRouterApiKey) {
      throw new Error('OpenRouter API key not configured')
    }

    // Create system message with store context
    const systemMessage = {
      role: 'system',
      content: `You are a helpful chat assistant for ${storeContext.name}, a ${storeContext.type} business. 
      
Business Details:
- Name: ${storeContext.name}
- Hours: ${storeContext.hours}
- Address: ${storeContext.address}
- Email: ${storeContext.email}
- Website: ${storeContext.website}
- Description: ${storeContext.description}

Services offered:
${storeContext.services.map((service: any) => `- ${service.text}`).join('\n')}

You should be friendly, helpful, and knowledgeable about the business. Help customers with:
- Information about services and products
- Booking appointments or scheduling
- Answering questions about pricing, hours, location
- Providing personalized recommendations
- General customer service

Keep responses conversational but professional, and always try to be helpful while staying focused on the business context.`
    }

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openRouterApiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://heysheets.com',
        'X-Title': 'HeySheets Chat Assistant',
      },
      body: JSON.stringify({
        model: 'openai/gpt-4o',
        messages: [systemMessage, ...messages],
        temperature: 0.7,
        max_tokens: 1000,
      }),
    })

    if (!response.ok) {
      throw new Error(`OpenRouter API error: ${response.status}`)
    }

    const data = await response.json()
    const aiResponse = data.choices[0]?.message?.content || 'I apologize, but I\'m having trouble processing your request right now. Please try again.'

    return new Response(
      JSON.stringify({ response: aiResponse }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      },
    )
  } catch (error) {
    console.error('Error in chat-completion function:', error)
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error',
        message: error.message 
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      },
    )
  }
})