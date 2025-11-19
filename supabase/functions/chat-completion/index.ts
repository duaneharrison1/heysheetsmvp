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
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ============================================================================
// MAIN HANDLER
// ============================================================================

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Parse request
    const body: ChatCompletionRequest = await req.json();
    const { messages, storeId } = body;

    if (!messages || messages.length === 0 || !storeId) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: messages or storeId' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

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
        servicesTab ? loadTab(servicesTab, storeId, serviceRoleKey) : Promise.resolve([]),
        productsTab ? loadTab(productsTab, storeId, serviceRoleKey) : Promise.resolve([]),
        hoursTab ? loadTab(hoursTab, storeId, serviceRoleKey) : Promise.resolve([])
      ]);

      storeData = { services, products, hours };
    } catch (error) {
      console.error('[Orchestrator] Error pre-loading data:', error);
    }

    // Step 1: Classify intent and extract parameters
    const classification: Classification = await classifyIntent(messages, { storeData });

    console.log('[Orchestrator] Classification:', {
      intent: classification.intent,
      confidence: classification.confidence,
      function: classification.function_to_call,
      needsClarification: classification.needs_clarification
    });

    // Step 2: Execute function if classified
    let functionResult: FunctionResult | undefined;

    if (classification.function_to_call && classification.function_to_call !== 'null') {
      console.log('[Orchestrator] Executing function:', classification.function_to_call);

      functionResult = await executeFunction(
        classification.function_to_call,
        classification.extracted_params,
        {
          storeId,
          userId: 'anonymous', // Public access, no user ID
          authToken: serviceRoleKey,  // Use SERVICE_ROLE_KEY for internal function calls
          store: storeConfig
        }
      );

      console.log('[Orchestrator] Function result:', functionResult);
    }

    // Step 3: Generate response using LLM
    const responseText = await generateResponse(
      messages,
      classification,
      functionResult,
      storeConfig
    );

    // Step 4: Return response
    const response: ChatCompletionResponse = {
      text: responseText,
      intent: classification.intent,
      confidence: classification.confidence,
      functionCalled: classification.function_to_call || undefined,
      functionResult
    };

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('[Orchestrator] Error:', error);
    return new Response(
      JSON.stringify({
        error: 'Internal server error',
        details: error instanceof Error ? error.message : String(error)
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
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
  authToken: string
): Promise<any[]> {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');

  try {
    const response = await fetch(`${supabaseUrl}/functions/v1/google-sheet`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`,
        'apikey': authToken
      },
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
