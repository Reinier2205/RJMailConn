-- Migration: 0003_create_oauth_tokens
-- Description: Create oauth_tokens table to store Microsoft OAuth authentication tokens securely
-- Requirements: 1.3, 2.1, 2.4

-- Create oauth_tokens table for secure token storage
CREATE TABLE IF NOT EXISTS oauth_tokens (
    -- Primary identifier (single-user system uses fixed ID)
    id TEXT PRIMARY KEY NOT NULL,
    
    -- OAuth token data
    access_token TEXT NOT NULL,
    refresh_token TEXT NOT NULL,
    
    -- Token expiration tracking
    expires_at DATETIME NOT NULL,
    
    -- Granted permission scope
    scope TEXT NOT NULL,
    
    -- Audit timestamps
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for performance optimization
CREATE INDEX IF NOT EXISTS idx_oauth_tokens_expires_at ON oauth_tokens(expires_at);
CREATE INDEX IF NOT EXISTS idx_oauth_tokens_updated_at ON oauth_tokens(updated_at);

-- Insert initial placeholder record for single-user system
-- This will be replaced when user first authenticates
INSERT OR IGNORE INTO oauth_tokens (
    id,
    access_token,
    refresh_token,
    expires_at,
    scope
) VALUES (
    'primary',
    'placeholder',
    'placeholder',
    datetime('now', '-1 day'),
    'placeholder'
);
