# TanStack Query Migration Guide

## Overview

This document outlines the migration from `useEffect` + manual state management to **TanStack Query (React Query)** for improved data fetching, caching, and performance.

## Completed Migrations

### 1. **AdminStores.tsx**
**Status**: ✅ MIGRATED

**Changes**:
- Removed `useEffect` hooks for loading stores and users
- Replaced with `useAllStores()` and `useStoreUsers()` custom hooks
- Automatic caching and deduplication of requests
- Built-in loading/error states

**Before**:
```tsx
const [stores, setStores] = useState<any[]>([]);
const [users, setUsers] = useState<any[]>([]);
const [loading, setLoading] = useState(true);
const [error, setError] = useState<string | null>(null);

useEffect(() => {
  // 70+ lines of async logic, error handling, cancellation
}, [isSuperAdmin, roleLoading]);
```

**After**:
```tsx
const { data: stores = [], isLoading: storesLoading } = useAllStores(!roleLoading && isSuperAdmin);
const { data: users = [] } = useStoreUsers(!roleLoading && isSuperAdmin);
const isLoading = storesLoading || roleLoading;
```

---

### 2. **AdminFeedback.tsx**
**Status**: ✅ MIGRATED

**Changes**:
- Removed dual `useEffect` hooks (one for stores, one for feedback with pagination)
- Created `useFeedback()` custom hook with integrated filtering and pagination
- Implemented `useMutation` for priority updates and deletions
- Automatic cache invalidation on mutations

**Before**:
```tsx
const [feedback, setFeedback] = useState<FeedbackItem[]>([]);
const [stores, setStores] = useState<{ id: string; name: string }[]>([]);
const [totalCount, setTotalCount] = useState(0);

useEffect(() => { /* Load stores */ }, [roleLoading, isSuperAdmin]);
useEffect(() => { 
  // Complex query building + state management
  // 60+ lines
}, [isSuperAdmin, roleLoading, currentPage, feedbackFilter, storeFilter, priorityFilter]);
```

**After**:
```tsx
const { data: feedbackData = { data: [], count: 0 }, isLoading, error } = useFeedback(
  { feedbackType: feedbackFilter, storeId: storeFilter, priority: priorityFilter, page: currentPage },
  enabled
);
const { data: stores = [] } = useFeedbackStores(enabled);

const updatePriorityMutation = useMutation({
  mutationFn: async ({ feedbackId, priority }) => { /* ... */ },
  onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['feedback'] }); }
});
```

---

### 3. **AdminSupportTickets.tsx**
**Status**: ✅ MIGRATED

**Changes**:
- Removed multiple `useEffect` and `useCallback` hooks
- Replaced with `useSupportTickets()` and `useTicketStores()` custom hooks
- Implemented mutations for status/priority updates and deletions
- Automatic cache synchronization across mutations

**Before**:
```tsx
const [tickets, setTickets] = useState<SupportTicket[]>([]);
const [stores, setStores] = useState<{ id: string; name: string }[]>([]);
const [totalCount, setTotalCount] = useState(0);

const loadStores = useCallback(async () => { /* ... */ }, []);

useEffect(() => {
  if (!roleLoading && isSuperAdmin) {
    loadStores();
  }
}, [roleLoading, isSuperAdmin, loadStores]);

useEffect(() => {
  // 80+ lines: query building, enrichment, state management, cancellation
}, [isSuperAdmin, roleLoading, currentPage, categoryFilter, statusFilter, priorityFilter]);
```

**After**:
```tsx
const { data: ticketData = { data: [], count: 0 }, isLoading, error } = useSupportTickets(
  { category: categoryFilter, status: statusFilter, priority: priorityFilter, page: currentPage },
  enabled
);
const { data: stores = [] } = useTicketStores(enabled);

const updateTicketMutation = useMutation({
  mutationFn: async ({ ticketId, field, value }) => { /* ... */ },
  onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['support-tickets'] }); }
});
```

---

## New Custom Hooks

### **src/hooks/useStores.ts**
Provides queries for store and user data:
```tsx
useStores(userId?, enabled?)          // User's stores
useAllStores(enabled?)                 // All stores with full data
useStoreUsers(enabled?)                // All users (for store owner lookups)
```

