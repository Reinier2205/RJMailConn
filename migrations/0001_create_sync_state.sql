-- Migration: 0001_create_sync_state
-- Description: Create sync_state table to track synchronization state for email and calendar data sources
-- Requirements: 2.3, 7.1, 7.2

-- Create sync_state table
CREATE TABLE IF NOT EXISTS sync_state (
    -- Primary identifier
    id TEXT PRIMARY KEY NOT NULL,
    
    -- Data source identifier ('email' or 'calendar')
    source TEXT NOT NULL CHECK (source IN ('email', 'calendar')),
    
    -- Timestamp tracking
    last_attempt_at DATETIME NOT NULL,
    last_success_at DATETIME,
    
    -- Sync position tracking
    last_success_cursor TEXT,
    
    -- Current sync status
    status TEXT NOT NULL CHECK (status IN (
        'complete', 
        'partial', 
        'failed', 
        'unauthorized', 
        'rate_limited', 
        'source_unavailable'
    )),
    
    -- Error tracking
    error_code TEXT,
    error_message TEXT,
    
    -- Sync statistics
    messages_checked INTEGER NOT NULL DEFAULT 0,
    events_checked INTEGER NOT NULL DEFAULT 0,
    pages_checked INTEGER NOT NULL DEFAULT 0,
    pagination_complete BOOLEAN NOT NULL DEFAULT FALSE,
    
    -- Audit timestamp
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for performance optimization
CREATE INDEX IF NOT EXISTS idx_sync_state_source ON sync_state(source);
CREATE INDEX IF NOT EXISTS idx_sync_state_updated_at ON sync_state(updated_at);
CREATE INDEX IF NOT EXISTS idx_sync_state_status ON sync_state(status);
CREATE INDEX IF NOT EXISTS idx_sync_state_last_success ON sync_state(last_success_at);

-- Create unique constraint on source to ensure single state record per data source
CREATE UNIQUE INDEX IF NOT EXISTS idx_sync_state_source_unique ON sync_state(source);

-- Insert initial records for email and calendar sources
INSERT OR IGNORE INTO sync_state (
    id,
    source,
    last_attempt_at,
    status,
    pagination_complete
) VALUES 
    ('email-sync-state', 'email', CURRENT_TIMESTAMP, 'failed', FALSE),
    ('calendar-sync-state', 'calendar', CURRENT_TIMESTAMP, 'failed', FALSE);