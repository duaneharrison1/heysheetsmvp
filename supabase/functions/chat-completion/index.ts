import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { classifyIntent } from './classifier/index.ts';
import { generateResponse } from './responder/index.ts';
import { executeFunction } from './tools/index.ts';
import { decodeJWT, getSupabase, corsHeaders } from './utils.ts';
import type { Message } from './types.ts';

console.log('[Chat-Completion] Function started (orchestrator)');

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    // Get anon key for internal API calls (NO USER AUTH REQUIRED)
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY') || '';

    const body = await req.json();
    const { messages, storeId } = body as { messages: Message[]; storeId?: string };

    if (!messages || !Array.isArray(messages) || messages.length === 0) throw new Error('Invalid messages format');
    if (!storeId) throw new Error('Missing storeId');

    const supabase = getSupabase();
    const { data: store, error: storeError } = await supabase
      .from('stores')
      .select('*')
      .eq('id', storeId)
      .single();

    if (storeError || !store) {
      console.error('[Chat] Store not found:', storeError?.message);
      throw new Error('Store not found');
    }

    let storeData: any = {};
    if (store.sheet_id) {
      const loadTab = async (tabName: string) => {
        try {
          const response = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/google-sheet`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}`, 'apikey': Deno.env.get('SUPABASE_ANON_KEY') || '' },
            body: JSON.stringify({ operation: 'read', storeId, tabName })
          });
          const result = await response.json();
          return result.success ? result.data : [];
        } catch {
          return [];
        }
      };
      const [products, services, hours] = await Promise.all([loadTab('Products'), loadTab('Services'), loadTab('Hours')]);
      storeData = { products, services, hours };
    }

    // Classify user intent
    const classification = await classifyIntent(messages, { storeData });

    // Execute function if needed
    let functionResult = null;
    if (classification.functionToCall) {
      functionResult = await executeFunction(classification.functionToCall, classification.params, { storeId, userId, authToken: token });
    }

    const responseText = await generateResponse(messages, classification as any, functionResult, store);

    return new Response(JSON.stringify({ text: responseText, intent: classification.intent, confidence: classification.confidence, functionCalled: classification.functionToCall || null, functionResult }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    console.error('[Chat] Error:', errMsg);
    return new Response(JSON.stringify({ error: errMsg || 'Internal server error' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});

console.log('[Chat-Completion] Handler registered');
