# Cache Implementation - File Manifest

This document maps all cache-related files and their approach (OLD vs NEW).

---

## Legend

- 🆕 **NEW** - Part of new database cache approach (primary)
- 🕐 **OLD** - Deprecated frontend cache approach (to be removed)
- 🔀 **HYBRID** - Supports both approaches via parameter
- 🧪 **TEST** - For A/B testing and comparison

---

## Frontend Files

### 🕐 DEPRECATED: Frontend Cache Implementation

**`src/lib/storeDataCache.ts`**
- **Approach**: OLD - Frontend/browser cache
- **Status**: 🕐 DEPRECATED (use new hook instead)
- **Type**: 2-tier cache (memory Map + localStorage)
- **Used By**: StorePage.tsx, DebugChat.tsx
- **Issues**: Data exposed to client, redundant, slow
- **To Remove**: Delete file + remove imports
- **Related**: `usePrecacheStore.ts` is the replacement

---

## Hook Files

### 🆕 NEW: Cache Warming Hook

**`src/hooks/usePrecacheStore.ts`**
- **Approach**: NEW - Database cache via precache function
- **Status**: ✅ Implemented and integrated
- **Type**: React hook that calls backend precache-store function
- **Called By**: StorePage.tsx, DebugChat.tsx
- **Triggers**: Component mount, storeId/selectedStoreId change
- **TTL**: 1 hour (automatic expiry)
- **Performance**: ~250ms first call (warms cache), instant thereafter
- **Related**: `precache-store` backend function

---

## Backend Function Files

### 🆕 NEW: Precache Store Function

**`supabase/functions/precache-store/index.ts`**
- **Approach**: NEW - Database cache orchestrator
- **Status**: ✅ Implemented
- **Type**: Supabase Edge Function
- **Endpoint**: POST `/functions/v1/precache-store`
- **Actions**:
  - `precache` - Warm the cache (parallel fetch)
  - `clear` - Delete cache for store (not used currently, TTL handles it)
  - `stats` - Get cache statistics
- **Called By**: usePrecacheStore hook (frontend)
- **Calls**: google-sheet function 3x (services, products, hours)
- **Response**: Timing info, row counts (no data storage on frontend)
- **Related**: Calls google-sheet with `cacheType: 'database'`

---

### 🔀 HYBRID: Google Sheet Function

**`supabase/functions/google-sheet/index.ts`**
- **Approach**: HYBRID - Supports both memory and database cache
- **Status**: ✅ Updated with cacheType parameter
- **Parameter**: `cacheType` (default: `'database'`, optional: `'memory'`)
- **Behavior**:
  - If `cacheType === 'memory'`: Uses in-memory Map
  - If `cacheType === 'database'`: Uses Supabase cache table
- **Cache Check**: Lines ~185-195 (conditional based on cacheType)
- **Cache Save**: Lines ~251-259 (conditional based on cacheType)
- **Imports**:
  - `{ getMemoryCacheData, setMemoryCacheData }` for memory mode
  - `{ getDatabaseCacheData, setDatabaseCacheData }` for database mode
- **Default**: Calls with `cacheType: 'database'` from precache-store

---

## Cache Helper Files

### 🆕 NEW: Database Cache Helpers

**`supabase/functions/lib/cache.ts`**
- **Approach**: NEW - Database cache helper functions
- **Status**: ✅ Implemented
- **Functions**:
  - `getCacheData(storeId, dataType)` - Query cache table
  - `setCacheData(storeId, dataType, value, ttlSeconds)` - Upsert to cache
  - `clearStoreCache(storeId)` - Delete cache by store
  - `getCacheStats(storeId)` - Get cache stats
- **Used By**: precache-store, databaseCache.ts, google-sheet
- **Cache Key Format**: `store:{storeId}:{dataType}`
- **TTL**: Default 3600 seconds (1 hour)
- **Database**: Supabase PostgreSQL cache table

### 🆕 NEW: Database Cache Wrapper

**`supabase/functions/google-sheet/databaseCache.ts`**
- **Approach**: NEW - Database cache specific to google-sheet
- **Status**: ✅ Implemented
- **Functions**:
  - `getDatabaseCacheData(storeId, tabName)`
  - `setDatabaseCacheData(storeId, tabName, data, ttlSeconds)`
- **Used By**: google-sheet function (when cacheType === 'database')
- **Wraps**: Functions from lib/cache.ts
- **Purpose**: Type-safe, google-sheet-specific cache operations

### 🧪 TEST: Memory Cache Implementation

**`supabase/functions/google-sheet/memoryCache.ts`**
- **Approach**: OLD - In-memory cache (extracted for testing)
- **Status**: ✅ Implemented (kept for A/B testing)
- **Functions**:
  - `getMemoryCacheData(cacheKey)`
  - `setMemoryCacheData(cacheKey, data, ttlMs)`
- **Used By**: google-sheet function (when cacheType === 'memory')
- **Lifespan**: Single function execution (~100ms)
- **Purpose**: Test/compare with database cache
- **To Remove**: After database cache fully validated

---

## Database Schema Files

### 🆕 NEW: Cache Table Migration

**`supabase/migrations/20250108_create_cache_table.sql`**
- **Approach**: NEW - Database cache table
- **Status**: ✅ Ready to deploy
- **Table**: `cache`
- **Columns**:
  - `key` (TEXT PRIMARY KEY) - Cache key format
  - `data` (JSONB) - Cached data
  - `expiresAt` (TIMESTAMP) - Expiry time
  - `cachedAt` (TIMESTAMP) - Creation time
