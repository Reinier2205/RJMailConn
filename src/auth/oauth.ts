/**
 * OAuth Handler - Microsoft OAuth 2.0 Authorization Code Flow
 * 
 * Manages secure authentication with Microsoft Entra ID using delegated permissions.
 * Implements CSRF protection, token lifecycle management, and user identity verification.
 */

import { Environment } from '../index';
import { TokenStorage } from './tokens';
import { OAuthStateManager } from './state';

export interface LoginRedirect {
  redirectUrl: string;
  state: string;
}

export interface AuthResult {
  success: boolean;
  tokens?: TokenSet;
  user?: MicrosoftUser;
  error?: string;
}

export interface TokenRefreshResult {
  success: boolean;
  tokens?: TokenSet;
  error?: string;
}

export interface TokenSet {
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
  scope: string;
}

export interface MicrosoftUser {
  id: string;
  displayName: string;
  userPrincipalName: string;
  mail: string;
}

/**
 * OAuth Handler for Microsoft 365 Authentication
 */
export class OAuthHandler {
  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly tenantId: string;
  private readonly redirectUri: string;
  private readonly tokenStorage: TokenStorage;
  private readonly stateManager: OAuthStateManager;

  // Required delegated permissions
  private readonly requiredScopes = [
    'openid',
    'profile',
    'email',
    'offline_access',
    'User.Read',
    'Mail.Read',
    'Mail.ReadWrite',
    'Calendars.ReadWrite'
  ].join(' ');

  constructor(env: Environment, baseUrl: string = 'https://morning-brief-connector.reinier-olivier.workers.dev') {
    this.clientId = env.CLIENT_ID;
    this.clientSecret = env.CLIENT_SECRET;
    this.tenantId = env.TENANT_ID;
    this.redirectUri = `${baseUrl}/auth/callback`;
    this.tokenStorage = new TokenStorage(env);
    this.stateManager = new OAuthStateManager(env);
  }

  /**
   * Initiate OAuth login flow with secure state generation
   */
  async initiateLogin(): Promise<LoginRedirect> {
    const state = await this.stateManager.generateState();
    
    const authUrl = new URL(`https://login.microsoftonline.com/${this.tenantId}/oauth2/v2.0/authorize`);
    authUrl.searchParams.set('client_id', this.clientId);
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('redirect_uri', this.redirectUri);
    authUrl.searchParams.set('response_mode', 'query');
    authUrl.searchParams.set('scope', this.requiredScopes);
    authUrl.searchParams.set('state', state);
    
    return {
      redirectUrl: authUrl.toString(),
      state
    };
  }

