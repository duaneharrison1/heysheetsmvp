# HeySheets MVP - Performance Investigation Report

> Generated: 2025-12-01

## Section 1: Project Identification

1. **Project/Repository Name:** HeySheets MVP (`heysheetsmvp`)
2. **Main Tech Stack:**
   - **Frontend:** React 18 + Vite + TypeScript
   - **UI Components:** Radix UI + Shadcn/ui + Tailwind CSS
   - **State Management:** Zustand
   - **Backend:** Supabase (PostgreSQL + Edge Functions)
   - **LLM Gateway:** OpenRouter
   - **Data Storage:** Google Sheets API + Supabase
3. **Architecture:** Single app with Supabase Edge Functions as backend

---

## Section 2: Data Storage & Fetching

**Where is business data stored?**
- [x] Google Sheets API (primary data source for services, products, hours)
- [x] Supabase/PostgreSQL database (store config, user accounts, calendar settings)

**Data Types Fetched:**
- Services, Products, Hours (from Google Sheets)
- Store configuration, calendar mappings (from Supabase)

**Data Fetching Pattern:** **PARALLEL (Fast)**

```typescript
// supabase/functions/chat-completion/index.ts:165-170
// Load data in parallel using SERVICE_ROLE_KEY for authentication
const [services, products, hours] = await Promise.all([
  servicesTab ? loadTab(servicesTab, storeId, serviceRoleKey, requestId) : Promise.resolve([]),
  productsTab ? loadTab(productsTab, storeId, serviceRoleKey, requestId) : Promise.resolve([]),
  hoursTab ? loadTab(hoursTab, storeId, serviceRoleKey, requestId) : Promise.resolve([])
]);
```

**Verdict:** Data is fetched **on-demand** at the start of each chat-completion request, using **Promise.all** for parallel loading.

---

## Section 3: Caching Strategy

**Is there a cache?**
- [x] In-memory cache (Map object)

**Cache Implementation:** `supabase/functions/google-sheet/index.ts:42-44`

```typescript
// Simple cache
const cache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
```

**Cache Logic:** `supabase/functions/google-sheet/index.ts:182-197`
```typescript
// Check cache (skip for bookings)
if (tabName.toLowerCase() !== 'bookings') {
  const cacheKey = `${sheetId}:${tabName}`;
  const cached = cache.get(cacheKey);
  if (cached && Date.now() < cached.expiry) {
    log(requestId, '💾 Cache hit:', cacheKey);
    return new Response(JSON.stringify({
      success: true,
      data: cached.data
    }), { ... });
  }
}
```

**Cache Details:**
| Aspect | Value |
|--------|-------|
| Cache Type | In-memory Map |
| TTL | 5 minutes (300,000ms) |
| What's Cached | Services, Products, Hours tabs |
| What's NOT Cached | Bookings (always fresh) |
| Precaching | **No** - data fetched on-demand per request |
| 2-tier Cache | **No** - no localStorage cache |

---

## Section 4: LLM Integration Architecture

**Which LLM provider is used?**
- [x] OpenRouter (multi-model gateway)

**Default Model:** `x-ai/grok-4.1-fast`

**Available Models:** (from `chat-completion/index.ts:220-232`)
```typescript
const modelPricing: Record<string, { input: number; output: number }> = {
  'anthropic/claude-sonnet-4.5': { input: 3.0, output: 15.0 },
  'google/gemini-3-pro-preview': { input: 2.0, output: 12.0 },
  'anthropic/claude-haiku-4.5': { input: 1.0, output: 5.0 },
  'openai/gpt-5.1': { input: 0.30, output: 1.20 },
  'google/gemini-2.5-flash': { input: 0.30, output: 2.50 },
  'deepseek/deepseek-chat-v3.1': { input: 0.27, output: 1.10 },
  'x-ai/grok-4.1-fast': { input: 0.20, output: 0.50 },  // DEFAULT
  'openai/gpt-4o-mini': { input: 0.15, output: 0.60 },
};
```

**Main Chat Endpoint:** `supabase/functions/chat-completion/index.ts`

---

## Section 5: Classification Approach

