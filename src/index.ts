/**
 * Morning Brief Connector - Main Entry Point
 *
 * Gmail + Google Calendar connector for Reinier's Morning Intelligence Brief.
 * Provides secure OAuth authentication, reliable data synchronization, and API endpoints.
 *
 * AUTHENTICATION:
 * - REST endpoints (/brief, /calendar, /drafts): Bearer token (CONNECTOR_API_TOKEN)
 * - MCP endpoint (/mcp): OAuth 2.1 with PKCE
 */

import { APIRouter } from './api/router';
import { SyncEngine } from './sync/sync-engine';
import { auditLog } from './database/audit';
import { createOAuthMcpHandler } from './mcp/oauth-handler';

/**
 * Cloudflare Workers Environment Interface
 */
export interface Environment {
  // D1 Database binding
  DB: D1Database;

  // Google OAuth secrets (managed via Cloudflare dashboard / wrangler secret put)
  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;

  // API access token for REST endpoints
  CONNECTOR_API_TOKEN: string;

  // HMAC secret for OAuth state parameter
  OAUTH_STATE_SECRET: string;

  // Static env var
  ENVIRONMENT: 'development' | 'staging' | 'production';

  // KV namespace for MCP OAuth 2.1 state
  OAUTH_KV?: KVNamespace;
}

// Create OAuth-protected MCP handler
const oauthMcpHandler = createOAuthMcpHandler(
  'https://morning-brief-connector.reinier-olivier.workers.dev',
);

export default {
  /**
   * Handle HTTP requests
   */
  async fetch(request: Request, env: Environment, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    // Route MCP and OAuth 2.1 discovery endpoints to the OAuth handler
    if (
      url.pathname === '/mcp' ||
      url.pathname === '/authorize' ||
      url.pathname === '/oauth/token' ||
      url.pathname === '/oauth/revoke' ||
      url.pathname === '/oauth/register' ||
      url.pathname === '/.well-known/oauth-protected-resource' ||
      url.pathname === '/.well-known/oauth-authorization-server' ||
      url.pathname === '/test-oauth' ||
      url.pathname === '/test-oauth-client' ||
      url.pathname === '/test-oauth-client/.well-known/oauth-client' ||
      url.pathname === '/'
    ) {
      if (!env.OAUTH_KV) {
        return new Response(
          JSON.stringify({
            error: 'OAuth KV namespace not configured',
            message: 'OAUTH_KV binding is required for MCP OAuth.',
          }),
          { status: 500, headers: { 'Content-Type': 'application/json' } },
        );
      }
      return oauthMcpHandler.fetch(request, { ...env, OAUTH_KV: env.OAUTH_KV }, ctx);
    }

    // All other endpoints go through the REST API router
    try {
      const apiRouter = new APIRouter(env);
      return await apiRouter.handleRequest(request);
    } catch (error) {
      console.error('Unhandled request error:', error);

      try {
        await auditLog(env.DB, {
          operation: 'request',
          resourceType: 'system',
          resourceId: null,
          result: 'failure',
          requestedBy: 'system',
          details: {
            error: error instanceof Error ? error.message : 'Unknown error',
            url: request.url,
            method: request.method,
          },
        });
      } catch {
        // audit failure must not mask original error
      }

      return new Response(
        JSON.stringify({ error: 'Internal server error', message: 'An unexpected error occurred' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } },
      );
    }
  },

  /**
   * Handle scheduled cron events
   */
  async scheduled(event: ScheduledEvent, env: Environment, _ctx: ExecutionContext): Promise<void> {
    try {
      console.log('Scheduled sync triggered:', event.scheduledTime);

      const syncEngine = new SyncEngine(env);
      const result = await syncEngine.syncAll();

      console.log('Scheduled sync completed:', {
        overall: result.overall,
        email: result.email.status,
        calendar: result.calendar.status,
        warnings: result.warnings,
      });

      await auditLog(env.DB, {
        operation: 'sync',
        resourceType: 'sync_state',
        resourceId: null,
        result: result.overall === 'complete' ? 'success' : 'partial',
        requestedBy: 'scheduler',
        details: {
          scheduledTime: event.scheduledTime,
          emailStatus: result.email.status,
          calendarStatus: result.calendar.status,
          emailItems: result.email.itemsProcessed,
          calendarItems: result.calendar.itemsProcessed,
          warnings: result.warnings,
        },
      });
    } catch (error) {
      console.error('Scheduled sync failed:', error);

      try {
        await auditLog(env.DB, {
          operation: 'sync',
          resourceType: 'sync_state',
          resourceId: null,
          result: 'failure',
          requestedBy: 'scheduler',
          details: {
            error: error instanceof Error ? error.message : 'Unknown error',
            scheduledTime: event.scheduledTime,
          },
        });
      } catch {
        // audit failure must not mask original error
      }

      throw error;
    }
  },
};
