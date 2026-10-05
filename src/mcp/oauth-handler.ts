/**
 * MCP OAuth Handler - OAuth 2.1 Protected MCP Endpoint
 * 
 * Provides OAuth 2.1 authentication for the MCP endpoint using
 * @cloudflare/workers-oauth-provider while keeping REST endpoints unchanged.
 */

import { OAuthProvider } from '@cloudflare/workers-oauth-provider';
import { Environment } from '../index';
import { BriefHandler } from '../api/brief';

/**
 * Extended Environment with OAuth KV binding
 */
export interface OAuthEnvironment extends Environment {
  OAUTH_KV: KVNamespace;
}

/**
 * MCP API Handler - Handles authenticated MCP requests
 */
async function mcpApiHandler(
  request: Request,
  env: OAuthEnvironment,
  ctx: any
): Promise<Response> {
  // Handle CORS preflight
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    });
  }

  // Only accept POST for MCP
  if (request.method !== 'POST') {
    return jsonRpcError(null, -32600, 'Only POST method is supported');
  }

  // Parse JSON-RPC request
  let jsonRpcRequest: any;
  try {
    jsonRpcRequest = await request.json();
  } catch (error) {
    return jsonRpcError(null, -32700, 'Invalid JSON in request body');
  }

  // Validate JSON-RPC 2.0 structure
  if (jsonRpcRequest.jsonrpc !== '2.0') {
    return jsonRpcError(
      jsonRpcRequest.id ?? null,
      -32600,
      'Invalid JSON-RPC version. Expected 2.0'
    );
  }

  const { method, params, id } = jsonRpcRequest;

  // Route based on method
  switch (method) {
    case 'initialize':
      return jsonRpcSuccess(id, {
        protocolVersion: '2024-11-05',
        serverInfo: {
          name: 'morning-brief-connector',
          version: '1.0.0',
        },
        capabilities: {
          tools: {},
        },
      });

    case 'tools/list':
      return jsonRpcSuccess(id, {
        tools: [
          {
            name: 'get_morning_brief',
            description:
              "Retrieve Reinier's current Morning Intelligence Brief, including email and calendar information.",
            inputSchema: {
              type: 'object',
              properties: {},
              required: [],
            },
          },
        ],
      });

    case 'tools/call':
      return await handleToolCall(params, id, env, ctx);

    default:
      return jsonRpcError(id ?? null, -32601, `Method not found: ${method}`);
  }
}

/**
 * Handle tools/call method
 */
async function handleToolCall(
  params: any,
  id: string | number | null,
  env: OAuthEnvironment,
  ctx: any
): Promise<Response> {
  if (!params || typeof params !== 'object') {
    return jsonRpcError(id, -32602, 'Invalid params: must be an object');
  }

  const { name } = params;

  if (typeof name !== 'string') {
    return jsonRpcError(id, -32602, 'Invalid params: name must be a string');
  }

  // Verify required scope
  if (!ctx.auth?.scope.includes('mcp:read')) {
    return jsonRpcError(
      id,
      -32603,
      'Insufficient scope',
      { required: ['mcp:read'], have: ctx.auth?.scope || [] }
    );
  }

  // Route to tool implementation
  switch (name) {
    case 'get_morning_brief':
      return await callGetMorningBrief(id, env);

    default:
      return jsonRpcError(id, -32601, `Unknown tool: ${name}`);
  }
}

/**
 * Call get_morning_brief tool - reuses existing BriefHandler
 */
async function callGetMorningBrief(
  id: string | number | null,
  env: OAuthEnvironment
): Promise<Response> {
  try {
    const briefHandler = new BriefHandler(env);
    const briefResponse = await briefHandler.generateBrief();

    return jsonRpcSuccess(id, {
      content: [
        {
          type: 'text',
          text: JSON.stringify(briefResponse, null, 2),
        },
      ],
    });
  } catch (error) {
    return jsonRpcError(
      id,
      -32603,
      'Failed to generate morning brief',
      {
        error: error instanceof Error ? error.message : 'Unknown error',
      }
    );
  }
}

/**
 * JSON-RPC success response helper
 */
function jsonRpcSuccess(id: string | number | null, result: any): Response {
  return new Response(
    JSON.stringify({
      jsonrpc: '2.0',
      id,
      result,
    }),
    {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    }
  );
}

/**
 * JSON-RPC error response helper
 */
