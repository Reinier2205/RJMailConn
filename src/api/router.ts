/**
 * API Router - HTTP Request Routing and Authentication
 * 
 * Handles all HTTP routing, authentication, and endpoint management
 * for the Microsoft 365 Mail Connector API.
 */

import { Environment } from "../index";
import { OAuthHandler } from "../auth/oauth";
import { auditLog } from "../database/audit";
import { DraftHandler } from "./drafts";
import { CalendarEventHandler } from "./calendar";
import { BriefHandler } from "./brief";
import { AuthMiddleware } from "./auth-middleware";

export interface AuthValidation {
  valid: boolean;
  error?: string | undefined;
}

/**
 * Main API Router Class
 * 
 * NOTE: /mcp endpoint now uses OAuth 2.1 and is handled separately in index.ts
 * All other endpoints continue using Bearer token authentication
 */
export class APIRouter {
  private readonly env: Environment;
  private readonly oauthHandler: OAuthHandler;
  private readonly authMiddleware: AuthMiddleware;

  constructor(env: Environment) {
    this.env = env;
    this.oauthHandler = new OAuthHandler(env);
    this.authMiddleware = new AuthMiddleware(env);
  }

  /**
   * Handle incoming HTTP requests
   */
  async handleRequest(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;

    // Add CORS headers for all responses
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, PATCH, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization"
    };

    // Handle preflight requests
    if (method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    try {
      // Route to appropriate handler
      if (path.startsWith("/auth/")) {
        return await this.handleAuthEndpoints(request, corsHeaders);
      } else if (path.startsWith("/email")) {
        return await this.handleEmailEndpoints(request, corsHeaders);
      } else if (path.startsWith("/calendar")) {
        return await this.handleCalendarEndpoints(request, corsHeaders);
      } else if (path.startsWith("/drafts")) {
        return await this.handleDraftEndpoints(request, corsHeaders);
      } else if (path === "/brief") {
        return await this.handleBriefEndpoint(request, corsHeaders);
      } else if (path === "/sync") {
        return await this.handleSyncEndpoint(request, corsHeaders);
      } else if (path.startsWith("/health") || path.startsWith("/status") || path === "/version") {
        return await this.handleHealthEndpoints(request, corsHeaders);
      } else {
        return new Response(
          JSON.stringify({ error: "Not found" }),
          { 
            status: 404, 
            headers: { ...corsHeaders, "Content-Type": "application/json" }
          }
        );
      }
    } catch (error) {
      console.error("Request handling error:", error);
      
      return new Response(
        JSON.stringify({ 
          error: "Internal server error",
          message: "An unexpected error occurred"
        }),
        { 
          status: 500, 
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        }
      );
    }
  }

  /**
   * Handle OAuth authentication endpoints
   */
  async handleAuthEndpoints(request: Request, corsHeaders: Record<string, string>): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;

