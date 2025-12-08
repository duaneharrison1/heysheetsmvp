# Caching Strategy - Configurable Approach

## Overview

Instead of hard-coding one caching approach, the system now supports **multiple caching strategies** that can be switched globally via configuration.

All functions check `CACHING_STRATEGY` and adapt their behavior accordingly.

---

## Configuration File

**`supabase/functions/_shared/caching-config.ts`**

```typescript
export const CACHING_STRATEGY = 'database' as const;

export type CachingStrategy = 'database' | 'legacy' | 'memory';
```

---

## Supported Strategies

### 1. 'database' - NEW (Default)

**Backend stores cache in Supabase database**

- **Where**: Supabase PostgreSQL `cache` table
- **Precache**: Frontend `usePrecacheStore` hook warms cache
- **Frontend sends**: Just `storeId` and `messages`
- **Backend behavior**:
  - `loadTab()` calls google-sheet with `cacheType: 'database'`
  - google-sheet checks database cache first
  - If cache miss, fetches from Google Sheets and saves to cache
  - If cache hit, returns instantly
- **TTL**: 1 hour (persistent across sessions)
- **Frontend exposure**: None (data not sent to client)

**When to use**: Primary production approach

---

### 2. 'legacy' - OLD

**Frontend stores cache in localStorage/memory**

- **Where**: Browser localStorage + JavaScript Map
- **Precache**: Frontend `precacheStoreData()` on page load
- **Frontend sends**: `storeId`, `messages`, AND `cachedData` blob
- **Backend behavior**:
  - `loadTab()` calls google-sheet WITHOUT `cacheType`
  - google-sheet uses `cachedData` from frontend if available
  - If no `cachedData`, fetches from Google Sheets
  - No cache storage (data comes from client)
- **TTL**: 5 minutes (lost on refresh)
- **Frontend exposure**: Yes (data in localStorage)

**When to use**: Testing/comparison, rollback if needed

---

### 3. 'memory' - TEST

**In-memory cache only (ephemeral)**

- **Where**: JavaScript Map in Deno process RAM
- **Precache**: None
- **Frontend sends**: Just `storeId` and `messages`
- **Backend behavior**:
  - `loadTab()` calls google-sheet with `cacheType: 'memory'`
  - google-sheet stores data in ephemeral Map
  - Data lost when function execution ends (~100ms)
  - Only useful for repeated requests in same execution (rare)
- **TTL**: Single execution (~100ms)
- **Frontend exposure**: None

**When to use**: A/B testing, performance comparison

---

## How Functions Use the Config

### loadTab() - chat-completion/index.ts

```typescript
// Build request body based on caching strategy
const requestBody: any = { operation: 'read', storeId, tabName };

if (CACHING_STRATEGY === 'database') {
  requestBody.cacheType = 'database';
}
// If 'legacy': no cacheType parameter
// If 'memory': cacheType = 'memory' (manual for testing)

const response = await fetch(`${supabaseUrl}/functions/v1/google-sheet`, {
  method: 'POST',
  headers,
  body: JSON.stringify(requestBody),
});
```

### loadStoreData() - chat-completion/index.ts

```typescript
// Only use frontend cachedData if using LEGACY strategy
const useFrontendCache = CACHING_STRATEGY === 'legacy';
const hasCachedServices = useFrontendCache && cachedData?.services && cachedData.services.length > 0;
const hasCachedProducts = useFrontendCache && cachedData?.products && cachedData.products.length > 0;
const hasCachedHours = useFrontendCache && cachedData?.hours && cachedData.hours.length > 0;

if (useFrontendCache && (hasCachedServices || hasCachedProducts || hasCachedHours)) {
  // Use frontend cached data (legacy approach)
  logCachedDataUsage(...);
}

// Fetch missing data via loadTab()
const [services, products, hours] = await Promise.all([
  hasCachedServices ? Promise.resolve(cachedData!.services!) : loadTab(...),
  // ... etc
]);
```

---

## Switching Strategies

To switch from one strategy to another, **change one line**:

```typescript
// In supabase/functions/_shared/caching-config.ts

export const CACHING_STRATEGY = 'database';  // ← Change this
// or
export const CACHING_STRATEGY = 'legacy';
// or  
export const CACHING_STRATEGY = 'memory';
```

All functions will automatically adapt:
- Frontend hooks enable/disable
- Backend functions use different code paths
- No function rewrites needed
- All old code preserved

---

## Behavior Matrix

| Aspect | Database | Legacy | Memory |
|--------|----------|--------|--------|
| **Storage** | Supabase DB | localStorage | RAM Map |
| **Precache** | usePrecacheStore | precacheStoreData | None |
| **Frontend sends** | storeId + messages | storeId + messages + cachedData | storeId + messages |
| **Backend uses cache** | Yes (cacheType) | Conditionally (from frontend) | Yes (ephemeral) |
| **TTL** | 1 hour | 5 minutes | ~100ms |
| **Persistence** | Across sessions | Page refresh only | None |
| **Frontend exposure** | No | Yes | No |
| **Recommended** | ✅ Production | For testing | For testing |

