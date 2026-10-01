/**
 * Microsoft Graph Client - Typed API Interface
 * 
 * Provides reliable, typed interface to Microsoft Graph API with automatic
 * token management, retry logic, and comprehensive error handling.
 */

import { Environment } from "../index";
import { TokenStorage } from "../auth/tokens";

export type RetrievalStatus = 
  | "complete"
  | "partial" 
  | "failed"
  | "unauthorized"
  | "rate_limited"
  | "source_unavailable";

export interface RetrievalResult<T> {
  status: RetrievalStatus;
  items: T[];
  itemsChecked: number;
  pagesChecked: number;
  paginationComplete: boolean;
  startedAt: Date;
  completedAt: Date;
  nextLink?: string;
  error?: GraphError;
}

export interface GraphError {
  code: string;
  message: string;
  details?: any;
  requestId?: string;
  timestamp: Date;
}

export interface CreateResult {
  success: boolean;
  id?: string;
  error?: GraphError;
}

export interface UpdateResult {
  success: boolean;
  error?: GraphError;
}

export interface MessageQueryOptions {
  from?: Date;
  to?: Date;
  top?: number;
  skip?: number;
  select?: string[];
  filter?: string;
  orderBy?: string;
}

export interface CalendarQueryOptions {
  startTime: Date;
  endTime: Date;
  top?: number;
  skip?: number;
}

/**
 * Microsoft Graph API Client
 */
export class GraphClient {
  private readonly env: Environment;
  private readonly tokenStorage: TokenStorage;
  private readonly baseUrl = "https://graph.microsoft.com/v1.0";
  
  constructor(env: Environment) {
    this.env = env;
    this.tokenStorage = new TokenStorage(env);
  }

  /**
   * Get user profile information
   */
  async getUserProfile(): Promise<any> {
    return this.makeRequest("/me");
  }

  /**
   * Get email messages with pagination support
   */
  async getMessages(options: MessageQueryOptions): Promise<RetrievalResult<any>> {
    const result: RetrievalResult<any> = {
      status: "failed",
      items: [],
      itemsChecked: 0,
      pagesChecked: 0,
      paginationComplete: false,
      startedAt: new Date(),
      completedAt: new Date()
    };

    try {
      const url = this.buildMessagesUrl(options);
      const paginationResult = await this.handlePagination(url);
      
      return {
        ...result,
        ...paginationResult,
        completedAt: new Date()
      };

    } catch (error) {
      result.status = this.classifyError(error);
      result.error = this.formatError(error);
      result.completedAt = new Date();
      return result;
    }
  }

  /**
   * Get calendar events with date range filtering
   */
  async getCalendarEvents(options: CalendarQueryOptions): Promise<RetrievalResult<any>> {
    const result: RetrievalResult<any> = {
      status: "failed",
      items: [],
      itemsChecked: 0,
      pagesChecked: 0,
      paginationComplete: false,
      startedAt: new Date(),
      completedAt: new Date()
    };

    try {
      const url = this.buildCalendarUrl(options);
      const paginationResult = await this.handlePagination(url);
      
      return {
        ...result,
        ...paginationResult,
        completedAt: new Date()
      };

    } catch (error) {
      result.status = this.classifyError(error);
      result.error = this.formatError(error);
      result.completedAt = new Date();
      return result;
    }
  }

  /**
   * Create email draft
   */
  async createDraft(draft: any): Promise<CreateResult> {
    try {
      const response = await this.makeRequest("/me/messages", "POST", draft);
      return {
        success: true,
        id: response.id
      };
    } catch (error) {
      return {
        success: false,
        error: this.formatError(error)
      };
    }
  }

  /**
   * Create calendar event
   */
  async createCalendarEvent(event: any): Promise<CreateResult> {
    try {
      const response = await this.makeRequest("/me/events", "POST", event);
      return {
        success: true,
        id: response.id
      };
    } catch (error) {
      return {
        success: false,
        error: this.formatError(error)
      };
    }
  }

  /**
   * Get calendar event by ID for verification and conflict detection
   */
  async getCalendarEvent(id: string): Promise<{ success: boolean; event?: any; error?: GraphError }> {
    try {
      const event = await this.makeRequest(`/me/events/${id}`);
      return { success: true, event };
    } catch (error) {
      return {
        success: false,
        error: this.formatError(error)
      };
    }
  }

