import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
// ===== Section: Imports & Configuration =====
// Description: External imports and top-level configuration values used by the function.
// - Deno std server for the HTTP handler
// - Supabase client for DB access
// - CORS headers and API keys
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};
console.log('[Chat-Completion] Function started with intelligence system');
const OPENROUTER_API_KEY = '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';
// ===== Section: Classifier =====
// Description: Intent classification and parameter extraction using the LLM
// - `classifyIntent` constructs a deterministic prompt and parses JSON output
async function classifyIntent(messages, context) {
  const lastMessage = messages[messages.length - 1]?.content || '';
  const conversationHistory = messages.slice(0, -1).map((m)=>`${m.role}: ${m.content}`).join('\n');
  let storeContext = '';
  if (context?.storeData) {
    const services = context.storeData.services || [];
    const products = context.storeData.products || [];
    const hours = context.storeData.hours || [];
    if (services.length > 0) storeContext += `\nAVAILABLE SERVICES:\n${JSON.stringify(services, null, 2)}`;
    if (products.length > 0) storeContext += `\nAVAILABLE PRODUCTS:\n${JSON.stringify(products, null, 2)}`;
    if (hours.length > 0) storeContext += `\nSTORE HOURS:\n${JSON.stringify(hours, null, 2)}`;
  }
  const now = new Date();
  const today = now.toISOString().split('T')[0];
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = tomorrow.toISOString().split('T')[0];
  const classificationPrompt = `You are an intent classifier for a business chat assistant.

CONVERSATION HISTORY:
${conversationHistory}

${storeContext}

CURRENT MESSAGE: "${lastMessage}"
TODAY'S DATE: ${today}
TOMORROW'S DATE: ${tomorrowStr}

Your job is to:
1. Classify the user's intent
2. Extract any parameters mentioned
3. Recommend which function to call

INTENTS:
- BOOKING: User wants to schedule/book
- PRODUCT: User wants to browse/buy products
- INFO: User wants store information
- GREETING: Greeting or small talk
- OTHER: Unclear intent

FUNCTIONS:
- get_store_info: Get store details
- check_availability: Check time slots
- create_booking: Create booking (only when ALL info present)
- get_products: Get product catalog

RESPOND WITH JSON ONLY:
{
  "intent": "BOOKING|PRODUCT|INFO|GREETING|OTHER",
  "confidence": "HIGH|MEDIUM|LOW",
  "params": {
    "service_name": "string or null",
    "date": "YYYY-MM-DD or null",
    "time": "HH:MM or null",
    "customer_name": "string or null",
    "email": "string or null",
    "phone": "string or null"
  },
  "functionToCall": "function_name or null"
}`;
  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://heysheets.com',
        'X-Title': 'HeySheets'
      },
      body: JSON.stringify({
        model: 'anthropic/claude-3.5-sonnet',
        messages: [
          {
            role: 'user',
            content: classificationPrompt
          }
        ],
        temperature: 0.3
      })
    });
    if (!response.ok) throw new Error(`OpenRouter API error: ${response.status}`);
    const data = await response.json();
    const content = data.choices[0]?.message?.content;
    if (!content) throw new Error('No response from classification LLM');
    let jsonStr = content.trim();
    if (jsonStr.startsWith('```json')) jsonStr = jsonStr.replace(/```json\n?/, '').replace(/\n?```$/, '');
    else if (jsonStr.startsWith('```')) jsonStr = jsonStr.replace(/```\n?/, '').replace(/\n?```$/, '');
    const classification = JSON.parse(jsonStr);
    console.log('[Classifier] Result:', {
      intent: classification.intent,
      confidence: classification.confidence,
      function: classification.functionToCall
    });
    return classification;
  } catch (error) {
    console.error('[Classifier] Error:', error);
    return {
      intent: 'OTHER',
      confidence: 'LOW',
      params: {},
      functionToCall: null
    };
  }
}
// ===== Section: Responder =====
// Description: Generates the user-facing conversational reply using the LLM
// - `generateResponse` includes context, optional function results, and formats the prompt
async function generateResponse(messages, classification, functionResult, storeContext) {
  console.log('[Responder] Starting response generation...');
  console.log('[Responder] Function result:', functionResult ? 'present' : 'null');
  const conversationHistory = messages.map((m)=>`${m.role}: ${m.content}`).join('\n');
  let contextInfo = '';
  if (storeContext) {
    contextInfo = `STORE CONTEXT:\nStore Name: ${storeContext.name || 'Unknown'}\nStore Type: ${storeContext.type || 'general'}\n`;
  }
  let functionContext = '';
  if (functionResult && functionResult.success) {
    functionContext = `FUNCTION RESULT (Use this data in your response):\n${JSON.stringify(functionResult, null, 2)}\n\nIMPORTANT: Present this data naturally and conversationally.`;
  } else if (functionResult && !functionResult.success) {
    functionContext = `FUNCTION ERROR:\n${functionResult.error}\n\nIMPORTANT: Apologize politely and guide the user.`;
  }
  const responsePrompt = `You are a helpful business assistant for this store.

${contextInfo}

CONVERSATION HISTORY:
${conversationHistory}

USER INTENT: ${classification.intent}

${functionContext}

Generate a helpful, natural, conversational response. Be friendly, use the function result data if available, and keep it under 200 words.

RESPOND NATURALLY:`;
  console.log('[Responder] Calling OpenRouter API...');
  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://heysheets.com',
        'X-Title': 'HeySheets'
      },
      body: JSON.stringify({
        model: 'anthropic/claude-3.5-sonnet',
        messages: [
          {
            role: 'user',
            content: responsePrompt
          }
        ],
        temperature: 0.7
      })
    });
    console.log('[Responder] API response status:', response.status);
    if (!response.ok) {
      const errorText = await response.text();
      console.error('[Responder] API error response:', errorText);
      throw new Error(`OpenRouter API error: ${response.status} - ${errorText}`);
    }
    const data = await response.json();
    console.log('[Responder] Got response data');
    const content = data.choices[0]?.message?.content;
    if (!content) {
      console.error('[Responder] No content in response');
      throw new Error('No response from LLM');
    }
    console.log('[Responder] Response content length:', content.length);
    return content;
  } catch (error) {
    console.error('[Responder] Error:', error);
    return 'I apologize, but I encountered an error. Please try again.';
  }
}
// ===== Section: Executor =====
// Description: Small, internal function implementations called based on classifier
// - dispatches to `getStoreInfo`, `checkAvailability`, `createBooking`, `getProducts`
async function executeFunction(functionName, params, context) {
  console.log(`[Executor] Calling function: ${functionName}`, params);
  const { storeId, authToken } = context;
  try {
    switch(functionName){
      case 'get_store_info':
        return await getStoreInfo(params, storeId, authToken);
      case 'check_availability':
        return await checkAvailability(params, storeId, authToken);
      case 'create_booking':
        return await createBooking(params, storeId, authToken);
      case 'get_products':
        return await getProducts(params, storeId, authToken);
      default:
        throw new Error(`Unknown function: ${functionName}`);
    }
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    console.error(`[Executor] Error in ${functionName}:`, errMsg);
    return {
      success: false,
      error: errMsg || 'Function execution failed'
    };
  }
}
async function getStoreInfo(params, storeId, authToken) {
  const tabs = params.info_type === 'all' ? [
    'hours',
    'services',
    'products'
  ] : [
    params.info_type
  ];
  const result = {
    success: true,
    data: {},
    type: params.info_type
  };
  for (const tab of tabs){
    try {
      const response = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/google-sheet`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
          'apikey': Deno.env.get('SUPABASE_ANON_KEY') || ''
        },
        body: JSON.stringify({
          operation: 'read',
          storeId,
          tabName: tab.charAt(0).toUpperCase() + tab.slice(1)
        })
      });
      if (response.ok) {
        const data = await response.json();
        result.data[tab] = data.data || [];
      }
    } catch (error) {
      result.data[tab] = [];
    }
  }
  return result;
}
async function checkAvailability(params, storeId, authToken) {
  const { service_name, date } = params;
  const servicesResponse = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/google-sheet`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${authToken}`,
      'apikey': Deno.env.get('SUPABASE_ANON_KEY') || ''
    },
    body: JSON.stringify({
      operation: 'read',
      storeId,
      tabName: 'Services'
    })
  });
  if (!servicesResponse.ok) throw new Error('Failed to fetch services');
  const servicesData = await servicesResponse.json();
  const services = servicesData.data || [];
  const service = services.find((s)=>s.serviceName?.toLowerCase() === service_name.toLowerCase() || s.name?.toLowerCase() === service_name.toLowerCase());
  if (!service) {
    return {
      success: false,
      error: `Service "${service_name}" not found. Available: ${services.map((s)=>s.serviceName || s.name).join(', ')}`
    };
  }
  const allPossibleSlots = [
    '09:00',
    '10:00',
    '11:00',
    '13:00',
    '14:00',
    '15:00',
    '16:00'
  ];
  return {
    success: true,
    service: service_name,
    date,
    day: new Date(date).toLocaleDateString('en-US', {
      weekday: 'long'
    }),
    available_slots: allPossibleSlots,
    duration: service.duration || '60 minutes'
  };
}
async function createBooking(params, storeId, authToken) {
  const required = [
    'service_name',
    'date',
    'time',
    'customer_name',
    'email'
  ];
  const missing = required.filter((field)=>!params[field]);
  if (missing.length > 0) return {
    success: false,
    error: `Missing: ${missing.join(', ')}`
  };
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(params.email)) return {
    success: false,
    error: 'Invalid email format'
  };
  const response = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/google-sheet`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${authToken}`,
      'apikey': Deno.env.get('SUPABASE_ANON_KEY') || ''
    },
    body: JSON.stringify({
      operation: 'append',
      storeId,
      tabName: 'Bookings',
      data: {
        service: params.service_name,
        date: params.date,
        time: params.time,
        customerName: params.customer_name,
        email: params.email,
        phone: params.phone || '',
        status: 'confirmed',
        createdAt: new Date().toISOString()
      }
    })
  });
  if (!response.ok) throw new Error('Failed to create booking');
  return {
    success: true,
    booking: {
      ...params,
      status: 'confirmed',
      confirmation: 'CONFIRMED-' + Date.now()
    },
    message: `Booking confirmed for ${params.service_name} on ${params.date} at ${params.time}`
  };
}
async function getProducts(params, storeId, authToken) {
  console.log('[getProducts] Fetching products, category:', params.category || 'all');
  console.log('[getProducts] StoreId:', storeId);
  try {
    const url = `${Deno.env.get('SUPABASE_URL')}/functions/v1/google-sheet`;
    console.log('[getProducts] Calling URL:', url);
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`,
        'apikey': Deno.env.get('SUPABASE_ANON_KEY') || ''
      },
      body: JSON.stringify({
        operation: 'read',
        storeId,
        tabName: 'Products'
      })
    });
    console.log('[getProducts] Response status:', response.status);
    if (!response.ok) {
      const errorText = await response.text();
      console.error('[getProducts] Error response:', errorText);
      throw new Error(`Failed to fetch products: ${response.status} - ${errorText}`);
    }
    const data = await response.json();
    console.log('[getProducts] Got data, product count:', data.data?.length || 0);
    let products = data.data || [];
    if (params.category) {
      products = products.filter((p)=>p.category?.toLowerCase() === params.category?.toLowerCase());
      if (products.length === 0) return {
        success: false,
        error: `No products in category "${params.category}"`
      };
    }
    console.log('[getProducts] Returning', products.length, 'products');
    return {
      success: true,
      products,
      category: params.category || 'all',
      count: products.length
    };
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    console.error('[getProducts] Caught error:', errMsg);
    return {
      success: false,
      error: `Failed to fetch products: ${errMsg}`
    };
  }
}
// ===== Section: Utility Functions =====
// Description: Lightweight helpers (JWT decode, Supabase client factory) used by the handler
function decodeJWT(token) {
  const parts = token.split('.');
  const payload = parts[1];
  const padded = payload + '='.repeat(4 - payload.length % 4);
  return JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(padded), (c)=>c.charCodeAt(0))));
}
function getSupabase() {
  return createClient(Deno.env.get('SUPABASE_URL') || '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '');
}
// ===== Section: Main HTTP Handler - PUBLIC (NO AUTH REQUIRED) =====
// Description: Entry point. Orchestrates store lookup, classification, optional function execution, and response generation.
// PUBLIC ACCESS - Anyone can chat without authentication
serve(async (req)=>{
  if (req.method === 'OPTIONS') return new Response('ok', {
    headers: corsHeaders
  });
  try {
    // Get anon key for internal API calls (NO USER AUTH REQUIRED)
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY') || '';

    const body = await req.json();
    const { messages, storeId } = body;
    if (!messages || !Array.isArray(messages) || messages.length === 0) throw new Error('Invalid messages format');
    if (!storeId) throw new Error('Missing storeId');

    console.log('[Chat] Processing for store:', storeId, '(PUBLIC ACCESS)');

    // Load store data (NO OWNERSHIP CHECK - PUBLIC ACCESS)
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

    console.log('[Chat] Store loaded:', store.name);

    // Load store data from sheets if available
    let storeData = {};
    if (store.sheet_id) {
      try {
        const loadTab = async (tabName)=>{
          try {
            const response = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/google-sheet`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${anonKey}`,
                'apikey': anonKey
              },
              body: JSON.stringify({
                operation: 'read',
                storeId,
                tabName
              })
            });
            const result = await response.json();
            return result.success ? result.data : [];
          } catch  {
            return [];
          }
        };
        const [products, services, hours] = await Promise.all([
          loadTab('Products'),
          loadTab('Services'),
          loadTab('Hours')
        ]);
        storeData = {
          products,
          services,
          hours
        };
        console.log('[Chat] Loaded store data:', {
          products: products.length,
          services: services.length,
          hours: hours.length
        });
      } catch (error) {
        const errMsg = error instanceof Error ? error.message : String(error);
        console.warn('[Chat] Error loading store data:', errMsg);
      }
    }

    // Classify user intent
    const classification = await classifyIntent(messages, {
      storeData
    });
    console.log('[Chat] Classification:', {
      intent: classification.intent,
      function: classification.functionToCall
    });

    // Execute function if needed
    let functionResult = null;
    if (classification.functionToCall) {
      console.log('[Chat] Executing function:', classification.functionToCall);
      functionResult = await executeFunction(
        classification.functionToCall,
        classification.params,
        {
          storeId,
          userId: 'anonymous',
          authToken: anonKey
        }
      );
      console.log('[Chat] Function result:', {
        success: functionResult?.success,
        hasData: !!functionResult?.products || !!functionResult?.data
      });
    }

    // Generate response
    console.log('[Chat] Calling generateResponse...');
    const response = await generateResponse(messages, classification, functionResult, store);
    console.log('[Chat] Response generated, length:', response?.length);

    return new Response(JSON.stringify({
      text: response,
      intent: classification.intent,
      confidence: classification.confidence,
      functionCalled: classification.functionToCall || null,
      functionResult
    }), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    console.error('[Chat] Error:', errMsg);
    return new Response(JSON.stringify({
      error: errMsg || 'Internal server error'
    }), {
      status: 500,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  }
});
console.log('[Chat-Completion] Handler registered');