function jsonRpcError(
  id: string | number | null,
  code: number,
  message: string,
  data?: any
): Response {
  return new Response(
    JSON.stringify({
      jsonrpc: '2.0',
      id,
      error: {
        code,
        message,
        ...(data && { data }),
      },
    }),
    {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    }
  );
}

/**
 * Default handler - serves authorization page and other routes
 */
async function defaultHandler(
  request: Request,
  _env: OAuthEnvironment,
  _ctx: ExecutionContext
): Promise<Response> {
  const url = new URL(request.url);

  // Root page - information about the service
  if (url.pathname === '/') {
    return new Response(
      `
<!DOCTYPE html>
<html>
<head>
  <title>Morning Brief Connector - MCP Server</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 800px; margin: 50px auto; padding: 20px; }
    h1 { color: #333; }
    code { background: #f4f4f4; padding: 2px 6px; border-radius: 3px; }
    .info { background: #e7f3ff; padding: 15px; border-radius: 5px; margin: 20px 0; }
  </style>
</head>
<body>
  <h1>🌅 Morning Brief Connector</h1>
  <p>OAuth 2.1 Protected MCP Server for Reinier's Morning Intelligence Brief</p>
  
  <div class="info">
    <h2>MCP Endpoint</h2>
    <p><code>${url.origin}/mcp</code></p>
    <p>Protected by OAuth 2.1 with PKCE</p>
  </div>

  <h2>Available Tool</h2>
  <ul>
    <li><strong>get_morning_brief</strong> - Retrieve morning brief with emails and calendar</li>
  </ul>

  <h2>Authorization</h2>
  <p>Clients must complete OAuth 2.1 authorization flow before accessing tools.</p>
  <p>Authorization endpoint: <code>${url.origin}/authorize</code></p>
  <p>Token endpoint: <code>${url.origin}/oauth/token</code></p>

  <h2>Web Interface</h2>
  <p><a href="/morning-brief.html">Open Morning Brief Web App</a></p>

  <h2>Health Check</h2>
  <p><a href="/health">Check service health</a></p>
</body>
</html>
      `,
      {
        status: 200,
        headers: { 'Content-Type': 'text/html' },
      }
    );
  }

  // Not found
  return new Response('Not Found', { status: 404 });
}

/**
 * Handle authorization endpoint
 * 
 * Note: The actual authorization flow is handled by OAuthProvider.
 * This function is only called by the defaultHandler for non-OAuth paths.
 * The /authorize endpoint itself is intercepted by OAuthProvider before reaching here.
 */
async function handleAuthorize(
  request: Request,
  _env: OAuthEnvironment
): Promise<Response> {
  // This should not normally be reached since OAuthProvider handles /authorize
  return new Response(
    `
<!DOCTYPE html>
<html>
<head>
  <title>Authorization Handler</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 600px; margin: 50px auto; padding: 20px; }
    .info { background: #e7f3ff; padding: 15px; border-radius: 5px; }
  </style>
</head>
<body>
  <h1>OAuth Authorization</h1>
  <div class="info">
    <p>This endpoint is managed by the OAuth provider.</p>
    <p>If you're seeing this, the OAuth flow may not be configured correctly.</p>
  </div>
</body>
</html>
    `,
    { status: 200, headers: { 'Content-Type': 'text/html' } }
  );
}

/**
 * HTML escape helper
 */
