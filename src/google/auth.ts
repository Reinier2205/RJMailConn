/**
 * Google OAuth 2.0 Authorization Code Flow
 *
 * Handles authentication with Google APIs (Gmail + Google Calendar)
 * using delegated OAuth access for a single personal account.
 */

import { Environment } from '../index';
import { TokenStorage } from '../auth/tokens';
import { OAuthStateManager } from '../auth/state';

export interface LoginRedirect {
  redirectUrl: string;
  state: string;
}

export interface AuthResult {
  success: boolean;
  tokens?: TokenSet;
  user?: GoogleUser;
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

export interface GoogleUser {
  id: string;
  displayName: string;
  email: string;
}

/**
 * Google OAuth Handler
 */
export class GoogleOAuthHandler {
  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly redirectUri: string;
  private readonly tokenStorage: TokenStorage;
  private readonly stateManager: OAuthStateManager;

  // Required Google OAuth scopes
  private readonly requiredScopes = [
    'openid',
    'email',
    'profile',
    'https://www.googleapis.com/auth/gmail.readonly',
    'https://www.googleapis.com/auth/gmail.compose',
    'https://www.googleapis.com/auth/calendar.readonly',
    'https://www.googleapis.com/auth/calendar.events',
  ].join(' ');

  constructor(env: Environment, baseUrl = 'https://morning-brief-connector.reinier-olivier.workers.dev') {
    this.clientId = env.GOOGLE_CLIENT_ID;
    this.clientSecret = env.GOOGLE_CLIENT_SECRET;
    this.redirectUri = `${baseUrl}/auth/callback`;
    this.tokenStorage = new TokenStorage(env);
    this.stateManager = new OAuthStateManager(env);
  }

  /**
   * Build Google authorization URL and return redirect details
   */
  async initiateLogin(): Promise<LoginRedirect> {
    const state = await this.stateManager.generateState();

    const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    authUrl.searchParams.set('client_id', this.clientId);
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('redirect_uri', this.redirectUri);
    authUrl.searchParams.set('scope', this.requiredScopes);
    authUrl.searchParams.set('state', state);
    authUrl.searchParams.set('access_type', 'offline');   // get refresh_token
    authUrl.searchParams.set('prompt', 'consent');         // always return refresh_token

    return { redirectUrl: authUrl.toString(), state };
  }

  /**
   * Handle OAuth callback: validate state, exchange code, fetch user profile
   */
  async handleCallback(code: string, state: string): Promise<AuthResult> {
    try {
      // CSRF protection
      const isValidState = await this.stateManager.validateState(state);
      if (!isValidState) {
        return { success: false, error: 'Invalid OAuth state parameter - possible CSRF attack' };
      }

      // Exchange code for tokens
      const tokenResult = await this.exchangeCodeForTokens(code);
      if (!tokenResult.success || !tokenResult.tokens) {
        return { success: false, error: tokenResult.error || 'Token exchange failed' };
      }

      // Fetch user identity from Google
      const userResult = await this.getUserProfile(tokenResult.tokens.accessToken);
      if (!userResult.success || !userResult.user) {
        return { success: false, error: userResult.error || 'User profile fetch failed' };
      }

      // Persist tokens
      await this.tokenStorage.storeTokens(tokenResult.tokens);

      // Consume the state nonce
      await this.stateManager.clearState(state);

      return { success: true, tokens: tokenResult.tokens, user: userResult.user };

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'OAuth callback failed',
      };
    }
  }

  /**
   * Use stored refresh token to get a new access token
   */
  async refreshTokens(): Promise<TokenRefreshResult> {
    try {
      const current = await this.tokenStorage.getTokens();
      if (!current?.refreshToken) {
        return { success: false, error: 'No refresh token available' };
      }

      const body = new URLSearchParams({
        client_id: this.clientId,
        client_secret: this.clientSecret,
        grant_type: 'refresh_token',
        refresh_token: current.refreshToken,
      });

      const response = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body,
      });

      if (!response.ok) {
        const err = await response.text();
        return { success: false, error: `Token refresh failed: ${response.status} ${err}` };
      }

      const data = await response.json() as any;

      const newTokens: TokenSet = {
        accessToken: data.access_token,
        // Google only returns a new refresh_token when rotating; keep old one otherwise
        refreshToken: data.refresh_token ?? current.refreshToken,
        expiresAt: new Date(Date.now() + data.expires_in * 1000),
        scope: data.scope ?? current.scope,
      };

      await this.tokenStorage.storeTokens(newTokens);
      return { success: true, tokens: newTokens };

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Token refresh failed',
      };
    }
  }

  /**
   * Clear stored tokens (logout)
   */
  async logout(): Promise<void> {
    await this.tokenStorage.clearTokens();
  }

  /**
   * Validate stored tokens, auto-refresh if within 5-minute expiry window
   */
  async validateTokens(): Promise<boolean> {
    const tokens = await this.tokenStorage.getTokens();
    if (!tokens) return false;

    const buffer = new Date(Date.now() + 5 * 60 * 1000);
    if (tokens.expiresAt > buffer) return true;

    const result = await this.refreshTokens();
    return result.success;
  }

  // ─── Private helpers ───────────────────────────────────────────────────────

  private async exchangeCodeForTokens(
    code: string
  ): Promise<{ success: boolean; tokens?: TokenSet; error?: string }> {
    try {
      const body = new URLSearchParams({
        code,
        client_id: this.clientId,
        client_secret: this.clientSecret,
        redirect_uri: this.redirectUri,
        grant_type: 'authorization_code',
      });

      const response = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body,
      });

      if (!response.ok) {
        const err = await response.text();
        return { success: false, error: `Code exchange failed: ${response.status} ${err}` };
      }

      const data = await response.json() as any;

      return {
        success: true,
        tokens: {
          accessToken: data.access_token,
          refreshToken: data.refresh_token,
          expiresAt: new Date(Date.now() + data.expires_in * 1000),
          scope: data.scope,
        },
      };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Code exchange failed' };
    }
  }

  private async getUserProfile(
    accessToken: string
  ): Promise<{ success: boolean; user?: GoogleUser; error?: string }> {
    try {
      const response = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (!response.ok) {
        return { success: false, error: `User profile request failed: ${response.status}` };
      }

      const data = await response.json() as any;

      return {
        success: true,
        user: {
          id: data.id,
          displayName: data.name ?? data.email,
          email: data.email,
        },
      };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'User profile fetch failed' };
    }
  }
}
