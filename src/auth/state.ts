/**
 * OAuth State Manager - CSRF Protection for OAuth Flow
 * 
 * Generates and validates cryptographically secure state parameters
 * to prevent CSRF attacks during OAuth authentication.
 */

import { Environment } from '../index';

/**
 * OAuth State Manager for CSRF Protection
 */
export class OAuthStateManager {
  private readonly stateSecret: string;

  constructor(env: Environment) {
    this.stateSecret = env.OAUTH_STATE_SECRET;
  }

  /**
   * Generate cryptographically secure OAuth state parameter
   */
  async generateState(): Promise<string> {
    // Generate random bytes for state
    const randomBytes = crypto.getRandomValues(new Uint8Array(32));
    const randomHex = Array.from(randomBytes)
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');

    // Create timestamp
    const timestamp = Date.now().toString();
    
    // Combine random data with timestamp
    const stateData = `${randomHex}.${timestamp}`;
    
    // Create HMAC signature for verification
    const signature = await this.createHMAC(stateData);
    
    return `${stateData}.${signature}`;
  }

  /**
   * Validate OAuth state parameter
   */
  async validateState(state: string): Promise<boolean> {
    try {
      const parts = state.split('.');
      if (parts.length !== 3) {
        return false;
      }

      const [randomHex, timestamp, signature] = parts;
      const stateData = `${randomHex}.${timestamp}`;

      // Verify HMAC signature
      const expectedSignature = await this.createHMAC(stateData);
      if (signature !== expectedSignature) {
        return false;
      }

      // Check timestamp is within valid window (30 minutes)
      const stateTime = parseInt(timestamp ?? "0");
      const now = Date.now();
      const thirtyMinutes = 30 * 60 * 1000;
      
      if (now - stateTime > thirtyMinutes) {
        return false;
      }

      return true;

    } catch (error) {
      console.error('State validation error:', error);
      return false;
    }
  }

  /**
   * Clear used state (placeholder for future session management)
   */
  async clearState(state: string): Promise<void> {
    // In a full implementation, this would remove the state from a cache
    // to prevent replay attacks. For now, we rely on timestamp validation.
    console.log(`State cleared: ${state.substring(0, 16)}...`);
  }

  /**
   * Create HMAC signature for state validation
   */
  private async createHMAC(data: string): Promise<string> {
    const encoder = new TextEncoder();
    const keyData = encoder.encode(this.stateSecret);
    const messageData = encoder.encode(data);

    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );

    const signature = await crypto.subtle.sign('HMAC', cryptoKey, messageData);
    const signatureArray = new Uint8Array(signature);
    
    return Array.from(signatureArray)
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  }
}