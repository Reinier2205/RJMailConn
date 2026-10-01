/**
 * Morning Brief Connector - Main Entry Point
 * 
 * Production-quality Microsoft 365 connector for Reinier's Morning Intelligence Brief.
 * Provides secure OAuth authentication, reliable data synchronization, and API endpoints
 * for email and calendar integration.
 */

import { APIRouter } from './api/router';
import { SyncEngine } from './sync/sync-engine';
import { auditLog } from './database/audit';

/**
 * Cloudflare Workers Environment Interface
 */
export interface Environment {
  // D1 Database binding
  DB: D1Database;
  
  // Secrets (managed via Cloudflare dashboard)
  MICROSOFT_CLIENT_ID: string;
  MICROSOFT_CLIENT_SECRET: string;
  MICROSOFT_TENANT_ID: string;
  CONNECTOR_API_TOKEN: string;
  OAUTH_STATE_SECRET: string;
  
  // Environment variables
  ENVIRONMENT: 'development' | 'staging' | 'production';
}

/**
 * Main request handler for Cloudflare Workers
 */
export default {
  /**
   * Handle HTTP requests
   */
  async fetch(request: Request, env: Environment, _ctx: ExecutionContext): Promise<Response> {
    try {
      const apiRouter = new APIRouter(env);
      return await apiRouter.handleRequest(request);
      
    } catch (error) {
      console.error('Unhandled request error:', error);
      
      // Log critical errors to audit trail
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
            method: request.method
          }
        });
      } catch (auditError) {
        console.error('Failed to log audit entry:', auditError);
      }
      
      return new Response(
        JSON.stringify({ 
          error: 'Internal server error',
          message: 'An unexpected error occurred'
        }), 
        { 
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }
  },

  /**
   * Handle scheduled events (Cron triggers)
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
        warnings: result.warnings
      });
      
      // Log sync completion to audit trail
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
          warnings: result.warnings
        }
      });
      
    } catch (error) {
      console.error('Scheduled sync failed:', error);
      
      // Log sync failure to audit trail
      try {
        await auditLog(env.DB, {
          operation: 'sync',
          resourceType: 'sync_state',
          resourceId: null,
          result: 'failure',
          requestedBy: 'scheduler',
          details: { 
            error: error instanceof Error ? error.message : 'Unknown error',
            scheduledTime: event.scheduledTime
          }
        });
      } catch (auditError) {
        console.error('Failed to log sync failure:', auditError);
      }
      
      // Re-throw to ensure Cloudflare Workers marks the execution as failed
      throw error;
    }
  }
};

/**
 * Export types for external usage
 */
// Exported above