# Debug Panel System - Implementation Guide

**Status:** ✅ IMPLEMENTED
**Date:** 2025-01-07
**Dependencies:** Production deployment, Zustand state management

---

## 🎯 What Was Built

A **production-ready debug monitoring system** with real-time request tracking and AI model management:

- ✅ **Correlation ID Tracking** - Unique ID per request for precise log filtering
- ✅ **Request Timeline** - Intent classification, function execution, response generation
- ✅ **Cost Tracking** - Token usage and cost per request + aggregated totals
- ✅ **Performance Metrics** - Timing breakdowns with min/max/avg statistics
- ✅ **AI Model Selector** - Switch between Claude, GPT, Grok in real-time
- ✅ **Direct Log Links** - One-click access to Supabase function logs
- ✅ **Copy for AI** - Export request context for debugging with Claude
- ✅ **Production-Enabled** - Works in deployed apps, not just dev mode
- ✅ **Non-Blocking UI** - Fixed side panel, chat remains fully functional

---

## 📁 Files Created

### Frontend Components

```
src/
├── components/
│   └── debug/
│       ├── DebugPanel.tsx              (NEW - Main panel component)
│       ├── DebugToggle.tsx             (NEW - Bottom-left toggle button)
│       └── HoverTooltip.tsx            (NEW - Tooltip wrapper)
├── stores/
│   └── useDebugStore.ts                (NEW - Zustand state management)
├── lib/
│   └── debug/
│       ├── correlation-id.ts           (NEW - ID generation + log links)
│       ├── timing.ts                   (NEW - Performance timer)
│       └── format-for-ai.ts            (NEW - Export formatting)
└── config/
    └── debug.ts                         (NEW - Model configs)
```

### What Each Module Does

**DebugPanel.tsx**
- Renders fixed left-side panel (384px wide)
- Displays request history with collapsible cards
- Shows quick stats: avg intent time, avg total time, total cost
- Model selector dropdown
- "Copy All" and "Clear History" actions
- Request cards with expandable details:
  - User message (2-line truncate with hover tooltip)
  - Intent classification with confidence + reasoning
  - Timeline breakdown (intent → functions → response)
  - Cost breakdown (with AI model in tooltip)
  - Function calls with parameters (in tooltip)
  - Action buttons (Copy, View Logs)

**DebugToggle.tsx**
- Bottom-left "debug" text button
- Keyboard shortcut: Ctrl+Shift+D (or Cmd+Shift+D on Mac)
- Toggles panel open/closed

**useDebugStore.ts**
- Zustand store for debug state
- Manages request history (max 100 requests)
- Tracks expanded/collapsed state per request
- Stores AI model selection (persists to localStorage)
- Calculates aggregate metrics (avg times, min/max, total cost)
- Auto-expands latest request

**correlation-id.ts**
- Generates UUID for each request: `crypto.randomUUID()`
- Creates Supabase log links with request ID filter
- Supports multiple function types: chat-completion, google-sheet, classifier, etc.

**timing.ts**
- RequestTimer class using Performance API
- Tracks elapsed time for request stages
- Creates performance marks/measures in browser DevTools
- Label format: `🤖 {label}` for easy filtering

**format-for-ai.ts**
- Exports request data in markdown format
- Includes full conversation context
- Shows request/response flow
- Perfect for pasting into Claude for debugging

---

## 🔄 How It Works

### Request Flow with Correlation IDs

