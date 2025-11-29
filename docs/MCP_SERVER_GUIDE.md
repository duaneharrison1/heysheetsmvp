# MCP Server Guide

**Status:** Implemented
**Date:** 2025-01-25
**Dependencies:** Supabase Edge Functions, chat-completion function

---

## Overview

The MCP (Model Context Protocol) Server is a Supabase Edge Function that enables programmatic interaction with the HeySheets chatbot. It allows Claude Code and other MCP-compatible clients to:

- Send chat messages and receive responses with full debug data
- Run automated test scenarios against the chatbot
- Debug intent classification, function calls, and timing issues

---

## Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌──────────────────────┐
│   Claude Code   │────▶│   MCP Server    │────▶│   chat-completion    │
│   (MCP Client)  │     │   (Edge Func)   │     │    (Edge Func)       │
└─────────────────┘     └─────────────────┘     └──────────────────────┘
        │                       │                         │
        │   JSON-RPC 2.0        │   Internal HTTP         │
        │   + x-api-key         │   + ANON_KEY            │
        ▼                       ▼                         ▼
   tools/call              handleCallChat()         AI Response
   tools/list              handleRunTest()          + Debug Data
   initialize
```

**Flow:**
1. MCP client sends JSON-RPC 2.0 request with authentication
2. MCP server validates `x-api-key` header against `MCP_SECRET`
3. Routes to appropriate handler based on method
4. For tool calls, internally calls `chat-completion` Edge Function
5. Returns results in JSON-RPC 2.0 response format

---

## Setup

### Prerequisites

- Supabase project with Edge Functions enabled
- `chat-completion` Edge Function deployed
- Access to Supabase Dashboard (for setting secrets)

### Configuration

**1. Generate MCP Secret**

```bash
openssl rand -hex 32
```

**2. Set Secret in Supabase**

- Go to https://supabase.com/dashboard
- Select your project
- Navigate to **Project Settings** → **Edge Functions** → **Secrets**
- Add secret: `MCP_SECRET` = `<your-generated-secret>`

**3. Deploy Function**

The function auto-deploys via GitHub Actions when merged to main.

Manual deploy:
```bash
supabase functions deploy mcp
```

---

## Usage

### Available Tools

| Tool | Description |
|------|-------------|
| `call_chat` | Send a message to the chatbot, get response with debug data |
| `run_test` | Execute a multi-step test scenario |

### Endpoint

```
POST https://iyzpedfkgzkxyciephgi.supabase.co/functions/v1/mcp
```

### Required Headers

```
Content-Type: application/json
Authorization: Bearer <SUPABASE_ANON_KEY>
x-api-key: <MCP_SECRET>
```

### Testing via Browser Console

**List available tools:**
```javascript
fetch('https://iyzpedfkgzkxyciephgi.supabase.co/functions/v1/mcp', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml5enBlZGZrZ3preHljaWVwaGdpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjIzMDI2NDksImV4cCI6MjA3Nzg3ODY0OX0.MSGXp631Mbc4AU-BMcsIKbVepuUimTmvE0Dyu-3h55Y',
    'x-api-key': '<YOUR_MCP_SECRET>'
  },
  body: JSON.stringify({
    jsonrpc: '2.0',
    method: 'tools/list',
    id: 1
  })
}).then(r => r.json()).then(console.log)
```

**Send a chat message:**
```javascript
fetch('https://iyzpedfkgzkxyciephgi.supabase.co/functions/v1/mcp', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml5enBlZGZrZ3preHljaWVwaGdpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjIzMDI2NDksImV4cCI6MjA3Nzg3ODY0OX0.MSGXp631Mbc4AU-BMcsIKbVepuUimTmvE0Dyu-3h55Y',
    'x-api-key': '<YOUR_MCP_SECRET>'
  },
  body: JSON.stringify({
    jsonrpc: '2.0',
    method: 'tools/call',
    params: {
      name: 'call_chat',
      arguments: {
        message: 'What classes do you offer?',
        storeId: 'store-bd4d9759'
      }
    },
    id: 1
  })
}).then(r => r.json()).then(console.log)
```

---

## API Reference

### Protocol

The server supports two formats:

1. **JSON-RPC 2.0** (MCP standard) - for Claude Code and MCP clients
2. **Legacy format** - backward compatible `{"tool": "...", "params": {...}}`

### JSON-RPC Methods

#### `initialize`

Returns server capabilities.

**Request:**
```json
{
  "jsonrpc": "2.0",
  "method": "initialize",
  "id": 1
}
```

**Response:**
```json
{
  "jsonrpc": "2.0",
  "result": {
    "protocolVersion": "2024-11-05",
    "capabilities": { "tools": {} },
    "serverInfo": { "name": "heysheets-mcp", "version": "1.0.0" }
  },
  "id": 1
}
```

#### `tools/list`

Returns available tools with JSON Schema definitions.

**Request:**
```json
{
  "jsonrpc": "2.0",
  "method": "tools/list",
  "id": 1
}
```

**Response:**
```json
{
  "jsonrpc": "2.0",
  "result": {
    "tools": [
      {
        "name": "call_chat",
        "description": "Send a message to the HeySheets chatbot...",
        "inputSchema": {
          "type": "object",
          "properties": {
            "message": { "type": "string" },
            "storeId": { "type": "string" },
            "model": { "type": "string" }
          },
          "required": ["message", "storeId"]
        }
      },
      {
        "name": "run_test",
        "description": "Execute a test scenario...",
        "inputSchema": { ... }
      }
    ]
  },
  "id": 1
}
```

#### `tools/call`

Execute a tool.

**Request (call_chat):**
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

**Response:**
```json
{
  "jsonrpc": "2.0",
  "result": {
    "content": [{
      "type": "text",
      "text": "{\n  \"success\": true,\n  \"message\": \"What pottery classes do you have?\",\n  \"response\": \"We offer Hand Building, Wheel Throwing...\",\n  \"intent\": \"SERVICE_INQUIRY\",\n  \"confidence\": 95,\n  \"debug\": { ... }\n}"
    }]
  },
  "id": 1
}
```

**Request (run_test):**
```json
{
  "jsonrpc": "2.0",
  "method": "tools/call",
  "params": {
    "name": "run_test",
    "arguments": {
      "scenario": {
        "id": "booking-flow",
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

### Legacy Format (Backward Compatible)

Still works for existing integrations:

```json
{
  "tool": "call_chat",
  "params": {
    "message": "What classes do you have?",
    "storeId": "store-bd4d9759"
  }
}
```

---

## Response Data

### call_chat Response

| Field | Description |
|-------|-------------|
| `success` | Boolean - whether the call succeeded |
| `message` | The user message that was sent |
| `response` | Bot's text response |
| `intent` | Classified intent (e.g., SERVICE_INQUIRY, CREATE_BOOKING) |
| `confidence` | Intent confidence score (0-100) |
| `debug` | Full debug object |

### Debug Object

| Field | Description |
|-------|-------------|
| `debug.intentDuration` | Time for intent classification (ms) |
| `debug.functionDuration` | Time for function execution (ms) |
| `debug.responseDuration` | Time for response generation (ms) |
| `debug.totalDuration` | Total request time (ms) |
| `debug.intent` | Intent details including reasoning |
| `debug.functionCalls` | Array of functions called with results |
| `debug.tokens` | Token usage breakdown |
| `debug.cost` | Cost breakdown by step |
| `debug.steps` | Step-by-step execution timeline |

### run_test Response

| Field | Description |
|-------|-------------|
| `passed` | Boolean - overall test pass/fail |
| `totalDuration` | Total test time (ms) |
| `stepsTotal` | Number of steps in scenario |
| `stepsPassed` | Number of steps that passed |
| `results` | Array of per-step results with debug data |

---

## Troubleshooting

### 401 Unauthorized

**Cause:** Missing or invalid authentication headers.

**Solution:** Ensure both headers are present:
```
Authorization: Bearer <SUPABASE_ANON_KEY>
x-api-key: <MCP_SECRET>
```

### Tool Not Found

**Cause:** Invalid tool name in `tools/call`.

**Solution:** Only `call_chat` and `run_test` are available. Use `tools/list` to see all tools.

### Chat API Error

**Cause:** The internal call to `chat-completion` failed.

**Solution:** Check the error message - common issues:
- Invalid `storeId`
- Store not found in database
- Missing store configuration

### Invalid Request Format

**Cause:** Request doesn't match JSON-RPC 2.0 or legacy format.

**Solution:** Ensure request has either:
- `jsonrpc: "2.0"` with `method` field (MCP format)
- `tool` field (legacy format)

---

## Related Files

| File | Purpose |
|------|---------|
| `supabase/functions/mcp/index.ts` | MCP server implementation |
| `supabase/functions/chat-completion/index.ts` | Chat API (called internally) |
| `supabase/functions/classifier/index.ts` | Intent classification |
| `supabase/functions/responder/index.ts` | Response generation |
| `supabase/functions/tools/index.ts` | Function execution |
| `src/qa/scenarios/` | Test scenario JSON files |
| `CLAUDE.md` | Quick reference for Claude Code |

---

## Environment Variables

| Variable | Description |
|----------|-------------|
| `SUPABASE_URL` | Supabase project URL (auto-set) |
| `SUPABASE_ANON_KEY` | Supabase anonymous key (auto-set) |
| `MCP_SECRET` | API key for MCP authentication (must be set manually) |
