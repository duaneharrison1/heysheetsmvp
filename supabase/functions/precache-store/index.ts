/**
 * ============================================================================
 * FUNCTION: precache-store
 * CACHING APPROACH: NEW - DATABASE CACHE (Backend/Supabase)
 * ============================================================================
 *
 * PURPOSE:
 *   Warm up the Supabase database cache when a store session begins
 *   Fetches services, products, hours from Google Sheets
 *   Stores results in database cache for fast retrieval
 *   Ensures subsequent requests get cache hits (no Sheets API calls)
 *
 * TRIGGER:
 *   Called by frontend usePrecacheStore hook when store page loads:
 *   - StorePage.tsx (on storeId mount)
 *   - DebugChat.tsx (on selectedStoreId change)
 *
 * ENDPOINT:
 *   POST /functions/v1/precache-store
 *
 * REQUEST BODY:
 *   {
 *     "storeId": "store-123",     // Required: Which store to precache
 *     "action": "precache|clear|stats"  // Required: What to do
 *   }
 *
 * ACTIONS:
 *   
 *   1. "precache" - Warm the cache
 *      - Fetches services, products, hours in parallel
 *      - Calls google-sheet function 3x with cacheType: 'database'
 *      - google-sheet handles cache check and save
 *      - Returns timing info and row counts
 *      
 *   2. "clear" - Delete cache for a store
 *      - Deletes all cache entries matching store:storeId:%
 *      - Called on session end (not currently used, TTL handles it)
 *      
 *   3. "stats" - Get cache statistics
 *      - Shows which data types are cached
 *      - Shows age and expiry times
 *      - Useful for debugging
 *
 * RESPONSE:
 *   {
 *     "success": true,
 *     "data": {
 *       "services": [...],
 *       "products": [...],
 *       "hours": [...],
 *       "duration": "245ms"
 *     }
 *   }
 *
 * FLOW:
 *   precache-store (this function)
 *     ↓
 *   Calls google-sheet 3x in parallel (services, products, hours)
 *     ↓
 *   google-sheet receives request with cacheType: 'database'
 *     ↓
 *   google-sheet checks database cache:
 *     - MISS: Fetches from Google Sheets, saves to cache
 *     - HIT: Returns from cache instantly
 *     ↓
 *   Returns data to precache-store
 *     ↓
 *   precache-store returns response to frontend (no data storage)
 *
 * DATABASE SCHEMA:
 *   Table: cache
 *   Columns:
 *     - key (TEXT PRIMARY KEY): store:{storeId}:{dataType}
 *     - data (JSONB): Array of rows from Google Sheet
 *     - expiresAt (TIMESTAMP): When cache expires
 *     - cachedAt (TIMESTAMP): When cache was created
 *
 * TTL BEHAVIOR:
 *   - Default: 3600 seconds (1 hour)
 *   - Cache expires automatically after 1 hour
 *   - Sessions longer than 1 hour will need re-precache
 *   - Next session starts with fresh precache
 *
 * PARALLEL EXECUTION:
 *   All three data types (services, products, hours) are fetched in parallel:
 *   - Not sequential (would be 3x slower)
 *   - Total time: ~max(individual times) ≈ 250ms for first request
 *
 * RELATED FILES:
 *   - FRONTEND HOOK: src/hooks/usePrecacheStore.ts
 *   - GOOGLE SHEET: supabase/functions/google-sheet/index.ts
 *   - CACHE HELPERS: supabase/functions/lib/cache.ts
 *   - DATABASE CACHE: supabase/functions/google-sheet/databaseCache.ts
 *   - DB MIGRATION: supabase/migrations/20250108_create_cache_table.sql
 *   - OLD APPROACH: src/lib/storeDataCache.ts (deprecated)
 *
 * MIGRATION STATUS:
 *   ✅ Function implemented
 *   ✅ Called from frontend usePrecacheStore hook
 *   ✅ Integrated into StorePage.tsx and DebugChat.tsx
 *   ⏳ Old precacheStoreData() still exists
 *   📋 To complete migration: Remove old storeDataCache.ts usage
 *
 * TESTING:
 *   # Precache a store
 *   curl -X POST https://xxx.supabase.co/functions/v1/precache-store \
 *     -H "Authorization: Bearer xxx" \
 *     -H "Content-Type: application/json" \
 *     -d '{"storeId": "store-123", "action": "precache"}'
 *   
 *   # Check cache stats
 *   curl -X POST https://xxx.supabase.co/functions/v1/precache-store \
 *     -H "Authorization: Bearer xxx" \
 *     -H "Content-Type: application/json" \
 *     -d '{"storeId": "store-123", "action": "stats"}'
 * ============================================================================
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-request-id'
};

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') || '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
);

function log(requestId: string | null, message: string, data?: any) {
  const prefix = requestId ? `[PRECACHE:${requestId}]` : '[precache-store]';
  if (data) {
    console.log(prefix, message, data);
  } else {
    console.log(prefix, message);
  }
}

/**
 * Fetch data from google-sheet function
 */
