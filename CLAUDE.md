# HeySheets - Claude Code Guide

## MCP Server

HeySheets has an MCP server that allows Claude Code to interact with the chatbot programmatically.

### Endpoint

```
POST https://iyzpedfkgzkxyciephgi.supabase.co/functions/v1/mcp
```

### Authentication

Include both headers:
```
Authorization: Bearer <SUPABASE_ANON_KEY>
x-api-key: <MCP_SECRET>
```

---

## JSON-RPC 2.0 Protocol (MCP Standard)

### Initialize

```json
{
  "jsonrpc": "2.0",
  "method": "initialize",
  "id": 1
}
```

### List Tools

```json
{
  "jsonrpc": "2.0",
  "method": "tools/list",
  "id": 1
}
```

### Call Tool: call_chat

Send a message to the chatbot and get response with debug data.

```json
{
  "jsonrpc": "2.0",
  "method": "tools/call",
  "params": {
    "name": "call_chat",
    "arguments": {
      "message": "What pottery classes do you have?",
      "storeId": "store-bd4d9759",
      "model": "gpt-4o-mini"
    }
  },
  "id": 1
}
```

Response includes:
- `response` - Bot's reply
- `intent` - Classified intent (e.g., SERVICE_INQUIRY, CREATE_BOOKING)
- `confidence` - Intent confidence (0-100)
- `debug` - Full debug object with timing, functions called, tokens, cost

### Call Tool: run_test

Execute a test scenario with multiple steps.

```json
{
  "jsonrpc": "2.0",
  "method": "tools/call",
  "params": {
    "name": "run_test",
    "arguments": {
      "scenario": {
        "id": "booking-test",
        "name": "Basic Booking Flow",
        "steps": [
          {
            "id": "step-1",
            "userMessage": "What classes do you have?",
            "expected": { "intent": "SERVICE_INQUIRY" }
          },
          {
            "id": "step-2",
            "userMessage": "Book Hand Building for Tuesday",
            "expected": { "intent": "CREATE_BOOKING" }
          }
        ]
      },
      "storeId": "store-bd4d9759"
    }
  },
  "id": 1
}
```

Response includes:
- `passed` - Overall pass/fail
- `results` - Per-step results with debug data
- `totalDuration` - Total test time in ms

---

## Legacy Format (Backward Compatible)

The server also accepts the simpler legacy format:

```json
{
  "tool": "call_chat",
  "params": {
    "message": "What pottery classes do you have?",
    "storeId": "store-bd4d9759",
    "model": "gpt-4o-mini"
  }
}
```

```json
{
  "tool": "list_tools",
  "params": {}
}
```

---

## Key Files

| File | Purpose |
|------|---------|
| `supabase/functions/chat-completion/` | Main chat API |
| `supabase/functions/classifier/` | Intent classification |
| `supabase/functions/responder/` | Response generation |
| `supabase/functions/tools/` | Function execution |
| `supabase/functions/mcp/` | MCP server (this) |
| `src/qa/scenarios/` | Test scenario JSON files |
| `src/qa/lib/test-runner.ts` | Frontend test runner |

---

## Test Stores

For testing, use these store IDs:
- `store-bd4d9759` - Default test store
- Check `src/pages/StorePage.tsx` for available stores
- Or query the `stores` table in Supabase

---

## Common Tasks

### Run a quick chat test

```json
{
  "jsonrpc": "2.0",
  "method": "tools/call",
  "params": {
    "name": "call_chat",
    "arguments": {
      "message": "hi",
      "storeId": "store-bd4d9759"
    }
  },
  "id": 1
}
```

### Debug a failing conversation

1. Use `call_chat` with the failing message
2. Check `debug.intent` for classification issues
3. Check `debug.functionCalls` for function errors
4. Check `debug.steps` for execution timeline

### Run the booking test suite

Load scenario from `src/qa/scenarios/booking-001-happy-path.json` and pass to `run_test`.

---

## Environment Variables

The MCP server uses these (already configured in Supabase):
- `SUPABASE_URL` - Supabase project URL
- `SUPABASE_ANON_KEY` - Supabase anonymous key
- `MCP_SECRET` - API key for MCP authentication

---

## Full Documentation

See `docs/MCP_SERVER_GUIDE.md` for complete API reference and troubleshooting.
