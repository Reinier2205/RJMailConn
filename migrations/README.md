# Database Migrations

This directory contains SQL migration files for the Microsoft 365 Mail Connector Cloudflare D1 database.

## Migration Files

- `0001_create_sync_state.sql` - Creates the sync_state table for tracking email and calendar synchronization status
- `0002_create_calendar_events.sql` - Creates the calendar_events table for storing synchronized calendar event data
- `0003_create_email_messages.sql` - Creates the email_messages table for storing synchronized email message data

## Running Migrations

Migrations are executed using Wrangler CLI with Cloudflare D1:

```bash
# Execute migrations in order
wrangler d1 execute [database-name] --file=migrations/0001_create_sync_state.sql
wrangler d1 execute [database-name] --file=migrations/0002_create_calendar_events.sql
wrangler d1 execute [database-name] --file=migrations/0003_create_email_messages.sql

# Execute a specific migration
wrangler d1 execute [database-name] --file=migrations/0002_create_calendar_events.sql

# List all tables to verify migration
wrangler d1 execute [database-name] --command="SELECT name FROM sqlite_master WHERE type='table'"
```

## Migration Naming Convention

Migration files use the format: `{number}_{description}.sql`

- Number: 4-digit zero-padded sequence (0001, 0002, etc.)
- Description: Brief snake_case description of the migration

## sync_state Table Schema

The sync_state table tracks synchronization status with these columns:

- **id**: Primary key identifier
- **source**: Data source type ('email' or 'calendar') 
- **last_attempt_at**: Timestamp of last sync attempt
- **last_success_at**: Timestamp of last successful sync (NULL until first success)
- **last_success_cursor**: Pagination cursor from last successful sync
- **status**: Current sync status (complete, partial, failed, unauthorized, rate_limited, source_unavailable)
- **error_code**: Error code for failed syncs
- **error_message**: Human-readable error message
- **messages_checked**: Count of email messages processed in last sync
- **events_checked**: Count of calendar events processed in last sync  
- **pages_checked**: Count of pagination pages processed
- **pagination_complete**: Boolean indicating if pagination completed successfully
- **updated_at**: Automatic timestamp for last record update

## Indexes

Performance indexes are created on:
- `source` (for source-specific queries)
- `updated_at` (for time-based ordering)
- `status` (for status filtering)
- `last_success_at` (for checkpoint queries)

A unique constraint ensures only one record exists per source type.

## calendar_events Table Schema

The calendar_events table stores synchronized calendar event data with these columns:

- **id**: Primary key identifier
- **graph_event_id**: Unique Microsoft Graph event ID (unique constraint)
- **subject**: Event subject/title (NOT NULL, defaults to empty string)
- **start_at**: Event start date and time (NOT NULL)
- **end_at**: Event end date and time (NOT NULL, must be >= start_at)
- **timezone**: IANA timezone identifier for the event (NOT NULL)
- **location**: Event location description
- **organiser**: Event organizer email or name
- **response_status**: User's response to the event (none, accepted, declined, tentative - defaults to none)
- **is_cancelled**: Boolean indicating if event is cancelled (defaults to FALSE)
- **body_preview**: Truncated preview of event body/description content
- **first_seen_at**: Timestamp when event was first synchronized (auto-set)
- **last_seen_at**: Timestamp when event was last seen during sync (auto-updated)

## calendar_events Indexes

Performance indexes are created on:
- `graph_event_id` (unique constraint for deduplication)
- `start_at` (for chronological ordering and date queries)
- `end_at` (for event duration and end-time queries)
- `timezone` (for timezone-based filtering)
- `organiser` (for organizer-based queries)
- `response_status` (for filtering by response status)
- `is_cancelled` (for filtering active vs cancelled events)
- `first_seen_at` and `last_seen_at` (for sync tracking)

Composite indexes for common query patterns:
- `start_at + end_at` (for date range queries)
- `is_cancelled + start_at + end_at` (for active events in date ranges)

## email_messages Table Schema

The email_messages table stores synchronized email message data with these columns:

- **id**: Primary key identifier
- **graph_message_id**: Unique Microsoft Graph message ID (unique constraint)
- **conversation_id**: Microsoft Graph conversation ID for message threading
- **internet_message_id**: Standard Internet Message-ID header value
- **received_at**: Timestamp when message was received (NOT NULL)
- **sender_email**: Email address of message sender (NOT NULL)
- **sender_name**: Display name of message sender
- **subject**: Message subject line (NOT NULL, defaults to empty string)
- **is_read**: Boolean indicating if message has been read (defaults to FALSE)
- **importance**: Message importance level (low, normal, high - defaults to normal)
- **has_attachments**: Boolean indicating presence of attachments (defaults to FALSE)
- **classification**: Email classification (new, important, marketing, unclassified - defaults to unclassified)
- **body_preview**: Truncated preview of message body content
- **web_link**: URL to view message in Outlook Web App
- **first_seen_at**: Timestamp when message was first synchronized (auto-set)
- **last_seen_at**: Timestamp when message was last seen during sync (auto-updated)

## email_messages Indexes

Performance indexes are created on:
- `graph_message_id` (unique constraint for deduplication)
- `received_at` (for chronological ordering)
- `sender_email` (for sender-based queries)
- `subject` (for subject searches)
- `is_read` (for unread message filtering)
- `importance` (for importance-based filtering)
- `classification` (for category-based queries)
- `conversation_id` (for conversation threading)
- `has_attachments` (for attachment filtering)
- `first_seen_at` and `last_seen_at` (for sync tracking)

Composite indexes for common query patterns:
- `classification + received_at` (for categorized message lists)
- `is_read + received_at` (for unread message queries)
- `importance + received_at` (for important message queries)

## audit_log Table Schema

The audit_log table tracks all system operations and data modifications with these columns:

- **id**: Primary key identifier (TEXT, NOT NULL)
- **timestamp**: Timestamp automatically set to current UTC time (DATETIME, NOT NULL, DEFAULT CURRENT_TIMESTAMP)
- **operation**: Operation type - one of: 'create', 'update', 'delete', 'sync', 'auth' (TEXT, NOT NULL, CHECK constraint)
- **resource_type**: Resource type - one of: 'email', 'calendar', 'draft', 'token', 'sync_state' (TEXT, NOT NULL, CHECK constraint)
- **resource_id**: Resource identifier, NULL for bulk operations (TEXT, nullable)
- **result**: Operation result - one of: 'success', 'failure', 'partial' (TEXT, NOT NULL, CHECK constraint)
- **requested_by**: API caller identification, NULL for system operations (TEXT, nullable)
- **details_json**: Structured operation metadata as JSON string (TEXT, nullable)

## audit_log Indexes

Performance indexes are created on:
- `timestamp` (for chronological queries and performance)
- `resource_type` (for filtering by resource type)
- `operation + result` (composite index for filtering operations by outcome)
- `resource_id` (for tracking specific resource operations)
- `resource_type + timestamp` (composite index for efficient resource-specific chronological queries)

## Audit Log Requirements Compliance

The audit_log table satisfies requirements 11.1, 11.2, and 11.3:

**11.1**: Creates audit log entries with timestamp, operation type, resource type, result, and requester information
**11.2**: Logs sync statistics and status without including sensitive user content 
**11.3**: Records audit entries with operation details in structured JSON format

Security features:
- Never logs access tokens, refresh tokens, email bodies, or private calendar content
- Sanitizes error messages in logs to prevent sensitive data exposure
- Supports both system operations (requested_by = NULL) and API caller identification