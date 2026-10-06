/**
 * OAuth Handler - re-exports Google OAuth implementation
 *
 * This file keeps backward-compatible exports so existing code that
 * imports from '../auth/oauth' continues to work without changes.
 */

export {
  GoogleOAuthHandler as OAuthHandler,
  type LoginRedirect,
  type AuthResult,
  type TokenRefreshResult,
  type TokenSet,
  type GoogleUser as MicrosoftUser,   // alias kept for router/audit compatibility
} from '../google/auth';