    switch (path) {
      case "/auth/login":
        if (method !== "GET") {
          return this.methodNotAllowed(corsHeaders);
        }
        return await this.handleLogin(corsHeaders);

      case "/auth/callback":
        if (method !== "GET") {
          return this.methodNotAllowed(corsHeaders);
        }
        return await this.handleCallback(request, corsHeaders);

      case "/auth/logout":
        if (method !== "POST") {
          return this.methodNotAllowed(corsHeaders);
        }
        return await this.handleLogout(corsHeaders);

      default:
        return this.notFound(corsHeaders);
    }
  }

  /**
   * Handle login initiation
   */
  private async handleLogin(corsHeaders: Record<string, string>): Promise<Response> {
    try {
      const loginRedirect = await this.oauthHandler.initiateLogin();
      
      await auditLog(this.env.DB, {
        operation: "auth",
        resourceType: "token",
        resourceId: null,
        result: "success",
        requestedBy: "system",
        details: { action: "login_initiated" }
      });

      // Return HTTP 302 redirect to Microsoft login
      return new Response(null, { 
        status: 302, 
        headers: { 
          ...corsHeaders,
          "Location": loginRedirect.redirectUrl
        }
      });
    } catch (error) {
      return this.handleError(error, corsHeaders, "Login initiation failed");
    }
  }

  /**
   * Handle OAuth callback
   */
  private async handleCallback(request: Request, corsHeaders: Record<string, string>): Promise<Response> {
    try {
      const url = new URL(request.url);
      const code = url.searchParams.get("code");
      const state = url.searchParams.get("state");
      const error = url.searchParams.get("error");

      if (error) {
        await auditLog(this.env.DB, {
          operation: "auth",
          resourceType: "token",
          resourceId: null,
          result: "failure",
          requestedBy: "system",
          details: { action: "oauth_callback", error }
        });

        return new Response(
          JSON.stringify({
            success: false,
            error: `OAuth error: ${error}`
          }),
          { 
            status: 400, 
            headers: { ...corsHeaders, "Content-Type": "application/json" }
          }
        );
      }

      if (!code || !state) {
        return new Response(
          JSON.stringify({
            success: false,
            error: "Missing required OAuth parameters"
          }),
          { 
            status: 400, 
            headers: { ...corsHeaders, "Content-Type": "application/json" }
          }
        );
      }

      const authResult = await this.oauthHandler.handleCallback(code, state);
      
      await auditLog(this.env.DB, {
        operation: "auth",
        resourceType: "token",
        resourceId: authResult.user?.id || null,
        result: authResult.success ? "success" : "failure",
        requestedBy: "system",
        details: { 
          action: "oauth_callback",
          userPrincipalName: authResult.user?.userPrincipalName,
          error: authResult.error
        }
      });

      if (authResult.success) {
        return new Response(
          JSON.stringify({
            success: true,
            user: {
              displayName: authResult.user?.displayName,
              userPrincipalName: authResult.user?.userPrincipalName,
              mail: authResult.user?.mail
            }
          }),
          { 
            status: 200, 
            headers: { ...corsHeaders, "Content-Type": "application/json" }
          }
        );
      } else {
        return new Response(
          JSON.stringify({
            success: false,
            error: authResult.error
          }),
          { 
            status: 401, 
            headers: { ...corsHeaders, "Content-Type": "application/json" }
          }
        );
      }
    } catch (error) {
      return this.handleError(error, corsHeaders, "OAuth callback failed");
    }
  }

  /**
   * Handle logout
   */
  private async handleLogout(corsHeaders: Record<string, string>): Promise<Response> {
    try {
      await this.oauthHandler.logout();
      
      await auditLog(this.env.DB, {
        operation: "auth",
        resourceType: "token",
        resourceId: null,
        result: "success",
        requestedBy: "system",
        details: { action: "logout" }
      });

      return new Response(
        JSON.stringify({ success: true }),
        { 
          status: 200, 
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        }
      );
    } catch (error) {
      return this.handleError(error, corsHeaders, "Logout failed");
    }
  }

  /**
   * Validate Bearer token for private endpoints
   * 
   * @deprecated Use authMiddleware.validateBearerToken directly
   */
  async validateBearerToken(request: Request): Promise<AuthValidation> {
    const result = await this.authMiddleware.validateBearerToken(request);
    return {
      valid: result.authenticated,
      error: result.error
    };
  }

  /**
   * Placeholder handlers for other endpoints
   */
  async handleEmailEndpoints(request: Request, corsHeaders: Record<string, string>): Promise<Response> {
    return this.authMiddleware.requireAuth(request, corsHeaders, async () => {
      // TODO: Implement email endpoints
      return new Response(
        JSON.stringify({ message: "Email endpoints not yet implemented" }),
        { 
          status: 501, 
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        }
      );
    });
  }

  async handleCalendarEndpoints(request: Request, corsHeaders: Record<string, string>): Promise<Response> {
    return this.authMiddleware.requireAuth(request, corsHeaders, async () => {
      const url = new URL(request.url);
      const method = request.method;
      const calendarHandler = new CalendarEventHandler(this.env);

      // Handle calendar event creation
      if (url.pathname === "/calendar/events" && method === "POST") {
        return await calendarHandler.handleCreateEvent(request);
      }
      
      // Handle calendar event updates
      if (url.pathname.startsWith("/calendar/events/") && method === "PATCH") {
        const eventId = url.pathname.split("/calendar/events/")[1];
        if (!eventId) {
          return new Response(
            JSON.stringify({ error: "Event ID is required for updates" }),
            { 
              status: 400, 
              headers: { ...corsHeaders, "Content-Type": "application/json" }
            }
          );
        }
        return await calendarHandler.handleUpdateEvent(request, eventId);
      }

      // Handle calendar data retrieval (existing functionality)
      if (url.pathname === "/calendar" && method === "GET") {
        // TODO: Implement calendar data retrieval endpoint
        return new Response(
          JSON.stringify({ message: "Calendar data retrieval not yet implemented" }),
          { 
            status: 501, 
            headers: { ...corsHeaders, "Content-Type": "application/json" }
          }
        );
      }

      return new Response(
        JSON.stringify({ error: "Calendar endpoint not found" }),
        { 
          status: 404, 
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        }
      );
    });
  }

  async handleDraftEndpoints(request: Request, corsHeaders: Record<string, string>): Promise<Response> {
    return this.authMiddleware.requireAuth(request, corsHeaders, async () => {
      const url = new URL(request.url);
      const method = request.method;
      const draftHandler = new DraftHandler(this.env);

      if (url.pathname === "/drafts" && method === "POST") {
        return await draftHandler.handleCreateDraft(request);
      } else if (url.pathname === "/drafts/reply" && method === "POST") {
        return await draftHandler.handleCreateReplyDraft(request);
      } else {
        return new Response(
          JSON.stringify({ error: "Draft endpoint not found" }),
          { 
            status: 404, 
            headers: { ...corsHeaders, "Content-Type": "application/json" }
          }
        );
      }
    });
  }

  async handleBriefEndpoint(request: Request, corsHeaders: Record<string, string>): Promise<Response> {
    return this.authMiddleware.requireAuth(request, corsHeaders, async () => {
      if (request.method !== "GET") {
        return this.methodNotAllowed(corsHeaders);
      }

      try {
        const briefHandler = new BriefHandler(this.env);
        const briefResponse = await briefHandler.generateBrief();
        
        return new Response(
          JSON.stringify(briefResponse),
          { 
            status: 200, 
            headers: { ...corsHeaders, "Content-Type": "application/json" }
          }
        );
      } catch (error) {
        return this.handleError(error, corsHeaders, "Morning brief generation failed");
      }
    });
  }

  async handleSyncEndpoint(request: Request, corsHeaders: Record<string, string>): Promise<Response> {
    return this.authMiddleware.requireAuth(request, corsHeaders, async () => {
      if (request.method !== "POST") {
        return this.methodNotAllowed(corsHeaders);
      }

      try {
        const { SyncEngine } = await import("../sync/sync-engine");
        const syncEngine = new SyncEngine(this.env);
        const result = await syncEngine.syncAll();
        
        return new Response(
          JSON.stringify(result),
          { 
            status: 200, 
            headers: { ...corsHeaders, "Content-Type": "application/json" }
          }
        );
      } catch (error) {
        return this.handleError(error, corsHeaders, "Manual sync failed");
      }
    });
  }

  async handleHealthEndpoints(request: Request, corsHeaders: Record<string, string>): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    // Basic health check - no authentication required
    if (path === "/health") {
      return new Response(
        JSON.stringify({ status: "ok", timestamp: new Date().toISOString() }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Detailed status - requires authentication
    if (path === "/status") {
      return this.authMiddleware.requireAuth(request, corsHeaders, async () => {
        try {
          const healthMonitor = new (await import("./health")).HealthMonitor(this.env);
          const status = await healthMonitor.getDetailedStatus();
          return new Response(
            JSON.stringify(status),
            { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        } catch (error) {
          return this.handleError(error, corsHeaders, "Status check failed");
        }
      });
    }

    // Version info - no authentication required
    if (path === "/version") {
      const healthMonitor = new (await import("./health")).HealthMonitor(this.env);
      return new Response(
        JSON.stringify(healthMonitor.getVersionInfo()),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: "Health endpoint not found" }),
      { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  private methodNotAllowed(corsHeaders: Record<string, string>): Response {
    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      { 
        status: 405, 
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    );
  }

  private notFound(corsHeaders: Record<string, string>): Response {
    return new Response(
      JSON.stringify({ error: "Not found" }),
      { 
        status: 404, 
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    );
  }

  private handleError(error: unknown, corsHeaders: Record<string, string>, context: string): Response {
    console.error(`${context}:`, error);
    
    return new Response(
      JSON.stringify({ 
        error: context,
        message: error instanceof Error ? error.message : "Unknown error"
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    );
  }
}



