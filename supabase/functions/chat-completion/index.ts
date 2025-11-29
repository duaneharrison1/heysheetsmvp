import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import {
  Classification,
  Message,
  StoreData,
  StoreConfig,
  FunctionResult,
  ChatCompletionRequest,
  ChatCompletionResponse
} from '../_shared/types.ts';
import { classifyIntent } from '../classifier/index.ts';
import { generateResponse } from '../responder/index.ts';
import { executeFunction } from '../tools/index.ts';

// ============================================================================
// CORS HEADERS
// ============================================================================

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-request-id',
};

// ============================================================================
// LOGGING HELPER
// ============================================================================

function log(requestId: string, message: string, data?: any) {
  const timestamp = new Date().toISOString();
  const logData = data ? JSON.stringify(data) : '';
  console.log(`[${timestamp}] [REQUEST_ID:${requestId}] ${message}`, logData);
}

// ============================================================================
// MAIN HANDLER
// ============================================================================

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  // 🆕 EXTRACT CORRELATION ID & START TIMING
  const requestId = req.headers.get('X-Request-ID') || crypto.randomUUID();
  const requestStart = performance.now();

  log(requestId, '📨 Chat completion started');

  try {
    // Parse request
    const body: ChatCompletionRequest = await req.json();
    const { messages, storeId, model, simpleMode } = body;

    // 🆕 SIMPLE MODE: Just do a raw LLM call, no chatbot logic
    if (simpleMode) {
      log(requestId, '🔧 Simple mode - raw LLM call');

      const OPENROUTER_API_KEY = Deno.env.get('OPENROUTER_API_KEY');
      if (!OPENROUTER_API_KEY) {
        return new Response(
          JSON.stringify({ error: 'OPENROUTER_API_KEY not configured' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const openRouterResponse = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
          'HTTP-Referer': 'https://heysheets.com',
          'X-Title': 'HeySheets QA'
        },
        body: JSON.stringify({
          model: model || 'x-ai/grok-4.1-fast',
          messages: messages,
          temperature: 0.7,
          max_tokens: 500
        })
      });

      if (!openRouterResponse.ok) {
        const errorText = await openRouterResponse.text();
        log(requestId, '❌ OpenRouter error', { status: openRouterResponse.status, error: errorText });
        return new Response(
          JSON.stringify({ error: 'LLM call failed', details: errorText }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const openRouterData = await openRouterResponse.json();
      const text = openRouterData.choices?.[0]?.message?.content || '';

      log(requestId, '✅ Simple mode complete', { textLength: text.length });

      return new Response(
        JSON.stringify({ text }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json', 'X-Request-ID': requestId } }
      );
    }

    if (!messages || messages.length === 0 || !storeId) {
      log(requestId, '❌ Missing required fields');
      return new Response(
        JSON.stringify({ error: 'Missing required fields: messages or storeId' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json', 'X-Request-ID': requestId } }
      );
    }

    log(requestId, '💬 User message', { messageCount: messages.length, storeId, model: model || 'x-ai/grok-4.1-fast (default)' });

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Load store configuration (including detected_schema)
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

    // Parse detected_schema if it's a string
    const storeConfig: StoreConfig = {
      ...store,
      detected_schema: typeof store.detected_schema === 'string'
        ? JSON.parse(store.detected_schema)
        : store.detected_schema
    };

    console.log('[Orchestrator] Store config:', {
      id: storeConfig.id,
      name: storeConfig.name,
      hasDetectedSchema: !!storeConfig.detected_schema,
      schemaKeys: storeConfig.detected_schema ? Object.keys(storeConfig.detected_schema) : []
    });

    // Pre-load store data for classification context (using detected schema)
    let storeData: StoreData = {
      services: [],
      products: [],
      hours: []
    };

    try {
      const detectedSchema = storeConfig.detected_schema || {};

      // Find actual tab names using fuzzy matching
      const servicesTab = findActualTabName('services', detectedSchema);
      const productsTab = findActualTabName('products', detectedSchema);
      const hoursTab = findActualTabName('hours', detectedSchema);

      // Load data in parallel using SERVICE_ROLE_KEY for authentication
      const [services, products, hours] = await Promise.all([
        servicesTab ? loadTab(servicesTab, storeId, serviceRoleKey, requestId) : Promise.resolve([]),
        productsTab ? loadTab(productsTab, storeId, serviceRoleKey, requestId) : Promise.resolve([]),
        hoursTab ? loadTab(hoursTab, storeId, serviceRoleKey, requestId) : Promise.resolve([])
      ]);

      storeData = { services, products, hours };
    } catch (error) {
      console.error('[Orchestrator] Error pre-loading data:', error);
    }

    // Step 1: Classify intent and extract parameters
    log(requestId, '🎯 Classifying intent...');
    const classifyStart = performance.now();

    const { classification, usage: classifyUsage } = await classifyIntent(messages, { storeData }, model);

    const classifyDuration = performance.now() - classifyStart;
    log(requestId, `✅ Intent: ${classification.intent} (${classifyDuration.toFixed(0)}ms)`, {
      confidence: classification.confidence,
      function: classification.function_to_call,
    });

    // Step 2: Execute function if classified
    let functionResult: FunctionResult | undefined;
    let functionDuration = 0;

    if (classification.function_to_call && classification.function_to_call !== 'null') {
      log(requestId, '🔧 Executing function:', { function: classification.function_to_call });
      const functionStart = performance.now();

      // Get the last user message for form data parsing
      const lastUserMessage = messages.filter(m => m.role === 'user').pop()?.content || '';

      functionResult = await executeFunction(
        classification.function_to_call,
        classification.extracted_params,
        {
          storeId,
          userId: 'anonymous', // Public access, no user ID
          authToken: serviceRoleKey,  // Use SERVICE_ROLE_KEY for internal function calls
          store: storeConfig,
          requestId,  // Pass correlation ID for tracing
          lastUserMessage  // Pass last message for form data parsing
        }
      );

      functionDuration = performance.now() - functionStart;
      log(requestId, `✅ Function complete (${functionDuration.toFixed(0)}ms)`, {
        success: functionResult?.success
      });
    }

    // Get pricing based on actual model used (fallback to Grok 4.1 Fast if not found)
    const modelPricing: Record<string, { input: number; output: number }> = {
      'anthropic/claude-sonnet-4.5': { input: 3.0, output: 15.0 },
      'google/gemini-3-pro-preview': { input: 2.0, output: 12.0 },
      'anthropic/claude-haiku-4.5': { input: 1.0, output: 5.0 },
      'openai/gpt-5.1': { input: 0.30, output: 1.20 },
      'openai/gpt-5.1-chat': { input: 0.30, output: 1.20 },
      'google/gemini-2.5-flash': { input: 0.30, output: 2.50 },
      'deepseek/deepseek-chat-v3.1': { input: 0.27, output: 1.10 },
      'minimax/minimax-m2': { input: 0.26, output: 1.02 },
      'qwen/qwen3-235b-a22b-2507': { input: 0.22, output: 0.95 },
      'x-ai/grok-4.1-fast': { input: 0.20, output: 0.50 },
      'openai/gpt-4o-mini': { input: 0.15, output: 0.60 },
    };
    const pricing = model ? (modelPricing[model] ?? modelPricing['x-ai/grok-4.1-fast']) : modelPricing['x-ai/grok-4.1-fast'];

    // Check if function wants to bypass LLM responder (deterministic response)
    // This is the demo-dh "OrderAgent" pattern for critical responses
    if (functionResult?.skipResponder && functionResult?.message) {
      log(requestId, '🎯 Using deterministic response (skipResponder)');
      const totalDuration = performance.now() - requestStart;

      // Build response without calling LLM responder
      const response: ChatCompletionResponse = {
        text: functionResult.message,
        intent: classification.intent,
        confidence: classification.confidence,
        functionCalled: classification.function_to_call || undefined,
        functionResult,
        debug: {
          intentDuration: classifyDuration,
          functionDuration,
          responseDuration: 0, // No responder call
          totalDuration,
          intent: {
            detected: classification.intent,
            confidence: classification.confidence,
            duration: classifyDuration,
            reasoning: classification.reasoning,
          },
          functionCalls: [{
            name: classification.function_to_call || '',
            arguments: classification.extracted_params || {},
            result: {
              success: functionResult.success,
              data: functionResult.data,
              error: functionResult.error,
            },
            duration: functionDuration,
          }],
          tokens: {
            classification: { input: classifyUsage.input, output: classifyUsage.output },
            response: { input: 0, output: 0 }, // No responder tokens
            total: { input: classifyUsage.input, output: classifyUsage.output, cached: 0 },
          },
          cost: {
            classification: (classifyUsage.input / 1_000_000) * pricing.input + (classifyUsage.output / 1_000_000) * pricing.output,
            response: 0,
            total: (classifyUsage.input / 1_000_000) * pricing.input + (classifyUsage.output / 1_000_000) * pricing.output,
          },
          steps: [
            {
              name: 'Intent Classification',
              function: 'classifier',
              status: 'success',
              duration: classifyDuration,
              result: {
                intent: classification.intent,
                confidence: classification.confidence,
                reasoning: classification.reasoning,
                params: classification.extracted_params,
              },
            },
            {
              name: 'Function Execution',
              function: 'tools',
              status: functionResult.success ? 'success' : 'error',
              duration: functionDuration,
              functionCalled: classification.function_to_call,
              result: functionResult.success ? functionResult.data : undefined,
            },
            {
              name: 'Response Generation',
              function: 'skipResponder',
              status: 'success',
              duration: 0,
              result: {
                length: functionResult.message.length,
                note: 'Deterministic response - LLM bypassed',
              },
            },
          ],
        },
      };

      log(requestId, `✨ Complete with skipResponder (${totalDuration.toFixed(0)}ms)`);

      return new Response(JSON.stringify(response), {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
          'X-Request-ID': requestId,
          'Server-Timing': `total;dur=${totalDuration}`,
        }
      });
    }

    // Step 3: Generate response using LLM
    log(requestId, '💬 Generating response...');
    const responseStart = performance.now();

    const { text: responseText, suggestions, usage: responseUsage } = await generateResponse(
      messages,
      classification,
      functionResult,
      storeConfig,
      model
    );

    const responseDuration = performance.now() - responseStart;
    const totalDuration = performance.now() - requestStart;

    // Aggregate token usage and calculate cost
    const totalInputTokens = classifyUsage.input + responseUsage.input;
    const totalOutputTokens = classifyUsage.output + responseUsage.output;

    const inputCost = (totalInputTokens / 1_000_000) * pricing.input;
    const outputCost = (totalOutputTokens / 1_000_000) * pricing.output;
    const totalCost = inputCost + outputCost;

    log(requestId, `✅ Response generated (${responseDuration.toFixed(0)}ms)`);
    log(requestId, `📊 Tokens: ${totalInputTokens} in, ${totalOutputTokens} out, $${totalCost.toFixed(4)}`);
    log(requestId, `✨ Complete (${totalDuration.toFixed(0)}ms)`);

    // Step 4: Return response
    const response: ChatCompletionResponse = {
      text: responseText,
      intent: classification.intent,
      confidence: classification.confidence,
      functionCalled: classification.function_to_call || undefined,
      functionResult,
      suggestions, // Dynamic suggestions from responder
      // 🆕 ADD DEBUG METADATA (frontend will filter in production)
      debug: {
        intentDuration: classifyDuration,
        functionDuration,
        responseDuration,
        totalDuration,
        intent: {
          detected: classification.intent,
          confidence: classification.confidence,
          duration: classifyDuration,
          reasoning: classification.reasoning, // 🆕 Add reasoning from classifier
        },
        functionCalls: functionResult ? [{
          name: classification.function_to_call || '',
          arguments: classification.extracted_params || {},
          result: {
            success: functionResult.success,
            data: functionResult.data,
            error: functionResult.error,
          },
          duration: functionDuration,
        }] : [],
        tokens: {
          classification: { input: classifyUsage.input, output: classifyUsage.output },
          response: { input: responseUsage.input, output: responseUsage.output },
          total: { input: totalInputTokens, output: totalOutputTokens, cached: 0 },
        },
        cost: {
          classification: (classifyUsage.input / 1_000_000) * pricing.input + (classifyUsage.output / 1_000_000) * pricing.output,
          response: (responseUsage.input / 1_000_000) * pricing.input + (responseUsage.output / 1_000_000) * pricing.output,
          total: totalCost,
        },
        // 🆕 ADD: Step-by-step breakdown for enhanced debugging
        steps: [
          {
            name: 'Intent Classification',
            function: 'classifier',
            status: 'success',
            duration: classifyDuration,
            result: {
              intent: classification.intent,
              confidence: classification.confidence,
              reasoning: classification.reasoning,
              params: classification.extracted_params,
            },
          },
          ...(classification.function_to_call && classification.function_to_call !== 'null' ? [{
            name: 'Function Execution',
            function: 'tools',
            status: functionResult?.success ? 'success' : 'error',
            duration: functionDuration,
            functionCalled: classification.function_to_call,
            result: functionResult?.success ? functionResult.data : undefined,
            error: !functionResult?.success ? {
              message: functionResult?.error || 'Function execution failed',
              args: classification.extracted_params,
            } : undefined,
          }] : []),
          {
            name: 'Response Generation',
            function: 'responder',
            status: 'success',
            duration: responseDuration,
            result: {
              length: responseText?.length || 0,
              tokens: { input: responseUsage.input, output: responseUsage.output },
            },
          },
        ],
      },
    };

    return new Response(JSON.stringify(response), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
        'X-Request-ID': requestId,
        'Server-Timing': `total;dur=${totalDuration}`,
      }
    });

  } catch (error) {
    log(requestId, '❌ Error', { error: error instanceof Error ? error.message : String(error) });
    return new Response(
      JSON.stringify({
        error: 'Internal server error',
        details: error instanceof Error ? error.message : String(error),
        requestId,
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json', 'X-Request-ID': requestId } }
    );
  }
});

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Find actual tab name from detected schema using fuzzy matching
 */
function findActualTabName(
  expectedTab: string,
  detectedSchema: Record<string, any>
): string | null {
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

/**
 * Load data from Google Sheet tab via google-sheet edge function
 * Uses SERVICE_ROLE_KEY for authentication to allow internal edge function calls
 */
async function loadTab(
  tabName: string,
  storeId: string,
  authToken: string,
  requestId?: string
): Promise<any[]> {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');

  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${authToken}`,
      'apikey': authToken
    };

    // Add correlation ID if provided
    if (requestId) {
      headers['X-Request-ID'] = requestId;
    }

    const response = await fetch(`${supabaseUrl}/functions/v1/google-sheet`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        operation: 'read',
        storeId,
        tabName
      })
    });

    if (!response.ok) {
      console.error(`[loadTab] Failed to load ${tabName}:`, await response.text());
      return [];
    }

    const result = await response.json();
    return result.data || [];
  } catch (error) {
    console.error(`[loadTab] Error loading ${tabName}:`, error);
    return [];
  }
}

console.log('Chat completion function started (modular architecture)');