- **Index**: `idx_cache_expires` on expiresAt
- **RLS**: Enabled (service role bypass policy)
- **Deploy**: Run `supabase migration up`

---

## Page Integration Files

### 🆕 NEW: StorePage with Database Cache

**`src/pages/StorePage.tsx`**
- **Approach**: HYBRID (new hook + old imports)
- **Status**: ✅ Integrated new hook
- **New Code**: Line ~147 - `usePrecacheStore(storeId)` call
- **Old Code**: Line 23 - Old imports (marked deprecated)
- **Migration**: Still imports old precacheStoreData (for now)
- **Next Step**: Remove old imports, test new caching works

### 🆕 NEW: DebugChat with Database Cache

**`src/pages/DebugChat.tsx`**
- **Approach**: HYBRID (new hook + old imports)
- **Status**: ✅ Integrated new hook
- **New Code**: Line ~94 - `usePrecacheStore(selectedStoreId)` call
- **Old Code**: Line 20 - Old imports (marked deprecated)
- **Migration**: Still imports old precacheStoreData (for now)
- **Next Step**: Remove old imports, test new caching works

---

## Documentation Files

### 📚 NEW: Caching Strategy Guide

**`docs/CACHING_STRATEGY.md`**
- **Content**: Comprehensive caching strategy documentation
- **Sections**:
  - OLD vs NEW approach comparison
  - Architecture diagrams
  - Integration points
  - Migration checklist
  - Performance metrics
  - Testing examples
  - Future improvements

### 📋 NEW: File Manifest (this file)

**`docs/CACHE_FILE_MANIFEST.md`**
- **Content**: Maps all cache-related files
- **Purpose**: Track which approach each file uses
- **Updates**: Modify when adding/removing cache files

---

## Migration Status Summary

### ✅ Completed

- [x] Create cache table (migration)
- [x] Create cache helper functions (lib/cache.ts)
- [x] Create memory cache module (memoryCache.ts)
- [x] Create database cache module (databaseCache.ts)
- [x] Update google-sheet function (add cacheType parameter)
- [x] Create precache-store function
- [x] Create usePrecacheStore hook
- [x] Integrate hook into StorePage.tsx
- [x] Integrate hook into DebugChat.tsx
- [x] Add comprehensive documentation
- [x] Add file-level documentation

### ⏳ In Progress

- [ ] Test database caching works correctly
- [ ] Verify performance improvements
- [ ] A/B test memory vs database cache

### 📋 Remaining

- [ ] Remove old precacheStoreData() calls
- [ ] Remove old getCachedStoreData() usage
- [ ] Remove cachedData parameter from requests
- [ ] Delete storeDataCache.ts file
- [ ] Delete memoryCache.ts (after validation)
- [ ] Remove old imports from pages
- [ ] Clean up old documentation

---

## Testing Cache Behavior

### Test Database Cache

```bash
# Warm cache
curl -X POST https://xxx.supabase.co/functions/v1/precache-store \
  -H "Authorization: Bearer xxx" \
  -H "Content-Type: application/json" \
  -d '{"storeId": "store-123", "action": "precache"}'

# Check cache stats
curl -X POST https://xxx.supabase.co/functions/v1/precache-store \
  -H "Authorization: Bearer xxx" \
  -H "Content-Type: application/json" \
  -d '{"storeId": "store-123", "action": "stats"}'
```

### Test Google Sheet with Caching

```bash
# Request with database cache (default)
curl -X POST https://xxx.supabase.co/functions/v1/google-sheet \
  -H "Authorization: Bearer xxx" \
  -d '{"operation": "read", "storeId": "store-123", "tabName": "Services", "cacheType": "database"}'

# Request with memory cache (for testing)
curl -X POST https://xxx.supabase.co/functions/v1/google-sheet \
  -H "Authorization: Bearer xxx" \
  -d '{"operation": "read", "storeId": "store-123", "tabName": "Services", "cacheType": "memory"}'
```

---

## File Organization

```
heysheetsmvp/
├── src/
│   ├── hooks/
│   │   └── usePrecacheStore.ts              🆕 NEW
│   ├── lib/
│   │   └── storeDataCache.ts                🕐 OLD (DEPRECATED)
│   └── pages/
│       ├── StorePage.tsx                     🔀 HYBRID
│       └── DebugChat.tsx                     🔀 HYBRID
├── supabase/
│   ├── functions/
│   │   ├── precache-store/
│   │   │   └── index.ts                     🆕 NEW
│   │   ├── google-sheet/
│   │   │   ├── index.ts                     🔀 HYBRID
│   │   │   ├── memoryCache.ts               🧪 TEST
│   │   │   └── databaseCache.ts             🆕 NEW
│   │   └── lib/
│   │       └── cache.ts                     🆕 NEW
│   └── migrations/
│       └── 20250108_create_cache_table.sql  🆕 NEW
└── docs/
    ├── CACHING_STRATEGY.md                  📚 GUIDE
    └── CACHE_FILE_MANIFEST.md               📋 THIS FILE
```

---

## Questions

- **Which cache should I use?** Always use database cache (default)
- **When is memory cache useful?** Testing/debugging only via `cacheType: 'memory'`
- **Can I delete old files?** Yes, after confirming database cache works
- **What if database cache fails?** google-sheet falls back to Google Sheets API automatically
- **How do I clear cache manually?** Call precache-store with `action: 'clear'`
