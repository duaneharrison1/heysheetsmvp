/**
 * DIRECT FUNCTION ENDPOINT
 * ========================
 *
 * Executes functions directly WITHOUT LLM classification or response generation.
 * Used for UI interactions (button clicks, form submissions) where intent is known.
 *
 * Benefits:
 * - ~50ms vs ~13s (bypasses 2 LLM calls)
 * - Deterministic responses (no AI variability)
 * - Cheaper (no token cost)
 *
 * Usage:
 * POST /functions/v1/direct-function
 * {
 *   "functionName": "create_booking",
 *   "params": { service_name, date, time, customer_name, customer_email, customer_phone },
 *   "storeId": "store_123"
 * }
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { corsHeaders } from '../_shared/cors.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getTemplateResponse } from '../_shared/templates.ts';
import { executeFunction } from '../tools/index.ts';
import { FunctionContext } from '../_shared/types.ts';

// Valid function names for direct calling
const ALLOWED_FUNCTIONS = [
  'get_products',
  'get_services',
  'get_store_info',
  'get_booking_slots',
  'create_booking',
  'submit_lead',
  'get_recommendations',
  'check_availability',
  'get_misc_data',
];

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const requestId = req.headers.get('X-Request-ID') || crypto.randomUUID();
  const startTime = performance.now();

  const log = (message: string, data?: any) => {
    console.log(`[direct-function][${requestId}] ${message}`, data ?? '');
  };

  try {
    const body = await req.json();
    const { functionName, params, storeId, cachedData } = body;

    log('Request received', { functionName, storeId, params });

    // Validate required fields
    if (!functionName) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing functionName' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!storeId) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing storeId' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate function name
    if (!ALLOWED_FUNCTIONS.includes(functionName)) {
      return new Response(
        JSON.stringify({ success: false, error: `Unknown or disallowed function: ${functionName}` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Load store config
    const { data: storeConfig, error: storeError } = await supabase
      .from('stores')
      .select('*')
      .eq('id', storeId)
      .single();

    if (storeError || !storeConfig) {
      log('Store not found', storeError);
      return new Response(
        JSON.stringify({ success: false, error: 'Store not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Build function context
    const context: FunctionContext = {
      storeId,
      userId: 'direct-call',
      authToken: serviceRoleKey,
      store: storeConfig,
      requestId,
      lastUserMessage: '',
      storeData: cachedData || undefined,
    };

    // Execute the function
    log('Executing function...');
    const functionStart = performance.now();

    const result = await executeFunction(functionName, params || {}, context);

    const functionDuration = performance.now() - functionStart;
    log(`Function executed in ${functionDuration.toFixed(0)}ms`, { success: result.success });

    // Get template response (or use function's message)
    const templateMessage = getTemplateResponse(functionName, result, params || {});
    const responseMessage = templateMessage || result.message || 'Done.';

    const totalDuration = performance.now() - startTime;

    // Return in same format as chat-completion for UI compatibility
    const response = {
      success: result.success,
      text: responseMessage,
      message: responseMessage,
      data: result.data || result,
      functionResult: result,
      components: result.components || [],
      componentsVersion: result.componentsVersion || '1',
      functionName,
      direct: true, // Flag to indicate this bypassed LLM
      debug: {
        requestId,
        functionDuration: Math.round(functionDuration),
        totalDuration: Math.round(totalDuration),
        mode: 'direct',
      },
    };

    log(`Request completed in ${totalDuration.toFixed(0)}ms`);

    return new Response(
      JSON.stringify(response),
      {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
          'X-Request-ID': requestId,
          'Server-Timing': `total;dur=${totalDuration.toFixed(0)}`,
        }
      }
    );

  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    log('Error:', errMsg);

    return new Response(
      JSON.stringify({
        success: false,
        error: errMsg || 'Unknown error',
        direct: true,
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
