/**
 * QA LLM ENDPOINT
 * ================
 * Simple raw LLM call for QA testing system.
 * Used by user-simulator and evaluator for generating/judging test messages.
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { corsHeaders } from '../_shared/cors.ts';
import {
  OPENROUTER_API_URL,
  HTTP_REFERER,
  DEFAULT_MODEL,
  SIMPLE_MODE_MAX_TOKENS,
  SIMPLE_MODE_TEMPERATURE,
} from '../_shared/config.ts';

// ============================================================================
// TYPES
// ============================================================================

interface QALLMRequest {
  messages: Array<{ role: string; content: string }>;
  model?: string;
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

  try {
    const { messages, model }: QALLMRequest = await req.json();

    if (!messages || messages.length === 0) {
      return new Response(
        JSON.stringify({ error: 'Missing required field: messages' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const OPENROUTER_API_KEY = Deno.env.get('OPENROUTER_API_KEY');
    if (!OPENROUTER_API_KEY) {
      return new Response(
        JSON.stringify({ error: 'OPENROUTER_API_KEY not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const response = await fetch(OPENROUTER_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
        'HTTP-Referer': HTTP_REFERER,
        'X-Title': 'HeySheets QA',
      },
      body: JSON.stringify({
        model: model || DEFAULT_MODEL,
        messages,
        temperature: SIMPLE_MODE_TEMPERATURE,
        max_tokens: SIMPLE_MODE_MAX_TOKENS,
        reasoning: { enabled: false },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[QA-LLM] OpenRouter error: ${response.status}`, errorText);
      return new Response(
        JSON.stringify({ error: 'LLM call failed', details: errorText }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const data = await response.json();
    const text = data.choices?.[0]?.message?.content || '';

    return new Response(
      JSON.stringify({ text }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json', 'X-Request-ID': requestId } }
    );
  } catch (error) {
    console.error('[QA-LLM] Error:', error);
    return new Response(
      JSON.stringify({
        error: 'Internal server error',
        details: error instanceof Error ? error.message : String(error),
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

console.log('QA LLM function started');
