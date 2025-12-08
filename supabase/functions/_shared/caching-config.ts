/**
 * ============================================================================
 * CACHING STRATEGY CONFIGURATION
 * ============================================================================
 *
 * Central configuration for switching between caching approaches globally.
 * All functions should import and use this config to determine cache behavior.
 *
 * STRATEGIES:
 *   'database'  - NEW: Backend stores cache in Supabase database
 *   'legacy'    - OLD: Frontend stores cache in localStorage/memory
 *   'memory'    - TEST: In-memory only (ephemeral)
 *
 * USAGE:
 *   import { CACHING_STRATEGY } from '../_shared/caching-config.ts';
 *
 *   if (CACHING_STRATEGY === 'database') {
 *     // Use new database cache approach
 *     loadTab(...) with cacheType: 'database'
 *   } else if (CACHING_STRATEGY === 'legacy') {
 *     // Use old frontend cache approach
 *     loadTab(...) without cacheType, expect cachedData from frontend
 *   }
 *
 * SWITCHING STRATEGIES:
 *   Change the value below to switch all functions globally.
 *   No code changes needed in individual functions.
 *
 * ============================================================================
 */

/**
 * ACTIVE CACHING STRATEGY
 * 
 * Options:
 *   'database' - Use Supabase database cache (new approach)
 *   'legacy'   - Use frontend cache from localStorage (old approach)
 *   'memory'   - Use in-memory ephemeral cache (testing only)
 *
 * Change this value to switch caching globally:
 */
export const CACHING_STRATEGY = 'database' as const;

// Type definition for strategy
export type CachingStrategy = 'database' | 'legacy' | 'memory';

/**
 * Helper function to check active strategy
 */
export function isCachingStrategy(strategy: CachingStrategy): boolean {
  return CACHING_STRATEGY === strategy;
}

/**
 * Description of current strategy (for logging/debugging)
 */
export const STRATEGY_DESCRIPTION: Record<CachingStrategy, string> = {
  database: 'Database Cache (NEW) - Supabase cache table, persistent across sessions',
  legacy: 'Legacy Cache (OLD) - Frontend localStorage/memory, data sent to backend',
  memory: 'Memory Cache (TEST) - In-memory only, ephemeral, testing only'
};

/**
 * Get description of current strategy
 */
export function getCurrentStrategyDescription(): string {
  return STRATEGY_DESCRIPTION[CACHING_STRATEGY];
}

/**
 * Behavior matrix for different strategies
 */
export const STRATEGY_BEHAVIOR = {
  database: {
    description: 'Database Cache (NEW)',
    precacheOnFrontend: true,          // usePrecacheStore hook warms cache
    sendCachedDataToBackend: false,    // Don't send cachedData in request
    backendUsesCache: true,            // Backend checks google-sheet cache
    cacheTtl: '1 hour',
    persistence: 'Across sessions',
    fronendExposure: false
  },
  legacy: {
    description: 'Legacy Cache (OLD)',
    precacheOnFrontend: true,          // precacheStoreData() on page load
    sendCachedDataToBackend: true,     // Send cachedData in chat request
    backendUsesCache: false,           // Backend ignores, uses frontend data
    cacheTtl: '5 minutes',
    persistence: 'Page refresh only',
    fronendExposure: true
  },
  memory: {
    description: 'Memory Cache (TEST)',
    precacheOnFrontend: false,
    sendCachedDataToBackend: false,
    backendUsesCache: true,
    cacheTtl: 'Single execution',
    persistence: 'None',
    fronendExposure: false
  }
};

/**
 * Logging helper to log cache strategy at startup
 */
export function logCachingStrategy(context: string): void {
  console.log(`[${context}] Active Caching Strategy: ${CACHING_STRATEGY}`);
  console.log(`[${context}] ${getCurrentStrategyDescription()}`);
  const behavior = STRATEGY_BEHAVIOR[CACHING_STRATEGY];
  console.log(`[${context}] Precache on frontend: ${behavior.precacheOnFrontend}`);
  console.log(`[${context}] Send cached data to backend: ${behavior.sendCachedDataToBackend}`);
  console.log(`[${context}] Backend uses cache: ${behavior.backendUsesCache}`);
}
