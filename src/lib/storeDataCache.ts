/**
 * ============================================================================
 * FILE: storeDataCache.ts
 * CACHING APPROACH: OLD - DEPRECATED (Frontend/Browser Cache)
 * STATUS: DEPRECATED - Use new database cache via usePrecacheStore hook instead
 * ============================================================================
 *
 * 2-Tier Cache for Store Data (LEGACY)
 * Tier 1: Memory (Map) - fast, lost on refresh
 * Tier 2: localStorage - slower, survives refresh
 *
 * ORIGINAL PURPOSE:
 *   1. Precache data when store page loads (before user sends message)
 *   2. Pass cached data to chat-completion to avoid refetching
 *
 * ISSUES WITH THIS APPROACH:
 *   ❌ Data stored on client-side (exposed to users via DevTools)
 *   ❌ Redundant storage (data cached on frontend AND backend)
 *   ❌ Frontend sends data blobs back to backend with each request
 *   ❌ Complex cache invalidation logic duplicated in frontend
 *   ❌ Inconsistent with backend cache (stale data possible)
 *   ❌ Takes up browser storage quota
 *   ❌ Lost on page refresh (localStorage fallback is slow)
 *
 * REPLACEMENT:
 *   ✅ src/hooks/usePrecacheStore.ts - New hook-based approach
 *   ✅ supabase/functions/precache-store/index.ts - Backend precacher
 *   ✅ supabase/functions/lib/cache.ts - Database cache helpers
 *   ✅ Cache stored in Supabase database (cache table)
 *   ✅ TTL-based expiry (1 hour)
 *   ✅ No data exposure to client
 *
 * MIGRATION INSTRUCTIONS:
 *   1. Remove imports of precacheStoreData, getCachedStoreData, getCacheStats
 *   2. Replace with usePrecacheStore hook call
 *   3. Remove cachedData parameter from chat-completion requests
 *   4. Test that caching still works via database
 *   5. Delete this file when confident old approach not needed
 *
 * WHERE THIS FILE IS USED:
 *   - src/pages/StorePage.tsx (line 23, marked deprecated)
 *   - src/pages/DebugChat.tsx (line 20, marked deprecated)
 *   - These imports are kept for now for backwards compatibility
 *
 * TIMELINE:
 *   ✅ Implemented: New database cache approach created
 *   ✅ Wired up: usePrecacheStore hook added to StorePage and DebugChat
 *   ⏳ Testing: Verify caching works with new approach
 *   📋 Cleanup: Remove old imports and delete this file
 *
 * RELATED FILES:
 *   - NEW: src/hooks/usePrecacheStore.ts
 *   - NEW: supabase/functions/precache-store/index.ts
 *   - NEW: supabase/functions/lib/cache.ts
 *   - NEW: supabase/functions/google-sheet/databaseCache.ts
 *   - NEW: supabase/migrations/20250108_create_cache_table.sql
 *   - UPDATED: supabase/functions/google-sheet/index.ts (added cacheType param)
 *   - DEPRECATED: src/pages/StorePage.tsx (old imports still here)
 *   - DEPRECATED: src/pages/DebugChat.tsx (old imports still here)
 *
 * ============================================================================
 */

interface CacheEntry<T> {
  data: T;
  expiry: number;
  cachedAt: number;
}

interface StoreDataCache {
  services: any[];
  products: any[];
  hours: any[];
}

const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const CACHE_PREFIX = 'heysheets:cache:';

// Tier 1: Memory cache (fast but lost on refresh)
const memoryCache = new Map<string, CacheEntry<any>>();

/**
 * Generate cache key for store data
 */
function getCacheKey(storeId: string, dataType: string): string {
  return `${CACHE_PREFIX}${storeId}:${dataType}`;
}

/**
 * Get data from cache (checks memory first, then localStorage)
 */
export function getFromCache<T>(storeId: string, dataType: string): T | null {
  const key = getCacheKey(storeId, dataType);
  const now = Date.now();

  // Tier 1: Check memory cache first (fastest)
  const memEntry = memoryCache.get(key);
  if (memEntry && now < memEntry.expiry) {
    // console.log(`[Cache] Memory HIT: ${dataType} (age: ${Math.round((now - memEntry.cachedAt) / 1000)}s)`);
    return memEntry.data as T;
  }

  // Tier 2: Check localStorage (survives refresh)
  try {
    const stored = localStorage.getItem(key);
    if (stored) {
      const entry: CacheEntry<T> = JSON.parse(stored);
      if (now < entry.expiry) {
        // console.log(`[Cache] localStorage HIT: ${dataType} (age: ${Math.round((now - entry.cachedAt) / 1000)}s)`);
        // Promote to memory cache for faster next access
        memoryCache.set(key, entry);
        return entry.data;
      } else {
        // Expired, clean up
        localStorage.removeItem(key);
        // console.log(`[Cache] Expired: ${dataType}`);
      }
    }
  } catch (e) {
    console.warn('[Cache] localStorage read error:', e);
  }

  // console.log(`[Cache] MISS: ${dataType}`);
  return null;
}

/**
 * Save data to both cache tiers
 */
