/**
 * Token Storage Manager - Secure OAuth Token Management
 * 
 * Handles secure storage and retrieval of Microsoft OAuth tokens
 * using Cloudflare Workers KV or D1 for persistence.
 */

import { Environment } from '../index';
import { TokenSet } from './oauth';

/**
 * Token Storage for OAuth Credentials
 */
export class TokenStorage {
  private readonly db: D1Database;
  
  constructor(env: Environment) {
    this.db = env.DB;
  }

  /**
   * Store OAuth tokens securely
   */
  async storeTokens(tokens: TokenSet): Promise<void> {
    try {
      const stmt = this.db.prepare(`
        INSERT OR REPLACE INTO oauth_tokens (
          id, access_token, refresh_token, expires_at, scope, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, datetime('now'), datetime('now'))
      `);

      await stmt.bind(
        'primary',  // Single-user system uses fixed ID
        tokens.accessToken,
        tokens.refreshToken,
        tokens.expiresAt.toISOString(),
        tokens.scope
      ).run();

    } catch (error) {
      console.error('Failed to store tokens:', error);
      throw new Error('Token storage failed');
    }
  }

  /**
   * Retrieve stored OAuth tokens
   */
  async getTokens(): Promise<TokenSet | null> {
    try {
      const stmt = this.db.prepare(`
        SELECT access_token, refresh_token, expires_at, scope 
        FROM oauth_tokens 
        WHERE id = ?
      `);

      const result = await stmt.bind('primary').first();
      
      if (!result) {
        return null;
      }

      return {
        accessToken: result.access_token as string,
        refreshToken: result.refresh_token as string,
        expiresAt: new Date(result.expires_at as string),
        scope: result.scope as string
      };

    } catch (error) {
      console.error('Failed to retrieve tokens:', error);
      return null;
    }
  }

  /**
   * Clear stored OAuth tokens
   */
  async clearTokens(): Promise<void> {
    try {
      const stmt = this.db.prepare(`DELETE FROM oauth_tokens WHERE id = ?`);
      await stmt.bind('primary').run();
    } catch (error) {
      console.error('Failed to clear tokens:', error);
      throw new Error('Token cleanup failed');
    }
  }

  /**
   * Check if valid tokens exist
   */
  async hasValidTokens(): Promise<boolean> {
    const tokens = await this.getTokens();
    if (!tokens) {
      return false;
    }

    // Check if access token is still valid (with 5-minute buffer)
    const now = new Date();
    const buffer = new Date(now.getTime() + 5 * 60 * 1000); // 5 minutes
    
    return tokens.expiresAt > buffer;
  }

  /**
   * Get access token for API requests
   */
  async getAccessToken(): Promise<string | null> {
    const tokens = await this.getTokens();
    return tokens?.accessToken || null;
  }

  /**
   * Update access token after refresh
   */
  async updateAccessToken(accessToken: string, expiresAt: Date): Promise<void> {
    try {
      const stmt = this.db.prepare(`
        UPDATE oauth_tokens 
        SET access_token = ?, expires_at = ?, updated_at = datetime('now')
        WHERE id = ?
      `);

      await stmt.bind(
        accessToken,
        expiresAt.toISOString(),
        'primary'
      ).run();

    } catch (error) {
      console.error('Failed to update access token:', error);
      throw new Error('Token update failed');
    }
  }
}