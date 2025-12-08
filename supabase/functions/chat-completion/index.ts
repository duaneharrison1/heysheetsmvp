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
import { CACHING_STRATEGY, logCachingStrategy } from '../_shared/caching-config.ts';
import { classifyIntent } from '../classifier/index.ts';
import { generateResponse } from '../responder/index.ts';
import { executeFunction } from '../tools/index.ts';
import { buildSkipResponderResponse, buildFullResponse } from '../debug/response-builder.ts';

// ============================================================================
// LOGGING
// ============================================================================

function log(requestId: string, message: string, data?: any, debugMode: boolean = false) {
  if (!debugMode) return; // Only log in debug mode
  // const timestamp = new Date().toISOString();
  // const logData = data ? JSON.stringify(data) : '';
  // console.log(`[${timestamp}] [REQUEST_ID:${requestId}] ${message}`, logData);
}

function logDuration(message: string, duration: number) {
  // Always log duration to browser console, regardless of debug mode
  console.log(`⏱️ ${message}: ${duration.toFixed(0)}ms`);
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
  const loadTabStart = performance.now();
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

    const fetchStart = performance.now();
    
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
    // If using legacy strategy, no cacheType - backend expects cachedData from frontend

    const response = await fetch(`${supabaseUrl}/functions/v1/google-sheet`, {
      method: 'POST',
      headers,
      body: JSON.stringify(requestBody),
    });
    const fetchDuration = performance.now() - fetchStart;

    if (!response.ok) {
      console.error(`[loadTab] Failed to load ${tabName} (fetch took ${fetchDuration.toFixed(0)}ms):`, await response.text());
      return [];
    }

    const parseStart = performance.now();
    const result = await response.json();
    const parseDuration = performance.now() - parseStart;

    const totalDuration = performance.now() - loadTabStart;
    log(requestId || '', `[loadTab] ${tabName}: fetch=${fetchDuration.toFixed(0)}ms, parse=${parseDuration.toFixed(0)}ms, total=${totalDuration.toFixed(0)}ms, rows=${result.data?.length || 0}`);

    return result.data || [];
  } catch (error) {
    const totalDuration = performance.now() - loadTabStart;
    console.error(`[loadTab] Error loading ${tabName} after ${totalDuration.toFixed(0)}ms:`, error);
    return [];
  }
}

/** Pre-load store data from sheets or use cached data */
interface LoadStoreDataResult {
  storeData: StoreData;
  duration: number;
  timing?: Record<string, number>;
}

async function loadStoreData(
  storeConfig: StoreConfig,
  cachedData: { services?: any[]; products?: any[]; hours?: any[] } | undefined,
  storeId: string,
  serviceRoleKey: string,
  requestId: string,
  debugMode: boolean = false
): Promise<LoadStoreDataResult> {
  const startTime = performance.now();
  const timing: Record<string, number> = {};
  const storeData: StoreData = { services: [], products: [], hours: [] };

  // ============================================================================
  // CACHING STRATEGY HANDLING
  // ============================================================================
  // 
  // DATABASE STRATEGY: Backend caches in Supabase database
  //   - loadTab() calls google-sheet with cacheType: 'database'
  //   - google-sheet checks database cache first, fetches if miss
  //   - cachedData from frontend is ignored
  //   - No need to pass data back-and-forth
  //
  // LEGACY STRATEGY: Frontend caches in localStorage
  //   - loadTab() calls google-sheet without cacheType
  //   - google-sheet uses cachedData passed from frontend
  //   - If hasCachedServices/Products/Hours, use frontend data
  //   - Avoids refetch if frontend already has data
  //
  // CURRENT STRATEGY: database
  //
  // ============================================================================

  // Only use frontend cachedData if using LEGACY strategy
  const useFrontendCache = CACHING_STRATEGY === 'legacy';
  const hasCachedServices = useFrontendCache && cachedData?.services && cachedData.services.length > 0;
  const hasCachedProducts = useFrontendCache && cachedData?.products && cachedData.products.length > 0;
  const hasCachedHours = useFrontendCache && cachedData?.hours && cachedData.hours.length > 0;

  if (useFrontendCache && (hasCachedServices || hasCachedProducts || hasCachedHours)) {
    logCachedDataUsage(
      requestId,
      cachedData?.services?.length || 0,
      cachedData?.products?.length || 0,
      cachedData?.hours?.length || 0,
      debugMode
    );
  }

  try {
    const schemaLookupStart = performance.now();
    const detectedSchema = storeConfig.detected_schema || {};
    const servicesTab = findActualTabName('services', detectedSchema);
    const productsTab = findActualTabName('products', detectedSchema);
    const hoursTab = findActualTabName('hours', detectedSchema);
    timing.schemaLookup = performance.now() - schemaLookupStart;

    // Track individual fetch times
    const fetchStart = performance.now();
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
    timing.parallelFetch = performance.now() - fetchStart;

    const duration = performance.now() - startTime;
    logStoreDataLoaded(
      requestId,
      duration,
      services.length,
      products.length,
      hours.length,
      timing.schemaLookup,
      timing.parallelFetch,
      { services: hasCachedServices, products: hasCachedProducts, hours: hasCachedHours },
      debugMode
    );

    return { storeData: { services, products, hours }, duration, timing };
  } catch (error) {
    console.error('[Orchestrator] Error pre-loading data:', error);
    const duration = performance.now() - startTime;
    return { storeData, duration, timing };
  }
}



