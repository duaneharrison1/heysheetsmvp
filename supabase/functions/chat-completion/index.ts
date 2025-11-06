import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Baked-in API key (move to secrets later if desired)
const OPENROUTER_API_KEY = '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';
const MODEL = 'anthropic/claude-3.5-sonnet';

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
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { messages, storeId } = body;

    if (!messages || !storeId) {
      return new Response(
        JSON.stringify({ error: 'Missing messages or storeId' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify auth
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const decoded = decodeJWT(token);
    const userId = decoded.sub;

    // Verify access
    const supabase = getSupabase();
    const { data: userStore } = await supabase
      .from('user_stores')
      .select('id')
      .eq('user_id', userId)
      .eq('store_id', storeId)
      .single();

    if (!userStore) {
      return new Response(
        JSON.stringify({ error: 'Access denied' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get store info
    const { data: store } = await supabase
      .from('stores')
      .select('name, system_prompt, sheet_id')
      .eq('id', storeId)
      .single();

    if (!store) {
      return new Response(
        JSON.stringify({ error: 'Store not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Load sheet data if available
    let spreadsheetInfo = '';
    if (store.sheet_id) {
      // Call google-sheet function to get data
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

      if (products.length > 0) {
        spreadsheetInfo += `\n\nPRODUCTS:\n${JSON.stringify(products)}`;
      }
      if (services.length > 0) {
        spreadsheetInfo += `\n\nSERVICES:\n${JSON.stringify(services)}`;
      }
      if (hours.length > 0) {
        spreadsheetInfo += `\n\nHOURS:\n${JSON.stringify(hours)}`;
      }
    }

    // Build system message
    const systemPrompt = store.system_prompt || `You are a helpful assistant for ${store.name}.`;
    const systemMessage = {
      role: 'system',
      content: systemPrompt + spreadsheetInfo,
    };

    // Call OpenRouter
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://heysheets.com',
        'X-Title': 'HeySheets',
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [systemMessage, ...messages],
        temperature: 0.7,
        max_tokens: 1000,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OpenRouter error: ${response.status} - ${error}`);
    }

    const data = await response.json();
    const aiResponse = data.choices[0]?.message?.content || 'I apologize, I could not generate a response.';

    return new Response(
      JSON.stringify({ response: aiResponse }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Chat error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
