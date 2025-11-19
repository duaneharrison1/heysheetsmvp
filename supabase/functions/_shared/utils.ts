// Utility helpers: cors headers, env access, JWT decode, supabase client
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Read OpenRouter API key from environment variable
export function getOpenRouterApiKey(): string {
  const key = Deno.env.get('OPENROUTER_API_KEY');
  if (!key) {
    throw new Error('OPENROUTER_API_KEY environment variable is not set');
  }
  return key;
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