**Approach Used:** **Custom Classifier (text-based JSON output)**

**NOT using native tool calling.** The classifier uses a text prompt with JSON response format.

```typescript
// supabase/functions/classifier/index.ts:209-226
const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
  method: 'POST',
  headers: { ... },
  body: JSON.stringify({
    model: model || 'x-ai/grok-4.1-fast',
    messages: [{ role: 'user', content: classificationPrompt }],
    response_format: { type: "json_object" },  // NOT tools/tool_choice
    temperature: 0.1,
    max_tokens: 500
  })
});
```

**Classification Output Structure:**
```typescript
{
  "intent": "SERVICE_INQUIRY" | "PRODUCT_INQUIRY" | "INFO_REQUEST" | etc.,
  "confidence": 0-100,
  "needs_clarification": boolean,
  "function_to_call": "get_services" | "get_products" | etc.,
  "extracted_params": { ... },
  "reasoning": "string"
}
```

**Quick Patterns Bypassing LLM:** None detected. All messages go through the LLM classifier.

---

## Section 6: LLM Call Count

**Fixed 2-3 LLM calls per user message:**

| Call # | Purpose | File Path | Estimated Time |
|--------|---------|-----------|----------------|
| 1 | Intent Classification + Param Extraction | `classifier/index.ts` | ~500-1500ms |
| 2 | Response Generation | `responder/index.ts` | ~500-1500ms |
| 3 (conditional) | Semantic Matching | `tools/semantic-matcher.ts` | ~300-800ms |

**Flow Logic:**
```typescript
// chat-completion/index.ts
// Step 1: Classification (ALWAYS)
const { classification, usage: classifyUsage } = await classifyIntent(messages, { storeData }, model);

// Step 2: Function execution (if function_to_call !== null)
if (classification.function_to_call && classification.function_to_call !== 'null') {
  functionResult = await executeFunction(...);
}

// Step 3: Response generation (ALWAYS, unless skipResponder)
if (functionResult?.skipResponder && functionResult?.message) {
  // Bypass LLM - use deterministic response
} else {
  // Call LLM for response generation
  const { text, suggestions, usage } = await generateResponse(...);
}
```

**skipResponder Pattern:** Some functions (like `getBookingSlots`) can bypass the responder LLM call by returning pre-built messages for deterministic responses.

---

## Section 7: Function Execution

**Available Functions:**

| Function | File Path | Data Source | Uses Cache? |
|----------|-----------|-------------|-------------|
| `get_store_info` | `tools/index.ts:64` | Google Sheets via `loadTabData` | Yes (via google-sheet) |
| `get_services` | `tools/index.ts:190` | Google Sheets + semantic matching | Yes + LLM call |
| `get_products` | `tools/index.ts:283` | Google Sheets + semantic matching | Yes + LLM call |
| `submit_lead` | `tools/index.ts:400` | Google Sheets (write) | No |
| `get_misc_data` | `tools/index.ts:578` | Google Sheets | Yes |
| `check_availability` | `calendar-booking.ts:126` | Google Calendar API | No |
| `create_booking` | `calendar-booking.ts:724` | Google Calendar API | No |
| `get_booking_slots` | `calendar-booking.ts:341` | Google Calendar API | No |

**Semantic Matcher:** Adds an additional LLM call for fuzzy matching:
```typescript
// tools/semantic-matcher.ts:93-106
const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
  body: JSON.stringify({
    model: 'anthropic/claude-3.5-haiku',  // Different, faster model
    messages: [{ role: 'user', content: prompt }],
    max_tokens: 500,
    temperature: 0.3
  })
});
```

---

## Section 8: Request Flow Timing

