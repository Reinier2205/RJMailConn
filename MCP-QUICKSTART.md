# Morning Brief Connector - MCP Quick Start

## Deploy Now

```bash
npm run build
npm run deploy
```

## MCP Endpoint

```
https://morning-brief-connector.reinier-olivier.workers.dev/mcp
```

## Test It

```powershell
.\test-mcp.ps1
```

## ChatGPT Configuration

```json
{
  "mcpServers": {
    "morning-brief": {
      "url": "https://morning-brief-connector.reinier-olivier.workers.dev/mcp",
      "headers": {
        "Authorization": "Bearer 716180e24c87de8b699efd32198adbd9"
      }
    }
  }
}
```

## Available Tool

**Tool Name:** `get_morning_brief`

**What it does:** Retrieves your current morning brief with emails and calendar

**Input:** None required

**Output:** Full brief data including:
- New and important emails
- Today's calendar events
- Upcoming events
- Sync status and warnings

## Quick Test with curl

```bash
curl -X POST https://morning-brief-connector.reinier-olivier.workers.dev/mcp \
  -H "Authorization: Bearer 716180e24c87de8b699efd32198adbd9" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
```

## What Didn't Change

✅ All existing REST endpoints still work:
- `GET /brief`
- `POST /calendar/events`
- `PATCH /calendar/events/{id}`
- `POST /drafts`

✅ Same authentication token for everything

✅ No new secrets or configuration needed

✅ Microsoft OAuth and database unchanged

## Full Documentation

See `MCP-INTEGRATION.md` for complete details.

---

**That's it!** Deploy and use with ChatGPT immediately.
