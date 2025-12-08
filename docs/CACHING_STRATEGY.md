# Caching Strategy: Migration from Frontend to Backend Cache

## Overview

This document describes the caching system migration from frontend-based (localStorage/memory) to backend-based (Supabase database) cache.

---

## OLD APPROACH (Deprecated - In Transition)

### Location
- **File**: `src/lib/storeDataCache.ts`
- **Usage**: `src/pages/StorePage.tsx`, `src/pages/DebugChat.tsx`

### How It Works
```
User loads StorePage → precacheStoreData() fires
  ↓
Fetches services/products/hours via google-sheet function
  ↓
Stores in frontend (memory Map + localStorage)
  ↓
User sends message → chat-completion receives cachedData parameter
  ↓
chat-completion uses frontend data, avoids google-sheet fetch
```

### Tier 1: Memory Cache
- **Where**: JavaScript Map in browser RAM
- **Lifespan**: Page refresh (dies when function execution ends)
- **Speed**: <1ms
- **Problem**: Lost on page refresh

### Tier 2: localStorage
- **Where**: Browser localStorage
- **Lifespan**: Until manually cleared (~5 min TTL)
- **Speed**: ~10-20ms
- **Problem**: Exposed to users, takes up browser storage

### Issues
1. **Data exposed to client** - Users can see cached data in localStorage
2. **Redundant storage** - Same data cached in frontend AND backend
3. **Latency** - Frontend sends data blob back to backend with each request
4. **Maintenance** - Separate cache invalidation logic needed
5. **Inconsistency** - Frontend cache may be stale while backend doesn't know

---

## NEW APPROACH (Current - Database Cache)

### Location
- **Precache Hook**: `src/hooks/usePrecacheStore.ts`
- **Precache Function**: `supabase/functions/precache-store/index.ts`
- **Cache Helpers**: `supabase/functions/lib/cache.ts`
- **Cache Storage**: `cache` table in Supabase (via migration)
- **Usage Pages**: `src/pages/StorePage.tsx`, `src/pages/DebugChat.tsx`

### How It Works
```
User loads StorePage
  ↓
usePrecacheStore(storeId) hook fires
  ↓
Calls precache-store function with action: 'precache'
  ↓
precache-store fetches services/products/hours via google-sheet
  ↓
google-sheet checks DATABASE cache first
  ↓
If MISS: Fetches from Google Sheets, saves to database cache
  ↓
If HIT: Returns cached data instantly
  ↓
User sends message → chat-completion → google-sheet
  ↓
google-sheet CACHE HIT (already warmed)
  ↓
Instant response, no Sheets API call needed
```

### Storage
- **Where**: Supabase PostgreSQL `cache` table
- **Schema**:
  ```sql
  CREATE TABLE cache (
    key TEXT PRIMARY KEY,
    data JSONB,
    expiresAt TIMESTAMP,
    cachedAt TIMESTAMP
  );
  ```
- **Key Format**: `store:{storeId}:{dataType}` (e.g., `store:store-123:services`)

### Lifespan
- **TTL**: 1 hour (3600 seconds)
- **Persistence**: Survives page refresh
- **Expiry**: Automatic via `expiresAt` column query

### Speed
- **Database query**: ~10-20ms (same infrastructure)
- **Cache hit**: <30ms total latency (query + return)
- **Improvement**: First message same speed, subsequent messages instant

---

## Architecture Comparison

### Data Flow: OLD APPROACH
```
┌─────────────┐
│   Browser   │ ← Frontend stores cache
│  (Frontend) │   (localStorage/memory)
└──────┬──────┘
       │
       ├─ page load: calls precacheStoreData()
       │
       └─ user message: 
          │ → includes cachedData in request body
          └─ → chat-completion uses it (or ignores)
               └─ → google-sheet may fetch (if not in cachedData)
                    └─ → stores in ephemeral memory cache (dies)
```

### Data Flow: NEW APPROACH
```
┌──────────────────┐
│  Supabase DB     │ ← Backend stores cache
│ (cache table)    │   (persistent across requests)
└────────┬─────────┘
         │
         ├─ page load: usePrecacheStore(storeId) calls precache-store
         │              └─ → precache-store calls google-sheet 3x in parallel
         │                   └─ → google-sheet checks cache table
         │                        └─ HIT: returns, MISS: fetches + saves
         │
         └─ user message:
            │ → chat-completion → google-sheet
            └─ → google-sheet checks cache table
                 └─ CACHE HIT (warmed on page load)
                    └─ instant response
```

---

## Integration Points

### StorePage.tsx
- **Import**: `usePrecacheStore` from `@/hooks/usePrecacheStore`
- **Usage**: `usePrecacheStore(storeId)` called at component level
- **Trigger**: Fires on component mount and whenever `storeId` changes
- **Result**: No visual feedback, cache warmed in background