```
User sends message
    ↓
[0ms]     Frontend: Creates correlation ID, starts timer
    ↓
[~50ms]   Network: Request to Supabase Edge Function
    ↓
[~100ms]  Store load: Query store config from Supabase
    ↓
[~300-500ms] Data fetch: Promise.all(services, products, hours)
             ├─ Cache hit: ~10ms (if cached)
             └─ Cache miss: ~300-500ms (Google Sheets API)
    ↓
[~500-1500ms] LLM Call #1: Intent Classification
    ↓
[~100-500ms] Function Execution
             ├─ Simple data return: ~10ms
             └─ With semantic matching: +300-800ms (LLM call)
    ↓
[~500-1500ms] LLM Call #2: Response Generation
             (or ~0ms if skipResponder)
    ↓
[~50ms]   Network: Response to frontend
    ↓
[~10ms]   Frontend: Render response

TOTAL ESTIMATE: 1,500ms - 4,000ms (typical)
               3,000ms - 6,000ms (with semantic matching)
```

**Measured Timing (from debug metadata):**
- `intentDuration`: Classification time
- `functionDuration`: Function execution time
- `responseDuration`: Response generation time
- `totalDuration`: End-to-end time

---

## Section 9: Artificial Delays

**Found 1 intentional delay:**

```typescript
// src/qa/lib/test-runner.ts:649
// Small delay for natural feel
await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 1000));
```

**Purpose:** QA/testing only - adds 1-2 second delay between simulated user messages for "natural feel" in goal-based tests. **Does not affect production chat.**

**UI Animation Delays:**
```typescript
// src/pages/StorePage.tsx:144-157
// Progress to step 2 after 1.5s
const timer1 = setTimeout(() => { setCurrentTaskStep(1); }, 3000);
// Progress to step 3 after 3s
const timer2 = setTimeout(() => { setCurrentTaskStep(2); }, 6000);
```
**Purpose:** Visual feedback while waiting - shows progressive "Analyzing", "Searching", "Generating" steps. **Cosmetic only.**

---

## Section 10: Streaming

**Is streaming implemented?**
- [ ] No streaming

The LLM responses are returned as complete JSON objects. No streaming implementation found in:
- `classifier/index.ts` - awaits full response
- `responder/index.ts` - awaits full response
- `StorePage.tsx` - awaits full JSON response

```typescript
// classifier/index.ts:234
const result = await response.json();

// responder/index.ts:130
const result = await response.json();
```

---

## Section 11: Performance Optimizations Found

| Optimization | Implemented? | File Path | Notes |
|--------------|--------------|-----------|-------|
| Precaching | **No** | - | Data loaded on-demand per request |
| Parallel data loading | **Yes** | `chat-completion/index.ts:166` | Promise.all for 3 tabs |
| In-memory cache | **Yes** | `google-sheet/index.ts:42-44` | 5 min TTL, per-instance |
| localStorage cache | **No** | - | Only in-memory |
| Message history trimming | **Yes** | `classifier/index.ts:87` | Last 6 messages only |
| Quick pattern matching | **No** | - | All messages go through LLM |
| Cached data to handlers | **No** | - | Functions re-fetch via API |
| skipResponder pattern | **Yes** | `calendar-booking.ts:687` | Deterministic responses for booking calendar |

---

## Section 12: Bottlenecks Identified

| Rank | Bottleneck | Time Cost | Potential Fix |
|------|------------|-----------|---------------|
| 1 | **2 sequential LLM calls** (classify + respond) | ~1-3 seconds | Combine into single call with tool calling |
| 2 | **No precaching** - data loaded every request | ~300-500ms | Precache on store page load |
| 3 | **3rd LLM call for semantic matching** | ~300-800ms | Use vector embeddings or keyword matching |
| 4 | **No greeting/simple pattern bypass** | ~500-1500ms | Quick regex patterns for greetings |
| 5 | **Cache per Edge Function instance** | Cache misses on cold starts | Shared cache (Redis/Upstash) |
| 6 | **No streaming** | Full response wait | Stream for faster perceived response |

---

## Section 13: Key Code Snippets

### 13.1 Main Chat Completion Flow
```typescript
// supabase/functions/chat-completion/index.ts:177-335

// Step 1: Classify intent and extract parameters
const { classification, usage: classifyUsage } = await classifyIntent(messages, { storeData }, model);

// Step 2: Execute function if classified
let functionResult: FunctionResult | undefined;
if (classification.function_to_call && classification.function_to_call !== 'null') {
  functionResult = await executeFunction(
    classification.function_to_call,
    classification.extracted_params,
    context
  );
}

// Check if function wants to bypass LLM responder
if (functionResult?.skipResponder && functionResult?.message) {
  // Return deterministic response
  return new Response(JSON.stringify(response), { ... });
}

// Step 3: Generate response using LLM
const { text, suggestions, usage } = await generateResponse(
  messages, classification, functionResult, storeConfig
);
```

