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

// Legacy format
interface LegacyMCPRequest {
  tool: string
  params: Record<string, any>
}

// JSON-RPC 2.0 format (MCP Protocol)
interface JsonRpcRequest {
  jsonrpc: '2.0'
  method: string
  params?: Record<string, any>
  id: string | number | null
}

interface JsonRpcResponse {
  jsonrpc: '2.0'
  result?: any
  error?: {
    code: number
    message: string
    data?: any
  }
  id: string | number | null
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

// MCP Tool Definition Schema
interface MCPToolDefinition {
  name: string
  description: string
  inputSchema: {
    type: 'object'
    properties: Record<string, any>
    required?: string[]
  }
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
// JSON-RPC HELPERS
// ============================================================================

function jsonRpcSuccess(id: string | number | null, result: any): JsonRpcResponse {
  return {
    jsonrpc: '2.0',
    result,
    id
  }
}

function jsonRpcError(id: string | number | null, code: number, message: string, data?: any): JsonRpcResponse {
  return {
    jsonrpc: '2.0',
    error: { code, message, data },
    id
  }
}

// JSON-RPC Error Codes
const PARSE_ERROR = -32700
const INVALID_REQUEST = -32600
const METHOD_NOT_FOUND = -32601
const INVALID_PARAMS = -32602
const INTERNAL_ERROR = -32603

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

// ============================================================================
// MCP TOOL DEFINITIONS (JSON Schema format)
// ============================================================================

const MCP_TOOLS: MCPToolDefinition[] = [
  {
    name: 'call_chat',
    description: 'Send a message to the HeySheets chatbot and receive response with full debug data including intent classification, function calls, tokens, and timing.',
    inputSchema: {
      type: 'object',
      properties: {
        message: {
          type: 'string',
          description: 'The user message to send to the chatbot'
        },
        storeId: {
          type: 'string',
          description: 'The store ID to chat with'
        },
        model: {
          type: 'string',
          description: 'AI model to use (default: gpt-4o-mini)'
        },
        conversationHistory: {
          type: 'array',
          description: 'Previous messages for conversation context',
          items: {
            type: 'object',
            properties: {
              role: { type: 'string', enum: ['user', 'assistant', 'system'] },
              content: { type: 'string' }
            },
            required: ['role', 'content']
          }
        }
      },
      required: ['message', 'storeId']
    }
  },
  {
    name: 'run_test',
    description: 'Execute a test scenario with multiple conversation steps against the chatbot. Returns pass/fail status and detailed results for each step.',
    inputSchema: {
      type: 'object',
      properties: {
        scenario: {
          type: 'object',
          description: 'Test scenario definition with steps',
          properties: {
            id: { type: 'string' },
            name: { type: 'string' },
            description: { type: 'string' },
            steps: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  userMessage: { type: 'string' },
                  expected: {
                    type: 'object',
                    properties: {
                      intent: { type: 'string' },
                      minConfidence: { type: 'number' },
                      functions: { type: 'array', items: { type: 'string' } },
                      maxTimeMs: { type: 'number' }
                    }
                  }
                },
                required: ['id', 'userMessage']
              }
            }
          },
          required: ['id', 'name', 'steps']
        },
        storeId: {
          type: 'string',
          description: 'The store ID to test against'
        },
        model: {
          type: 'string',
          description: 'AI model to use for the test'
        }
      },
      required: ['scenario', 'storeId']
    }
  }
]

// ============================================================================
// MCP PROTOCOL HANDLERS (JSON-RPC 2.0)
// ============================================================================

/**
 * Handle MCP initialize method
 */
function handleInitialize(): any {
  return {
    protocolVersion: '2024-11-05',
    capabilities: {
      tools: {}
    },
    serverInfo: {
      name: 'heysheets-mcp',
      version: '1.0.0'
    }
  }
}

/**
 * Handle MCP tools/list method
 */
function handleToolsList(): any {
  return {
    tools: MCP_TOOLS
  }
}

/**
 * Handle MCP tools/call method
 */
