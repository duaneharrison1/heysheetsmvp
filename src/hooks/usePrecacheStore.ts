/**
 * ============================================================================
 * HOOK: usePrecacheStore
 * CACHING APPROACH: NEW - DATABASE CACHE (Backend/Supabase)
 * ============================================================================
 *
 * PURPOSE:
 *   Warm up the Supabase database cache when a store page loads
 *   Ensures cache hits for subsequent data requests (no Google Sheets API calls)
 *   
 * HOW IT WORKS:
 *   1. Component mounts or storeId changes → Hook fires
 *   2. Calls precache-store function with action: 'precache'
 *   3. precache-store fetches services, products, hours via google-sheet
 *   4. google-sheet checks database cache first:
 *      - CACHE HIT: Returns instantly from database
 *      - CACHE MISS: Fetches from Google Sheets, saves to database cache
 *   5. Cache expires after 1 hour (TTL) automatically
 *   6. No data returned to frontend, no latency added
 *
 * USAGE:
 *   import { usePrecacheStore } from '@/hooks/usePrecacheStore';
 *   
 *   export function StorePage() {
 *     const storeId = storeIdFromParams;
 *     usePrecacheStore(storeId);
 *     // component renders
 *   }
 *
 * WHEN CALLED:
 *   - StorePage.tsx: On component mount and when storeId changes
 *   - DebugChat.tsx: On component mount and when selectedStoreId changes
 *
 * DEPENDENCIES:
 *   - Supabase auth/client (for API calls)
 *   - precache-store function (supabase/functions/precache-store/index.ts)
 *   - google-sheet function (supabase/functions/google-sheet/index.ts)
 *   - cache table (supabase/migrations/20250108_create_cache_table.sql)
 *
 * RELATED FILES:
 *   - OLD APPROACH: src/lib/storeDataCache.ts (deprecated, to be removed)
 *   - NEW APPROACH: supabase/functions/precache-store/index.ts
 *   - NEW APPROACH: supabase/functions/lib/cache.ts
 *   - NEW APPROACH: supabase/functions/google-sheet/databaseCache.ts
 *
 * MIGRATION STATUS:
 *   ✅ Implemented
 *   ✅ Integrated into StorePage.tsx and DebugChat.tsx
 *   ⏳ Old approach (storeDataCache.ts) still exists for comparison
 *   📋 To remove old approach: Delete precacheStoreData calls and storeDataCache.ts
 * ============================================================================
 */

import { useEffect } from 'react';
import { useSupabaseClient } from '@supabase/auth-helpers-react';

export function usePrecacheStore(storeId: string | null | undefined) {
  const supabase = useSupabaseClient();

  useEffect(() => {
    if (!storeId) return;

    const precacheData = async () => {
      try {
        const supabaseUrl = supabase.supabaseUrl;
        const anonKey = supabase.supabaseKey;

        const response = await fetch(
          `${supabaseUrl}/functions/v1/precache-store`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${anonKey}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              storeId,
              action: 'precache'
            })
          }
        );

        if (!response.ok) {
          console.warn(`[usePrecacheStore] Precache failed for ${storeId}:`, response.status);
          return;
        }

        const result = await response.json();
        console.log(`[usePrecacheStore] Cache warmed for ${storeId}:`, {
          services: result.data?.services?.length || 0,
          products: result.data?.products?.length || 0,
          hours: result.data?.hours?.length || 0,
          duration: result.data?.duration
        });
      } catch (error) {
        console.warn(`[usePrecacheStore] Error precaching ${storeId}:`, error);
      }
    };

    precacheData();
    // No cleanup - cache persists via TTL
  }, [storeId, supabase]);
}