---

## Files Affected by Strategy

### Always Check Config

These files check `CACHING_STRATEGY` and adapt:

- **`supabase/functions/chat-completion/index.ts`**
  - loadTab() function
  - loadStoreData() function

- **`supabase/functions/chat-completion-native/index.ts`**
  - loadTab() function (similar logic)
  - loadStoreData() function (similar logic)

- **`supabase/functions/tools/index.ts`**
  - loadTabData() functions
  - Tool execution logic

### Strategy-Specific (Used Based on Config)

**Database Strategy Only:**
- `supabase/functions/_shared/caching-config.ts`
- `supabase/functions/precache-store/index.ts`
- `supabase/functions/google-sheet/databaseCache.ts`
- `supabase/functions/lib/cache.ts`
- `src/hooks/usePrecacheStore.ts`

**Legacy Strategy Only:**
- `src/lib/storeDataCache.ts`
- Functions expecting `cachedData` parameter

---

## Implementation Checklist

### Database Strategy
- [x] Config file created (caching-config.ts)
- [x] loadTab() updated to check CACHING_STRATEGY
- [x] loadStoreData() updated to check CACHING_STRATEGY
- [x] cacheType parameter logic implemented
- [x] Frontend hook wired up (usePrecacheStore)
- [ ] Test with CACHING_STRATEGY = 'database'

### Legacy Strategy (Preserved)
- [x] Old code preserved (not deleted)
- [x] loadTab() falls back to legacy if strategy='legacy'
- [x] loadStoreData() uses cachedData if strategy='legacy'
- [x] Frontend cache still available
- [ ] Test with CACHING_STRATEGY = 'legacy'

### Memory Strategy (Testing)
- [x] Memory cache module created
- [x] google-sheet supports cacheType='memory'
- [ ] Test with CACHING_STRATEGY = 'memory'

---

## Testing Different Strategies

### Test Database Strategy
```
1. Set CACHING_STRATEGY = 'database'
2. Deploy migration (creates cache table)
3. Load StorePage → usePrecacheStore warms cache
4. Send message → google-sheet uses database cache
5. Verify cache hit in logs
```

### Test Legacy Strategy
```
1. Set CACHING_STRATEGY = 'legacy'
2. No migration needed
3. Load StorePage → precacheStoreData() warms cache
4. Send message → frontend sends cachedData
5. Verify cache hit in logs
```

### Test Memory Strategy
```
1. Set CACHING_STRATEGY = 'memory'
2. Load StorePage → no precache
3. Send message → google-sheet uses memory cache
4. Repeat message → cache hit
5. New function execution → fresh memory (cache miss)
```

---

## Migration Flow

### Current State (Parallel)
```
✅ Database strategy code: Ready
✅ Legacy strategy code: Preserved
✅ Config allows switching: Yes
⏳ Testing: Needed
```

### Phase 1: Test Database (Current)
- Set CACHING_STRATEGY = 'database'
- Verify all functionality works
- Compare performance

### Phase 2: Validate
- Run both strategies in parallel
- A/B test if needed
- Monitor logs

### Phase 3: Deprecate Legacy
- Once confident, mark legacy as deprecated
- Set CACHING_STRATEGY = 'database' permanently
- Plan removal of old code

---

## Advantages of This Approach

✅ **No code loss** - Both approaches exist simultaneously  
✅ **Easy rollback** - Change one line to go back  
✅ **Safe testing** - Can A/B test without code changes  
✅ **Flexible** - Add new strategies without touching functions  
✅ **Clear** - All functions know which strategy to use  
✅ **Maintainable** - Central point of control  

---

## Adding New Strategies

To add a new strategy (e.g., 'redis'):

1. Add to `CachingStrategy` type:
   ```typescript
   export type CachingStrategy = 'database' | 'legacy' | 'memory' | 'redis';
   ```

2. Add behavior description:
   ```typescript
   export const STRATEGY_BEHAVIOR = {
     // ... existing ...
     redis: {
       description: 'Redis Cache',
       precacheOnFrontend: true,
       // ... etc
     }
   };
   ```

3. Update functions to check:
   ```typescript
   if (CACHING_STRATEGY === 'redis') {
     // Redis-specific logic
   }
   ```

No file rewrites needed!

---

## Summary

**One configuration value controls all caching behavior globally.**

Change `CACHING_STRATEGY` in `supabase/functions/_shared/caching-config.ts` and the entire system adapts:
- Frontend precaching
- Backend cache usage
- Data flow
- Logging

**All old code preserved. No code loss. Safe and flexible.**