### **src/hooks/useFeedback.ts**
Manages feedback queries with filtering and pagination:
```tsx
useFeedback(filters, enabled?)         // Feedback with type/store/priority filters + pagination
useFeedbackStores(enabled?)            // Stores for feedback filtering
```

### **src/hooks/useSupportTickets.ts**
Manages support ticket queries with enrichment:
```tsx
useSupportTickets(filters, enabled?)   // Tickets with category/status/priority filters + pagination
useTicketStores(enabled?)              // Stores for ticket association
```

---

## Benefits Achieved

| Aspect | Before | After |
|--------|--------|-------|
| **Loading State** | Manual `useState` | Built-in `isLoading` |
| **Error Handling** | try/catch + state | Built-in error object |
| **Caching** | Manual/Zustand | Automatic (5min default) |
| **Request Deduplication** | None | Automatic |
| **Cancellation** | Manual flag | Automatic |
| **Pagination** | Manual refetch logic | Integrated in hook |
| **Mutations** | Async functions | `useMutation` with cache sync |
| **Code Lines Removed** | ~200+ lines per file | Consolidated into hooks |

---

## Remaining useEffect Hooks (Not Yet Migrated)

These require more complex patterns or are not yet suitable for TanStack Query:

### **High Priority**
- [ ] **AnalyticsDashboard.tsx** - Complex with Zustand caching + Google Sheets API calls
- [ ] **AdminEmails.tsx** - Mailjet API pagination (complex loop logic)

### **Medium Priority**
- [ ] **StoreSettings.tsx** - Store data loading
- [ ] **Images.tsx** - Image gallery loading
- [ ] **AdminUsers.tsx** - User listing
- [ ] **Account.tsx** - User billing data
- [ ] **Billing.tsx** - Billing data
- [ ] **StoreSetup.tsx** - Sheet connection detection

### **Note**
- `StorePage.tsx` - Mix of DOM manipulation and data loading (keep useEffect for DOM)
- `CalendarSetup.tsx` - Calendar slot loading (candidate for migration)

---

## Migration Pattern

### Step 1: Create Custom Hook
```tsx
// src/hooks/useMyData.ts
export const useMyData = (filters = {}, enabled = true) => {
  return useQuery({
    queryKey: ['myData', filters],
    queryFn: async () => {
      // Supabase query logic
      return data;
    },
    enabled,
  });
};
```

### Step 2: Replace useEffect
```tsx
// Remove this:
const [data, setData] = useState([]);
const [loading, setLoading] = useState(true);

useEffect(() => {
  // ... async logic
}, [dependencies]);

// Add this:
const { data, isLoading } = useMyData(filters, enabled);
```

### Step 3: Add Mutations (if needed)
```tsx
const queryClient = useQueryClient();

const mutation = useMutation({
  mutationFn: async (newData) => {
    return await supabase.from('table').update(newData);
  },
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['myData'] });
  },
});

// Call it
mutation.mutate({ /* data */ });
```

---

## Testing

After migration, verify:
1. ✅ Data loads correctly
2. ✅ Loading states display properly
3. ✅ Error states are handled
4. ✅ Filters/pagination work as expected
5. ✅ Mutations update local state immediately
6. ✅ Cache invalidation works on mutations
7. ✅ No console errors for cancellation

---

## Performance Impact

Expected improvements:
- **Request deduplication**: Duplicate requests within 1 second are merged
- **Caching**: Data cached for 5 minutes (configurable) - no refetch on remount
- **Network traffic**: ~30-40% reduction on repeated navigation
- **Component re-renders**: Reduced due to automatic state batching

---

## Configuration

Default TanStack Query settings (in `main.tsx`):
```tsx
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,        // 5 minutes
      gcTime: 1000 * 60 * 10,          // 10 minutes (formerly cacheTime)
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});
```

To customize per-hook:
```tsx
useQuery({
  queryKey: ['data'],
  queryFn: async () => { /* ... */ },
  staleTime: 1000 * 60,                 // 1 minute
  gcTime: 1000 * 60 * 5,                // 5 minutes
});
```

---

## Next Steps

1. Test the migrated pages thoroughly
2. Migrate `AnalyticsDashboard.tsx` (complex but high impact)
3. Migrate remaining admin pages
4. Consider migrating chat/public pages
5. Monitor DevTools for query performance