// ============================================================================
// DEBUG LOGGING FUNCTIONS
// ============================================================================

/** Log request initialization */
function logRequestStart(requestId: string, debugMode: boolean): void {
  log(requestId, '📨 Chat completion started', undefined, debugMode);
}

/** Log request settings */
function logRequestSettings(
  requestId: string,
  model: string | undefined,
  reasoningEnabled: boolean,
  storeId: string,
  parseTime: number,
  debugMode: boolean
): void {
  log(requestId, `⏱️ Request parsed (${parseTime.toFixed(0)}ms)`, undefined, debugMode);
  log(requestId, 'Received settings:', {
    model: model || `${DEFAULT_MODEL} (default)`,
    reasoningEnabled,
    storeId,
  }, debugMode);
}

/** Log user message details */
function logUserMessage(
  requestId: string,
  messageCount: number,
  storeId: string,
  model: string | undefined,
  debugMode: boolean
): void {
  log(requestId, '💬 User message', {
    messageCount,
    storeId,
    model: model || `${DEFAULT_MODEL} (default)`,
  }, debugMode);
}

/** Log Supabase initialization timing */
function logSupabaseInit(requestId: string, duration: number, debugMode: boolean): void {
  log(requestId, `⏱️ Supabase client init (${duration.toFixed(0)}ms)`, undefined, debugMode);
}

/** Log store config fetch timing */
function logStoreConfigFetch(requestId: string, duration: number, debugMode: boolean): void {
  log(requestId, `⏱️ Store config fetched from DB (${duration.toFixed(0)}ms)`, undefined, debugMode);
}

/** Log store configuration details */
function logStoreConfigDetails(requestId: string, storeConfig: StoreConfig, debugMode: boolean): void {
  if (!debugMode) return;
  console.log('[Orchestrator] Store config:', {
    id: storeConfig.id,
    name: storeConfig.name,
    hasDetectedSchema: !!storeConfig.detected_schema,
    schemaKeys: storeConfig.detected_schema ? Object.keys(storeConfig.detected_schema) : [],
  });
}

/** Log cached data usage */
function logCachedDataUsage(
  requestId: string,
  cachedServices: number,
  cachedProducts: number,
  cachedHours: number,
  debugMode: boolean
): void {
  log(requestId, '📦 Using client-provided cached data', {
    services: cachedServices,
    products: cachedProducts,
    hours: cachedHours,
  }, debugMode);
}

/** Log store data loaded */
function logStoreDataLoaded(
  requestId: string,
  duration: number,
  servicesCount: number,
  productsCount: number,
  hoursCount: number,
  schemaLookupTime: number | undefined,
  parallelFetchTime: number | undefined,
  fromCache: { services: boolean | undefined; products: boolean | undefined; hours: boolean | undefined },
  debugMode: boolean
): void {
  log(requestId, `📊 Store data loaded (${duration.toFixed(0)}ms)`, {
    services: servicesCount,
    products: productsCount,
    hours: hoursCount,
    timing: {
      schemaLookup: schemaLookupTime?.toFixed(0),
      parallelFetch: parallelFetchTime?.toFixed(0),
      fromCache,
    },
  }, debugMode);
}