function escapeHtml(unsafe: string): string {
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Create OAuth-protected MCP handler
 */
export function createOAuthMcpHandler(baseUrl: string): OAuthProvider<OAuthEnvironment> {
  const provider: OAuthProvider<OAuthEnvironment> = new OAuthProvider<OAuthEnvironment>({
    // OAuth endpoints
    authorizeEndpoint: '/authorize',
    tokenEndpoint: '/oauth/token',
    
    // MCP API route
    apiRoute: '/mcp',
    apiHandler: {
      fetch: mcpApiHandler,
    },
    
    // Default handler for other routes (including /authorize page)
    defaultHandler: {
      fetch: async (request: Request, env: OAuthEnvironment, ctx: ExecutionContext): Promise<Response> => {
        const url = new URL(request.url);
        
        // Handle authorization page
        if (url.pathname === '/authorize') {
          return handleAuthorizePage(request, env, provider);
        }
        
        // Handle other routes
        return defaultHandler(request, env, ctx);
      },
    },
    
    // OAuth configuration - these are the scopes this server can issue
    scopesSupported: ['mcp:read', 'mcp:write', 'offline_access'],
    
    // Required scopes for accessing the API
    requiredScopes: ['mcp:read'],
    
    // Resource metadata for MCP discovery (RFC 9728)
    resourceMetadata: {
      resource: `${baseUrl}/mcp`,
      authorization_servers: [baseUrl],
      bearer_methods_supported: ['header'],
    },
    
    // Enable dynamic client registration for MCP clients
    clientIdMetadataDocumentEnabled: true,
  });
  
  return provider;
}

/**
 * Handle authorization consent page
 */
async function handleAuthorizePage(
  request: Request,
  env: OAuthEnvironment,
  provider: OAuthProvider<OAuthEnvironment>
): Promise<Response> {
  const url = new URL(request.url);
  
  try {
    // Parse the authorization request using OAuth provider
    const authRequest = await provider.parseAuthorizationRequest(request, env);
    
    // If GET, show consent page
    if (request.method === 'GET') {
      return new Response(
        `
<!DOCTYPE html>
<html>
<head>
  <title>Authorize Morning Brief Connector</title>
  <style>
    body { 
      font-family: system-ui, sans-serif; 
      max-width: 600px; 
      margin: 50px auto; 
      padding: 20px;
      background: #f5f5f5;
    }
    .card {
      background: white;
      padding: 30px;
      border-radius: 8px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    h1 { margin-top: 0; color: #333; }
    .app-info { background: #f0f9ff; padding: 15px; border-radius: 5px; margin: 20px 0; }
    .permissions { margin: 20px 0; }
    .permissions ul { list-style: none; padding: 0; }
    .permissions li { padding: 8px 0; }
    .permissions li:before { content: "✓ "; color: #4caf50; font-weight: bold; }
    .buttons { margin-top: 30px; }
    button {
      padding: 12px 24px;
      font-size: 16px;
      border: none;
      border-radius: 5px;
      cursor: pointer;
      margin-right: 10px;
    }
    .btn-approve { background: #4caf50; color: white; }
    .btn-approve:hover { background: #45a049; }
    .btn-deny { background: #f44336; color: white; }
    .btn-deny:hover { background: #da190b; }
  </style>
</head>
<body>
  <div class="card">
    <h1>🌅 Morning Brief Connector</h1>
    <p>An application wants to access your Morning Brief</p>
    
    <div class="app-info">
      <strong>Client:</strong> ${escapeHtml(authRequest.clientId)}<br>
      <strong>Scopes:</strong> ${escapeHtml(authRequest.scope.join(', '))}
    </div>

    <div class="permissions">
      <h3>Requested Permissions:</h3>
      <ul>
        <li>Read your morning brief (emails and calendar)</li>
        <li>Access synced email metadata</li>
        <li>Access calendar events</li>
      </ul>
    </div>

    <form method="POST" action="${url.pathname}${url.search}">
      <div class="buttons">
        <button type="submit" name="action" value="approve" class="btn-approve">
          ✓ Approve
        </button>
        <button type="submit" name="action" value="deny" class="btn-deny">
          ✗ Deny
        </button>
      </div>
    </form>
  </div>
</body>
</html>
        `,
        { status: 200, headers: { 'Content-Type': 'text/html' } }
      );
    }
    
    // If POST, process approval/denial
    if (request.method === 'POST') {
      const formData = await request.formData();
      const action = formData.get('action');
      
      if (action === 'deny') {
        // User denied - return error
        return await provider.completeAuthorization(authRequest, env, {
          error: 'access_denied',
          error_description: 'User denied authorization'
        });
      }
      
      // User approved - complete authorization with user props
      return await provider.completeAuthorization(authRequest, env, {
        props: {
          userId: 'reinier',  // Single user system
          email: 'reinier@example.com',
          name: 'Reinier'
        }
      });
    }
    
    return new Response('Method not allowed', { status: 405 });
    
  } catch (error) {
    console.error('Authorization error:', error);
    return new Response(
      `
<!DOCTYPE html>
<html>
<head>
  <title>Authorization Error</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 600px; margin: 50px auto; padding: 20px; }
    .error { background: #ffe7e7; padding: 15px; border-radius: 5px; color: #c00; }
  </style>
</head>
<body>
  <h1>Authorization Error</h1>
  <div class="error">
    <p>${escapeHtml(error instanceof Error ? error.message : 'Unknown error')}</p>
  </div>
</body>
</html>
      `,
      { status: 400, headers: { 'Content-Type': 'text/html' } }
    );
  }
}
