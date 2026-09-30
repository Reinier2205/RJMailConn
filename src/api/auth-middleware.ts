/**
 * API Authentication Middleware
 * 
 * Provides Bearer token authentication for private API endpoints.
 * Validates tokens against stored Cloudflare Worker Secrets.
 * 
 * Requirements: 8.1, 8.2, 4.1
 */

import { Environment } from "../index";

/**
 * Authentication validation result
 */
export interface AuthResult {
  authenticated: boolean;
  error?: string;
}

/**
 * Authentication middleware for validating Bearer tokens
 */
export class AuthMiddleware {
  private readonly env: Environment;

  constructor(env: Environment) {
    this.env = env;
  }

  /**
   * Validate Bearer token authentication
   * 
   * Requirements:
   * - 8.1: Validate Bearer token authentication against stored Cloudflare secrets
   * - 8.2: Return 401 for unauthenticated requests to private endpoints
   * 
   * @param request - HTTP request to validate
   * @returns Authentication result with status and optional error message
   */
  async validateBearerToken(request: Request): Promise<AuthResult> {
    // Extract Authorization header
    const authHeader = request.headers.get("Authorization");
    
    // Check for Authorization header presence
    if (!authHeader) {
      return {
        authenticated: false,
        error: "Missing Authorization header"
      };
    }

    // Validate Bearer scheme
    if (!authHeader.startsWith("Bearer ")) {
      return {
        authenticated: false,
        error: "Invalid Authorization header format. Expected: Bearer <token>"
      };
    }

    // Extract token value
    const token = authHeader.substring(7).trim();
    
    // Validate token is not empty
    if (!token) {
      return {
        authenticated: false,
        error: "Empty Bearer token"
      };
    }

    // Validate token against stored Cloudflare secret
    const storedToken = this.env.CONNECTOR_API_TOKEN;
    
    if (!storedToken) {
      console.error("CONNECTOR_API_TOKEN not configured in Cloudflare Worker Secrets");
      return {
        authenticated: false,
        error: "Authentication service unavailable"
      };
    }

    // Constant-time comparison to prevent timing attacks
    if (!this.secureCompare(token, storedToken)) {
      return {
        authenticated: false,
        error: "Invalid API token"
      };
    }

    return {
      authenticated: true
    };
  }

  /**
   * Create 401 Unauthorized response for failed authentication
   * 
   * Requirement 8.2: Return 401 for unauthenticated requests to private endpoints
   * 
   * @param authResult - Authentication result containing error details
   * @param corsHeaders - CORS headers to include in response
   * @returns 401 Unauthorized HTTP response
   */
  createUnauthorizedResponse(
    authResult: AuthResult,
    corsHeaders: Record<string, string> = {}
  ): Response {
    return new Response(
      JSON.stringify({
        error: "Unauthorized",
        message: authResult.error || "Authentication required"
      }),
      {
        status: 401,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
          "WWW-Authenticate": 'Bearer realm="API"'
        }
      }
    );
  }

  /**
   * Middleware wrapper for protecting endpoints
   * 
   * Validates authentication and returns 401 response if validation fails.
   * Otherwise, calls the provided handler function.
   * 
   * @param request - HTTP request to validate
   * @param corsHeaders - CORS headers for response
   * @param handler - Handler function to call if authentication succeeds
   * @returns HTTP response from handler or 401 Unauthorized
   */
  async requireAuth(
    request: Request,
    corsHeaders: Record<string, string>,
    handler: () => Promise<Response>
  ): Promise<Response> {
    const authResult = await this.validateBearerToken(request);
    
    if (!authResult.authenticated) {
      return this.createUnauthorizedResponse(authResult, corsHeaders);
    }

    return await handler();
  }

  /**
   * Constant-time string comparison to prevent timing attacks
   * 
   * Compares two strings in a way that takes the same amount of time
   * regardless of where differences occur, preventing timing-based attacks.
   * 
   * @param a - First string to compare
   * @param b - Second string to compare
   * @returns true if strings are equal, false otherwise
   */
  private secureCompare(a: string, b: string): boolean {
    // If lengths differ, comparison fails (but still compare to prevent timing leak)
    const lengthMatch = a.length === b.length;
    
    // Use the longer length to ensure we always do the same number of comparisons
    const compareLength = Math.max(a.length, b.length);
    
    let mismatch = 0;
    
    // Compare each character, accumulating mismatches
    for (let i = 0; i < compareLength; i++) {
      const charA = i < a.length ? a.charCodeAt(i) : 0;
      const charB = i < b.length ? b.charCodeAt(i) : 0;
      mismatch |= charA ^ charB;
    }
    
    // Return true only if lengths match and no character mismatches
    return lengthMatch && mismatch === 0;
  }
}