```
┌─────────────────────────────────────────────────────────────┐
│                    User sends message                       │
└─────────────────┬───────────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────────┐
│  1. Generate Correlation ID                                 │
│     const requestId = generateCorrelationId()               │
│     → "a1b2c3d4-5678-90ab-cdef-123456789abc"               │
└─────────────────┬───────────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────────┐
│  2. Create Debug Request                                    │
│     useDebugStore.addRequest({                              │
│       id: requestId,                                        │
│       userMessage: "Book pottery tomorrow at 2pm",          │
│       model: "anthropic/claude-3.5-sonnet",                 │
│       status: "pending",                                    │
│       timestamp: Date.now(),                                │
│       timings: { requestStart: performance.now() }          │
│     })                                                      │
└─────────────────┬───────────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────────┐
│  3. Send to Backend with Correlation Header                 │
│     fetch('/functions/v1/chat-completion', {                │
│       headers: {                                            │
│         'X-Request-ID': requestId  ← KEY!                   │
│       }                                                     │
│     })                                                      │
└─────────────────┬───────────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────────┐
│  Backend: Edge Function                                     │
│                                                             │
│  const requestId = req.headers.get('X-Request-ID')         │
│  console.log(`[${requestId}] Step 1: Classifying...`)      │
│  console.log(`[${requestId}] Intent detected: BOOKING`)     │
│  console.log(`[${requestId}] Function called: create_booking`) │
│                                                             │
│  All logs tagged with [requestId]                          │
└─────────────────┬───────────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────────┐
│  4. Frontend Updates State in Real-Time                     │
│                                                             │
│  Status: pending → classifying → executing → responding    │
│                                                             │
│  useDebugStore.updateRequest(requestId, {                  │
│     status: "classifying",                                 │
│     intent: { detected: "BOOKING", confidence: 0.95 }      │
│   })                                                       │
│                                                             │
│  useDebugStore.updateRequest(requestId, {                  │
│     status: "executing",                                   │
│     functionCalls: [{ name: "create_booking", ... }]       │
│   })                                                       │
│                                                             │
│  useDebugStore.updateRequest(requestId, {                  │
│     status: "complete",                                    │
│     timings: { totalDuration: 2450 }                       │
│   })                                                       │
└─────────────────┬───────────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────────┐
│  5. User Views Debug Panel                                  │
│                                                             │
│  - Click "debug" button (bottom-left)                      │
│  - See request card with all details                       │
│  - Click "Chat" button → Supabase logs filtered by ID      │
│  - URL: https://supabase.com/.../logs?s=a1b2c3d4...        │
│  - All backend logs for this request appear!               │
└─────────────────────────────────────────────────────────────┘
```

### State Management Architecture

```typescript
// useDebugStore.ts structure
interface DebugStore {
  // State
  requests: DebugRequest[]           // Last 100 requests
  messages: Message[]                 // Full conversation
  isPanelOpen: boolean                // Panel visibility
  selectedModel: string               // AI model selection
  expandedRequests: Set<string>       // Which cards are expanded

  // Actions
  addRequest(request: DebugRequest)
  updateRequest(id: string, updates: Partial<DebugRequest>)
  addMessage(message: Message)
  setModel(model: string)
  togglePanel()
  clearHistory()

  // Getters
  getAverageIntentTime(): number
  getAverageResponseTime(): number
  getTotalCost(): number
  getCostBreakdown(): { requests, inputTokens, outputTokens }
}
```

---

## 🚀 Integration Guide

### Step 1: Add Debug Panel to App

```typescript
// App.tsx
import { DebugPanel } from '@/components/debug/DebugPanel';
import { DebugToggle } from '@/components/debug/DebugToggle';

export default function App() {
  return (
    <div>
      <YourMainContent />

      {/* Add at root level */}
      <DebugPanel />
      <DebugToggle />
    </div>
  );
}
```

### Step 2: Track Requests in Chat

