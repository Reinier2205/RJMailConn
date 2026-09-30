-- Migration: 0002_create_audit_log
-- Description: Create audit_log table to track all system operations and data modifications
-- Requirements: 11.1, 11.2, 11.3

-- Create audit_log table for comprehensive operation tracking
CREATE TABLE IF NOT EXISTS audit_log (
    -- Primary identifier
    id TEXT PRIMARY KEY NOT NULL,
    
    -- Timestamp automatically set to current UTC time
    timestamp DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    -- Operation type from predefined enum values
    operation TEXT NOT NULL CHECK (operation IN (
        'create', 
        'update', 
        'delete', 
        'sync', 
        'auth'
    )),
    
    -- Resource type from predefined enum values
    resource_type TEXT NOT NULL CHECK (resource_type IN (
        'email', 
        'calendar', 
        'draft', 
        'token', 
        'sync_state'
    )),
    
    -- Resource identifier (null for bulk operations)
    resource_id TEXT,
    
    -- Operation result from predefined values
    result TEXT NOT NULL CHECK (result IN (
        'success', 
        'failure', 
        'partial'
    )),
    
    -- API caller identification (null for system operations)
    requested_by TEXT,
    
    -- Structured operation metadata as JSON
    details_json TEXT
);

-- Create indexes for query performance optimization
-- Index on timestamp for chronological queries and performance
CREATE INDEX IF NOT EXISTS idx_audit_log_timestamp ON audit_log(timestamp);

-- Index on resource_type for filtering by resource type
CREATE INDEX IF NOT EXISTS idx_audit_log_resource_type ON audit_log(resource_type);

-- Composite index on operation and result for filtering operations by outcome
CREATE INDEX IF NOT EXISTS idx_audit_log_operation_result ON audit_log(operation, result);

-- Index on resource_id for tracking specific resource operations
CREATE INDEX IF NOT EXISTS idx_audit_log_resource_id ON audit_log(resource_id);

-- Composite index on resource_type and timestamp for efficient resource-specific chronological queries
CREATE INDEX IF NOT EXISTS idx_audit_log_resource_type_timestamp ON audit_log(resource_type, timestamp);