export function setInCache<T>(storeId: string, dataType: string, data: T, ttlMs?: number): void {
  const key = getCacheKey(storeId, dataType);
  const ttl = ttlMs || CACHE_TTL;
  const now = Date.now();

  const entry: CacheEntry<T> = {
    data,
    expiry: now + ttl,
    cachedAt: now,
  };

  // Tier 1: Memory cache
  memoryCache.set(key, entry);

  // Tier 2: localStorage
    try {
    localStorage.setItem(key, JSON.stringify(entry));
    // console.log(`[Cache] Stored: ${dataType} (TTL: ${ttl / 1000}s, size: ${Array.isArray(data) ? data.length : 'n/a'})`);
  } catch (e) {
    // localStorage might be full or disabled
    console.warn('[Cache] localStorage write error:', e);
  }
}

/**
 * Clear all cache for a specific store
 * Call this after mutations (bookings, lead submissions, etc.)
 */
export function clearStoreCache(storeId: string): void {
  const prefix = getCacheKey(storeId, '');

  // Clear memory cache
  for (const key of memoryCache.keys()) {
    if (key.startsWith(prefix)) {
      memoryCache.delete(key);
    }
  }

  // Clear localStorage
    try {
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const key = localStorage.key(i);
      if (key?.startsWith(prefix)) {
        localStorage.removeItem(key);
      }
    }
    // console.log(`[Cache] Cleared all cache for store: ${storeId}`);
  } catch (e) {
    console.warn('[Cache] localStorage clear error:', e);
  }
}

/**
 * Get all cached data for a store (for passing to chat-completion)
 */
export function getCachedStoreData(storeId: string): StoreDataCache | null {
  const services = getFromCache<any[]>(storeId, 'services');
  const products = getFromCache<any[]>(storeId, 'products');
  const hours = getFromCache<any[]>(storeId, 'hours');

  // Only return if we have at least some data cached
  if (services || products || hours) {
    return {
      services: services || [],
      products: products || [],
      hours: hours || [],
    };
  }

  return null;
}

/**
 * Fetch data from server and cache it
 */
async function fetchAndCache(
  storeId: string,
  dataType: string,
  supabaseUrl: string,
  anonKey: string
): Promise<any[]> {
  try {
    const response = await fetch(`${supabaseUrl}/functions/v1/google-sheet`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${anonKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        operation: 'read',
        storeId,
        tabName: dataType.charAt(0).toUpperCase() + dataType.slice(1), // services -> Services
      }),
    });

    if (!response.ok) {
      console.warn(`[Cache] Failed to fetch ${dataType}:`, response.status);
      return [];
    }

    const result = await response.json();
    const data = result.data || [];

    // Cache the result
    setInCache(storeId, dataType, data);

    return data;
  } catch (error) {
    console.warn(`[Cache] Error fetching ${dataType}:`, error);
    return [];
  }
}

/**
 * Precache all store data - call this when store page loads
 * This warms the cache BEFORE user sends their first message
 */
export async function precacheStoreData(
  storeId: string,
  supabaseUrl: string,
  anonKey: string
): Promise<StoreDataCache> {
  // console.log(`[Cache] Precaching data for store: ${storeId}`);

  const dataTypes = ['services', 'products', 'hours'];
  const results: any[] = [];

  // Check cache and fetch missing data in parallel
  await Promise.all(
    dataTypes.map(async (dataType, index) => {
      // Check cache first
      const cached = getFromCache<any[]>(storeId, dataType);
      if (cached) {
        results[index] = cached;
        return;
      }

      // Fetch from server
      const data = await fetchAndCache(storeId, dataType, supabaseUrl, anonKey);
      results[index] = data;
    })
  );

  const storeData: StoreDataCache = {
    services: results[0] || [],
    products: results[1] || [],
    hours: results[2] || [],
  };

  // console.log(`[Cache] Precache complete:`, {
  //   services: storeData.services.length,
  //   products: storeData.products.length,
  //   hours: storeData.hours.length,
  // });

  return storeData;
}

/**
 * Check if data is cached (without retrieving it)
 */
export function isCached(storeId: string, dataType: string): boolean {
  const key = getCacheKey(storeId, dataType);
  const now = Date.now();

  // Check memory first
  const memEntry = memoryCache.get(key);
  if (memEntry && now < memEntry.expiry) {
    return true;
  }

  // Check localStorage
  try {
    const stored = localStorage.getItem(key);
    if (stored) {
      const entry = JSON.parse(stored);
      return now < entry.expiry;
    }
  } catch {
    // Ignore errors
  }

  return false;
}

/**
 * Get cache stats for debugging
 */
export function getCacheStats(storeId: string): {
  services: { cached: boolean; age: number | null };
  products: { cached: boolean; age: number | null };
  hours: { cached: boolean; age: number | null };
} {
  const now = Date.now();
  const getAge = (dataType: string): number | null => {
    const key = getCacheKey(storeId, dataType);
    const memEntry = memoryCache.get(key);
    if (memEntry && now < memEntry.expiry) {
      return Math.round((now - memEntry.cachedAt) / 1000);
    }
    try {
      const stored = localStorage.getItem(key);
      if (stored) {
        const entry = JSON.parse(stored);
        if (now < entry.expiry) {
          return Math.round((now - entry.cachedAt) / 1000);
        }
      }
    } catch {
      // Ignore
    }
    return null;
  };

  return {
    services: { cached: isCached(storeId, 'services'), age: getAge('services') },
    products: { cached: isCached(storeId, 'products'), age: getAge('products') },
    hours: { cached: isCached(storeId, 'hours'), age: getAge('hours') },
  };
}