  /**
   * Handle OAuth callback with state validation and token exchange
   */
  async handleCallback(code: string, state: string): Promise<AuthResult> {
    try {
      // Validate state parameter for CSRF protection
      const isValidState = await this.stateManager.validateState(state);
      if (!isValidState) {
        return {
          success: false,
          error: 'Invalid OAuth state parameter - possible CSRF attack'
        };
      }

      // Exchange authorization code for tokens
      const tokenResult = await this.exchangeCodeForTokens(code);
      if (!tokenResult.success) {
        return {
          success: false,
          error: tokenResult.error || 'Token exchange failed'
        };
      }

      // Verify user identity and permissions
      const userResult = await this.getUserProfile(tokenResult.tokens!.accessToken);
      if (!userResult.success) {
        return {
          success: false,
          error: userResult.error || 'User profile verification failed'
        };
      }

      // Store tokens securely
      await this.tokenStorage.storeTokens(tokenResult.tokens!);
      
      // Clear used state
      await this.stateManager.clearState(state);

      return {
        success: true,
        tokens: tokenResult.tokens,
        user: userResult.user
      };

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'OAuth callback processing failed'
      };
    }
  }

  /**
   * Refresh access tokens using stored refresh token
   */
  async refreshTokens(): Promise<TokenRefreshResult> {
    try {
      const currentTokens = await this.tokenStorage.getTokens();
      if (!currentTokens || !currentTokens.refreshToken) {
        return {
          success: false,
          error: 'No refresh token available'
        };
      }

      const tokenUrl = `https://login.microsoftonline.com/${this.tenantId}/oauth2/v2.0/token`;
      
      const requestBody = new URLSearchParams({
        client_id: this.clientId,
        client_secret: this.clientSecret,
        grant_type: 'refresh_token',
        refresh_token: currentTokens.refreshToken,
        scope: this.requiredScopes
      });

      const response = await fetch(tokenUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Accept': 'application/json'
        },
        body: requestBody
      });

      if (!response.ok) {
        const errorText = await response.text();
        return {
          success: false,
          error: `Token refresh failed: ${response.status} ${errorText}`
        };
      }

      const tokenData = await response.json() as any;
      
      const newTokens: TokenSet = {
        accessToken: tokenData.access_token,
        refreshToken: tokenData.refresh_token || currentTokens.refreshToken,
        expiresAt: new Date(Date.now() + (tokenData.expires_in * 1000)),
        scope: tokenData.scope || currentTokens.scope
      };

      await this.tokenStorage.storeTokens(newTokens);

      return {
        success: true,
        tokens: newTokens
      };

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Token refresh failed'
      };
    }
  }

  /**
   * Logout and clear stored tokens
   */
  async logout(): Promise<void> {
    await this.tokenStorage.clearTokens();
  }

  /**
   * Validate current tokens and refresh if necessary
   */
  async validateTokens(): Promise<boolean> {
    const tokens = await this.tokenStorage.getTokens();
    if (!tokens) {
      return false;
    }

    // Check if token expires within 5 minutes
    const expirationBuffer = new Date(Date.now() + 5 * 60 * 1000);
    if (tokens.expiresAt > expirationBuffer) {
      return true;
    }

    // Token expired - attempt refresh
    const refreshResult = await this.refreshTokens();
    return refreshResult.success;
  }

  /**
   * Exchange authorization code for access tokens
   */
  private async exchangeCodeForTokens(code: string): Promise<{ success: boolean; tokens?: TokenSet; error?: string }> {
    try {
      const tokenUrl = `https://login.microsoftonline.com/${this.tenantId}/oauth2/v2.0/token`;
      
      const requestBody = new URLSearchParams({
        client_id: this.clientId,
        client_secret: this.clientSecret,
        code: code,
        redirect_uri: this.redirectUri,
        grant_type: 'authorization_code',
        scope: this.requiredScopes
      });

      const response = await fetch(tokenUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Accept': 'application/json'
        },
        body: requestBody
      });

      if (!response.ok) {
        const errorText = await response.text();
        return {
          success: false,
          error: `Token exchange failed: ${response.status} ${errorText}`
        };
      }

      const tokenData = await response.json() as any;
      
      const tokens: TokenSet = {
        accessToken: tokenData.access_token,
        refreshToken: tokenData.refresh_token,
        expiresAt: new Date(Date.now() + (tokenData.expires_in * 1000)),
        scope: tokenData.scope
      };

      return {
        success: true,
        tokens
      };

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Token exchange failed'
      };
    }
  }

  /**
   * Get user profile from Microsoft Graph
   */
  private async getUserProfile(accessToken: string): Promise<{ success: boolean; user?: MicrosoftUser; error?: string }> {
    try {
      const response = await fetch('https://graph.microsoft.com/v1.0/me', {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Accept': 'application/json'
        }
      });

      if (!response.ok) {
        return {
          success: false,
          error: `User profile request failed: ${response.status}`
        };
      }

      const userData = await response.json() as any;
      
      const user: MicrosoftUser = {
        id: userData.id,
        displayName: userData.displayName || '',
        userPrincipalName: userData.userPrincipalName || '',
        mail: userData.mail || userData.userPrincipalName || ''
      };

      return {
        success: true,
        user
      };

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'User profile retrieval failed'
      };
    }
  }
}