/** Log intent classification */
function logIntentClassified(
  requestId: string,
  functionToCall: string | null,
  duration: number,
  debugMode: boolean
): void {
  log(requestId, `✅ Tool selected: ${functionToCall || 'none'} (${duration.toFixed(0)}ms)`, undefined, debugMode);
}

/** Log function execution start */
function logFunctionExecuting(
  requestId: string,
  functionName: string,
  debugMode: boolean
): void {
  log(requestId, '🔧 Executing function:', { function: functionName }, debugMode);
}

/** Log function execution complete */
function logFunctionComplete(
  requestId: string,
  duration: number,
  success: boolean,
  dataLoadDuration?: number,
  debugMode?: boolean
): void {
  log(requestId, `✅ Function complete (${duration.toFixed(0)}ms)`, {
    success,
    dataLoadDuration: dataLoadDuration || undefined,
  }, debugMode || false);
}

/** Log skipResponder mode */
function logSkipResponder(requestId: string, debugMode: boolean): void {
  log(requestId, '🎯 Using deterministic response (skipResponder)', undefined, debugMode);
}

/** Log response generation */
function logResponseGenerating(requestId: string, debugMode: boolean): void {
  log(requestId, '💬 Generating response...', undefined, debugMode);
}

/** Log response generated */
function logResponseGenerated(
  requestId: string,
  duration: number,
  totalInputTokens: number,
  totalOutputTokens: number,
  totalCost: number,
  debugMode: boolean
): void {
  log(requestId, `✅ Response generated (${duration.toFixed(0)}ms)`, undefined, debugMode);
  log(requestId, `📊 Tokens: ${totalInputTokens} in, ${totalOutputTokens} out, $${totalCost.toFixed(4)}`, undefined, debugMode);
}

/** Log full timing breakdown */
function logTimingBreakdown(
  requestId: string,
  timing: Record<string, number>,
  orchestratorDataLoadDuration: number,
  classifyDuration: number,
  functionDuration: number,
  functionDataLoadDuration: number,
  responseDuration: number,
  totalDuration: number,
  debugMode: boolean
): void {
  const accountedTime =
    (timing.requestParse || 0) +
    (timing.supabaseInit || 0) +
    (timing.storeConfigFetch || 0) +
    (timing.schemaParse || 0) +
    orchestratorDataLoadDuration +
    classifyDuration +
    functionDuration +
    responseDuration;
  const overhead = totalDuration - accountedTime;

  log(requestId, `⏱️ FULL TIMING BREAKDOWN:`, undefined, debugMode);
  log(requestId, `   requestParse: ${(timing.requestParse || 0).toFixed(0)}ms`, undefined, debugMode);
  log(requestId, `   supabaseInit: ${(timing.supabaseInit || 0).toFixed(0)}ms`, undefined, debugMode);
  log(requestId, `   storeConfigFetch: ${(timing.storeConfigFetch || 0).toFixed(0)}ms`, undefined, debugMode);
  log(requestId, `   schemaParse: ${(timing.schemaParse || 0).toFixed(0)}ms`, undefined, debugMode);
  log(requestId, `   dataPreload: ${orchestratorDataLoadDuration.toFixed(0)}ms`, undefined, debugMode);
  log(requestId, `   classifier: ${classifyDuration.toFixed(0)}ms`, undefined, debugMode);
  log(
    requestId,
    `   function: ${functionDuration.toFixed(0)}ms (dataLoad=${functionDataLoadDuration.toFixed(0)}ms)`,
    undefined,
    debugMode
  );
  log(requestId, `   responder: ${responseDuration.toFixed(0)}ms`, undefined, debugMode);
  log(requestId, `   overhead/unaccounted: ${overhead.toFixed(0)}ms`, undefined, debugMode);
  log(requestId, `   TOTAL: ${totalDuration.toFixed(0)}ms`, undefined, debugMode);
}

/** Log request completion */
function logRequestComplete(requestId: string, totalDuration: number, debugMode: boolean): void {
  log(requestId, `✨ Complete (${totalDuration.toFixed(0)}ms)`, undefined, debugMode);
}