```typescript
// StorePage.tsx (or wherever you handle chat)
import { useDebugStore } from '@/stores/useDebugStore';
import { generateCorrelationId } from '@/lib/debug/correlation-id';
import { requestTimer } from '@/lib/debug/timing';

function handleSendMessage(userMessage: string) {
  const { addRequest, updateRequest, selectedModel } = useDebugStore.getState();

  // 1. Generate correlation ID
  const requestId = generateCorrelationId();

  // 2. Create debug request
  addRequest({
    id: requestId,
    timestamp: Date.now(),
    userMessage,
    model: selectedModel,
    status: 'pending',
    timings: {
      requestStart: performance.now(),
    },
  });

  // 3. Start timing
  requestTimer.start(requestId, 'total');

  // 4. Call backend with correlation header
  const response = await fetch('/functions/v1/chat-completion', {
    method: 'POST',
    headers: {
      'X-Request-ID': requestId,  // ← KEY!
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messages: conversationHistory,
      storeId,
      model: selectedModel,  // Pass selected model
    }),
  });

  const data = await response.json();

  // 5. Update with results
  const totalDuration = requestTimer.end(requestId, 'total');

  updateRequest(requestId, {
    status: 'complete',
    intent: data.intent,
    functionCalls: data.functionCalls,
    response: { text: data.text },
    timings: {
      ...timings,
      totalDuration,
    },
    tokens: data.tokens,
    cost: data.cost,
  });
}
```

### Step 3: Backend - Log with Correlation ID

```typescript
// supabase/functions/chat-completion/index.ts
Deno.serve(async (req) => {
  // Extract correlation ID from header
  const requestId = req.headers.get('X-Request-ID') || crypto.randomUUID();

  // Use in all logs
  console.log(`[${requestId}] Chat completion request started`);
  console.log(`[${requestId}] User message: ${userMessage}`);

  try {
    // Step 1: Classify intent
    console.log(`[${requestId}] Classifying intent...`);
    const intent = await classifyIntent(messages);
    console.log(`[${requestId}] Intent: ${intent.detected} (${intent.confidence})`);

    // Step 2: Execute functions
    if (intent.functionToCall) {
      console.log(`[${requestId}] Executing function: ${intent.functionToCall}`);
      const result = await executeFunction(intent.functionToCall, intent.params);
      console.log(`[${requestId}] Function result:`, result);
    }

    // Step 3: Generate response
    console.log(`[${requestId}] Generating response...`);
    const response = await generateResponse(intent, functionResult);
    console.log(`[${requestId}] ✅ Complete`);

    return new Response(JSON.stringify({
      text: response,
      intent,
      functionCalls,
      tokens,
      cost,
    }));

  } catch (error) {
    console.error(`[${requestId}] ❌ Error:`, error);
    throw error;
  }
});
```

---

## 📊 Debug Panel Features

### Quick Stats Bar

```
┌─────────────────────────────────────────────────────────┐
│  Avg Intent     │   Avg Total     │   Cost              │
│  1.23s          │   2.45s         │   $0.0034           │
│                 │                 │                     │
│  (hover shows   │  (hover shows   │  (hover shows       │
│   min/max)      │   min/max)      │   breakdown)        │
└─────────────────────────────────────────────────────────┘
```

### Request Card (Collapsed)

```
┌─────────────────────────────────────────────────────────┐
│  10:23:45 AM                                    ✅ 2.45s │
│  "Book pottery class tomorrow at 2pm..."               │
│  🎯 BOOKING (95)                                        │
└─────────────────────────────────────────────────────────┘
```

### Request Card (Expanded)

```
┌─────────────────────────────────────────────────────────┐
│  10:23:45 AM                                    ✅ 2.45s │
│  "Book pottery class tomorrow at 2pm for John,         │
│   email john@test.com"                                  │
│  🎯 BOOKING (95) ← hover shows AI reasoning            │
│                                                         │
│  Timeline:                                              │
│  📊 Intent: 1.23s                                       │
│  🔧 Functions: 0.89s                                    │
│      ✅ create_booking ← hover shows params            │
│  💬 Response: 0.33s                                     │
│                                                         │
│  Cost: ← hover shows model + token breakdown           │
│  💰 $0.0034                                             │
│                                                         │
│  Functions:                                             │
│  ✅ create_booking ← hover shows params                │
│                                                         │
│  [Copy]  [Chat Logs]  [Sheet Logs]                     │
└─────────────────────────────────────────────────────────┘
```

### Model Selector

