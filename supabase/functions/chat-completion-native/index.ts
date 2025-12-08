/**
 * chat-completion-native - Native Tool Calling Implementation
 *
 * This edge function uses native OpenAI-compatible tool calling instead of
 * the custom classifier. Used for A/B testing to compare performance.
 *
 * Toggle in frontend: localStorage.setItem('heysheets:useNativeToolCalling', 'true')
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { executeFunction } from '../tools/index.ts';
import { generateResponse } from '../responder/index.ts';
import {
  StoreConfig,
  StoreData,
  FunctionResult,
  Message,
} from '../_shared/types.ts';
import { slimForResponder } from '../_shared/slim.ts';
import { getReasoningConfig } from '../_shared/model-config.ts';
import { CACHING_STRATEGY } from '../_shared/caching-config.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-request-id, x-debug-mode',
};

// ============================================================================
// TOOL DEFINITIONS (OpenAI-compatible format)
// ============================================================================

const tools = [
  {
    type: 'function',
    function: {
      name: 'get_store_info',
      description: 'Get store details, hours, services, and products overview. Use when user asks general questions about the store, what they offer, or wants to see everything available.',
      parameters: {
        type: 'object',
        properties: {
          info_type: {
            type: 'string',
            enum: ['hours', 'services', 'products', 'all'],
            description: "Type of info to retrieve. 'all' returns everything."
          }
        },
        required: []
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'get_services',
      description: 'Get complete list of ALL services/classes offered. Use when user wants to browse or see all services without a specific search term.',
      parameters: {
        type: 'object',
        properties: {
          category: {
            type: 'string',
            description: 'Optional category to filter by if explicitly mentioned'
          }
        },
        required: []
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'search_services',
      description: 'Search for specific services by keyword with semantic matching. Use when user asks for something SPECIFIC like "beginner classes", "pottery for kids", "relaxing", "weekend", etc.',
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'Search term or description (e.g., "sake", "beginner pottery", "weekend classes")'
          }
        },
        required: ['query']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'get_products',
      description: 'Get complete list of ALL products for sale. Use when user wants to browse or see all products without a specific search term.',
      parameters: {
        type: 'object',
        properties: {
          category: {
            type: 'string',
            description: 'Optional category to filter by if explicitly mentioned'
          }
        },
        required: []
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'search_products',
      description: 'Search for specific products by keyword with semantic matching. Use when user asks for something SPECIFIC.',
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'Search term or description for products'
          }
        },
        required: ['query']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'submit_lead',
      description: 'Capture user contact information. Use when user wants to be contacted, sign up for updates, leave their info, or shows interest in being reached. ALWAYS call this even if info is missing - it will return a form.',
      parameters: {
        type: 'object',
        properties: {
          name: {
            type: 'string',
            description: "User's full name"
          },
          email: {
            type: 'string',
            description: "User's email address"
          },
          phone: {
            type: 'string',
            description: "User's phone number (optional)"
          }
        },
        required: []
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'get_misc_data',
      description: 'Access custom data tabs like FAQ, Policies, Testimonials, or any other custom tab. Use when user asks about topics not covered by standard tabs.',
      parameters: {
        type: 'object',
        properties: {
          tab_name: {
            type: 'string',
            description: "Name of the custom tab to access (e.g., 'FAQ', 'Policies')"
          },
          query: {
            type: 'string',
            description: 'Optional search term to filter results'
          }
        },
        required: ['tab_name']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'check_availability',
      description: 'Check if a specific service is available at a specific date and time. Use when user asks "is X available on Y at Z?" - just checking, not booking.',
      parameters: {
        type: 'object',
        properties: {
          service_name: {
            type: 'string',
            description: 'Name of the service to check'
          },
          date: {
            type: 'string',
            description: 'Date in YYYY-MM-DD format'
          },
          time: {
            type: 'string',
            description: 'Time in HH:MM format'
          }
        },
        required: ['service_name', 'date', 'time']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'get_booking_slots',
      description: 'Show visual booking calendar with available times for a service. ALWAYS use this when user wants to book/schedule/reserve a service, even if they have not specified date/time. Extracts any mentioned details as prefill values.',
      parameters: {
        type: 'object',
        properties: {
          service_name: {
            type: 'string',
            description: 'Name of the service to book'
          },
          start_date: {
            type: 'string',
            description: 'Start of date range in YYYY-MM-DD format (default: today)'
          },
          end_date: {
            type: 'string',
            description: 'End of date range in YYYY-MM-DD format (default: today + 14 days)'
          },
          date: {
            type: 'string',
            description: 'Pre-selected date if user mentioned one (YYYY-MM-DD)'
          },
          time: {
            type: 'string',
            description: 'Pre-selected time if user mentioned one (HH:MM)'
          },
          name: {
            type: 'string',
            description: "User's name if mentioned"
          },
          email: {
            type: 'string',
            description: "User's email if mentioned"
          },
          phone: {
            type: 'string',
            description: "User's phone if mentioned"
          }
        },
        required: ['service_name']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'create_booking',
      description: 'Create an actual booking with calendar invite. ONLY call this when you have ALL required info: service_name, date, time, name, AND email. Usually called from booking calendar UI.',
      parameters: {
        type: 'object',
        properties: {
          service_name: {
            type: 'string',
            description: 'Name of the service to book'
          },
          date: {
            type: 'string',
            description: 'Booking date in YYYY-MM-DD format'
          },
          time: {
            type: 'string',
            description: 'Booking time in HH:MM format'
          },
          name: {
            type: 'string',
            description: 'Full name of person making booking'
          },
          email: {
            type: 'string',
            description: 'Email address for confirmation'
          },
          phone: {
            type: 'string',
            description: 'Phone number (optional)'
          }
        },
        required: ['service_name', 'date', 'time', 'name', 'email']
      }
    }
  }
];

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function log(requestId: string, message: string, data?: any) {
  const timestamp = new Date().toISOString();
  const logData = data ? JSON.stringify(data) : '';
  console.log(`[${timestamp}] [REQUEST_ID:${requestId}] [NATIVE] ${message}`, logData);
}

function findActualTabName(
  expectedTab: string,
  detectedSchema: Record<string, any>
): string | null {
  if (!detectedSchema || typeof detectedSchema !== 'object') {
    return null;
  }
  const expectedLower = expectedTab.toLowerCase();

  // Try exact match first
  for (const actualTab of Object.keys(detectedSchema)) {
    if (actualTab.toLowerCase() === expectedLower) {
      return actualTab;
    }
  }

  // Try partial match
  for (const actualTab of Object.keys(detectedSchema)) {
    if (actualTab.toLowerCase().includes(expectedLower) ||
        expectedLower.includes(actualTab.toLowerCase())) {
      return actualTab;
    }
  }

  return null;
}

async function loadTab(
  tabName: string,
  storeId: string,
  authToken: string,
  requestId: string
): Promise<any[]> {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');

  try {
    // Build request body based on caching strategy
    const requestBody: any = { 
      operation: 'read', 
      storeId, 
      tabName 
    };

    // If using database cache strategy, pass cacheType parameter
    if (CACHING_STRATEGY === 'database') {
      requestBody.cacheType = 'database';
    }

    const response = await fetch(`${supabaseUrl}/functions/v1/google-sheet`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`,
        'apikey': authToken,
        'X-Request-ID': requestId,
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      return [];
    }

    const result = await response.json();
    return result.data || [];
  } catch (error) {
    console.error(`[loadTab] Error loading ${tabName}:`, error);
    return [];
  }
}

function buildSystemPrompt(store: StoreConfig, storeData: StoreData): string {
  const storeName = store?.name || 'our store';

  let prompt = `You are a helpful assistant for ${storeName}. Help customers with their questions about services, products, bookings, and store information.

RESPONSE GUIDELINES:
- Be warm, friendly, and professional
- Keep responses CONCISE (under 200 words unless explaining complex details)
- When listing services/products, show 3-4 highlights maximum, not the full list
- DO NOT include image URLs or markdown images in your response (the UI handles images separately)
- Present data naturally and conversationally - don't just dump lists
- Use emojis sparingly and appropriately
- Don't mention internal system details (functions, tools, confidence scores)

TOOL USAGE RULES:
- For booking requests, ALWAYS use get_booking_slots (not check_availability) to show the calendar
- For browsing ALL services, use get_services (returns complete list)
- For SPECIFIC service searches (e.g., "beginner classes", "relaxing"), use search_services with query
- For browsing ALL products, use get_products (returns complete list)
- For SPECIFIC product searches, use search_products with query
- For hours/contact/general info, use get_store_info
- For lead capture (user wants to be contacted), use submit_lead
- Only use create_booking when you have ALL required fields (service_name, date, time, name, email)
- For greetings like "hi" or "hello", respond conversationally without using tools

TODAY'S DATE: ${new Date().toISOString().split('T')[0]}
`;

  // Add store data context
  if (storeData.services?.length > 0) {
    prompt += `\nAvailable Services (${storeData.services.length} total):\n`;
    storeData.services.slice(0, 5).forEach((s: any) => {
      prompt += `- ${s.serviceName || s.name}: $${s.price || 'Price varies'}\n`;
    });
    if (storeData.services.length > 5) {
      prompt += `  ...and ${storeData.services.length - 5} more\n`;
    }
  }

  if (storeData.products?.length > 0) {
    prompt += `\nAvailable Products (${storeData.products.length} total):\n`;
    storeData.products.slice(0, 5).forEach((p: any) => {
      prompt += `- ${p.name || p.productName}: $${p.price || 'Price varies'}\n`;
    });
    if (storeData.products.length > 5) {
      prompt += `  ...and ${storeData.products.length - 5} more\n`;
    }
  }

  if (storeData.hours?.length > 0) {
    prompt += `\nStore Hours:\n`;
    storeData.hours.forEach((h: any) => {
      if (h.isOpen === true || h.isOpen === 'Yes' || h.isOpen === 'yes') {
        prompt += `- ${h.day}: ${h.openTime} - ${h.closeTime}\n`;
      }
    });
  }

  return prompt;
}

// ============================================================================
// MAIN HANDLER
// ============================================================================

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const requestId = req.headers.get('X-Request-ID') || crypto.randomUUID();
  const requestStart = performance.now();

  log(requestId, '📨 Native tool calling started');

  try {
    const body = await req.json();
    const { messages, storeId, model, cachedData, reasoningEnabled = false } = body;

    // Log endpoint and settings for verification
    log(requestId, '==========================================');
    log(requestId, 'Endpoint called: chat-completion-native');
    log(requestId, 'This is the NATIVE TOOL CALLING endpoint');
    log(requestId, '==========================================');
    log(requestId, 'Received settings:', {
      model: model || 'x-ai/grok-4.1-fast (default)',
      reasoningEnabled,
      storeId,
    });

    if (!messages || messages.length === 0 || !storeId) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: messages or storeId' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const OPENROUTER_API_KEY = Deno.env.get('OPENROUTER_API_KEY');
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    if (!OPENROUTER_API_KEY) {
      return new Response(
        JSON.stringify({ error: 'OPENROUTER_API_KEY not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get store config
    const supabase = createClient(supabaseUrl, serviceRoleKey);
    const { data: store, error: storeError } = await supabase
      .from('stores')
      .select('*')
      .eq('id', storeId)
      .single();

    if (storeError || !store) {
      return new Response(
        JSON.stringify({ error: 'Store not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const storeConfig: StoreConfig = {
      ...store,
      detected_schema: typeof store.detected_schema === 'string'
        ? JSON.parse(store.detected_schema)
        : store.detected_schema
    };

    // Build context for function execution
    const context = {
      storeId,
      userId: 'anonymous',
      authToken: serviceRoleKey,
      store: storeConfig,
      requestId,
      lastUserMessage: messages[messages.length - 1]?.content || ''
    };

    // Load store data (use cached if provided)
    const hasCachedServices = cachedData?.services && cachedData.services.length > 0;
    const hasCachedProducts = cachedData?.products && cachedData.products.length > 0;
    const hasCachedHours = cachedData?.hours && cachedData.hours.length > 0;

    if (hasCachedServices || hasCachedProducts || hasCachedHours) {
      log(requestId, '📦 Using client-provided cached data');
    }

    const detectedSchema = storeConfig.detected_schema || {};
    const servicesTab = findActualTabName('services', detectedSchema);
    const productsTab = findActualTabName('products', detectedSchema);
    const hoursTab = findActualTabName('hours', detectedSchema);

    const [services, products, hours] = await Promise.all([
      hasCachedServices ? Promise.resolve(cachedData.services) :
        (servicesTab ? loadTab(servicesTab, storeId, serviceRoleKey, requestId) : Promise.resolve([])),
      hasCachedProducts ? Promise.resolve(cachedData.products) :
        (productsTab ? loadTab(productsTab, storeId, serviceRoleKey, requestId) : Promise.resolve([])),
      hasCachedHours ? Promise.resolve(cachedData.hours) :
        (hoursTab ? loadTab(hoursTab, storeId, serviceRoleKey, requestId) : Promise.resolve([]))
    ]);

    const storeData: StoreData = { services, products, hours };

    // Add storeData to context for function handlers to use cached data
    (context as any).storeData = storeData;

    // Build system prompt
    const systemPrompt = buildSystemPrompt(storeConfig, storeData);

    // Prepare messages for OpenRouter
    const apiMessages: Array<{ role: string; content: string | null; tool_calls?: any[]; tool_call_id?: string }> = [
      { role: 'system', content: systemPrompt },
      ...messages.slice(-6) // Last 6 messages for context
    ];

    let finalResponse = '';
    let functionCalls: Array<{ name: string; args: any; result?: any; duration?: number }> = [];
    let functionResult: FunctionResult | null = null;
    let totalCalls = 0;
    const maxCalls = 5;
    let totalInputTokens = 0;
    let totalOutputTokens = 0;

    // Track timing breakdown for debug panel (similar to classifier mode)
    let intentDuration = 0;      // First LLM call (tool decision)
    let totalFunctionDuration = 0;  // Sum of all function executions
    let responseDuration = 0;    // Final LLM call (response generation)

    // Granular step tracking for QA parity with classifier mode
    const llmCallSteps: Array<{
      callNumber: number;
      duration: number;
      inputTokens: number;
      outputTokens: number;
      hasToolCalls: boolean;
      toolCallName?: string;
      contentLength: number;
    }> = [];
    const functionExecutionSteps: Array<{
      name: string;
      arguments: any;
      duration: number;
      success: boolean;
      error?: string;
    }> = [];

    // Token tracking per stage (for classifier parity)
    let classificationTokens = { input: 0, output: 0 };  // First LLM call (intent/tool decision)
    let responseTokens = { input: 0, output: 0 };        // Final LLM call (response generation)

    // Reasoning tracking
    let reasoning: string | null = null;
    let reasoningDetails: any[] | null = null;
    let reasoningDuration = 0;

    // Check if model supports reasoning
    const modelId = model || 'x-ai/grok-4.1-fast';
    const modelConfig = getReasoningConfig(modelId);
    const shouldUseReasoning = reasoningEnabled && modelConfig.supportsReasoning;

    log(requestId, '🧠 Reasoning config:', {
      requestedModel: modelId,
      supportsReasoning: modelConfig.supportsReasoning,
      reasoningEnabled,
      willUseReasoning: shouldUseReasoning,
    });

    // Iterative tool calling loop
    while (totalCalls < maxCalls) {
      totalCalls++;
      log(requestId, `🔄 LLM call #${totalCalls}`);

      const llmStart = performance.now();

      // Build request body with conditional reasoning
      const requestBody: Record<string, any> = {
        model: modelId,
        messages: apiMessages,
        tools: tools,
        tool_choice: 'auto',
        temperature: 0.3,
        max_tokens: 600,  // Reduced from 1000 to match responder (prevent verbose responses)
      };

      // Add reasoning parameter if enabled and supported
      if (shouldUseReasoning) {
        if (modelConfig.reasoningParam === 'legacy_deepseek') {
          // DeepSeek R1 uses legacy parameter
          requestBody.include_reasoning = true;
        } else if (modelConfig.reasoningParam === 'unified_enabled') {
          // Simple enabled flag (for models like Grok that don't support effort)
          requestBody.reasoning = { enabled: true };
        } else {
          // Unified reasoning parameter with effort (default)
          requestBody.reasoning = {
            effort: modelConfig.defaultEffort || 'medium'
          };
        }
        log(requestId, '🧠 Reasoning enabled with:', requestBody.reasoning || requestBody.include_reasoning);
      }

      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://heysheets.com',
          'X-Title': 'HeySheets Native Tool Calling'
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        const errorText = await response.text();
        log(requestId, '❌ OpenRouter error', { status: response.status, error: errorText });
        throw new Error(`OpenRouter API error: ${response.status}`);
      }

      const result = await response.json();
      const llmDuration = performance.now() - llmStart;

      // Track tokens
      if (result.usage) {
        totalInputTokens += result.usage.prompt_tokens || 0;
        totalOutputTokens += result.usage.completion_tokens || 0;
      }

      const message = result.choices?.[0]?.message;
      if (!message) {
        throw new Error('No message in OpenRouter response');
      }

      // Extract reasoning from response if present
      if (shouldUseReasoning) {
        // Check for simple reasoning field
        if (message.reasoning && !reasoning) {
          reasoning = message.reasoning;
          reasoningDuration += llmDuration; // Attribute LLM time to reasoning
          log(requestId, '🧠 Got reasoning (simple):', { length: reasoning?.length });
        }

        // Check for detailed reasoning_details array
        if (message.reasoning_details && Array.isArray(message.reasoning_details)) {
          reasoningDetails = message.reasoning_details;

          // Extract text for simple display if not already set
          if (!reasoning) {
            reasoning = message.reasoning_details
              .filter((r: any) => r.type === 'reasoning.text' || r.type === 'reasoning.summary')
              .map((r: any) => r.text || r.summary?.join('\n') || '')
              .join('\n\n');
            reasoningDuration += llmDuration;
          }
          log(requestId, '🧠 Got reasoning_details:', { count: reasoningDetails?.length });
        }
      }

      log(requestId, `✅ LLM response (${llmDuration.toFixed(0)}ms)`, {
        hasToolCalls: !!message.tool_calls?.length,
        contentLength: message.content?.length || 0,
        hasReasoning: !!message.reasoning || !!message.reasoning_details
      });

      // Track this LLM call for granular step logging
      const callInputTokens = result.usage?.prompt_tokens || 0;
      const callOutputTokens = result.usage?.completion_tokens || 0;
      llmCallSteps.push({
        callNumber: totalCalls,
        duration: llmDuration,
        inputTokens: callInputTokens,
        outputTokens: callOutputTokens,
        hasToolCalls: !!message.tool_calls?.length,
        toolCallName: message.tool_calls?.[0]?.function?.name,
        contentLength: message.content?.length || 0,
      });

      // Track tokens per stage: first call with tool = classification, final call without tool = response
      if (message.tool_calls && message.tool_calls.length > 0) {
        // This is a tool-decision call (like classifier)
        if (classificationTokens.input === 0) {
          classificationTokens = { input: callInputTokens, output: callOutputTokens };
        }
      } else {
        // This is the final response call (like responder)
        responseTokens = { input: callInputTokens, output: callOutputTokens };
      }

      // Check if AI wants to call a tool
      if (message.tool_calls && message.tool_calls.length > 0) {
        // First LLM call with tool decision = intentDuration
        if (intentDuration === 0) {
          intentDuration = llmDuration;
        }
        const toolCall = message.tool_calls[0];
        const functionName = toolCall.function.name;
        let functionArgs: Record<string, any> = {};

        try {
          functionArgs = JSON.parse(toolCall.function.arguments || '{}');
        } catch (e) {
          console.warn('[Native] Failed to parse tool arguments:', toolCall.function.arguments);
        }

        log(requestId, `🔧 Tool call: ${functionName}`, functionArgs);

        // Execute the function
        const functionStart = performance.now();
        functionResult = await executeFunction(functionName, functionArgs, context);
        const functionDuration = performance.now() - functionStart;

        functionCalls.push({
          name: functionName,
          args: functionArgs,
          result: functionResult,
          duration: functionDuration
        });

        // Track function execution step for granular logging
        functionExecutionSteps.push({
          name: functionName,
          arguments: functionArgs,
          duration: functionDuration,
          success: functionResult?.success ?? false,
          error: functionResult?.error,
        });

        // Accumulate function duration for timeline
        totalFunctionDuration += functionDuration;

        log(requestId, `✅ Function ${functionName} (${functionDuration.toFixed(0)}ms)`, {
          success: functionResult?.success,
          skipResponder: functionResult?.skipResponder
        });

        // Check for skipResponder pattern (deterministic response)
        if (functionResult?.skipResponder && functionResult?.message) {
          log(requestId, '🎯 Using skipResponder - deterministic response');
          finalResponse = functionResult.message;
          break;
        }

        // Slim the function result before passing back to LLM
        // This removes imageURL, tags, and truncates descriptions to reduce token usage
        const slimmedData = slimForResponder(functionName, functionResult?.data);

        // Add tool call and result to messages
        apiMessages.push({
          role: 'assistant',
          content: null,
          tool_calls: message.tool_calls
        });
        apiMessages.push({
          role: 'tool',
          tool_call_id: toolCall.id,
          content: JSON.stringify({
            success: functionResult?.success,
            data: slimmedData,  // Use slimmed data instead of full data
            message: functionResult?.message,
            error: functionResult?.error
          })
        });

        // Continue loop for AI to process result
        continue;
      }

      // No tool call - this is the final text response
      responseDuration = llmDuration;  // Track final response duration
      finalResponse = message.content || '';
      break;
    }

    // If no functions were called, the intentDuration is the entire response time
    // (i.e., it was a simple greeting without tool use)
    if (functionCalls.length === 0) {
      intentDuration = responseDuration;
      responseDuration = 0;
    }

    const totalDuration = performance.now() - requestStart;

    // Calculate cost (using Grok 4.1 Fast pricing as default)
    const pricing = { input: 0.20, output: 0.50 }; // per 1M tokens
    const totalCost = (totalInputTokens / 1_000_000) * pricing.input +
                     (totalOutputTokens / 1_000_000) * pricing.output;

    log(requestId, `⏱️ Timing breakdown: intent=${intentDuration.toFixed(0)}ms, function=${totalFunctionDuration.toFixed(0)}ms, response=${responseDuration.toFixed(0)}ms, total=${totalDuration.toFixed(0)}ms`);
    log(requestId, `✨ Complete (${totalDuration.toFixed(0)}ms)`, {
      llmCalls: totalCalls,
      functionCalls: functionCalls.length,
      tokens: { input: totalInputTokens, output: totalOutputTokens },
      cost: totalCost.toFixed(4)
    });

    // Build granular steps array with proper naming:
    // Tool Selection (LLM picks tool) → Function Execution → ... → LLM Response
    // For native loop, we track each Tool Selection + Function Execution pair
    const detectedIntent = functionCalls.length > 0 
      ? functionCalls[functionCalls.length - 1]?.name || 'FUNCTION_CALL'
      : 'GREETING';
    
    const steps: Array<{
      name: string;
      function: string;
      status: 'success' | 'error';
      duration: number;
      functionCalled?: string;
      result?: any;
      error?: any;
    }> = [];

    // Build interleaved Tool Selection + Function Execution steps from the loop
    // Each llmCallStep with hasToolCalls=true is followed by a functionExecutionStep
    let funcIdx = 0;
    for (const llmCall of llmCallSteps) {
      if (llmCall.hasToolCalls && funcIdx < functionExecutionSteps.length) {
        // Tool Selection step (LLM call that selected a tool)
        steps.push({
          name: llmCallSteps.length > 2 ? `Tool Selection #${llmCall.callNumber}` : 'Tool Selection',
          function: 'native-tool-calling',
          status: 'success',
          duration: llmCall.duration,
          functionCalled: llmCall.toolCallName,
          result: {
            toolSelected: llmCall.toolCallName,
            llmCallNumber: llmCall.callNumber,
            tokens: { input: llmCall.inputTokens, output: llmCall.outputTokens },
          },
        });

        // Corresponding Function Execution step
        const funcStep = functionExecutionSteps[funcIdx];
        steps.push({
          name: 'Function Execution',
          function: 'tools',
          status: funcStep.success ? 'success' : 'error',
          duration: funcStep.duration,
          functionCalled: funcStep.name,
          result: funcStep.success ? { function: funcStep.name, args: funcStep.arguments } : undefined,
          error: !funcStep.success ? { message: funcStep.error || 'Function execution failed', args: funcStep.arguments } : undefined,
        });
        funcIdx++;
      } else if (!llmCall.hasToolCalls && llmCall.contentLength > 0) {
        // This is the final LLM Response call (no tool, has content)
        steps.push({
          name: 'LLM Response',
          function: 'native-responder',
          status: 'success',
          duration: llmCall.duration,
          result: {
            length: llmCall.contentLength,
            llmCallNumber: llmCall.callNumber,
            tokens: { input: llmCall.inputTokens, output: llmCall.outputTokens },
          },
        });
      }
    }

    // Handle skipResponder case (deterministic response, no final LLM call)
    if (functionResult?.skipResponder && !steps.some(s => s.name === 'LLM Response')) {
      steps.push({
        name: 'LLM Response',
        function: 'skipResponder',
        status: 'success',
        duration: 0,
        result: {
          length: finalResponse?.length || 0,
          note: 'Deterministic response - LLM bypassed',
        },
      });
    }

    // Fallback: if no Tool Selection steps but we have function calls, add them the old way
    // (shouldn't happen, but safety net)
    if (steps.length === 0 && functionExecutionSteps.length > 0) {
      steps.push({
        name: 'Tool Selection',
        function: 'native-tool-calling',
        status: 'success',
        duration: intentDuration,
        result: {
          intent: detectedIntent,
          confidence: 90,
          reasoning: reasoning || 'Native tool calling - model selected tool directly',
          tokens: classificationTokens,
        },
      });
      for (const funcStep of functionExecutionSteps) {
        steps.push({
          name: 'Function Execution',
          function: 'tools',
          status: funcStep.success ? 'success' : 'error',
          duration: funcStep.duration,
          functionCalled: funcStep.name,
          result: funcStep.success ? { function: funcStep.name, args: funcStep.arguments } : undefined,
          error: !funcStep.success ? { message: funcStep.error || 'Function execution failed', args: funcStep.arguments } : undefined,
        });
      }
      if (responseDuration > 0) {
        steps.push({
          name: 'LLM Response',
          function: 'native-responder',
          status: 'success',
          duration: responseDuration,
          result: { length: finalResponse?.length || 0, tokens: responseTokens },
        });
      }
    }

    // Handle simple greeting (no tools called)
    if (steps.length === 0 && functionCalls.length === 0) {
      steps.push({
        name: 'LLM Response',
        function: 'native-responder',
        status: 'success',
        duration: intentDuration, // For greetings, intentDuration holds the full response time
        result: {
          length: finalResponse?.length || 0,
          note: 'Direct response - no tool selection',
          tokens: classificationTokens,
        },
      });
    }

    // Log steps array for QA verification
    log(requestId, `📊 Built ${steps.length} steps for QA:`, steps.map(s => ({
      name: s.name,
      duration: s.duration,
      functionCalled: s.functionCalled,
    })));

    // Calculate per-stage costs for classifier parity
    const classificationCost = (classificationTokens.input / 1_000_000) * pricing.input +
                               (classificationTokens.output / 1_000_000) * pricing.output;
    const responseCost = (responseTokens.input / 1_000_000) * pricing.input +
                         (responseTokens.output / 1_000_000) * pricing.output;

    // Build response with classifier-compatible debug schema
    const responsePayload = {
      text: finalResponse,
      intent: detectedIntent,
      confidence: 90, // Native tool calling has high confidence
      functionCalled: functionCalls[functionCalls.length - 1]?.name || null,
      functionResult: functionResult,
      debug: {
        endpoint: 'chat-completion-native',  // Confirm which endpoint was used
        reasoningEnabled: shouldUseReasoning, // Actual reasoning status (after model check)
        mode: 'native-tool-calling',
        llmCalls: totalCalls,
        totalDuration,
        // Timeline breakdown (compatible with classifier mode debug panel)
        intentDuration,        // Tool decision time (first LLM call)
        functionDuration: totalFunctionDuration,  // Total function execution time
        responseDuration,      // Response generation time (final LLM call)
        reasoningDuration: reasoningDuration > 0 ? reasoningDuration : undefined,  // Time spent on reasoning
        // Reasoning content (if available)
        reasoning,             // Simple text version
        reasoningDetails,      // Full structured version (if available)
        // Intent/Tool Selection object matching classifier schema
        intent: {
          detected: detectedIntent,
          confidence: 90,
          duration: intentDuration,
          reasoning: reasoning || 'Native tool calling - model selected tool directly',
        },
        // Renamed timing fields for clarity
        toolSelectionDuration: intentDuration,   // Time for LLM to select tool(s)
        llmResponseDuration: responseDuration,   // Time for final LLM response
        // Function calls array (existing format)
        functionCalls: functionCalls.map(fc => ({
          name: fc.name,
          arguments: fc.args,
          result: {
            success: fc.result?.success,
            data: fc.result?.data,
            error: fc.result?.error
          },
          duration: fc.duration
        })),
        // Token breakdown matching classifier schema (per-stage + total)
        tokens: {
          classification: classificationTokens,
          response: responseTokens,
          total: { input: totalInputTokens, output: totalOutputTokens, cached: 0 }
        },
        // Cost breakdown matching classifier schema (per-stage + total)
        cost: {
          classification: classificationCost,
          response: responseCost,
          total: totalCost
        },
        // Granular steps array matching classifier schema
        steps,
        // Additional native-specific debug info (LLM call details)
        llmCallDetails: llmCallSteps,
      }
    };

    return new Response(JSON.stringify(responsePayload), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
        'X-Request-ID': requestId,
        'Server-Timing': `total;dur=${totalDuration}`
      }
    });

  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    log(requestId, '❌ Error', { error: errorMsg });

    return new Response(
      JSON.stringify({
        error: 'Internal server error',
        details: errorMsg,
        requestId
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

console.log('[chat-completion-native] Native tool calling function loaded');