  /**
   * Update calendar event
   */
  async updateCalendarEvent(id: string, updates: any): Promise<UpdateResult> {
    try {
      await this.makeRequest(`/me/events/${id}`, "PATCH", updates);
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: this.formatError(error)
      };
    }
  }

  /**
   * Handle complete pagination for any endpoint
   */
  private async handlePagination(initialUrl: string): Promise<Partial<RetrievalResult<any>>> {
    const items: any[] = [];
    let pagesChecked = 0;
    let currentUrl: string | null = initialUrl;
    let paginationComplete = false;

    while (currentUrl) {
      pagesChecked++;
      
      try {
        const pageResponse = await this.fetchWithRetry(currentUrl);
        const pageData = await pageResponse.json();
        
        if ((pageData as any).value && Array.isArray((pageData as any).value)) {
          items.push(...(pageData as any).value);
        }
        
        // Check for next page
        currentUrl = (pageData as any)["@odata.nextLink"] || null;
        
        if (!currentUrl) {
          paginationComplete = true;
        }
        
      } catch (error) {
        // Page failed - mark as partial
        return {
          status: "partial",
          items,
          itemsChecked: items.length,
          pagesChecked,
          paginationComplete: false,
          error: this.formatError(error)
        };
      }
    }

    return {
      status: "complete",
      items,
      itemsChecked: items.length,
      pagesChecked,
      paginationComplete
    };
  }

  /**
   * Make authenticated request to Microsoft Graph
   */
  private async makeRequest(endpoint: string, method: string = "GET", body?: any): Promise<any> {
    // Check if we have valid tokens
    const hasValidTokens = await this.tokenStorage.hasValidTokens();
    if (!hasValidTokens) {
      throw new Error("Authentication required - no valid tokens available");
    }

    const url = `${this.baseUrl}${endpoint}`;
    const response = await this.fetchWithRetry(url, method, body);
    return response.json();
  }

  /**
   * Fetch with automatic retry logic and token refresh
   */
  private async fetchWithRetry(
    url: string, 
    method: string = "GET", 
    body?: any,
    attempt: number = 1
  ): Promise<Response> {
    const maxAttempts = 3;
    const requestId = crypto.randomUUID();
    
    // Get access token
    const accessToken = await this.tokenStorage.getAccessToken();
    if (!accessToken) {
      throw new Error("No access token available");
    }
    
    const headers: Record<string, string> = {
      "Authorization": `Bearer ${accessToken}`,
      "Accept": "application/json",
      "Content-Type": "application/json",
      "Client-Request-Id": requestId
    };

    const requestOptions: RequestInit = {
      method,
      headers
    };

    if (body && (method === "POST" || method === "PATCH")) {
      requestOptions.body = JSON.stringify(body);
    }

    try {
      const response = await fetch(url, requestOptions);
      
      // Handle rate limiting
      if (response.status === 429) {
        const retryAfter = response.headers.get("Retry-After");
        const delay = retryAfter ? parseInt(retryAfter) * 1000 : Math.pow(2, attempt) * 1000;
        
        if (attempt < maxAttempts) {
          await new Promise(resolve => setTimeout(resolve, delay));
          return this.fetchWithRetry(url, method, body, attempt + 1);
        } else {
          throw new Error(`Rate limited after ${maxAttempts} attempts`);
        }
      }

      // Handle authentication errors
      if (response.status === 401) {
        // Try token refresh once per request
        if (attempt === 1) {
          const refreshResult = await this.refreshTokens();
          if (refreshResult.success) {
            return this.fetchWithRetry(url, method, body, attempt + 1);
          }
        }
        throw new Error("Authentication failed - unable to refresh token");
      }

      // Handle other HTTP errors
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Graph API error: ${response.status} ${errorText}`);
      }

      return response;

    } catch (error) {
      // Retry transient errors
      if (attempt < maxAttempts && this.isRetryableError(error)) {
        const delay = Math.pow(2, attempt) * 1000; // Exponential backoff
        await new Promise(resolve => setTimeout(resolve, delay));
        return this.fetchWithRetry(url, method, body, attempt + 1);
      }
      
      throw error;
    }
  }

  /**
   * Refresh tokens using OAuth handler
   */
  private async refreshTokens(): Promise<{ success: boolean }> {
    try {
      const tokens = await this.tokenStorage.getTokens();
      if (!tokens?.refreshToken) {
        return { success: false };
      }

      // Manual token refresh using Microsoft endpoint
      const tokenUrl = `https://login.microsoftonline.com/${this.env.MICROSOFT_TENANT_ID}/oauth2/v2.0/token`;
      
      const requestBody = new URLSearchParams({
        client_id: this.env.MICROSOFT_CLIENT_ID,
        client_secret: this.env.MICROSOFT_CLIENT_SECRET,
        grant_type: "refresh_token",
        refresh_token: tokens.refreshToken,
        scope: tokens.scope
      });

      const response = await fetch(tokenUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded"
        },
        body: requestBody
      });

      if (!response.ok) {
        return { success: false };
      }

      const tokenData = await response.json() as any;
      
      // Update stored tokens
      await this.tokenStorage.updateAccessToken(
        tokenData.access_token,
        new Date(Date.now() + (tokenData.expires_in * 1000))
      );

      return { success: true };

    } catch (error) {
      console.error("Token refresh failed:", error);
      return { success: false };
    }
  }

  /**
   * Build messages query URL with proper OData parameters
   */
  private buildMessagesUrl(options: MessageQueryOptions): string {
    const url = new URL(`${this.baseUrl}/me/messages`);
    
    // Set pagination parameters
    url.searchParams.set("$top", (options.top || 50).toString());
    if (options.skip) url.searchParams.set("$skip", options.skip.toString());
    
    // Set ordering
    url.searchParams.set("$orderby", options.orderBy || "receivedDateTime desc");
    
    // Set select fields for performance
    const selectFields = options.select || [
      "id", "conversationId", "internetMessageId", "receivedDateTime",
      "sender", "subject", "isRead", "importance", "hasAttachments", 
      "bodyPreview", "webLink"
    ];
    url.searchParams.set("$select", selectFields.join(","));
    
    // Build filters
    const filters: string[] = [];
    if (options.from) {
      filters.push(`receivedDateTime ge ${options.from.toISOString()}`);
    }
    if (options.to) {
      filters.push(`receivedDateTime le ${options.to.toISOString()}`);
    }
    if (options.filter) {
      filters.push(options.filter);
    }
    
    if (filters.length > 0) {
      url.searchParams.set("$filter", filters.join(" and "));
    }
    
    return url.toString();
  }

  /**
   * Build calendar events query URL with date filtering
   */
  private buildCalendarUrl(options: CalendarQueryOptions): string {
    const url = new URL(`${this.baseUrl}/me/events`);
    
    // Set pagination parameters
    url.searchParams.set("$top", (options.top || 50).toString());
    if (options.skip) url.searchParams.set("$skip", options.skip.toString());
    
    // Set ordering
    url.searchParams.set("$orderby", "start/dateTime");
    
    // Set select fields
    const selectFields = [
      "id", "subject", "start", "end", "location", "organizer", 
      "attendees", "responseStatus", "isCancelled", "bodyPreview"
    ];
    url.searchParams.set("$select", selectFields.join(","));
    
    // Date range filter
    const filter = `start/dateTime ge '${options.startTime.toISOString()}' and end/dateTime le '${options.endTime.toISOString()}'`;
    url.searchParams.set("$filter", filter);
    
    return url.toString();
  }

  /**
   * Classify errors for appropriate handling
   */
  private classifyError(error: any): RetrievalStatus {
    const message = error?.message || "";
    
    if (message.includes("Authentication") || message.includes("401")) return "unauthorized";
    if (message.includes("Rate limited") || message.includes("429")) return "rate_limited";
    if (message.includes("503") || message.includes("unavailable")) return "source_unavailable";
    
    return "failed";
  }

  /**
   * Format error for consistent error reporting
   */
  private formatError(error: any): GraphError {
    return {
      code: error?.code || "UNKNOWN_ERROR",
      message: error?.message || "An unexpected error occurred",
      details: error?.details,
      requestId: crypto.randomUUID(),
      timestamp: new Date()
    };
  }

  /**
   * Check if error is retryable
   */
  private isRetryableError(error: any): boolean {
    const message = error?.message || "";
    
    // Don not retry authentication or client errors
    if (message.includes("Authentication") || message.includes("401")) return false;
    if (message.includes("400") || message.includes("403")) return false;
    
    // Retry network errors, timeouts, and server errors
    return true;
  }
}
