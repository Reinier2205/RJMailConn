# Morning Brief Connector - MCP Integration Guide

**Model Context Protocol (MCP) Endpoint**

This document describes how to integrate ChatGPT or other MCP clients with the Morning Brief Connector's MCP endpoint.

---

## Overview

The Morning Brief Connector now exposes a **Model Context Protocol (MCP)** endpoint using JSON-RPC 2.0 over HTTP. This allows AI assistants like ChatGPT, Claude, and Cursor to directly invoke the morning brief tool.

### Key Features
- ✅ **JSON-RPC 2.0 over HTTP** - Modern MCP transport
- ✅ **Stateless** - No session management required
- ✅ **Existing Authentication** - Uses the same Bearer token as REST endpoints
- ✅ **No Microsoft Auth Required** - OAuth is handled internally by the Worker
- ✅ **Direct Integration** - Calls existing BriefHandler, no HTTP overhead

---

## MCP Endpoint Details

### Endpoint URL
```
https://morning-brief-connector.reinier-olivier.workers.dev/mcp
```

### Transport
**HTTP with JSON-RPC 2.0**

### Authentication
**Bearer Token** (same as existing REST endpoints)

Required Header:
```http
Authorization: Bearer <CONNECTOR_API_TOKEN>
```

**IMPORTANT:** Use the same `CONNECTOR_API_TOKEN` secret value used for `/brief` and other endpoints.

### Supported Methods

| Method | Description |
|--------|-------------|
| `initialize` | Initialize MCP session and retrieve server capabilities |
| `tools/list` | List all available MCP tools |
| `tools/call` | Invoke a specific tool by name |

---

## Available MCP Tools

### 1. get_morning_brief

**Description:** Retrieve Reinier's current Morning Intelligence Brief, including email and calendar information.

**Input Schema:**
```json
{
  "type": "object",
  "properties": {},
  "required": []
}
```
*No input parameters required.*

**Output Format:**
```json
{
  "content": [
    {
      "type": "text",
      "text": "<JSON string containing full brief data>"
    }
  ]
}
```

The `text` field contains a JSON-formatted string with the complete morning brief structure:
- `generated_at` - ISO 8601 timestamp
- `status` - Sync status (`complete`, `partial`, `failed`, etc.)
- `data_sources` - Email and calendar sync metadata
- `emails` - Categorized email data (new_messages, important_messages, etc.)
- `calendar` - Today's and upcoming calendar events
- `warnings` - Data freshness or sync issue alerts

---

## Example MCP Requests

### 1. Initialize

**Request:**
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "initialize"
}
```

**Response:**
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "protocolVersion": "2024-11-05",
    "serverInfo": {
      "name": "morning-brief-connector",
      "version": "1.0.0"
    },
    "capabilities": {
      "tools": {}
    }
  }
}
```

### 2. List Tools

**Request:**
```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "method": "tools/list"
}
```

**Response:**
```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "result": {
    "tools": [
      {
        "name": "get_morning_brief",
        "description": "Retrieve Reinier's current Morning Intelligence Brief, including email and calendar information.",
        "inputSchema": {
          "type": "object",
          "properties": {},
          "required": []
        }
      }
    ]
  }
}
```

### 3. Call get_morning_brief Tool

**Request:**
```json
{
  "jsonrpc": "2.0",
  "id": 3,
  "method": "tools/call",
  "params": {
    "name": "get_morning_brief",
    "arguments": {}
  }
}
```

**Response (Sanitized Example):**
```json
{
  "jsonrpc": "2.0",
  "id": 3,
  "result": {
    "content": [
      {
        "type": "text",
        "text": "{\"generated_at\":\"2026-10-01T12:30:45.123Z\",\"status\":\"complete\",\"data_sources\":{\"email\":{\"status\":\"complete\",\"last_sync\":\"2026-10-01T06:15:23.456Z\",\"items\":247},\"calendar\":{\"status\":\"complete\",\"last_sync\":\"2026-10-01T06:15:45.789Z\",\"items\":18}},\"emails\":{\"new_messages\":[{\"id\":\"uuid\",\"subject\":\"Q4 Planning\",\"sender_email\":\"colleague@company.com\",\"received_at\":\"2026-10-01T08:23:15.000Z\"}],\"important_messages\":[],\"marketing_messages\":[],\"unread_count\":42},\"calendar\":{\"today_events\":[{\"id\":\"uuid\",\"subject\":\"Team Standup\",\"start_at\":\"2026-10-01T09:00:00.000Z\",\"end_at\":\"2026-10-01T09:30:00.000Z\"}],\"upcoming_events\":[]},\"warnings\":[]}"
      }
    ]
  }
}
```

