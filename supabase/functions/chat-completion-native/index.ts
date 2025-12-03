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

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-request-id',
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
          prefill_date: {
            type: 'string',
            description: 'Pre-selected date if user mentioned one (YYYY-MM-DD)'
          },
          prefill_time: {
            type: 'string',
            description: 'Pre-selected time if user mentioned one (HH:MM)'
          },
          prefill_name: {
            type: 'string',
            description: "User's name if mentioned"
          },
          prefill_email: {
            type: 'string',
            description: "User's email if mentioned"
          },
          prefill_phone: {
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
      description: 'Create an actual booking with calendar invite. ONLY call this when you have ALL required info: service_name, date, time, customer_name, AND customer_email. Usually called from booking calendar UI.',
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
          customer_name: {
            type: 'string',
            description: 'Full name of person making booking'
          },
          customer_email: {
            type: 'string',
            description: 'Email address for confirmation'
          },
          customer_phone: {
            type: 'string',
            description: 'Phone number (optional)'
          }
        },
        required: ['service_name', 'date', 'time', 'customer_name', 'customer_email']
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
    const response = await fetch(`${supabaseUrl}/functions/v1/google-sheet`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`,
        'apikey': authToken,
        'X-Request-ID': requestId,
      },
      body: JSON.stringify({
        operation: 'read',
        storeId,
        tabName
      })
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

Be friendly, helpful, and conversational. When you need specific data, use the available tools.

IMPORTANT RULES:
- For booking requests, ALWAYS use get_booking_slots (not check_availability) to show the calendar
- For browsing ALL services, use get_services (returns complete list)
- For SPECIFIC service searches (e.g., "beginner classes", "relaxing"), use search_services with query
- For browsing ALL products, use get_products (returns complete list)
- For SPECIFIC product searches, use search_products with query
- For hours/contact/general info, use get_store_info
- For lead capture (user wants to be contacted), use submit_lead
- Only use create_booking when you have ALL required fields (service_name, date, time, customer_name, customer_email)
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

    // Iterative tool calling loop
    while (totalCalls < maxCalls) {
      totalCalls++;
      log(requestId, `🔄 LLM call #${totalCalls}`);

      const llmStart = performance.now();
      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://heysheets.com',
          'X-Title': 'HeySheets Native Tool Calling'
        },
        body: JSON.stringify({
          model: model || 'x-ai/grok-4.1-fast',
          messages: apiMessages,
          tools: tools,
          tool_choice: 'auto',
          temperature: 0.3,
          max_tokens: 1000,
          // Pass reasoning setting from request (defaults to disabled)
          reasoning: { enabled: reasoningEnabled },
        })
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

      log(requestId, `✅ LLM response (${llmDuration.toFixed(0)}ms)`, {
        hasToolCalls: !!message.tool_calls?.length,
        contentLength: message.content?.length || 0
      });

      // Check if AI wants to call a tool
      if (message.tool_calls && message.tool_calls.length > 0) {
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
            data: functionResult?.data,
            message: functionResult?.message,
            error: functionResult?.error
          })
        });

        // Continue loop for AI to process result
        continue;
      }

      // No tool call - this is the final text response
      finalResponse = message.content || '';
      break;
    }

    const totalDuration = performance.now() - requestStart;

    // Calculate cost (using Grok 4.1 Fast pricing as default)
    const pricing = { input: 0.20, output: 0.50 }; // per 1M tokens
    const totalCost = (totalInputTokens / 1_000_000) * pricing.input +
                     (totalOutputTokens / 1_000_000) * pricing.output;

    log(requestId, `✨ Complete (${totalDuration.toFixed(0)}ms)`, {
      llmCalls: totalCalls,
      functionCalls: functionCalls.length,
      tokens: { input: totalInputTokens, output: totalOutputTokens },
      cost: totalCost.toFixed(4)
    });

    // Build response
    const responsePayload = {
      text: finalResponse,
      intent: functionCalls.length > 0 ? 'FUNCTION_CALL' : 'GREETING',
      confidence: 90, // Native tool calling has high confidence
      functionCalled: functionCalls[functionCalls.length - 1]?.name || null,
      functionResult: functionResult,
      debug: {
        endpoint: 'chat-completion-native',  // Confirm which endpoint was used
        reasoningEnabled,                     // Confirm reasoning setting
        mode: 'native-tool-calling',
        llmCalls: totalCalls,
        totalDuration,
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
        tokens: {
          total: { input: totalInputTokens, output: totalOutputTokens, cached: 0 }
        },
        cost: {
          total: totalCost
        },
        steps: [
          {
            name: 'Native Tool Calling',
            function: 'chat-completion-native',
            status: 'success',
            duration: totalDuration,
            result: {
              llmCalls: totalCalls,
              functionsExecuted: functionCalls.map(fc => fc.name)
            }
          }
        ]
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