### 13.2 Classification Logic
```typescript
// supabase/functions/classifier/index.ts:209-226
const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    model: model || 'x-ai/grok-4.1-fast',
    messages: [{ role: 'user', content: classificationPrompt }],
    response_format: { type: "json_object" },
    temperature: 0.1,
    max_tokens: 500
  })
});
```

### 13.3 Caching Implementation
```typescript
// supabase/functions/google-sheet/index.ts:42-44
const cache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// Cache check (line 182-197)
if (tabName.toLowerCase() !== 'bookings') {
  const cacheKey = `${sheetId}:${tabName}`;
  const cached = cache.get(cacheKey);
  if (cached && Date.now() < cached.expiry) {
    return cached.data; // Cache hit!
  }
}

// Cache set (line 247-253)
cache.set(cacheKey, {
  data: result,
  expiry: Date.now() + CACHE_TTL
});
```

### 13.4 Data Fetching Pattern
```typescript
// supabase/functions/chat-completion/index.ts:165-170
// Load data in parallel using SERVICE_ROLE_KEY
const [services, products, hours] = await Promise.all([
  servicesTab ? loadTab(servicesTab, storeId, serviceRoleKey, requestId) : Promise.resolve([]),
  productsTab ? loadTab(productsTab, storeId, serviceRoleKey, requestId) : Promise.resolve([]),
  hoursTab ? loadTab(hoursTab, storeId, serviceRoleKey, requestId) : Promise.resolve([])
]);
```

---

## Section 14: Summary Table

| Aspect | This Project |
|--------|--------------|
| **Project Name** | HeySheets MVP |
| **Data Storage** | Google Sheets API + Supabase PostgreSQL |
| **Caching Type** | Memory only (per Edge Function instance) |
| **Cache TTL** | 300 seconds (5 minutes) |
| **Precaching** | No |
| **Parallel Loading** | Yes (Promise.all for 3 tabs) |
| **LLM Provider** | OpenRouter |
| **LLM Model** | x-ai/grok-4.1-fast (default) |
| **Classification** | Custom classifier (JSON response format) |
| **LLM Calls per Message** | Fixed 2 (classify + respond), Variable +1 (semantic matching) |
| **Iterative Calling** | No (max 1 function per message) |
| **Streaming** | No |
| **Artificial Delays** | No (only in QA testing) |
| **Estimated Response Time** | 1.5-4 seconds typical |
| **Main Bottleneck** | 2 sequential LLM calls |

---

## Section 15: Recommendations

### Quick wins (< 1 hour to implement):

1. **Add greeting pattern bypass** - Regex match "hi", "hello", "hey" and return canned response without LLM calls (~1.5s saved)

2. **Reduce context window** - Currently sends 6 messages; reduce to 4 for faster classification

3. **Lower classifier max_tokens** - Currently 500; reduce to 300 (classification JSON is ~200 tokens)

### Medium effort (1 day):

1. **Precache store data on page load** - Add a "warm cache" API call when StorePage mounts, before user sends first message (~300-500ms saved on first message)

2. **Replace semantic matching LLM with keyword scoring** - The `getCodeScores` function already exists; increase its weight to 100% and remove LLM call (~500-800ms saved)

3. **Add shared cache (Upstash Redis)** - Eliminates cache misses on Edge Function cold starts

### Larger changes (1 week+):

1. **Combine classify + respond into single LLM call** - Use native OpenAI tool calling to classify, execute, and respond in one completion (~1-2s saved)

2. **Implement response streaming** - Stream partial responses for faster perceived response time (user sees text appearing immediately)

3. **Pre-compute embeddings for semantic search** - Generate embeddings for services/products offline, use vector similarity instead of LLM for matching