```
┌─────────────────────────────────────────────────────────┐
│  [Claude 3.5 Sonnet ⭐         ▼]                       │
│   │                                                     │
│   ├─ Claude 3.5 Sonnet ⭐                               │
│   ├─ GPT-4o Mini                                        │
│   └─ Grok Beta                                          │
└─────────────────────────────────────────────────────────┘
```

Selection persists to localStorage and applies to all new requests.

---

## 🔧 Configuration

### Adding New AI Models

```typescript
// src/config/debug.ts
export const DEBUG_CONFIG = {
  models: [
    {
      id: 'anthropic/claude-3.5-sonnet',
      name: 'Claude 3.5 Sonnet',
      tier: 'Smart',
      costPer1MInput: 3.00,
      costPer1MOutput: 15.00,
      isDefault: true,
    },
    {
      id: 'openai/gpt-4o-mini',
      name: 'GPT-4o Mini',
      tier: 'Balanced',
      costPer1MInput: 0.15,
      costPer1MOutput: 0.60,
      isDefault: false,
    },
    // Add your custom model:
    {
      id: 'custom/my-model',
      name: 'My Custom Model',
      tier: 'Custom',
      costPer1MInput: 1.00,
      costPer1MOutput: 5.00,
      isDefault: false,
    },
  ],
};
```

### Customizing Log Links

```typescript
// src/lib/debug/correlation-id.ts
export function generateSupabaseLogLink(
  requestId: string,
  timestamp: number,
  functionName: 'chat-completion' | 'google-sheet' | 'custom-function'
): string {
  const projectId = extractProjectId();

  // Customize search term if your logs use different format
  const searchTerm = requestId; // or `[${requestId}]` if you log with brackets

  return `https://supabase.com/dashboard/project/${projectId}/functions/${functionName}/logs?s=${encodeURIComponent(searchTerm)}`;
}
```

---

## 📈 Performance Optimization

### Request History Limit

```typescript
// useDebugStore.ts
addRequest: (request) =>
  set((state) => ({
    requests: [request, ...state.requests].slice(0, 100), // Keep last 100
  }))
```

Change `100` to adjust memory usage vs history depth.

### Auto-Expand Latest

```typescript
// By default, latest request auto-expands
// To disable:
addRequest: (request) =>
  set((state) => {
    const newExpanded = new Set(state.expandedRequests);
    // Remove this line to disable auto-expand:
    // newExpanded.add(request.id);
    return {
      requests: [request, ...state.requests],
      expandedRequests: newExpanded,
    };
  })
```

---

## 🐛 Troubleshooting

### Issue: Log links don't work (404 error)

**Check:**
1. Supabase project ID extraction
2. Function name matches deployed function

**Solution:**
```typescript
// Verify project ID extraction
const projectId = import.meta.env.VITE_SUPABASE_URL
  ?.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1];

