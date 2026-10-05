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
 * Extended Environment with OAuth KV binding and OAuth API
 */
export interface OAuthEnvironment extends Environment {
  OAUTH_KV: KVNamespace;
  OAUTH_PROVIDER?: any; // OAuthProvider exposes helpers here
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
  env: OAuthEnvironment,
  _ctx: ExecutionContext
): Promise<Response> {
  const url = new URL(request.url);

  // Authorization endpoint - handle consent
  if (url.pathname === '/authorize') {
    return handleAuthorizeConsent(request, env);
  }

  // Client ID Metadata Document (CIMD) - serve at both paths
  if (url.pathname === '/test-oauth-client' || 
      url.pathname === '/test-oauth-client/.well-known/oauth-client') {
    return new Response(
      JSON.stringify({
        client_id: `${url.origin}/test-oauth-client`,
        client_name: 'Morning Brief OAuth Test',
        redirect_uris: [`${url.origin}/test-oauth`],
        grant_types: ['authorization_code', 'refresh_token'],
        response_types: ['code'],
        token_endpoint_auth_method: 'none',
        token_endpoint_auth_methods_supported: ['none'],
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Cache-Control': 'public, max-age=3600',
        },
      }
    );
  }

  // OAuth test page
  if (url.pathname === '/test-oauth') {
    return new Response(buildOAuthTestPage(url.origin), {
      status: 200,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  }

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
  <p><a href="/test-oauth">Test OAuth 2.1 Flow (Interactive)</a></p>
  <p><a href="/morning-brief-simple.html">Open Simple Web App (Bearer Token)</a></p>

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
 * Handle authorization consent flow
 * Single-user system: auto-approve all requests after showing brief confirmation
 */
async function handleAuthorizeConsent(
  request: Request,
  env: OAuthEnvironment
): Promise<Response> {
  try {
    // Get OAuth API from the provider
    const oauth = env.OAUTH_PROVIDER;
    if (!oauth) {
      return new Response('OAuth provider not available', { status: 500 });
    }

    // GET: Show consent page
    if (request.method === 'GET') {
      // Parse and validate the authorization request
      const authRequest = await oauth.parseAuthRequest(request);
      
      // Get client details for the consent page
      const details = await oauth.describeConsent(authRequest);
      
      // Begin consent (creates secure handle)
      const consent = await oauth.beginConsent(authRequest);
      
      // Build consent page
      const html = buildConsentPage(details, consent.handle);
      
      consent.headers.set('Content-Type', 'text/html; charset=utf-8');
      return new Response(html, { headers: consent.headers });
    }

    // POST: Handle approval/denial
    if (request.method === 'POST') {
      const form = await request.formData();
      const handle = String(form.get('handle') || '');
      const decision = String(form.get('decision') || '');

      // Deny
      if (decision === 'deny') {
        const denied = await oauth.denyConsent(request, handle);
        return new Response(null, { status: 302, headers: denied.headers });
      }

      // Approve
      if (decision === 'approve') {
        const approved = await oauth.approveConsent(request, handle, {
          scope: form.getAll('scope').map(String),
        });

        // Complete authorization (single-user: userId is always 'reinier')
        const { redirectTo } = await oauth.completeAuthorization({
          request: approved.request,
          userId: 'reinier', // Single user system
          metadata: {},
          scope: approved.request.scope,
          props: { userId: 'reinier' }, // Available in ctx.props
        });

        approved.headers.set('Location', redirectTo);
        return new Response(null, { status: 302, headers: approved.headers });
      }

      return new Response('Invalid decision', { status: 400 });
    }

    return new Response('Method not allowed', { status: 405 });
    
  } catch (error: any) {
    console.error('Authorization error:', error);
    
    // Handle AuthorizationError with redirect
    if (error.redirectTo) {
      return Response.redirect(error.redirectTo, 302);
    }
    
    // Show error page
    const message = error.description || error.message || 'Authorization failed';
    return new Response(
      buildErrorPage(escapeHtml(message)),
      { 
        status: 400, 
        headers: { 'Content-Type': 'text/html; charset=utf-8' } 
      }
    );
  }
}

/**
 * Build consent page HTML
 */
function buildConsentPage(details: any, handle: string): string {
  const name = escapeHtml(details.clientName || 'Unknown Client');
  const origin = details.clientDomain
    ? `Published by <strong>${escapeHtml(details.clientDomain)}</strong>.`
    : 'This app registered itself; its name is not verified.';
  
  const scopes = details.scope
    .map((scope: string) => 
      `<label><input type="checkbox" name="scope" value="${escapeHtml(scope)}" checked> ${escapeHtml(scope)}</label>`
    )
    .join('<br>');

  const loopbackWarning = details.redirectIsLoopback
    ? '<p class="warning"><strong>⚠️ This sends access to an app on your computer.</strong> Continue only if you just started signing in from it.</p>'
    : '';

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Authorize ${name}</title>
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
    .app-info { 
      background: #f0f9ff; 
      padding: 15px; 
      border-radius: 5px; 
      margin: 20px 0;
      border-left: 4px solid #3b82f6;
    }
    .permissions { margin: 20px 0; }
    .permissions label { display: block; padding: 8px 0; }
    .warning {
      background: #fff3cd;
      padding: 15px;
      border-radius: 5px;
      margin: 20px 0;
      border-left: 4px solid #ffc107;
    }
    .buttons { margin-top: 30px; display: flex; gap: 10px; }
    button {
      padding: 12px 24px;
      border: none;
      border-radius: 5px;
      font-size: 16px;
      cursor: pointer;
      font-weight: 500;
    }
    button[name="decision"][value="approve"] {
      background: #10b981;
      color: white;
      flex: 1;
    }
    button[name="decision"][value="deny"] {
      background: #ef4444;
      color: white;
    }
    .auto-note {
      background: #f0fdf4;
      padding: 12px;
      border-radius: 5px;
      margin: 15px 0;
      border-left: 4px solid #10b981;
      font-size: 14px;
    }
  </style>
</head>
<body>
  <div class="card">
    <h1>🌅 Allow ${name} to access your Morning Brief?</h1>
    
    <div class="app-info">
      <p>${origin}</p>
      <p>Access will be sent to <strong>${escapeHtml(details.redirectHost)}</strong>.</p>
    </div>

    ${loopbackWarning}

    <form method="POST">
      <input type="hidden" name="handle" value="${escapeHtml(handle)}">
      
      <div class="permissions">
        <h3>Permissions requested:</h3>
        ${scopes}
      </div>

      <div class="auto-note">
        ✅ <strong>Single-user system</strong> - Reinier's private Morning Brief connector
      </div>

      <div class="buttons">
        <button type="submit" name="decision" value="approve">Allow Access</button>
        <button type="submit" name="decision" value="deny">Deny</button>
      </div>
    </form>
  </div>
</body>
</html>`;
}

/**
 * Build error page HTML
 */
function buildErrorPage(message: string): string {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Authorization Error</title>
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
    .error {
      background: #fee;
      padding: 15px;
      border-radius: 5px;
      border-left: 4px solid #f44;
      margin: 20px 0;
    }
  </style>
</head>
<body>
  <div class="card">
    <h1>❌ Authorization Error</h1>
    <div class="error">
      <p>${message}</p>
    </div>
    <p><a href="/">Return to home</a></p>
  </div>
</body>
</html>`;
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
 * Build OAuth test page
 */
function buildOAuthTestPage(baseUrl: string): string {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>OAuth 2.1 Flow Test - Morning Brief Connector</title>
  <style>
    body {
      font-family: system-ui, sans-serif;
      max-width: 800px;
      margin: 50px auto;
      padding: 20px;
      background: #f5f5f5;
    }
    .card {
      background: white;
      padding: 30px;
      border-radius: 8px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
      margin-bottom: 20px;
    }
    h1 { margin-top: 0; }
    button {
      background: #3b82f6;
      color: white;
      padding: 12px 24px;
      border: none;
      border-radius: 5px;
      font-size: 16px;
      cursor: pointer;
      font-weight: 500;
    }
    button:hover {
      background: #2563eb;
    }
    button:disabled {
      background: #9ca3af;
      cursor: not-allowed;
    }
    .output {
      background: #f9fafb;
      padding: 15px;
      border-radius: 5px;
      font-family: monospace;
      font-size: 14px;
      overflow-x: auto;
      margin-top: 15px;
      max-height: 400px;
      overflow-y: auto;
    }
    .success {
      background: #f0fdf4;
      border-left: 4px solid #10b981;
    }
    .error {
      background: #fef2f2;
      border-left: 4px solid #ef4444;
    }
    .step {
      margin: 15px 0;
      padding: 10px;
      border-radius: 5px;
    }
    .step-title {
      font-weight: bold;
      margin-bottom: 10px;
    }
  </style>
</head>
<body>
  <div class="card">
    <h1>🌅 OAuth 2.1 Flow Test</h1>
    <p>Test the OAuth 2.1 + PKCE flow for the Morning Brief Connector MCP server</p>
    
    <div class="step">
      <div class="step-title">Step 1: Start Authorization</div>
      <p>Click the button below to start the OAuth 2.1 authorization flow with PKCE.</p>
      <button id="startAuth">Start Authorization</button>
    </div>

    <div class="step">
      <div class="step-title">Step 2: After Authorization</div>
      <p>After authorization, you'll be redirected back here with an authorization code.</p>
      <button id="exchangeToken" disabled>Exchange Token</button>
    </div>

    <div class="step">
      <div class="step-title">Step 3: Call MCP Endpoint</div>
      <p>Use the access token to call the MCP endpoint.</p>
      <button id="callMcp" disabled>Call get_morning_brief</button>
    </div>

    <div id="output" class="output" style="display: none;"></div>
  </div>

  <script>
    const BASE_URL = '${baseUrl}';
    const REDIRECT_URI = BASE_URL + '/test-oauth';
    const CLIENT_ID = BASE_URL + '/test-oauth-client'; // CIMD client

    let state = {
      codeVerifier: null,
      codeChallenge: null,
      authState: null,
      authorizationCode: null,
      accessToken: null,
      refreshToken: null
    };

    const saved = localStorage.getItem('oauthState');
    if (saved) {
      state = JSON.parse(saved);
    }

    function saveState() {
      localStorage.setItem('oauthState', JSON.stringify(state));
    }

    function log(message, isError = false) {
      const output = document.getElementById('output');
      output.style.display = 'block';
      output.className = 'output ' + (isError ? 'error' : 'success');
      output.textContent = message;
    }

    function generateRandomString(length) {
      const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
      const values = crypto.getRandomValues(new Uint8Array(length));
      return Array.from(values).map(x => possible[x % possible.length]).join('');
    }

    async function generateCodeChallenge(codeVerifier) {
      const encoder = new TextEncoder();
      const data = encoder.encode(codeVerifier);
      const hash = await crypto.subtle.digest('SHA-256', data);
      const base64 = btoa(String.fromCharCode(...new Uint8Array(hash)));
      return base64.replace(/\\+/g, '-').replace(/\\//g, '_').replace(/=/g, '');
    }

    document.getElementById('startAuth').addEventListener('click', async () => {
      try {
        state.codeVerifier = generateRandomString(128);
        state.codeChallenge = await generateCodeChallenge(state.codeVerifier);
        state.authState = generateRandomString(32);
        saveState();

        const params = new URLSearchParams({
          client_id: CLIENT_ID,
          response_type: 'code',
          redirect_uri: REDIRECT_URI,
          scope: 'mcp:read offline_access',
          state: state.authState,
          code_challenge: state.codeChallenge,
          code_challenge_method: 'S256'
        });

        const authUrl = BASE_URL + '/authorize?' + params;
        log('Starting authorization flow...\\nRedirecting to: ' + authUrl);
        
        setTimeout(() => {
          window.location.href = authUrl;
        }, 1000);
        
      } catch (error) {
        log('Error: ' + error.message, true);
      }
    });

    document.getElementById('exchangeToken').addEventListener('click', async () => {
      try {
        log('Exchanging authorization code for access token...');

        const body = new URLSearchParams({
          grant_type: 'authorization_code',
          code: state.authorizationCode,
          redirect_uri: REDIRECT_URI,
          client_id: CLIENT_ID,
          code_verifier: state.codeVerifier
        });

        const response = await fetch(BASE_URL + '/oauth/token', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
          },
          body: body.toString()
        });

        const data = await response.json();
        
        if (response.ok) {
          state.accessToken = data.access_token;
          state.refreshToken = data.refresh_token;
          saveState();
          
          document.getElementById('callMcp').disabled = false;
          log('✅ Token received!\\n\\nAccess Token: ' + data.access_token.substring(0, 20) + '...\\nRefresh Token: ' + (data.refresh_token ? data.refresh_token.substring(0, 20) + '...' : 'none') + '\\nExpires in: ' + data.expires_in + 's\\nScopes: ' + data.scope);
        } else {
          log('❌ Token exchange failed:\\n' + JSON.stringify(data, null, 2), true);
        }
        
      } catch (error) {
        log('Error: ' + error.message, true);
      }
    });

    document.getElementById('callMcp').addEventListener('click', async () => {
      try {
        log('Calling MCP endpoint: get_morning_brief...');

        const response = await fetch(BASE_URL + '/mcp', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + state.accessToken
          },
          body: JSON.stringify({
            jsonrpc: '2.0',
            method: 'tools/call',
            params: {
              name: 'get_morning_brief',
              arguments: {}
            },
            id: 1
          })
        });

        const data = await response.json();
        
        if (response.ok && !data.error) {
          log('✅ MCP call successful!\\n\\n' + JSON.stringify(data, null, 2));
        } else {
          log('❌ MCP call failed:\\n' + JSON.stringify(data, null, 2), true);
        }
        
      } catch (error) {
        log('Error: ' + error.message, true);
      }
    });

    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    const returnedState = urlParams.get('state');
    const error = urlParams.get('error');
    const errorDescription = urlParams.get('error_description');

    if (error) {
      log('❌ Authorization error: ' + error + '\\n' + (errorDescription || ''), true);
    } else if (code && returnedState) {
      if (returnedState !== state.authState) {
        log('❌ State mismatch! Possible CSRF attack.', true);
      } else {
        state.authorizationCode = code;
        saveState();
        document.getElementById('exchangeToken').disabled = false;
        log('✅ Authorization code received!\\n\\nCode: ' + code.substring(0, 20) + '...');
        
        window.history.replaceState({}, document.title, window.location.pathname);
      }
    }

    if (state.accessToken) {
      document.getElementById('callMcp').disabled = false;
    }
  </script>
</body>
</html>`;
}

/**
 * Create OAuth-protected MCP handler
 */
export function createOAuthMcpHandler(baseUrl: string): any {
  return new OAuthProvider<OAuthEnvironment>({
    // OAuth endpoints
    authorizeEndpoint: '/authorize',
    tokenEndpoint: '/oauth/token',
    
    // MCP API route
    apiRoute: '/mcp',
    apiHandler: {
      fetch: mcpApiHandler,
    },
    
    // Default handler for non-OAuth routes
    defaultHandler: {
      fetch: defaultHandler,
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
    
    // Enable CIMD with proper compatibility settings (requires 2024-11-11+ and global_fetch_strictly_public)
    clientIdMetadataDocumentEnabled: true,
    
    // Removed pre-registered clients - using CIMD instead
  });
}
