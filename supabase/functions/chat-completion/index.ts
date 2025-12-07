/**
 * CHAT COMPLETION ORCHESTRATOR
 * ============================
 * Main entry point for chat completion requests.
 * Orchestrates: Classifier → Function Execution → Responder
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import {
  Message,
  StoreData,
  StoreConfig,
  FunctionResult,
  ChatCompletionRequest,
  ChatCompletionResponse
} from '../_shared/types.ts';
import { corsHeaders } from '../_shared/cors.ts';
import {
  DEFAULT_MODEL,
  getModelPricing,
  calculateCost,
} from '../_shared/config.ts';
import { classifyIntent } from '../classifier/index.ts';
import { generateResponse } from '../responder/index.ts';
import { executeFunction } from '../tools/index.ts';

// ============================================================================
// LOGGING
// ============================================================================

function log(requestId: string, message: string, data?: any) {
  const timestamp = new Date().toISOString();
  const logData = data ? JSON.stringify(data) : '';
  console.log(`[${timestamp}] [REQUEST_ID:${requestId}] ${message}`, logData);
}

// ============================================================================
// DATA LOADING
// ============================================================================

/** Find actual tab name from detected schema using fuzzy matching */
function findActualTabName(
  expectedTab: string,
  detectedSchema: Record<string, any>
): string | null {
  if (!detectedSchema || typeof detectedSchema !== 'object') {
    console.warn('[findActualTabName] Invalid or missing detectedSchema:', detectedSchema);
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

/** Load data from Google Sheet tab via edge function */
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
      'apikey': authToken,
    };

    if (requestId) {
      headers['X-Request-ID'] = requestId;
    }

    const response = await fetch(`${supabaseUrl}/functions/v1/google-sheet`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ operation: 'read', storeId, tabName }),
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

/** Pre-load store data from sheets or use cached data */
interface LoadStoreDataResult {
  storeData: StoreData;
  duration: number;
}

async function loadStoreData(
  storeConfig: StoreConfig,
  cachedData: { services?: any[]; products?: any[]; hours?: any[] } | undefined,
  storeId: string,
  serviceRoleKey: string,
  requestId: string
): Promise<LoadStoreDataResult> {
  const startTime = performance.now();
  const storeData: StoreData = { services: [], products: [], hours: [] };

  const hasCachedServices = cachedData?.services && cachedData.services.length > 0;
  const hasCachedProducts = cachedData?.products && cachedData.products.length > 0;
  const hasCachedHours = cachedData?.hours && cachedData.hours.length > 0;

  if (hasCachedServices || hasCachedProducts || hasCachedHours) {
    log(requestId, '📦 Using client-provided cached data', {
      services: cachedData?.services?.length || 0,
      products: cachedData?.products?.length || 0,
      hours: cachedData?.hours?.length || 0,
    });
  }

  try {
    const detectedSchema = storeConfig.detected_schema || {};
    const servicesTab = findActualTabName('services', detectedSchema);
    const productsTab = findActualTabName('products', detectedSchema);
    const hoursTab = findActualTabName('hours', detectedSchema);

    const [services, products, hours] = await Promise.all([
      hasCachedServices
        ? Promise.resolve(cachedData!.services!)
        : servicesTab
          ? loadTab(servicesTab, storeId, serviceRoleKey, requestId)
          : Promise.resolve([]),
      hasCachedProducts
        ? Promise.resolve(cachedData!.products!)
        : productsTab
          ? loadTab(productsTab, storeId, serviceRoleKey, requestId)
          : Promise.resolve([]),
      hasCachedHours
        ? Promise.resolve(cachedData!.hours!)
        : hoursTab
          ? loadTab(hoursTab, storeId, serviceRoleKey, requestId)
          : Promise.resolve([]),
    ]);

    const duration = performance.now() - startTime;
    log(requestId, `📊 Store data loaded (${duration.toFixed(0)}ms)`, {
      services: services.length,
      products: products.length,
      hours: hours.length,
    });

    return { storeData: { services, products, hours }, duration };
  } catch (error) {
    console.error('[Orchestrator] Error pre-loading data:', error);
    const duration = performance.now() - startTime;
    return { storeData, duration };
  }
}

