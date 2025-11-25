import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

// ============================================================================
// CORS HEADERS
// ============================================================================

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-api-key',
}

// ============================================================================
// ENVIRONMENT VARIABLES
// ============================================================================

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!
const MCP_SECRET = Deno.env.get('MCP_SECRET')!

// ============================================================================
// TYPES
// ============================================================================

interface MCPRequest {
  tool: string
  params: Record<string, any>
}

interface ChatMessage {
  role: 'user' | 'assistant' | 'system'
  content: string
}

interface TestStep {
  id: string
  userMessage: string
  expected?: {
    intent?: string
    minConfidence?: number
    functions?: string[]
    maxTimeMs?: number
  }
}

interface TestScenario {
  id: string
  name: string
  description?: string
  steps: TestStep[]
}

// ============================================================================
// LOGGING HELPER
// ============================================================================

function log(message: string, data?: any) {
  const timestamp = new Date().toISOString()
  const logData = data ? JSON.stringify(data) : ''
  console.log(`[${timestamp}] [MCP] ${message}`, logData)
}

// ============================================================================
// CHAT API HELPER
// ============================================================================

/**
 * Call the chat-completion Edge Function
 */
async function callChatAPI(
  messages: ChatMessage[],
  storeId: string,
  model: string = 'gpt-4o-mini'
): Promise<any> {
  const requestId = crypto.randomUUID()

  const response = await fetch(
    `${SUPABASE_URL}/functions/v1/chat-completion`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'X-Request-ID': requestId,
      },
      body: JSON.stringify({
        messages,
        storeId,
        model,
      })
    }
  )

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Chat API error: ${response.status} - ${errorText}`)
  }

  return response.json()
}

// ============================================================================
// TOOL HANDLERS
// ============================================================================

/**
 * Tool: call_chat - Send a single message and get response with debug
 */
async function handleCallChat(params: {
  message: string
  storeId: string
  model?: string
  conversationHistory?: ChatMessage[]
}): Promise<any> {
  const messages: ChatMessage[] = params.conversationHistory
    ? [...params.conversationHistory]
    : []
  messages.push({ role: 'user', content: params.message })

  const result = await callChatAPI(messages, params.storeId, params.model)

  return {
    success: true,
    message: params.message,
    response: result.text,
    intent: result.intent,
    confidence: result.confidence,
    debug: result.debug
  }
}

/**
 * Tool: run_test - Execute a test scenario
 */
async function handleRunTest(params: {
  scenario: TestScenario
  storeId: string
  model?: string
}): Promise<any> {
  const { scenario, storeId, model } = params
  const results: any[] = []
  const conversationHistory: ChatMessage[] = []

  let allPassed = true
  const startTime = Date.now()

  for (const step of scenario.steps) {
    // Add user message to history
    conversationHistory.push({ role: 'user', content: step.userMessage })

    // Call chat API
    const stepStartTime = Date.now()
    let result: any
    let error: string | null = null

    try {
      result = await callChatAPI([...conversationHistory], storeId, model)
    } catch (e) {
      error = e instanceof Error ? e.message : String(e)
      allPassed = false
    }

    const stepDuration = Date.now() - stepStartTime

    // Add assistant response to history
    if (result?.text) {
      conversationHistory.push({ role: 'assistant', content: result.text })
    }

    // Evaluate step
    let stepPassed = true
    const failures: string[] = []

    if (error) {
      stepPassed = false
      failures.push(`Error: ${error}`)
    } else if (step.expected) {
      // Check intent
      if (step.expected.intent && result.intent !== step.expected.intent) {
        stepPassed = false
        failures.push(`Intent: expected ${step.expected.intent}, got ${result.intent}`)
      }

      // Check confidence
      if (step.expected.minConfidence && result.confidence < step.expected.minConfidence) {
        stepPassed = false
        failures.push(`Confidence: expected >= ${step.expected.minConfidence}, got ${result.confidence}`)
      }

      // Check timing
      if (step.expected.maxTimeMs && stepDuration > step.expected.maxTimeMs) {
        stepPassed = false
        failures.push(`Timing: expected <= ${step.expected.maxTimeMs}ms, got ${stepDuration}ms`)
      }

      // Check functions called
      if (step.expected.functions && result.debug?.functionCalls) {
        const calledFunctions = result.debug.functionCalls.map((f: any) => f.name)
        for (const expectedFn of step.expected.functions) {
          if (!calledFunctions.includes(expectedFn)) {
            stepPassed = false
            failures.push(`Function: expected ${expectedFn} to be called`)
          }
        }
      }
    }

    if (!stepPassed) {
      allPassed = false
    }

    results.push({
      stepId: step.id,
      userMessage: step.userMessage,
      botResponse: result?.text || null,
      intent: result?.intent || null,
      confidence: result?.confidence || null,
      duration: stepDuration,
      passed: stepPassed,
      failures,
      debug: result?.debug || null,
      error
    })
  }

  const totalDuration = Date.now() - startTime

  return {
    scenario: {
      id: scenario.id,
      name: scenario.name
    },
    passed: allPassed,
    totalDuration,
    stepsTotal: scenario.steps.length,
    stepsPassed: results.filter(r => r.passed).length,
    results
  }
}

/**
 * Tool: list_tools - Return available MCP tools
 */
function handleListTools(): any {
  return {
    tools: [
      {
        name: 'call_chat',
        description: 'Send a message to the HeySheets chatbot and receive response with full debug data',
        parameters: {
          message: { type: 'string', required: true, description: 'User message to send' },
          storeId: { type: 'string', required: true, description: 'Store ID to chat with' },
          model: { type: 'string', required: false, description: 'AI model to use (default: gpt-4o-mini)' },
          conversationHistory: { type: 'array', required: false, description: 'Previous messages for context' }
        }
      },
      {
        name: 'run_test',
        description: 'Execute a test scenario against the chatbot',
        parameters: {
          scenario: { type: 'object', required: true, description: 'Test scenario with steps' },
          storeId: { type: 'string', required: true, description: 'Store ID to test against' },
          model: { type: 'string', required: false, description: 'AI model to use' }
        }
      },
      {
        name: 'list_tools',
        description: 'List available MCP tools',
        parameters: {}
      }
    ]
  }
}

// ============================================================================
// MAIN HANDLER
// ============================================================================

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Check authentication
    const apiKey = req.headers.get('x-api-key')
    if (apiKey !== MCP_SECRET) {
      log('Unauthorized request', { hasKey: !!apiKey })
      return new Response(
        JSON.stringify({ error: 'Unauthorized', message: 'Invalid or missing API key' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Parse request
    const { tool, params }: MCPRequest = await req.json()

    if (!tool) {
      return new Response(
        JSON.stringify({ error: 'Bad Request', message: 'Missing tool parameter' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    log(`Tool: ${tool}`, params)

    // Route to tool handler
    let result: any

    switch (tool) {
      case 'call_chat':
        if (!params.message || !params.storeId) {
          throw new Error('call_chat requires message and storeId')
        }
        result = await handleCallChat(params)
        break

      case 'run_test':
        if (!params.scenario || !params.storeId) {
          throw new Error('run_test requires scenario and storeId')
        }
        result = await handleRunTest(params)
        break

      case 'list_tools':
        result = handleListTools()
        break

      default:
        return new Response(
          JSON.stringify({ error: 'Unknown tool', message: `Tool '${tool}' not found` }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
    }

    log(`Tool ${tool} completed successfully`)

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    const errorStack = error instanceof Error ? error.stack : undefined

    log('Error', { message: errorMessage, stack: errorStack })

    return new Response(
      JSON.stringify({
        error: 'Internal Server Error',
        message: errorMessage,
        stack: errorStack
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

console.log('MCP server function started')