**Note:** The `text` field contains a JSON string that should be parsed by the MCP client.

---

## ChatGPT Integration

### Configuration for ChatGPT Custom GPT

If using ChatGPT with MCP support:

1. **Server URL:**
   ```
   https://morning-brief-connector.reinier-olivier.workers.dev/mcp
   ```

2. **Transport:**
   ```
   HTTP (JSON-RPC 2.0)
   ```

3. **Authentication:**
   ```
   Bearer Token
   Header: Authorization: Bearer <CONNECTOR_API_TOKEN>
   ```

4. **Available Tools:**
   - `get_morning_brief`

### Example ChatGPT MCP Configuration

```json
{
  "mcpServers": {
    "morning-brief": {
      "url": "https://morning-brief-connector.reinier-olivier.workers.dev/mcp",
      "transport": "http",
      "headers": {
        "Authorization": "Bearer [REDACTED_USE_CONNECTOR_API_TOKEN]"
      }
    }
  }
}
```

---

## Claude Desktop Integration

Add to `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS) or equivalent on your platform:

```json
{
  "mcpServers": {
    "morning-brief": {
      "url": "https://morning-brief-connector.reinier-olivier.workers.dev/mcp",
      "headers": {
        "Authorization": "Bearer [REDACTED_USE_CONNECTOR_API_TOKEN]"
      }
    }
  }
}
```

Restart Claude Desktop to activate the integration.

---

## Cursor Integration

In Cursor → Settings → MCP Servers → Add Server:

```json
{
  "url": "https://morning-brief-connector.reinier-olivier.workers.dev/mcp",
  "headers": {
    "Authorization": "Bearer [REDACTED_USE_CONNECTOR_API_TOKEN]"
  }
}
```

---

## Testing the MCP Endpoint

### Using PowerShell Test Script

```powershell
.\test-mcp.ps1
```

This script tests:
1. MCP initialization
2. Tool listing
3. get_morning_brief tool invocation
4. Error handling
5. Authentication validation

### Using curl

**Initialize:**
```bash
curl -X POST https://morning-brief-connector.reinier-olivier.workers.dev/mcp \
  -H "Authorization: Bearer <YOUR_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize"}'
```

**List Tools:**
```bash
curl -X POST https://morning-brief-connector.reinier-olivier.workers.dev/mcp \
  -H "Authorization: Bearer <YOUR_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":2,"method":"tools/list"}'
```

**Call Tool:**
```bash
curl -X POST https://morning-brief-connector.reinier-olivier.workers.dev/mcp \
  -H "Authorization: Bearer <YOUR_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"get_morning_brief","arguments":{}}}'
```

---

## Error Responses

### Authentication Error
```json
{
  "jsonrpc": "2.0",
  "id": null,
  "error": {
    "code": -32600,
    "message": "Authentication required",
    "data": {
      "error": "Missing Authorization header"
    }
  }
}
```

### Invalid Method
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "error": {
    "code": -32601,
    "message": "Method not found: unknown_method"
  }
}
```

### Tool Not Found
```json
{
  "jsonrpc": "2.0",
  "id": 3,
  "error": {
    "code": -32601,
    "message": "Unknown tool: invalid_tool_name"
  }
}
```

### Internal Error
```json
{
  "jsonrpc": "2.0",
  "id": 3,
  "error": {
    "code": -32603,
    "message": "Failed to generate morning brief",
    "data": {
      "error": "Database connection failed"
    }
  }
}
```

---

## JSON-RPC Error Codes

| Code | Meaning |
|------|---------|
| `-32700` | Parse error - Invalid JSON |
| `-32600` | Invalid Request - Missing required fields |
| `-32601` | Method not found |
| `-32602` | Invalid params |
| `-32603` | Internal error |

---

## Security Notes