// ============================================================================
// RESPONSE BUILDERS
// ============================================================================

/** Build debug response for skipResponder mode */
function buildSkipResponderResponse(
  functionResult: FunctionResult,
  classification: any,
  classifyUsage: { input: number; output: number },
  classifyDuration: number,
  functionDuration: number,
  totalDuration: number,
  model?: string,
  dataLoadDuration?: number,
  dataLoadSource?: 'orchestrator' | 'function' | 'both'
): ChatCompletionResponse {
  const pricing = getModelPricing(model);

  return {
    text: functionResult.message!,
    functionCalled: classification.function_to_call || undefined,
    functionResult,
    debug: {
      intentDuration: classifyDuration,
      functionDuration,
      responseDuration: 0,
      totalDuration,
      dataLoadDuration,
      dataLoadSource,
      toolSelection: {
        function: classification.function_to_call,
        duration: classifyDuration,
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
        response: { input: 0, output: 0 },
        total: { input: classifyUsage.input, output: classifyUsage.output, cached: 0 },
      },
      cost: {
        classification: calculateCost(classifyUsage.input, classifyUsage.output, model),
        response: 0,
        total: calculateCost(classifyUsage.input, classifyUsage.output, model),
      },
      steps: [
        {
          name: 'Tool Selection',
          function: 'classifier',
          status: 'success',
          duration: classifyDuration,
          result: {
            function_to_call: classification.function_to_call,
            params: classification.extracted_params,
            tokens: { input: classifyUsage.input, output: classifyUsage.output },
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
            length: functionResult.message!.length,
            note: 'Deterministic response - LLM bypassed',
          },
        },
      ],
    },
  };
}