### DebugChat.tsx
- **Import**: `usePrecacheStore` from `@/hooks/usePrecacheStore`
- **Usage**: `usePrecacheStore(selectedStoreId)` called at component level
- **Trigger**: Fires on component mount and whenever `selectedStoreId` changes
- **Result**: No visual feedback, cache warmed in background

### google-sheet Function
- **Parameter**: `cacheType` (default: `'database'`, optional: `'memory'`)
- **Behavior**: 
  - Checks cache based on `cacheType` parameter
  - Memory cache: Uses ephemeral Map (test legacy behavior)
  - Database cache: Queries Supabase cache table
- **Fallback**: If cache miss, fetches from Google Sheets

### precache-store Function
- **Actions**: 
  - `precache`: Warm the cache
  - `clear`: Delete cache for a store
  - `stats`: Get cache statistics
- **Response**: Returns precache timing and row counts

---

## Migration Checklist

- [ ] **Backend**:
  - [x] Create cache table (migration)
  - [x] Create cache helper functions (lib/cache.ts)
  - [x] Create memory cache module (memoryCache.ts)
  - [x] Create database cache module (databaseCache.ts)
  - [x] Update google-sheet to support both cache types
  - [x] Create precache-store function
  - [ ] Remove memory cache Map from google-sheet (when ready)

- [ ] **Frontend**:
  - [x] Create usePrecacheStore hook
  - [x] Add hook to StorePage.tsx
  - [x] Add hook to DebugChat.tsx
  - [ ] Remove precacheStoreData() calls
  - [ ] Remove getCachedStoreData() calls
  - [ ] Remove cachedData parameter from chat requests
  - [ ] Remove storeDataCache.ts imports
  - [ ] Delete storeDataCache.ts (when ready)

---

## Testing

### Test Precaching
```bash
curl -X POST https://xxx.supabase.co/functions/v1/precache-store \
  -H "Authorization: Bearer xxx" \
  -H "Content-Type: application/json" \
  -d '{
    "storeId": "store-123",
    "action": "precache"
  }'
```

**Response**:
```json
{
  "success": true,
  "data": {
    "services": [...],
    "products": [...],
    "hours": [...],
    "duration": "245ms"
  }
}
```

### Test Cache Hit
```bash
# First request (cache miss, ~500ms)
curl -X POST https://xxx.supabase.co/functions/v1/google-sheet \
  -H "Authorization: Bearer xxx" \
  -d '{"operation": "read", "storeId": "store-123", "tabName": "Services", "cacheType": "database"}'

# Second request (cache hit, ~20ms)
curl -X POST https://xxx.supabase.co/functions/v1/google-sheet \
  -H "Authorization: Bearer xxx" \
  -d '{"operation": "read", "storeId": "store-123", "tabName": "Services", "cacheType": "database"}'
```

### Check Cache Stats
```bash
curl -X POST https://xxx.supabase.co/functions/v1/precache-store \
  -H "Authorization: Bearer xxx" \
  -H "Content-Type: application/json" \
  -d '{
    "storeId": "store-123",
    "action": "stats"
  }'
```

**Response**:
```json
{
  "success": true,
  "stats": {
    "services": {"cached": true, "age": 45, "expiresAt": "2025-01-09T..."},
    "products": {"cached": true, "age": 45, "expiresAt": "2025-01-09T..."},
    "hours": {"cached": true, "age": 45, "expiresAt": "2025-01-09T..."}
  },
  "cacheEntries": 3
}
```

---

## Performance Impact

### Before (Frontend Cache)
- **First message**: ~700ms (precache + fetch + response)
- **Second message**: ~400ms (precache served from localStorage)
- **After refresh**: ~700ms (localStorage expires/missing)

### After (Database Cache)
- **Page load**: ~250ms (precache-store warms cache, non-blocking)
- **First message**: ~50ms (cache hit)
- **Second message**: ~50ms (cache hit)
- **After refresh**: ~50ms (cache still in database, TTL valid)

---

## Fallback & Rollback

If database cache fails:
1. google-sheet function falls back to Google Sheets API automatically
2. No data loss, just slower response
3. Can toggle `cacheType: 'memory'` to test old behavior
4. Old storeDataCache.ts still available (not deleted yet)

---

## Future Improvements

1. **Cache Invalidation**: Add webhook to clear cache when sheet changes
2. **Multi-Store Cache**: Optimize queries for stores with many cache entries
3. **Cache Analytics**: Track hit rates, most frequently accessed data
4. **Conditional Precaching**: Only precache if sheet was updated since last cache
5. **Compression**: Compress large datasets in cache table (JSONB can be large)

---

## Questions & Support

- **Why backend cache instead of Redis?** Supabase PostgreSQL is already in infrastructure, no additional service/cost
- **Why 1 hour TTL?** Session-based expiry; longer than typical session, short enough to catch sheet updates
- **Why precache on page load?** Ensures data is ready before user sends first message, maximizing cache hits
- **Can I use memory cache?** Yes, pass `cacheType: 'memory'` to google-sheet for testing legacy behavior