### Authentication
- The MCP endpoint uses the **same Bearer token** as the REST endpoints
- Token is validated using constant-time comparison
- Token value is the Cloudflare secret: `CONNECTOR_API_TOKEN`

### What's NOT Exposed
- ❌ `CONNECTOR_API_TOKEN` value
- ❌ Microsoft access tokens
- ❌ Microsoft refresh tokens
- ❌ OAuth client secrets
- ❌ D1 database credentials

### What IS Exposed
- ✅ Brief data (email metadata, calendar events)
- ✅ Server info (name, version)
- ✅ Tool names and descriptions

---

## Implementation Details

### Architecture
```
ChatGPT/Claude
     |
     | HTTP POST (JSON-RPC 2.0)
     | Authorization: Bearer <token>
     v
  /mcp endpoint
     |
     | McpHandler validates auth
     | Routes to tool handler
     v
  BriefHandler
     |
     | Queries D1 database
     | No Microsoft API calls
     v
  JSON-RPC Response
```

### Key Features
1. **No Microsoft Auth Required**: The Worker handles all OAuth internally
2. **Direct Internal Calls**: MCP handler directly calls `BriefHandler`, no HTTP overhead
3. **Stateless**: Each request is independent, no session management
4. **Same Authentication**: Uses existing `CONNECTOR_API_TOKEN` and `AuthMiddleware`
5. **Future-Ready**: Structured to easily add `create_calendar_event` and `create_email_draft` tools

---

## Future MCP Tools

The following tools can be added in the future by extending the `McpHandler`:

### create_calendar_event
Create a new calendar event in Microsoft 365

**Input Schema:**
```json
{
  "type": "object",
  "properties": {
    "subject": { "type": "string" },
    "startTime": { "type": "string" },
    "endTime": { "type": "string" },
    "timezone": { "type": "string" },
    "location": { "type": "string" },
    "attendees": { "type": "array", "items": { "type": "string" } }
  },
  "required": ["subject", "startTime", "endTime", "timezone"]
}
```

### update_calendar_event
Update an existing calendar event

**Input Schema:**
```json
{
  "type": "object",
  "properties": {
    "eventId": { "type": "string" },
    "subject": { "type": "string" },
    "startTime": { "type": "string" },
    "endTime": { "type": "string" },
    "timezone": { "type": "string" },
    "location": { "type": "string" }
  },
  "required": ["eventId"]
}
```

### create_email_draft
Create an email draft (no sending)

**Input Schema:**
```json
{
  "type": "object",
  "properties": {
    "subject": { "type": "string" },
    "body": { "type": "string" },
    "toRecipients": { "type": "array", "items": { "type": "string" } },
    "ccRecipients": { "type": "array", "items": { "type": "string" } },
    "importance": { "type": "string", "enum": ["low", "normal", "high"] }
  },
  "required": ["subject", "body", "toRecipients"]
}
```

---

## Troubleshooting

### MCP Client Can't Connect
1. Verify Worker is accessible: `https://morning-brief-connector.reinier-olivier.workers.dev/health`
2. Check authentication token is correct
3. Ensure using POST method
4. Verify `Content-Type: application/json` header

### Authentication Errors
1. Confirm `Authorization: Bearer <token>` header is present
2. Check token matches `CONNECTOR_API_TOKEN` Cloudflare secret
3. Token should not have extra whitespace or quotes

### Tool Returns Stale Data
1. Check `data_sources.email.last_sync` and `data_sources.calendar.last_sync`
2. Sync runs daily at 06:00 UTC (08:00 SAST)
3. Review `warnings` array for data freshness alerts

### JSON-RPC Errors
1. Ensure request includes `"jsonrpc": "2.0"`
2. Include `"id"` field (can be number or string)
3. Check `"method"` is one of: `initialize`, `tools/list`, `tools/call`
4. For `tools/call`, include `"params"` with `"name"` and `"arguments"`

---

## Support

For issues or questions:
- Review existing endpoints: `GET /brief`, `POST /calendar/events`, `POST /drafts`
- Check Worker logs in Cloudflare dashboard
- Run test scripts: `.\test-api.ps1` and `.\test-mcp.ps1`
- Review documentation: `README.md`, `API.md`, `SECURITY.md`

---

**MCP Endpoint is Production-Ready** ✅

No additional deployment steps required beyond the standard `npm run deploy`.