async function fetchFromGoogleSheet(
  supabaseUrl: string,
  serviceRoleKey: string,
  storeId: string,
  tabName: string,
  requestId: string | null
) {
  try {
    const response = await fetch(`${supabaseUrl}/functions/v1/google-sheet`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${serviceRoleKey}`,
        'Content-Type': 'application/json',
        'X-Request-ID': requestId || ''
      },
      body: JSON.stringify({
        operation: 'read',
        storeId,
        tabName,
        cacheType: 'database'
      })
    });

    if (!response.ok) {
      log(requestId, `❌ Failed to fetch ${tabName}:`, response.status);
      return null;
    }

    const result = await response.json();
    return result.data || null;
  } catch (error) {
    log(requestId, `❌ Error fetching ${tabName}:`, error);
    return null;
  }
}

/**
 * Precache all store data to database
 * Called when session begins
 */
async function precacheStoreData(
  storeId: string,
  supabaseUrl: string,
  serviceRoleKey: string,
  requestId: string | null
) {
  log(requestId, '🚀 Starting precache for store:', storeId);
  const startTime = performance.now();

  // Fetch all three data types in parallel
  const [services, products, hours] = await Promise.all([
    fetchFromGoogleSheet(supabaseUrl, serviceRoleKey, storeId, 'Services', requestId),
    fetchFromGoogleSheet(supabaseUrl, serviceRoleKey, storeId, 'Products', requestId),
    fetchFromGoogleSheet(supabaseUrl, serviceRoleKey, storeId, 'Hours', requestId)
  ]);

  const duration = performance.now() - startTime;

  log(requestId, '✅ Precache complete:', {
    services: services?.length || 0,
    products: products?.length || 0,
    hours: hours?.length || 0,
    duration: `${duration.toFixed(0)}ms`
  });

  return {
    storeId,
    services: services || [],
    products: products || [],
    hours: hours || [],
    duration
  };
}

serve(async (req) => {
  const requestId = req.headers.get('X-Request-ID') || null;

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { storeId, action } = body;

    if (!storeId) {
      return new Response(JSON.stringify({ error: 'Missing storeId' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // ============================================
    // PRECACHE ACTION
    // ============================================
    if (action === 'precache') {
      const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
      const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

      const result = await precacheStoreData(storeId, supabaseUrl, serviceRoleKey, requestId);

      return new Response(JSON.stringify({
        success: true,
        message: 'Precache completed',
        data: result
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // ============================================
    // CLEAR CACHE ACTION (for session end)
    // ============================================
    if (action === 'clear') {
      log(requestId, '🗑️ Clearing cache for store:', storeId);

      const { error } = await supabase
        .from('cache')
        .delete()
        .like('key', `store:${storeId}:%`);

      if (error) {
        log(requestId, '❌ Error clearing cache:', error.message);
        return new Response(JSON.stringify({
          success: false,
          error: error.message
        }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      log(requestId, '✅ Cache cleared for store:', storeId);
      return new Response(JSON.stringify({
        success: true,
        message: 'Cache cleared',
        storeId
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // ============================================
    // GET CACHE STATS
    // ============================================
    if (action === 'stats') {
      log(requestId, '📊 Getting cache stats for store:', storeId);
      const now = new Date().toISOString();

      const { data, error } = await supabase
        .from('cache')
        .select('key, cachedAt, expiresAt')
        .like('key', `store:${storeId}:%`)
        .gt('expiresAt', now);

      if (error) {
        return new Response(JSON.stringify({
          success: false,
          error: error.message
        }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const stats: any = {};
      data?.forEach((entry: any) => {
        const dataType = entry.key.split(':')[2];
        const age = Math.round((Date.now() - new Date(entry.cachedAt).getTime()) / 1000);
        stats[dataType] = {
          cached: true,
          age,
          expiresAt: entry.expiresAt
        };
      });

      return new Response(JSON.stringify({
        success: true,
        storeId,
        stats,
        cacheEntries: data?.length || 0
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({
      error: 'Unknown action. Use: precache, clear, or stats'
    }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('[precache-store] Error:', error);
    return new Response(JSON.stringify({
      error: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