/** Log skipResponder completion */
function logSkipResponderComplete(requestId: string, totalDuration: number, debugMode: boolean): void {
  log(requestId, `✨ Complete with skipResponder (${totalDuration.toFixed(0)}ms)`, undefined, debugMode);
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
  const debugMode = req.headers.get('X-Debug-Mode') === 'true';
  const requestStart = performance.now();

  // Timing tracking object
  const timing: Record<string, number> = {};

  logRequestStart(requestId, debugMode);

  try {
    // Parse request (with timing)
    const parseStart = performance.now();
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
    timing.requestParse = performance.now() - parseStart;
    logRequestSettings(requestId, model, reasoningEnabled, storeId, timing.requestParse, debugMode);

    // Validate required fields
    if (!messages || messages.length === 0 || !storeId) {
      log(requestId, '❌ Missing required fields');
      return new Response(
        JSON.stringify({ error: 'Missing required fields: messages or storeId' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json', 'X-Request-ID': requestId } }
      );
    }

    logUserMessage(requestId, messages.length, storeId, model, debugMode);

    // Initialize Supabase client (with timing)
    const supabaseInitStart = performance.now();
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);
    timing.supabaseInit = performance.now() - supabaseInitStart;
    logSupabaseInit(requestId, timing.supabaseInit, debugMode);

    // Load store configuration (with timing)
    const storeConfigStart = performance.now();
    const { data: store, error: storeError } = await supabase
      .from('stores')
      .select('*')
      .eq('id', storeId)
      .single();
    timing.storeConfigFetch = performance.now() - storeConfigStart;
    logStoreConfigFetch(requestId, timing.storeConfigFetch, debugMode);

    if (storeError || !store) {
      return new Response(
        JSON.stringify({ error: 'Store not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse store config (with timing)
    const schemaParseStart = performance.now();
    const storeConfig: StoreConfig = {
      ...store,
      detected_schema:
        typeof store.detected_schema === 'string'
          ? JSON.parse(store.detected_schema)
          : store.detected_schema,
    };
    timing.schemaParse = performance.now() - schemaParseStart;
    logStoreConfigDetails(requestId, storeConfig, debugMode);

    // Pre-load store data
    const { storeData, duration: orchestratorDataLoadDuration } = await loadStoreData(storeConfig, cachedData, storeId, serviceRoleKey, requestId, debugMode);

    // Step 1: Classify intent
    const classifyStart = performance.now();

    const { classification, usage: classifyUsage } = await classifyIntent(
      messages,
      { storeData },
      model,
      { reasoningEnabled, includeStoreData: true, debugMode }
    );

    const classifyDuration = performance.now() - classifyStart;
    logIntentClassified(requestId, classification.function_to_call || null, classifyDuration, debugMode);

    // Step 2: Execute function if classified
    let functionResult: FunctionResult | undefined;
    let functionDuration = 0;
    let functionDataLoadDuration = 0;

    if (classification.function_to_call && classification.function_to_call !== null) {
      logFunctionExecuting(requestId, classification.function_to_call, debugMode);
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
      logFunctionComplete(requestId, functionDuration, functionResult?.success || false, functionDataLoadDuration, debugMode);
    }

    // Check for skipResponder (deterministic response)
    if (functionResult?.skipResponder && functionResult?.message) {
      logSkipResponder(requestId, debugMode);
      const totalDuration = performance.now() - requestStart;
      logDuration('Total request duration', totalDuration);

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
        dataLoadSource,
        debugMode
      );

      logTimingBreakdown(
        requestId,
        timing,
        orchestratorDataLoadDuration,
        classifyDuration,
        functionDuration,
        functionDataLoadDuration,
        0,
        totalDuration,
        debugMode
      );
      logSkipResponderComplete(requestId, totalDuration, debugMode);

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
    logResponseGenerating(requestId, debugMode);
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
        debugMode,
      }
    );

    const responseDuration = performance.now() - responseStart;
    const totalDuration = performance.now() - requestStart;
    logDuration('Total request duration', totalDuration);

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

    logResponseGenerated(requestId, responseDuration, totalInputTokens, totalOutputTokens, totalCost, debugMode);

    logTimingBreakdown(
      requestId,
      timing,
      orchestratorDataLoadDuration,
      classifyDuration,
      functionDuration,
      functionDataLoadDuration,
      responseDuration,
      totalDuration,
      debugMode
    );
    logRequestComplete(requestId, totalDuration, debugMode);

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
      dataLoadSource,
      debugMode
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