async function handleToolsCall(params: { name: string; arguments?: Record<string, any> }): Promise<any> {
  const { name, arguments: args } = params

  if (!name) {
    throw { code: INVALID_PARAMS, message: 'Missing tool name' }
  }

  log(`tools/call: ${name}`, args)

  switch (name) {
    case 'call_chat':
      if (!args?.message || !args?.storeId) {
        throw { code: INVALID_PARAMS, message: 'call_chat requires message and storeId' }
      }
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(await handleCallChat(args as any), null, 2)
          }
        ]
      }

    case 'run_test':
      if (!args?.scenario || !args?.storeId) {
        throw { code: INVALID_PARAMS, message: 'run_test requires scenario and storeId' }
      }
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(await handleRunTest(args as any), null, 2)
          }
        ]
      }

    default:
      throw { code: METHOD_NOT_FOUND, message: `Unknown tool: ${name}` }
  }
}

// ============================================================================
// LEGACY FORMAT HANDLERS
// ============================================================================

/**
 * Handle legacy format request (backward compatibility)
 */
async function handleLegacyRequest(body: LegacyMCPRequest): Promise<any> {
  const { tool, params } = body

  if (!tool) {
    throw new Error('Missing tool parameter')
  }

  log(`Legacy tool: ${tool}`, params)

  switch (tool) {
    case 'call_chat':
      if (!params.message || !params.storeId) {
        throw new Error('call_chat requires message and storeId')
      }
      return handleCallChat(params)

    case 'run_test':
      if (!params.scenario || !params.storeId) {
        throw new Error('run_test requires scenario and storeId')
      }
      return handleRunTest(params)

    case 'list_tools':
      // Return legacy format for backward compatibility
      return {
        tools: MCP_TOOLS.map(t => ({
          name: t.name,
          description: t.description,
          parameters: Object.fromEntries(
            Object.entries(t.inputSchema.properties).map(([key, value]: [string, any]) => [
              key,
              {
                type: value.type,
                required: t.inputSchema.required?.includes(key) ?? false,
                description: value.description
              }
            ])
          )
        }))
      }

    default:
      throw new Error(`Unknown tool: ${tool}`)
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

    // Parse request body
    const body = await req.json()

    // Detect format: JSON-RPC 2.0 (MCP) vs Legacy
    if (body.jsonrpc === '2.0') {
      // =====================================================================
      // JSON-RPC 2.0 / MCP PROTOCOL
      // =====================================================================
      const rpcRequest = body as JsonRpcRequest
      const { method, params, id } = rpcRequest

      log(`JSON-RPC method: ${method}`, params)

      try {
        let result: any

        switch (method) {
          case 'initialize':
            result = handleInitialize()
            break

          case 'notifications/initialized':
            // Client acknowledgment, no response needed for notifications
            // But we still return success for HTTP
            result = {}
            break

          case 'tools/list':
            result = handleToolsList()
            break

          case 'tools/call':
            if (!params) {
              throw { code: INVALID_PARAMS, message: 'Missing params for tools/call' }
            }
            result = await handleToolsCall(params as { name: string; arguments?: Record<string, any> })
            break

          default:
            throw { code: METHOD_NOT_FOUND, message: `Method not found: ${method}` }
        }

        log(`JSON-RPC ${method} completed successfully`)

        return new Response(
          JSON.stringify(jsonRpcSuccess(id, result)),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )

      } catch (err: any) {
        const code = err.code || INTERNAL_ERROR
        const message = err.message || 'Internal error'

        log(`JSON-RPC error: ${message}`, { code })

        return new Response(
          JSON.stringify(jsonRpcError(id, code, message)),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

    } else if (body.tool) {
      // =====================================================================
      // LEGACY FORMAT (backward compatibility)
      // =====================================================================
      const result = await handleLegacyRequest(body as LegacyMCPRequest)

      log(`Legacy tool ${body.tool} completed successfully`)

      return new Response(
        JSON.stringify(result),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )

    } else {
      // Unknown format
      return new Response(
        JSON.stringify({ error: 'Bad Request', message: 'Invalid request format. Expected JSON-RPC 2.0 or legacy format.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

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

console.log('MCP server function started (JSON-RPC 2.0 + Legacy support)')
