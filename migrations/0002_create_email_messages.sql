-- Migration: 0002_create_email_messages
-- Description: Create email_messages table to store synchronized email message data from Microsoft Graph API
-- Requirements: 2.1, 4.3, 4.4

-- Create email_messages table
CREATE TABLE IF NOT EXISTS email_messages (
    -- Primary identifier
    id TEXT PRIMARY KEY NOT NULL,
    
    -- Microsoft Graph identifiers
    graph_message_id TEXT NOT NULL UNIQUE,
    conversation_id TEXT,
    internet_message_id TEXT,
    
    -- Message metadata
    received_at DATETIME NOT NULL,
    sender_email TEXT NOT NULL,
    sender_name TEXT,
    subject TEXT NOT NULL DEFAULT '',
    
    -- Message properties
    is_read BOOLEAN NOT NULL DEFAULT FALSE,
    importance TEXT NOT NULL DEFAULT 'normal' CHECK (importance IN ('low', 'normal', 'high')),
    has_attachments BOOLEAN NOT NULL DEFAULT FALSE,
    classification TEXT NOT NULL DEFAULT 'unclassified' CHECK (classification IN ('new', 'important', 'marketing', 'unclassified')),
    
    -- Message content preview and linking
    body_preview TEXT,
    web_link TEXT,
    
    -- Sync tracking timestamps
    first_seen_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_seen_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Create unique constraint on graph_message_id to prevent duplicates
CREATE UNIQUE INDEX IF NOT EXISTS idx_email_messages_graph_id_unique ON email_messages(graph_message_id);

-- Create indexes for query performance optimization
CREATE INDEX IF NOT EXISTS idx_email_messages_received_at ON email_messages(received_at);
CREATE INDEX IF NOT EXISTS idx_email_messages_sender_email ON email_messages(sender_email);
CREATE INDEX IF NOT EXISTS idx_email_messages_subject ON email_messages(subject);
CREATE INDEX IF NOT EXISTS idx_email_messages_is_read ON email_messages(is_read);
CREATE INDEX IF NOT EXISTS idx_email_messages_importance ON email_messages(importance);
CREATE INDEX IF NOT EXISTS idx_email_messages_classification ON email_messages(classification);
CREATE INDEX IF NOT EXISTS idx_email_messages_conversation_id ON email_messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_email_messages_has_attachments ON email_messages(has_attachments);
CREATE INDEX IF NOT EXISTS idx_email_messages_first_seen_at ON email_messages(first_seen_at);
CREATE INDEX IF NOT EXISTS idx_email_messages_last_seen_at ON email_messages(last_seen_at);

-- Create composite indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_email_messages_classification_received ON email_messages(classification, received_at);
CREATE INDEX IF NOT EXISTS idx_email_messages_read_received ON email_messages(is_read, received_at);
CREATE INDEX IF NOT EXISTS idx_email_messages_importance_received ON email_messages(importance, received_at);