console.log('Project ID:', projectId);
// Should output: "iyzpedfkgzkxyciephgi"
```

### Issue: Correlation IDs not appearing in Supabase logs

**Check backend is reading header:**
```typescript
const requestId = req.headers.get('X-Request-ID');
console.log('Request ID:', requestId);
```

**Check frontend is sending header:**
```typescript
// In network tab, verify header exists:
X-Request-ID: a1b2c3d4-5678-90ab-cdef-123456789abc
```

### Issue: Panel opens but shows no requests

**Check:**
1. `addRequest()` being called
2. Zustand store initialized
3. Browser console for errors

**Debug:**
```typescript
// Add temporary logging
const { addRequest } = useDebugStore.getState();
console.log('Adding request:', requestId);
addRequest({ ... });
console.log('Requests now:', useDebugStore.getState().requests);
```

### Issue: Costs showing as $0.0000

**Check token data:**
```typescript
// Backend must return tokens in response:
{
  tokens: {
    classification: { input: 1234, output: 567 },
    response: { input: 2345, output: 890 },
    total: { input: 3579, output: 1457, cached: 0 }
  }
}
```

**Verify cost calculation:**
```typescript
// Should multiply tokens by model rates
const inputCost = (tokens.total.input / 1_000_000) * model.costPer1MInput;
const outputCost = (tokens.total.output / 1_000_000) * model.costPer1MOutput;
const total = inputCost + outputCost;
```

---

## ✅ Success Checklist

After integration:

- [ ] Debug panel opens via bottom-left button
- [ ] Keyboard shortcut (Ctrl+Shift+D) works
- [ ] Requests appear in panel when sending messages
- [ ] Request cards show user message (truncated)
- [ ] Intent classification appears with confidence
- [ ] Timeline shows intent/functions/response durations
- [ ] Cost shows per request and total
- [ ] Model selector changes apply to new requests
- [ ] "Copy" button exports request with context
- [ ] "Chat Logs" button opens Supabase with filtered logs
- [ ] Logs in Supabase show `[requestId]` tags
- [ ] Panel doesn't block chat interface
- [ ] Quick stats show averages correctly

---

## 🚀 Advanced Usage

### Export All Requests for Analysis

```typescript
import { formatAllRequestsForAI } from '@/lib/debug/format-for-ai';

const { requests, messages } = useDebugStore.getState();
const export = formatAllRequestsForAI(requests, messages);

// Copy to clipboard
navigator.clipboard.writeText(export);

// Or download as file
const blob = new Blob([export], { type: 'text/markdown' });
const url = URL.createObjectURL(blob);
const a = document.createElement('a');
a.href = url;
a.download = `debug-export-${Date.now()}.md`;
a.click();
```

### Filter Requests by Status

```typescript
// In DebugPanel.tsx
const filteredRequests = requests.filter(r => r.status === 'error');

// Show only errors for debugging
```

### Custom Request Grouping

```typescript
// Group by intent
const byIntent = requests.reduce((acc, req) => {
  const intent = req.intent?.detected || 'UNKNOWN';
  if (!acc[intent]) acc[intent] = [];
  acc[intent].push(req);
  return acc;
}, {} as Record<string, DebugRequest[]>);

// Show breakdown:
// BOOKING: 15 requests, avg 2.3s, $0.045
// INFO: 8 requests, avg 1.8s, $0.018
```

### Performance Marks in Browser DevTools

The `RequestTimer` creates performance marks:

```javascript
// In Chrome DevTools:
// 1. Open Performance tab
// 2. Record
// 3. Send chat message
// 4. Stop recording
// 5. Look for marks labeled: 🤖 Intent Classification
```

---

## 🎉 Summary

You now have a **production-ready debug system** that:

- 🔍 Tracks every request with unique correlation IDs
- ⏱️ Measures performance at each stage
- 💰 Calculates costs per request and in aggregate
- 🔗 Links directly to backend logs in Supabase
- 🤖 Switches AI models on the fly
- 📋 Exports context for AI-assisted debugging
- 🎨 Provides beautiful, non-blocking UI
- 🚀 Works in production, not just development

**Debug with confidence in your deployed application!**

---

## 📚 Additional Resources

- **Zustand Docs**: https://zustand-demo.pmnd.rs/
- **Performance API**: https://developer.mozilla.org/en-US/docs/Web/API/Performance
- **Correlation IDs**: https://www.rapid7.com/blog/post/2016/12/23/the-value-of-correlation-ids/
- **UUID v4**: https://datatracker.ietf.org/doc/html/rfc4122

---

**Pro Tips:**

1. **Use keyboard shortcut** - Ctrl+Shift+D is faster than clicking button
2. **Hover tooltips** - Most data has additional details on hover
3. **Copy early** - Export problematic requests before they scroll away
4. **Check timing** - If intent > 2s, consider lighter model
5. **Monitor costs** - Set budget alert when total > threshold
6. **Filter logs** - Use correlation ID to find exact backend execution
7. **Compare models** - Try GPT-4o Mini for 10x cost savings
