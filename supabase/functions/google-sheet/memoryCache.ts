/**
 * ============================================================================
 * MODULE: memoryCache.ts
 * CACHING APPROACH: OLD - IN-MEMORY CACHE (For Testing Legacy Behavior)
 * STATUS: PARALLEL IMPLEMENTATION (Used for A/B testing, not primary)
 * ============================================================================
 *
 * PURPOSE:
 *   In-memory cache stored in RAM of Deno process
 *   Extracted from original google-sheet function for modularity
 *   Allows testing legacy caching behavior vs new database cache
 *   Used when cacheType parameter = 'memory'
 *
 * HOW IT WORKS:
 *   - Stores data in JavaScript Map (hash table)
 *   - Data persists during single function execution (~100ms)
 *   - Data is lost when function execution ends
 *   - Each function invocation gets fresh process with empty Map
 *
 * LIMITATIONS:
 *   ❌ Only survives during one function execution
 *   ❌ Ephemeral (lost immediately after request)
 *   ❌ Only helps if same data requested twice in same execution (rare)
 *   ❌ Different requests don't share cache (process isolation)
 *   ❌ Not useful for session-based caching
 *
 * COMPARISON WITH DATABASE CACHE:
 *   
 *   In-Memory (this module):
 *   - Lifespan: ~100ms (one execution)
 *   - Speed: <1ms lookup
 *   - Persistence: None
 *   - Use: Legacy/testing only
 *   
 *   Database (databaseCache.ts):
 *   - Lifespan: 1 hour (1 session)
 *   - Speed: ~15ms lookup
 *   - Persistence: Across functions, users, refreshes
 *   - Use: Primary caching strategy
 *
 * USAGE:
 *   import { getMemoryCacheData, setMemoryCacheData } from './memoryCache.ts';
 *   
 *   const cacheKey = `${sheetId}:${tabName}`;
 *   const cachedData = getMemoryCacheData(cacheKey);
 *   if (cachedData) {
 *     return cachedData;
 *   }
 *   
 *   // Fetch from Sheets
 *   const data = await fetchFromSheets();
 *   setMemoryCacheData(cacheKey, data);
 *   return data;
 *
 * WHY KEPT:
 *   - A/B testing: Compare performance with database cache
 *   - Fallback: If database cache fails, can switch to memory
 *   - Testing: Legacy behavior verification
 *   - Context: Understand evolution of caching strategy
 *
 * WHEN TO USE:
 *   - Pass `cacheType: 'memory'` to google-sheet function
 *   - For debugging/testing only
 *   - Not recommended for production
 *
 * RELATED FILES:
 *   - GOOGLE SHEET: supabase/functions/google-sheet/index.ts
 *   - DATABASE CACHE: supabase/functions/google-sheet/databaseCache.ts
 *   - NEW APPROACH: supabase/functions/precache-store/index.ts
 *   - DEPRECATED: src/lib/storeDataCache.ts (similar concept on frontend)
 *
 * MIGRATION STATUS:
 *   ✅ Extracted for modularity
 *   ⏳ Kept for testing/comparison
 *   📋 Can be removed when database cache fully validated
 * ============================================================================
 */

const cache = new Map();
const CACHE_TTL = 60 * 60 * 1000; // 1 hour (for consistency, though data doesn't last)

export function getMemoryCacheData(cacheKey: string): any | null {
  const cached = cache.get(cacheKey);
  if (cached && Date.now() < cached.expiry) {
    console.log(`[MemoryCache] HIT: ${cacheKey}`);
    return cached.data;
  }
  console.log(`[MemoryCache] MISS: ${cacheKey}`);
  return null;
}

export function setMemoryCacheData(cacheKey: string, data: any, ttlMs: number = CACHE_TTL): void {
  cache.set(cacheKey, {
    data,
    expiry: Date.now() + ttlMs
  });
  console.log(`[MemoryCache] SET: ${cacheKey} (TTL: ${ttlMs / 1000}s)`);
}
