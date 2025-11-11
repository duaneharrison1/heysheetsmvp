// Utility helpers: cors headers, env access, JWT decode, supabase client
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Read OpenRouter API key from env first; fallback kept for compatibility (not recommended for prod)
const FALLBACK_OPENROUTER_KEY = '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';
export function getOpenRouterApiKey(): string {
  return Deno.env.get('OPENROUTER_API_KEY') || FALLBACK_OPENROUTER_KEY;
}

export function decodeJWT(token: string): { sub: string } {
  const parts = token.split('.');
  const payload = parts[1] || '';
  const padded = payload + '='.repeat((4 - (payload.length % 4)) % 4);
  return JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(padded), c => c.charCodeAt(0))));
}

export function getSupabase() {
  return createClient(Deno.env.get('SUPABASE_URL') || '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '');
}
