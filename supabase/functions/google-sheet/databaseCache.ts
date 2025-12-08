/**
 * ============================================================================
 * MODULE: databaseCache.ts
 * CACHING APPROACH: NEW - DATABASE CACHE (Backend/Supabase)
 * ============================================================================
 *
 * PURPOSE:
 *   Wrapper functions for database cache operations specific to google-sheet
 *   Implements the cache check/save logic called by google-sheet READ operation
 *   Part of the hybrid cache system (memory + database)
 *
 * FUNCTIONS:
 *   - getDatabaseCacheData(storeId, tabName)
 *     Returns cached data if exists and not expired
 *   
 *   - setDatabaseCacheData(storeId, tabName, data, ttlSeconds)
 *     Saves data to database cache with TTL
 *
 * CACHE KEY FORMAT:
 *   store:{storeId}:{tabName}
 *   Examples:
 *     - store:store-123:Services
 *     - store:store-123:Products
 *     - store:store-123:Hours
 *
 * TTL BEHAVIOR:
 *   - Default: 3600 seconds (1 hour)
 *   - Configurable per call
 *   - Cache persists across:
 *     ✅ Function executions
 *     ✅ Page refreshes
 *     ✅ User sessions (1 hour)
 *   - Expires automatically via query filter (not deleted)
 *
 * DEPENDENCY CHAIN:
 *   google-sheet/index.ts (READ operation)
 *     ↓
 *   Check cacheType parameter
 *     ↓
 *   If cacheType === 'database':
 *     ↓
 *   databaseCache.getDatabaseCacheData()
 *     ↓
 *   Returns data from cache table or null
 *     ↓
 *   If null: Fetch from Google Sheets
 *     ↓
 *   databaseCache.setDatabaseCacheData()
 *     ↓
 *   Saves to cache table
 *
 * RELATED FILES:
 *   - CACHE HELPERS: supabase/functions/lib/cache.ts
 *   - GOOGLE SHEET: supabase/functions/google-sheet/index.ts
 *   - MEMORY CACHE: supabase/functions/google-sheet/memoryCache.ts
 *   - PRECACHER: supabase/functions/precache-store/index.ts
 *   - FRONTEND HOOK: src/hooks/usePrecacheStore.ts
 *
 * MIGRATION STATUS:
 *   ✅ Implemented as part of cacheType refactor
 *   ✅ Integrated into google-sheet function
 *   ✅ Used by precache-store function
 *   ✅ Parallel implementation with memory cache (for testing)
 * ============================================================================
 */

import { getCacheData, setCacheData } from '../lib/cache.ts';

/**
 * Get data from database cache
 * Cache key format: store:{storeId}:{tabName}
 */
export async function getDatabaseCacheData(storeId: string, tabName: string): Promise<any | null> {
  const data = await getCacheData(storeId, tabName);
  if (data) {
    console.log(`[DatabaseCache] HIT: ${storeId}:${tabName}`);
    return data;
  }
  console.log(`[DatabaseCache] MISS: ${storeId}:${tabName}`);
  return null;
}

/**
 * Save data to database cache
 * Default TTL: 1 hour for session-based caching
 */
export async function setDatabaseCacheData(
  storeId: string,
  tabName: string,
  data: any,
  ttlSeconds: number = 3600
): Promise<void> {
  await setCacheData(storeId, tabName, data, ttlSeconds);
  console.log(`[DatabaseCache] SET: ${storeId}:${tabName} (TTL: ${ttlSeconds}s)`);
}
