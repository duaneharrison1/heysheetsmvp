import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Import new intelligent chat modules
import { classifyIntent } from './classifier/classifier.ts';
import { executeFunction } from './functions/executor.ts';
import { generateResponse } from './classifier/responder.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

console.log('[Chat-Completion] Function started with intelligence system');

function decodeJWT(token: string): { sub: string } {
  const parts = token.split('.');
  const payload = parts[1];
  const padded = payload + '='.repeat(4 - (payload.length % 4));
  return JSON.parse(new TextDecoder().decode(
    Uint8Array.from(atob(padded), c => c.charCodeAt(0))
  ));
}

function getSupabase() {
  return createClient(
    Deno.env.get('SUPABASE_URL') || '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
  );
}

serve(async (req) => {
  // ═══════════════════════════════════════════════════════════
  // CORS PREFLIGHT
  // ═══════════════════════════════════════════════════════════

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // ═══════════════════════════════════════════════════════════
    // STEP 0: AUTHENTICATION
    // ═══════════════════════════════════════════════════════════

    console.log('[Chat] Step 0: Authenticating...');

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Missing authorization header');
    }

    const token = authHeader.replace('Bearer ', '');
    const decoded = decodeJWT(token);
    const userId = decoded.sub;

    console.log('[Chat] Authenticated user:', userId);

    // ═══════════════════════════════════════════════════════════
    // STEP 1: PARSE REQUEST
    // ═══════════════════════════════════════════════════════════

    console.log('[Chat] Step 1: Parsing request...');

    const body = await req.json();
    const { messages, storeId } = body;

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      throw new Error('Invalid messages format');
    }

    if (!storeId) {
      throw new Error('Missing storeId');
    }

    console.log('[Chat] Processing for store:', storeId);
    console.log('[Chat] Message count:', messages.length);

    // ═══════════════════════════════════════════════════════════
    // STEP 2: VERIFY ACCESS
    // ═══════════════════════════════════════════════════════════

    console.log('[Chat] Step 2: Verifying access...');

    const supabase = getSupabase();
    const { data: store, error: storeError } = await supabase
      .from('stores')
      .select('*')
      .eq('id', storeId)
      .eq('user_id', userId)
      .single();

    if (storeError || !store) {
      console.error('[Chat] Access error:', storeError);
      throw new Error('Store not found or access denied');
    }

    console.log('[Chat] Access verified');

    console.log('[Chat] Store loaded:', store.name);

    // ═══════════════════════════════════════════════════════════
    // STEP 3: FETCH STORE DATA FOR CLASSIFICATION CONTEXT
    // ═══════════════════════════════════════════════════════════

    console.log('[Chat] Step 3: Fetching store data for context...');

    let storeData: any = {};

    if (store.sheet_id) {
      try {
        const supabaseUrl = Deno.env.get('SUPABASE_URL');
        const anonKey = Deno.env.get('SUPABASE_ANON_KEY');

        const loadTab = async (tabName: string) => {
          try {
            const response = await fetch(
              `${supabaseUrl}/functions/v1/google-sheet`,
              {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${token}`,
                  'apikey': anonKey || '',
                },
                body: JSON.stringify({
                  operation: 'read',
                  storeId,
                  tabName,
                }),
              }
            );
            const result = await response.json();
            return result.success ? result.data : [];
          } catch (error) {
            return [];
          }
        };

        const [products, services, hours] = await Promise.all([
          loadTab('Products'),
          loadTab('Services'),
          loadTab('Hours'),
        ]);

        storeData = { products, services, hours };
        console.log('[Chat] Store data loaded successfully');
      } catch (error) {
        console.warn('[Chat] Error loading store data:', error.message);
        // Continue without store data context
      }
    }

    // ═══════════════════════════════════════════════════════════
    // STEP 4: CLASSIFY INTENT
    // ═══════════════════════════════════════════════════════════

    console.log('[Chat] Step 4: Classifying intent...');

    const classification = await classifyIntent(messages, { storeData });

    console.log('[Chat] Classification result:', {
      intent: classification.intent,
      confidence: classification.confidence,
      functionToCall: classification.functionToCall,
      params: Object.keys(classification.params || {})
    });

    // ═══════════════════════════════════════════════════════════
    // STEP 5: EXECUTE FUNCTION (if recommended)
    // ═══════════════════════════════════════════════════════════

    let functionResult = null;

    if (classification.functionToCall) {
      console.log('[Chat] Step 5: Executing function:', classification.functionToCall);

      functionResult = await executeFunction(
        classification.functionToCall,
        classification.params,
        {
          storeId: storeId,
          userId: userId,
          authToken: token
        }
      );

      console.log('[Chat] Function execution result:', {
        success: functionResult.success,
        hasData: !!functionResult.data || !!functionResult.products || !!functionResult.booking
      });
    } else {
      console.log('[Chat] Step 5: No function to execute');
    }

    // ═══════════════════════════════════════════════════════════
    // STEP 6: GENERATE RESPONSE
    // ═══════════════════════════════════════════════════════════

    console.log('[Chat] Step 6: Generating response...');

    const response = await generateResponse(
      messages,
      classification,
      functionResult,
      store
    );

    console.log('[Chat] Response generated successfully');
    console.log('[Chat] Response length:', response.length);

    // ═══════════════════════════════════════════════════════════
    // RETURN ENRICHED RESPONSE
    // ═══════════════════════════════════════════════════════════

    return new Response(
      JSON.stringify({
        text: response,
        intent: classification.intent,
        confidence: classification.confidence,
        functionCalled: classification.functionToCall || null,
        functionResult: functionResult
      }),
      {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      }
    );

  } catch (error) {
    console.error('[Chat] Error:', error);
    console.error('[Chat] Error stack:', error.stack);

    return new Response(
      JSON.stringify({
        error: error.message || 'Internal server error',
        details: error.stack
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      }
    );
  }
});

console.log('[Chat-Completion] Handler registered');
