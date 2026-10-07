/**
 * MCP OAuth Handler - OAuth 2.1 Protected MCP Endpoint
 * 
 * Provides OAuth 2.1 authentication for the MCP endpoint using
 * @cloudflare/workers-oauth-provider while keeping REST endpoints unchanged.
 */

import { OAuthProvider } from '@cloudflare/workers-oauth-provider';
import { Environment } from '../index';
import { BriefHandler } from '../api/brief';
import { buildGetMyMailPage } from './export-json-page';

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

  // GetMyMail - unified daily sync page (also handles /export-json for backwards compat)
  if (url.pathname === '/getmymail' || url.pathname === '/export-json') {
    return new Response(buildGetMyMailPage(url.origin), {
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
  <h1>Ã°Å¸Å’â€¦ Morning Brief Connector</h1>
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
    ? '<p class="warning"><strong>Ã¢Å¡Â Ã¯Â¸Â This sends access to an app on your computer.</strong> Continue only if you just started signing in from it.</p>'
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
    <h1>Ã°Å¸Å’â€¦ Allow ${name} to access your Morning Brief?</h1>
    
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
        Ã¢Å“â€¦ <strong>Single-user system</strong> - Reinier's private Morning Brief connector
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
    <h1>Ã¢ÂÅ’ Authorization Error</h1>
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
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Morning Brief</title>
<style>
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#0f172a;color:#e2e8f0;min-height:100vh}
a{color:inherit;text-decoration:none}
/* header */
header{background:linear-gradient(135deg,#1e3a5f,#0f172a);padding:20px 28px;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid #1e293b}
.h-left h1{font-size:1.4rem;font-weight:700;color:#f8fafc}
.h-left p{font-size:.8rem;color:#94a3b8;margin-top:2px}
.h-right{display:flex;gap:10px;align-items:center}
/* buttons */
.btn{border:none;padding:9px 18px;border-radius:8px;font-size:.84rem;font-weight:600;cursor:pointer;display:inline-flex;align-items:center;gap:6px;transition:filter .15s}
.btn:hover{filter:brightness(1.15)}
.btn:disabled{opacity:.4;cursor:not-allowed}
.btn-blue{background:#2563eb;color:#fff}
.btn-green{background:#16a34a;color:#fff}
/* status dot */
.dot{width:8px;height:8px;border-radius:50%;display:inline-block}
.dot-green{background:#22c55e;box-shadow:0 0 6px #22c55e}
.dot-grey{background:#475569}
.dot-orange{background:#f97316;box-shadow:0 0 6px #f97316}
/* layout */
main{max-width:1200px;margin:0 auto;padding:24px 20px;display:grid;grid-template-columns:1fr 370px;gap:20px}
@media(max-width:820px){main{grid-template-columns:1fr}}
/* stats */
.stats{grid-column:1/-1;display:grid;grid-template-columns:repeat(3,1fr);gap:14px}
.stat{background:#1e293b;border:1px solid #334155;border-radius:10px;padding:16px 20px}
.stat-lbl{font-size:.72rem;color:#64748b;font-weight:700;text-transform:uppercase;letter-spacing:.05em}
.stat-val{font-size:2rem;font-weight:800;color:#f1f5f9;line-height:1.1;margin-top:4px}
.stat-sub{font-size:.73rem;color:#475569;margin-top:2px}
/* card */
.card{background:#1e293b;border:1px solid #334155;border-radius:12px;overflow:hidden;margin-bottom:18px}
.card:last-child{margin-bottom:0}
.card-hdr{padding:14px 18px;border-bottom:1px solid #334155;display:flex;align-items:center;justify-content:space-between}
.card-title{font-size:.88rem;font-weight:700;color:#f1f5f9;display:flex;align-items:center;gap:8px}
.badge{background:#334155;color:#94a3b8;font-size:.7rem;font-weight:700;padding:2px 8px;border-radius:20px}
.badge-blue{background:#1e3a5f;color:#60a5fa}
/* section label */
.sec-lbl{font-size:.7rem;font-weight:700;color:#475569;text-transform:uppercase;letter-spacing:.07em;padding:7px 18px;background:#162032;border-bottom:1px solid #1e293b}
/* email row */
.e-row{padding:13px 18px;border-bottom:1px solid #1e293b;display:flex;gap:12px;align-items:flex-start;transition:background .15s;cursor:pointer}
.e-row:last-child{border-bottom:none}
.e-row:hover{background:#243447}
.avatar{width:34px;height:34px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:.82rem;font-weight:700;flex-shrink:0;color:#fff}
.u-dot{width:7px;height:7px;border-radius:50%;background:#3b82f6;flex-shrink:0;margin-top:5px}
.u-dot-empty{width:7px;flex-shrink:0}
.e-body{flex:1;min-width:0}
.e-from{font-size:.8rem;font-weight:600;color:#cbd5e1;display:flex;justify-content:space-between}
.e-time{font-size:.73rem;color:#475569;font-weight:400}
.e-subj{font-size:.87rem;color:#f1f5f9;font-weight:500;margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.e-prev{font-size:.76rem;color:#64748b;margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
/* event row */
.ev-row{padding:13px 18px;border-bottom:1px solid #1e293b;display:flex;gap:12px;align-items:flex-start}
.ev-row:last-child{border-bottom:none}
.time-blk{background:#0f172a;border-radius:8px;padding:5px 9px;text-align:center;min-width:50px;flex-shrink:0}
.time-h{font-size:.95rem;font-weight:700;color:#60a5fa;line-height:1}
.time-m{font-size:.68rem;color:#475569}
.ev-body{flex:1;min-width:0}
.ev-title{font-size:.87rem;font-weight:600;color:#f1f5f9}
.ev-meta{font-size:.75rem;color:#64748b;margin-top:3px}
.ev-tag{display:inline-block;font-size:.68rem;font-weight:600;padding:1px 6px;border-radius:4px;margin-top:4px}
.tag-today{background:#1e3a5f;color:#60a5fa}
.tag-up{background:#1c2d1e;color:#4ade80}
/* empty */
.empty{padding:28px 18px;text-align:center;color:#475569;font-size:.84rem}
/* spinner */
.spin{display:inline-block;width:13px;height:13px;border:2px solid transparent;border-top-color:currentColor;border-radius:50%;animation:sp .7s linear infinite}
@keyframes sp{to{transform:rotate(360deg)}}
/* toast */
#toast{position:fixed;bottom:20px;right:20px;background:#0f172a;border:1px solid #334155;border-radius:8px;padding:11px 16px;font-size:.82rem;color:#e2e8f0;transform:translateY(60px);opacity:0;transition:all .25s;z-index:99}
#toast.show{transform:translateY(0);opacity:1}
#toast.ok{border-color:#22c55e}
#toast.err{border-color:#ef4444}
</style>
</head>
<body>

<header>
  <div class="h-left">
    <h1>Ã°Å¸Å’â€¦ Morning Brief</h1>
    <p id="hSub">LoadingÃ¢â‚¬Â¦</p>
  </div>
  <div class="h-right">
    <span id="hDot"><span class="dot dot-grey"></span></span>
    <button id="syncBtn" class="btn btn-blue" disabled>
      <span class="spin" id="spn" style="display:none"></span>
      Ã¢â€ Â» Sync &amp; Refresh
    </button>
  </div>
</header>

<main>
  <div class="stats">
    <div class="stat"><div class="stat-lbl">Unread</div><div class="stat-val" id="sUnread">Ã¢â‚¬â€</div><div class="stat-sub">emails</div></div>
    <div class="stat"><div class="stat-lbl">Today</div><div class="stat-val" id="sToday">Ã¢â‚¬â€</div><div class="stat-sub">calendar events</div></div>
    <div class="stat"><div class="stat-lbl">Upcoming</div><div class="stat-val" id="sUp">Ã¢â‚¬â€</div><div class="stat-sub">next 7 days</div></div>
  </div>

  <!-- emails column -->
  <div>
    <div class="card">
      <div class="card-hdr">
        <span class="card-title">Ã°Å¸â€œÂ§ Important &amp; Unread <span class="badge badge-blue" id="cImp">0</span></span>
      </div>
      <div id="impList"><div class="empty">LoadingÃ¢â‚¬Â¦</div></div>
    </div>
    <div class="card">
      <div class="card-hdr">
        <span class="card-title">Ã°Å¸â€œÂ° Newsletters &amp; Marketing <span class="badge" id="cMkt">0</span></span>
      </div>
      <div id="mktList"><div class="empty">LoadingÃ¢â‚¬Â¦</div></div>
    </div>
  </div>

  <!-- calendar column -->
  <div>
    <div class="card">
      <div class="card-hdr"><span class="card-title">Ã°Å¸â€œâ€¦ Calendar</span></div>
      <div id="calList"><div class="empty">LoadingÃ¢â‚¬Â¦</div></div>
    </div>
  </div>
</main>

<div id="toast"></div>

<script>
(function(){
const BASE = '${baseUrl}';
const TOKEN = '716180e24c87de8b699efd32198adbd9';

// Ã¢â€â‚¬Ã¢â€â‚¬ colours for avatars Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
const COLS=['#6366f1','#ec4899','#14b8a6','#f59e0b','#8b5cf6','#06b6d4','#10b981','#ef4444'];
function aCol(s){let h=0;for(let i=0;i<s.length;i++)h=s.charCodeAt(i)+((h<<5)-h);return COLS[Math.abs(h)%COLS.length]}
function aInit(n){if(!n)return'?';const p=n.split(' ').filter(Boolean);return p.length>=2?(p[0][0]+p[p.length-1][0]).toUpperCase():n.slice(0,2).toUpperCase()}
function ago(iso){const d=Date.now()-new Date(iso).getTime(),m=Math.floor(d/60000),h=Math.floor(m/60),dy=Math.floor(h/24);return m<60?m+'m':h<24?h+'h':dy+'d'}
function sast(iso){const d=new Date(new Date(iso).getTime()+2*3600000);return d.getUTCHours().toString().padStart(2,'0')+':'+d.getUTCMinutes().toString().padStart(2,'0')}
function dFmt(iso){return new Date(iso).toLocaleDateString('en-ZA',{weekday:'short',month:'short',day:'numeric',timeZone:'Africa/Johannesburg'})}
function isToday(iso){const a=new Date(iso),b=new Date();return a.getUTCFullYear()===b.getUTCFullYear()&&a.getUTCMonth()===b.getUTCMonth()&&a.getUTCDate()===b.getUTCDate()}
function esc(s){return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')}

function emailHtml(m){
  const name=m.sender_name||m.sender_email||'?';
  return \`<a href="\${esc(m.web_link||'#')}" target="_blank">
  <div class="e-row">
    \${m.is_read?'<div class="u-dot-empty"></div>':'<div class="u-dot"></div>'}
    <div class="avatar" style="background:\${aCol(name)}">\${esc(aInit(name))}</div>
    <div class="e-body">
      <div class="e-from"><span>\${esc(name)}</span><span class="e-time">\${ago(m.received_at)}</span></div>
      <div class="e-subj">\${esc(m.subject||'(no subject)')}</div>
      <div class="e-prev">\${esc((m.body_preview||'').slice(0,110))}</div>
    </div>
  </div></a>\`}

function eventHtml(e,today){
  const t=sast(e.start_at);
  const [h,mn]=t.split(':');
  return \`<div class="ev-row">
  <div class="time-blk"><div class="time-h">\${h}:\${mn}</div><div class="time-m">SAST</div></div>
  <div class="ev-body">
    <div class="ev-title">\${esc(e.subject||'(no title)')}</div>
    <div class="ev-meta">\${e.location?'Ã°Å¸â€œÂ '+esc(e.location)+' Ã‚Â· ':''}\${today?'Today':esc(dFmt(e.start_at))}</div>
    <span class="ev-tag \${today?'tag-today':'tag-up'}">\${today?'Today':'Upcoming'}</span>
  </div></div>\`}

// Ã¢â€â‚¬Ã¢â€â‚¬ API calls Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
async function apiBrief(){
  const r=await fetch(BASE+'/brief',{headers:{Authorization:'Bearer '+TOKEN}});
  if(!r.ok)throw new Error('brief '+r.status);
  return r.json()}

async function apiSync(){
  const r=await fetch(BASE+'/sync',{method:'POST',headers:{Authorization:'Bearer '+TOKEN}});
  return r.json()}

// Ã¢â€â‚¬Ã¢â€â‚¬ Render Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
async function load(){
  busy(true);
  try{
    const d=await apiBrief();

    document.getElementById('sUnread').textContent=d.emails.unread_count??0;
    document.getElementById('sToday').textContent=d.calendar.today_events.length;
    document.getElementById('sUp').textContent=d.calendar.upcoming_events.length;

    const cls=d.status==='complete'?'dot-green':'dot-orange';
    document.getElementById('hDot').innerHTML=\`<span class="dot \${cls}"></span>\`;

    document.getElementById('hSub').textContent=new Date().toLocaleString('en-ZA',
      {weekday:'long',day:'numeric',month:'long',hour:'2-digit',minute:'2-digit',timeZone:'Africa/Johannesburg'});

    const imp=d.emails.important_messages||[];
    document.getElementById('cImp').textContent=imp.length;
    document.getElementById('impList').innerHTML=imp.length?imp.map(emailHtml).join(''):'<div class="empty">No important emails</div>';

    const mkt=d.emails.marketing_messages||[];
    document.getElementById('cMkt').textContent=mkt.length;
    document.getElementById('mktList').innerHTML=mkt.length?mkt.map(emailHtml).join(''):'<div class="empty">No newsletters today</div>';

    const te=d.calendar.today_events||[], ue=d.calendar.upcoming_events||[];
    let cal='';
    if(te.length) cal+='<div class="sec-lbl">Today</div>'+te.map(e=>eventHtml(e,true)).join('');
    if(ue.length) cal+='<div class="sec-lbl">Coming up</div>'+ue.map(e=>eventHtml(e,false)).join('');
    document.getElementById('calList').innerHTML=cal||'<div class="empty">No upcoming events</div>';

    toast('Ã¢Å“â€œ Loaded',false);
  }catch(e){toast('Error: '+e.message,true)}
  finally{busy(false)}}

document.getElementById('syncBtn').addEventListener('click',async()=>{
  busy(true);toast('Syncing from GmailÃ¢â‚¬Â¦',false);
  try{await apiSync();await load()}
  catch(e){toast('Sync failed: '+e.message,true);busy(false)}});

function busy(on){
  document.getElementById('spn').style.display=on?'inline-block':'none';
  document.getElementById('syncBtn').disabled=on}

let toastTimer;
function toast(msg,err){
  const el=document.getElementById('toast');
  el.textContent=msg;el.className='show '+(err?'err':'ok');
  clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.className='',3000)}

// boot
load();
})();
</script>
</body>
</html>`
}
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
