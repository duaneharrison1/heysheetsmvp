import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') || '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
);

/**
 * Get cached data from database
 * Returns null if not found or expired
 */
export async function getCacheData(storeId: string, dataType: string) {
  try {
    const key = `store:${storeId}:${dataType}`;
    const now = new Date().toISOString();

    const { data, error } = await supabase
      .from('cache')
      .select('data')
      .eq('key', key)
      .gt('expiresAt', now)
      .maybeSingle();

    if (error) {
      console.warn(`[Cache] Read error for ${key}:`, error.message);
      return null;
    }

    if (data) {
      console.log(`[Cache] HIT: ${dataType}`);
      return data.data;
    }

    console.log(`[Cache] MISS: ${dataType}`);
    return null;
  } catch (e) {
    console.warn(`[Cache] Error reading cache:`, e);
    return null;
  }
}

/**
 * Save data to cache
 * ttlSeconds: time to live (default: 1 hour for session persistence)
 */
export async function setCacheData(
  storeId: string,
  dataType: string,
  value: any,
  ttlSeconds = 3600 // 1 hour for session-based caching
) {
  try {
    const key = `store:${storeId}:${dataType}`;
    const expiresAt = new Date(Date.now() + ttlSeconds * 1000).toISOString();

    const { error } = await supabase.from('cache').upsert(
      {
        key,
        data: value,
        expiresAt,
      },
      { onConflict: 'key' }
    );

    if (error) {
      console.warn(`[Cache] Write error for ${key}:`, error.message);
    } else {
      console.log(`[Cache] SET: ${dataType} (TTL: ${ttlSeconds}s)`);
    }
  } catch (e) {
    console.warn(`[Cache] Error writing cache:`, e);
  }
}

/**
 * Clear all cache for a specific store
 * Call after mutations (bookings, form submissions, etc.)
 */
export async function clearStoreCache(storeId: string) {
  try {
    const { error } = await supabase
      .from('cache')
      .delete()
      .like('key', `store:${storeId}:%`);

    if (error) {
      console.warn(`[Cache] Clear error for store ${storeId}:`, error.message);
    } else {
      console.log(`[Cache] Cleared all cache for store: ${storeId}`);
    }
  } catch (e) {
    console.warn(`[Cache] Error clearing cache:`, e);
  }
}

/**
 * Get cache stats for debugging
 */
export async function getCacheStats(storeId: string) {
  try {
    const now = new Date().toISOString();

    const { data, error } = await supabase
      .from('cache')
      .select('key, cachedAt, expiresAt')
      .like('key', `store:${storeId}:%`)
      .gt('expiresAt', now);

    if (error) {
      console.warn('[Cache] Stats error:', error.message);
      return {};
    }

    const stats: any = {};
    data?.forEach((entry: any) => {
      const dataType = entry.key.split(':')[2];
      const age = Math.round((Date.now() - new Date(entry.cachedAt).getTime()) / 1000);
      stats[dataType] = { cached: true, age };
    });

    return stats;
  } catch (e) {
    console.warn('[Cache] Error getting stats:', e);
    return {};
  }
}
