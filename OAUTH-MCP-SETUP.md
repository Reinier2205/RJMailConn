# Morning Brief Connector - OAuth 2.1 MCP Setup

**Status:** ✅ Ready for Deployment

The MCP endpoint now uses OAuth 2.1 authentication while all REST endpoints continue using Bearer token authentication.

---

## What Changed

### MCP Endpoint
- **Before:** Bearer token authentication (same as REST)
- **After:** OAuth 2.1 with PKCE (ChatGPT-compatible)

### REST Endpoints (UNCHANGED)
All these continue using Bearer token (`CONNECTOR_API_TOKEN`):
- `GET /brief`
- `POST /calendar/events`
- `PATCH /calendar/events/{id}`
- `POST /drafts`
- `GET /health`
- `GET /status`

---

## Deployment Steps

### 1. Deploy the Worker

```bash
npm run build
npm run deploy
```

The KV namespace (`OAUTH_KV`) is already configured and bound.

### 2. No New Secrets Required

All existing secrets remain unchanged:
- ✅ `CONNECTOR_API_TOKEN` - Still used for REST endpoints
- ✅ `CLIENT_ID` - Still used for Microsoft OAuth
- ✅ `CLIENT_SECRET` - Still used for Microsoft OAuth
- ✅ `TENANT_ID` - Still used for Microsoft OAuth
- ✅ `OAUTH_STATE_SECRET` - Still used for Microsoft OAuth

**No action needed** - these secrets are already configured.

---

## OAuth 2.1 Endpoints

### MCP Resource
```
https://morning-brief-connector.reinier-olivier.workers.dev/mcp
```

### Authorization Endpoint
```
https://morning-brief-connector.reinier-olivier.workers.dev/authorize
```

### Token Endpoint
```
https://morning-brief-connector.reinier-olivier.workers.dev/oauth/token
```

### OAuth Metadata Discovery

**Protected Resource Metadata:**
```
https://morning-brief-connector.reinier-olivier.workers.dev/.well-known/oauth-protected-resource
```

**Authorization Server Metadata:**
```
https://morning-brief-connector.reinier-olivier.workers.dev/.well-known/oauth-authorization-server
```

---

## OAuth Configuration

### Required Scopes
- `mcp:read` - Required for all MCP access (get_morning_brief tool)
- `mcp:write` - For future write operations (calendar/draft creation)
- `offline_access` - For refresh tokens (long-lived access)

### PKCE
- **Method:** S256 (SHA-256)
- **Required:** Yes (mandatory for all clients)

### Client Registration
- **Dynamic Client Registration:** Enabled
- **Client ID Metadata Documents:** Enabled (ChatGPT compatibility)

---

## Connecting ChatGPT

### Method 1: ChatGPT Custom GPT Actions

When creating a Custom GPT:

1. Go to **Actions**
2. Select **Authentication** → **OAuth**
3. Configure:

```
Authorization URL:
https://morning-brief-connector.reinier-olivier.workers.dev/authorize

Token URL:
https://morning-brief-connector.reinier-olivier.workers.dev/oauth/token

Scope:
mcp:read

Client ID:
[Will be auto-registered via Client ID Metadata Document]
```

### Method 2: Direct MCP Client Configuration

For MCP clients that support OAuth:

```json
{
  "mcpServers": {
    "morning-brief": {
      "url": "https://morning-brief-connector.reinier-olivier.workers.dev/mcp",
      "transport": "http",
      "oauth": {
        "authorizationEndpoint": "https://morning-brief-connector.reinier-olivier.workers.dev/authorize",
        "tokenEndpoint": "https://morning-brief-connector.reinier-olivier.workers.dev/oauth/token",
        "scopes": ["mcp:read"]
      }
    }
  }
}
```

---

## Testing OAuth Flow

### 1. Test OAuth Discovery

```bash
# Protected resource metadata
curl https://morning-brief-connector.reinier-olivier.workers.dev/.well-known/oauth-protected-resource

# Authorization server metadata
curl https://morning-brief-connector.reinier-olivier.workers.dev/.well-known/oauth-authorization-server
```

### 2. Test Authorization Endpoint

Open in browser:
```
https://morning-brief-connector.reinier-olivier.workers.dev/authorize?client_id=test&redirect_uri=http://localhost&response_type=code&state=test123&code_challenge=test&code_challenge_method=S256
```

You should see the authorization approval page.

### 3. Test MCP Endpoint (Unauthenticated)

```bash
curl -X POST https://morning-brief-connector.reinier-olivier.workers.dev/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize"}'
```