/** Build full debug response with responder */
function buildFullResponse(
  responseText: string,
  suggestions: string[],
  classification: any,
  functionResult: FunctionResult | undefined,
  classifyUsage: { input: number; output: number },
  responseUsage: { input: number; output: number },
  classifyDuration: number,
  functionDuration: number,
  responseDuration: number,
  totalDuration: number,
  reasoningEnabled: boolean,
  model?: string,
  dataLoadDuration?: number,
  dataLoadSource?: 'orchestrator' | 'function' | 'both'
): ChatCompletionResponse {
  const pricing = getModelPricing(model);
  const totalInputTokens = classifyUsage.input + responseUsage.input;
  const totalOutputTokens = classifyUsage.output + responseUsage.output;
  const totalCost = calculateCost(totalInputTokens, totalOutputTokens, model);

  return {
    text: responseText,
    functionCalled: classification.function_to_call || undefined,
    functionResult,
    suggestions,
    debug: {
      endpoint: 'chat-completion',
      reasoningEnabled,
      intentDuration: classifyDuration,
      functionDuration,
      responseDuration,
      totalDuration,
      dataLoadDuration,
      dataLoadSource,
      toolSelection: {
        function: classification.function_to_call,
        duration: classifyDuration,
      },
      functionCalls: functionResult
        ? [{
            name: classification.function_to_call || '',
            arguments: classification.extracted_params || {},
            result: {
              success: functionResult.success,
              data: functionResult.data,
              error: functionResult.error,
            },
            duration: functionDuration,
          }]
        : [],
      tokens: {
        classification: { input: classifyUsage.input, output: classifyUsage.output },
        response: { input: responseUsage.input, output: responseUsage.output },
        total: { input: totalInputTokens, output: totalOutputTokens, cached: 0 },
      },
      cost: {
        classification: calculateCost(classifyUsage.input, classifyUsage.output, model),
        response: calculateCost(responseUsage.input, responseUsage.output, model),
        total: totalCost,
      },
      steps: [
        {
          name: 'Tool Selection',
          function: 'classifier',
          status: 'success',
          duration: classifyDuration,
          result: {
            function_to_call: classification.function_to_call,
            params: classification.extracted_params,
            tokens: { input: classifyUsage.input, output: classifyUsage.output },
          },
        },
        ...(classification.function_to_call && classification.function_to_call !== 'null'
          ? [{
              name: 'Function Execution',
              function: 'tools',
              status: functionResult?.success ? 'success' : 'error',
              duration: functionDuration,
              functionCalled: classification.function_to_call,
              result: functionResult?.success ? functionResult.data : undefined,
              error: !functionResult?.success
                ? {
                    message: functionResult?.error || 'Function execution failed',
                    args: classification.extracted_params,
                  }
                : undefined,
            }]
          : []),
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
}

// ============================================================================
// MAIN HANDLER
// ============================================================================

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const requestId = req.headers.get('X-Request-ID') || crypto.randomUUID();
  const requestStart = performance.now();

  log(requestId, '📨 Chat completion started');

  try {
    // Parse request
    const body: ChatCompletionRequest = await req.json();
    const {
      messages,
      storeId,
      model,
      cachedData,
      reasoningEnabled = false,
    } = body as ChatCompletionRequest & {
      cachedData?: { services?: any[]; products?: any[]; hours?: any[] };
      reasoningEnabled?: boolean;
    };

    log(requestId, 'Received settings:', {
      model: model || `${DEFAULT_MODEL} (default)`,
      reasoningEnabled,
      storeId,
    });

    // Validate required fields
    if (!messages || messages.length === 0 || !storeId) {
      log(requestId, '❌ Missing required fields');
      return new Response(
        JSON.stringify({ error: 'Missing required fields: messages or storeId' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json', 'X-Request-ID': requestId } }
      );
    }

    log(requestId, '💬 User message', {
      messageCount: messages.length,
      storeId,
      model: model || `${DEFAULT_MODEL} (default)`,
    });

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Load store configuration
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
      detected_schema:
        typeof store.detected_schema === 'string'
          ? JSON.parse(store.detected_schema)
          : store.detected_schema,
    };

    console.log('[Orchestrator] Store config:', {
      id: storeConfig.id,
      name: storeConfig.name,
      hasDetectedSchema: !!storeConfig.detected_schema,
      schemaKeys: storeConfig.detected_schema ? Object.keys(storeConfig.detected_schema) : [],
    });

    // Pre-load store data
    const { storeData, duration: orchestratorDataLoadDuration } = await loadStoreData(storeConfig, cachedData, storeId, serviceRoleKey, requestId);

    // Step 1: Classify intent
    log(requestId, '🎯 Classifying intent...');
    const classifyStart = performance.now();

    const { classification, usage: classifyUsage } = await classifyIntent(
      messages,
      { storeData },
      model,
      { reasoningEnabled, includeStoreData: true }
    );

    const classifyDuration = performance.now() - classifyStart;
    log(requestId, `✅ Tool selected: ${classification.function_to_call || 'none'} (${classifyDuration.toFixed(0)}ms)`);

    // Step 2: Execute function if classified
    let functionResult: FunctionResult | undefined;
    let functionDuration = 0;
    let functionDataLoadDuration = 0;

    if (classification.function_to_call && classification.function_to_call !== 'null') {
      log(requestId, '🔧 Executing function:', { function: classification.function_to_call });
      const functionStart = performance.now();

      const lastUserMessage = messages.filter(m => m.role === 'user').pop()?.content || '';

      functionResult = await executeFunction(
        classification.function_to_call,
        classification.extracted_params,
        {
          storeId,
          userId: 'anonymous',
          authToken: serviceRoleKey,
          store: storeConfig,
          requestId,
          lastUserMessage,
          storeData,
        }
      );

      functionDuration = performance.now() - functionStart;
      // Extract data load duration from function result if available
      if (functionResult?.data?.dataLoadDuration) {
        functionDataLoadDuration = functionResult.data.dataLoadDuration;
      }
      log(requestId, `✅ Function complete (${functionDuration.toFixed(0)}ms)`, {
        success: functionResult?.success,
        dataLoadDuration: functionDataLoadDuration || undefined,
      });
    }

    // Check for skipResponder (deterministic response)
    if (functionResult?.skipResponder && functionResult?.message) {
      log(requestId, '🎯 Using deterministic response (skipResponder)');
      const totalDuration = performance.now() - requestStart;

      // Calculate total data load duration and source
      const totalDataLoadDuration = orchestratorDataLoadDuration + functionDataLoadDuration;
      const dataLoadSource = orchestratorDataLoadDuration > 0 && functionDataLoadDuration > 0
        ? 'both'
        : orchestratorDataLoadDuration > 0
        ? 'orchestrator'
        : functionDataLoadDuration > 0
        ? 'function'
        : undefined;

      const response = buildSkipResponderResponse(
        functionResult,
        classification,
        classifyUsage,
        classifyDuration,
        functionDuration,
        totalDuration,
        model,
        totalDataLoadDuration > 0 ? totalDataLoadDuration : undefined,
        dataLoadSource
      );

      log(requestId, `⏱️ Timing: dataLoad=${orchestratorDataLoadDuration.toFixed(0)}ms, intent=${classifyDuration.toFixed(0)}ms, function=${functionDuration.toFixed(0)}ms (dataLoad=${functionDataLoadDuration.toFixed(0)}ms), response=0ms, total=${totalDuration.toFixed(0)}ms`);
      log(requestId, `✨ Complete with skipResponder (${totalDuration.toFixed(0)}ms)`);

      return new Response(JSON.stringify(response), {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
          'X-Request-ID': requestId,
          'Server-Timing': `total;dur=${totalDuration}`,
        },
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
      model,
      {
        architectureMode: 'enhanced',
        reasoningEnabled,
        functionName: classification.function_to_call || undefined,
      }
    );

    const responseDuration = performance.now() - responseStart;
    const totalDuration = performance.now() - requestStart;

    const totalInputTokens = classifyUsage.input + responseUsage.input;
    const totalOutputTokens = classifyUsage.output + responseUsage.output;
    const totalCost = calculateCost(totalInputTokens, totalOutputTokens, model);

    // Calculate total data load duration and source
    const totalDataLoadDuration = orchestratorDataLoadDuration + functionDataLoadDuration;
    const dataLoadSource = orchestratorDataLoadDuration > 0 && functionDataLoadDuration > 0
      ? 'both'
      : orchestratorDataLoadDuration > 0
      ? 'orchestrator'
      : functionDataLoadDuration > 0
      ? 'function'
      : undefined;

    log(requestId, `✅ Response generated (${responseDuration.toFixed(0)}ms)`);
    log(requestId, `📊 Tokens: ${totalInputTokens} in, ${totalOutputTokens} out, $${totalCost.toFixed(4)}`);
    log(requestId, `⏱️ Timing: dataLoad=${orchestratorDataLoadDuration.toFixed(0)}ms, intent=${classifyDuration.toFixed(0)}ms, function=${functionDuration.toFixed(0)}ms (dataLoad=${functionDataLoadDuration.toFixed(0)}ms), response=${responseDuration.toFixed(0)}ms, total=${totalDuration.toFixed(0)}ms`);
    log(requestId, `✨ Complete (${totalDuration.toFixed(0)}ms)`);

    // Step 4: Return response
    const response = buildFullResponse(
      responseText,
      suggestions,
      classification,
      functionResult,
      classifyUsage,
      responseUsage,
      classifyDuration,
      functionDuration,
      responseDuration,
      totalDuration,
      reasoningEnabled,
      model,
      totalDataLoadDuration > 0 ? totalDataLoadDuration : undefined,
      dataLoadSource
    );

    return new Response(JSON.stringify(response), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
        'X-Request-ID': requestId,
        'Server-Timing': `total;dur=${totalDuration}`,
      },
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

console.log('Chat completion function started (modular architecture)');
