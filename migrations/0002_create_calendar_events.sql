-- Migration: 0002_create_calendar_events
-- Description: Create calendar_events table to store synchronized calendar event data from Microsoft Graph API
-- Requirements: 2.2, 5.2, 5.3

-- Create calendar_events table
CREATE TABLE IF NOT EXISTS calendar_events (
    -- Primary identifier
    id TEXT PRIMARY KEY NOT NULL,
    
    -- Microsoft Graph unique identifier (unique constraint enforced below)
    graph_event_id TEXT NOT NULL,
    
    -- Event basic information
    subject TEXT NOT NULL DEFAULT '',
    
    -- Event timing (start must be <= end, validated in application)
    start_at DATETIME NOT NULL,
    end_at DATETIME NOT NULL,
    timezone TEXT NOT NULL,
    
    -- Event location and participants
    location TEXT,
    organiser TEXT,
    
    -- Event status and response
    response_status TEXT NOT NULL DEFAULT 'none' CHECK (response_status IN (
        'none',
        'accepted', 
        'declined',
        'tentative'
    )),
    is_cancelled BOOLEAN NOT NULL DEFAULT FALSE,
    
    -- Event content preview
    body_preview TEXT,
    
    -- Sync tracking timestamps
    first_seen_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_seen_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Create unique constraint on graph_event_id to prevent duplicates
CREATE UNIQUE INDEX IF NOT EXISTS idx_calendar_events_graph_id_unique ON calendar_events(graph_event_id);

-- Create indexes for optimal date-based queries
CREATE INDEX IF NOT EXISTS idx_calendar_events_start_at ON calendar_events(start_at);
CREATE INDEX IF NOT EXISTS idx_calendar_events_end_at ON calendar_events(end_at);
CREATE INDEX IF NOT EXISTS idx_calendar_events_date_range ON calendar_events(start_at, end_at);

-- Create indexes for filtering and search operations
CREATE INDEX IF NOT EXISTS idx_calendar_events_timezone ON calendar_events(timezone);
CREATE INDEX IF NOT EXISTS idx_calendar_events_organiser ON calendar_events(organiser);
CREATE INDEX IF NOT EXISTS idx_calendar_events_response_status ON calendar_events(response_status);
CREATE INDEX IF NOT EXISTS idx_calendar_events_is_cancelled ON calendar_events(is_cancelled);

-- Create indexes for sync tracking and operational queries
CREATE INDEX IF NOT EXISTS idx_calendar_events_first_seen ON calendar_events(first_seen_at);
CREATE INDEX IF NOT EXISTS idx_calendar_events_last_seen ON calendar_events(last_seen_at);

-- Create composite index for common query patterns (today's events, upcoming events)
CREATE INDEX IF NOT EXISTS idx_calendar_events_active_by_date ON calendar_events(is_cancelled, start_at, end_at);