Should return:
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "error": {
    "code": -32600,
    "message": "Authentication required"
  }
}
```

---

## Single-User Authorization

The authorization page (`/authorize`) is configured for single-user access:

1. When ChatGPT initiates OAuth, you'll be redirected to `/authorize`
2. You'll see an approval page showing:
   - Client ID
   - Requested permissions (read morning brief, access emails/calendar)
3. Click **Approve** to grant access
4. ChatGPT receives an authorization code
5. ChatGPT exchanges the code for an access token
6. ChatGPT can now call the `get_morning_brief` tool

**Security:** Only you can approve access. The OAuth flow requires your explicit approval each time a new client connects.

---

## Available MCP Tools

### get_morning_brief

**Description:** Retrieve Reinier's current Morning Intelligence Brief, including email and calendar information.

**Required Scope:** `mcp:read`

**Input:** None

**Output:** Full morning brief data (same as REST `/brief` endpoint)

---

## Architecture

```
ChatGPT
   |
   | OAuth 2.1 Flow
   | (PKCE + S256)
   v
/authorize → User approves → Authorization code
   |
   v
/oauth/token → Exchange code → Access token
   |
   v
/mcp (with Bearer token)
   |
   | Validates OAuth token
   | Checks scopes
   v
BriefHandler → D1 Database
   |
   v
Return morning brief data
```

**Key Points:**
- OAuth layer authenticates ChatGPT ↔ Worker
- Microsoft OAuth layer (unchanged) authenticates Worker ↔ Microsoft
- REST endpoints continue using Bearer token (separate auth)

---

## Troubleshooting

### OAuth KV Not Bound Error

If you see:
```
OAuth KV namespace not configured
```

**Solution:** Re-deploy after verifying `wrangler.jsonc` contains:
```json
"kv_namespaces": [
  {
    "binding": "OAUTH_KV",
    "id": "f82dd95f5a4a41488fd339a58b6d127b"
  }
]
```

### REST Endpoints Not Working

REST endpoints should still work with Bearer token. Test:
```bash
curl https://morning-brief-connector.reinier-olivier.workers.dev/health
curl -H "Authorization: Bearer 716180e24c87de8b699efd32198adbd9" \
  https://morning-brief-connector.reinier-olivier.workers.dev/brief
```

If these fail, the deployment has an issue. Check Cloudflare Worker logs.

### Authorization Page Not Showing

Ensure you're accessing `/authorize` with required query parameters:
- `client_id`
- `redirect_uri`
- `state`
- `code_challenge`
- `response_type=code`

ChatGPT will provide these automatically during OAuth flow.

---

## Next Steps

1. **Deploy:**
   ```bash
   npm run deploy
   ```

2. **Test Discovery:**
   ```bash
   curl https://morning-brief-connector.reinier-olivier.workers.dev/.well-known/oauth-authorization-server
   ```

3. **Configure ChatGPT:**
   - Create Custom GPT with OAuth authentication
   - Use the authorization and token URLs above
   - Scope: `mcp:read`

4. **Approve Connection:**
   - ChatGPT will redirect you to `/authorize`
   - Click "Approve" to grant access
   - ChatGPT can now call `get_morning_brief`

---

## Security Notes

### What's Protected by OAuth
- ✅ MCP endpoint (`/mcp`)
- ✅ OAuth token endpoint (`/oauth/token`)
- ✅ Authorization approval required for each client

### What's Protected by Bearer Token
- ✅ REST endpoints (`/brief`, `/calendar`, `/drafts`)
- ✅ Separate from OAuth (unchanged)

### What's Never Exposed
- ❌ `CONNECTOR_API_TOKEN` (REST authentication)
- ❌ Microsoft access tokens
- ❌ Microsoft refresh tokens
- ❌ Microsoft `CLIENT_SECRET`
- ❌ OAuth authorization codes (single-use)

### OAuth State Storage
- OAuth tokens, codes, and client registrations stored in KV namespace
- Tokens stored as hashes (not plaintext)
- Automatic expiration and cleanup

---

## Support

**Documentation:**
- This file: `OAUTH-MCP-SETUP.md`
- MCP Integration: `MCP-INTEGRATION.md`
- Deployment: `DEPLOYMENT.md`
- API Reference: `API.md`

**Testing:**
- REST endpoints: `.\test-api.ps1`
- Health check: `GET /health`

**Logs:**
- Cloudflare Dashboard → Workers → morning-brief-connector → Logs

---

**OAuth 2.1 MCP Ready for Production** ✅
