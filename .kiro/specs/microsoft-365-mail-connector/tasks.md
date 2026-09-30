# Implementation Plan: Microsoft 365 Mail Connector

## Overview

This implementation plan follows the 18-phase development approach specified in the original MailConn Spec.txt, creating a production-quality Microsoft 365 connector for Reinier's Morning Intelligence Brief. The tasks are structured to build incrementally from foundation to completion, with comprehensive testing and validation at each phase.

## Tasks

### Phase 1: Project Foundation

- [x] 1. Create project structure and configuration files
  - Set up clean modular architecture with TypeScript
  - Create package.json, tsconfig.json, wrangler.jsonc, .gitignore
  - Create documentation files: README.md, SETUP.md, ARCHITECTURE.md, SECURITY.md, API.md, TESTING.md, TROUBLESHOOTING.md
  - Set up src/ directory structure with auth/, microsoft/, api/, sync/, validation/, database/, security/ modules
  - _Requirements: 8.1, 17.1, 17.4_

  - [ ]* 1.1 Write unit tests for project configuration validation
    - Test TypeScript configuration and build setup
    - Validate module structure and import paths
    - _Requirements: 17.1, 17.2_

### Phase 2: D1 Database Schema and Migrations

- [x] 2. Create D1 database schema and migration system
  - [x] 2.1 Create sync_state table migration
    - Implement table with id, source, last_attempt_at, last_success_at, last_success_cursor, status, error_code, error_message, messages_checked, events_checked, pages_checked, pagination_complete, updated_at columns
    - Add proper indexes on source and updated_at
    - _Requirements: 2.3, 7.1, 7.2_

  - [x] 2.2 Create email_messages table migration  
    - Implement table with id, graph_message_id (unique), conversation_id, internet_message_id, received_at, sender_email, sender_name, subject, is_read, importance, has_attachments, classification, body_preview, web_link, first_seen_at, last_seen_at columns
    - Add unique constraint on graph_message_id and indexes for queries
    - _Requirements: 2.1, 4.3, 4.4_

  - [x] 2.3 Create calendar_events table migration
    - Implement table with id, graph_event_id (unique), subject, start_at, end_at, timezone, location, organiser, response_status, is_cancelled, body_preview, first_seen_at, last_seen_at columns  
    - Add unique constraint on graph_event_id and indexes for date queries
    - _Requirements: 2.2, 5.2, 5.3_

  - [x] 2.4 Create audit_log table migration
    - Implement table with id, timestamp, operation, resource_type, resource_id, result, requested_by, details_json columns
    - Add indexes on timestamp and resource_type for query performance
    - _Requirements: 11.1, 11.2, 11.3_

  - [ ]* 2.5 Write database migration tests
    - Test migration execution and rollback functionality
    - Validate table constraints and indexes
    - Test data integrity rules
    - _Requirements: 17.2, 17.3_

### Phase 3: Microsoft OAuth Implementation

- [x] 3. Implement Microsoft OAuth authorization flow
  - [x] 3.1 Create OAuth handler with secure state management
    - Implement OAuthHandler class with initiateLogin(), handleCallback(), refreshTokens(), logout(), validateTokens() methods
    - Generate cryptographically secure state parameters for CSRF protection
    - _Requirements: 1.1, 1.2, 15.1, 15.5_

  - [x] 3.2 Implement OAuth endpoints in API router
    - Create GET /auth/login, GET /auth/callback, GET /auth/logout endpoints
    - Validate state parameter consistency and handle OAuth errors
    - _Requirements: 1.3, 3.1_

  - [x] 3.3 Implement token storage and refresh logic
    - Store tokens securely using Cloudflare Worker Secrets
    - Implement automatic token refresh with 5-minute expiration buffer
    - Validate token scope matches required permissions
    - _Requirements: 1.4, 1.5, 2.1, 2.2, 2.4, 2.5, 15.1_

  - [ ]* 3.4 Write OAuth security tests
    - **Property 1: OAuth Security and Permission Constraint**
    - **Validates: Requirements 1.1, 1.2, 1.5, 9.4, 18.4**
    
  - [ ]* 3.5 Write token lifecycle tests
    - **Property 2: Token Lifecycle Integrity**  
    - **Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5**

### Phase 4: Microsoft Graph Client

- [x] 4. Create reusable Microsoft Graph client with reliability features
  - [x] 4.1 Implement Graph client base functionality
    - Create GraphClient class with automatic Authorization header management
    - Implement token refresh on 401 responses and timeout handling
    - Generate unique request IDs for diagnostics without logging sensitive data
    - _Requirements: 3.1, 3.4, 3.5, 11.4_

  - [x] 4.2 Implement Graph error handling and retry logic
    - Handle rate limiting (429) with exponential backoff and Retry-After compliance
    - Classify errors as transient, authentication, rate_limit, service_unavailable, permanent
    - Implement retry operations with appropriate backoff intervals
    - _Requirements: 3.2, 3.3, 14.1, 14.2_

  - [x] 4.3 Implement Graph API method interfaces
    - Create getMessages(), getCalendarEvents(), createDraft(), createCalendarEvent(), updateCalendarEvent(), getUserProfile() methods
    - Implement proper TypeScript interfaces for all Graph responses
    - _Requirements: 4.4, 5.2, 9.1, 10.1, 10.2_

  - [ ]* 4.4 Write Graph client reliability tests
    - **Property 3: Graph API Reliability**
    - **Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5**

### Phase 5: Email Retrieval Implementation

- [x] 5. Implement comprehensive email data retrieval
  - [x] 5.1 Create email message data model and validation
    - Implement EmailMessage interface with all required fields
    - Add validation for graph_message_id uniqueness and data types
    - _Requirements: 4.4, 15.2, 15.4_

  - [x] 5.2 Implement complete email pagination logic
    - Follow ALL @odata.nextLink pagination until completion
    - Track pagesChecked, itemsChecked, and paginationComplete status
    - Mark sync as partial when any page fails
    - _Requirements: 4.1, 4.2, 2.4_

  - [x] 5.3 Implement email retrieval with metadata collection
    - Collect message ID, conversation ID, received date, sender, subject, read state, importance, attachments, body preview, web link
    - Handle Graph API response mapping to internal data model
    - _Requirements: 4.4_

  - [ ]* 5.4 Write email pagination tests
    - **Property 4: Complete Pagination Handling**
    - **Validates: Requirements 4.1, 4.2, 5.1**

### Phase 6: Email Synchronization Engine

- [x] 6. Implement checkpoint-based email synchronization
  - [x] 6.1 Create sync engine with checkpoint management
    - Implement SyncEngine class with syncEmails(), getLastSuccessfulSync(), validateCompleteness() methods
    - Save sync checkpoints only after successful complete synchronization
    - _Requirements: 2.3, 6.1, 6.2_

  - [x] 6.2 Implement incremental sync with safety overlap
    - Use safety overlap window from last successful checkpoint to prevent data gaps
    - Implement deduplication using graph_message_id as unique identifier
    - _Requirements: 4.3, 4.5, 6.3_

  - [x] 6.3 Implement failure retention logic
    - Retain previous successful data when current sync fails or is incomplete
    - Never reset checkpoints or clear data on sync failures
    - _Requirements: 6.4, 12.3_

  - [ ]* 6.4 Write email deduplication tests
    - **Property 5: Data Deduplication and Collection**
    - **Validates: Requirements 4.3, 4.4, 5.2, 5.3**

  - [ ]* 6.5 Write checkpoint reliability tests
    - **Property 6: Checkpoint-Based Reliability**
    - **Validates: Requirements 4.5, 6.1, 6.2, 6.3, 6.4**

### Phase 7: Calendar Retrieval Implementation

- [x] 7. Implement calendar event data retrieval
  - [x] 7.1 Create calendar event data model and validation
    - Implement CalendarEvent interface with required fields
    - Validate start_at ≤ end_at and proper timezone handling
    - _Requirements: 5.2, 5.5, 10.5_

  - [x] 7.2 Implement calendar data retrieval with date filtering
    - Support GET /calendar with from/to date range parameters
    - Collect event ID, subject, start/end times, timezone, location, organizer, response status, cancellation status, body preview
    - _Requirements: 5.2, 5.5_

  - [x] 7.3 Implement calendar pagination and completeness validation
    - Follow complete pagination for calendar queries
    - Apply same reliability rules as email synchronization
    - _Requirements: 5.1, 2.4_

  - [ ]* 7.4 Write calendar synchronization tests
    - Test date range filtering and timezone handling
    - Test pagination completeness and failure scenarios
    - _Requirements: 5.1, 5.3, 5.4_

### Phase 8: Draft Email Creation

- [x] 8. Implement email draft creation without sending
  - [x] 8.1 Create draft creation endpoints and validation
    - Implement POST /drafts and POST /drafts/reply endpoints
    - Validate draft content: subject, body, recipients
    - Ensure drafts appear in Microsoft Outlook Drafts folder
    - _Requirements: 9.1, 9.2, 9.3_

  - [x] 8.2 Ensure no email sending capability
    - Verify no /send endpoints exist and Mail.Send permission not requested
    - Implement draft-only functionality with proper validation
    - _Requirements: 9.4, 18.4_

  - [ ]* 8.3 Write draft creation tests
    - **Property 10: Draft Creation Without Sending**
    - **Validates: Requirements 9.1, 9.2, 9.3, 9.5**

### Phase 9: Calendar Event Management

- [x] 9. Implement calendar write operations
  - [x] 9.1 Create calendar event creation endpoint
    - Implement POST /calendar/events with required field validation
    - Validate subject, start/end times, timezone for all calendar events
    - _Requirements: 10.1, 10.5_

  - [x] 9.2 Create calendar event update endpoint
    - Implement PATCH /calendar/events/:id with conflict detection
    - Retrieve existing event first to verify ID and prevent conflicts
    - _Requirements: 10.2_

  - [x] 9.3 Implement calendar operation authentication and auditing
    - Require valid Bearer token authentication for all calendar operations
    - Record all calendar modifications in audit_log table
    - _Requirements: 10.3, 10.4_

  - [ ]* 9.4 Write calendar management tests
    - **Property 11: Calendar Event Management**
    - **Validates: Requirements 10.1, 10.2, 10.5, 5.5**

### Phase 10: API Security Implementation

- [ ] 10. Implement comprehensive API security
  - [ ] 10.1 Create API authentication middleware
    - Validate Bearer token authentication against stored Cloudflare secrets
    - Return 401 for unauthenticated requests to private endpoints
    - _Requirements: 8.1, 8.2, 4.1_

  - [ ] 10.2 Implement input validation and sanitization
    - Validate and sanitize all external inputs including Graph responses
    - Implement proper SQL parameterization for database queries
    - Sanitize error messages to prevent sensitive data leakage
    - _Requirements: 15.2, 15.3, 15.4_

  - [ ] 10.3 Secure sensitive data handling
    - Store OAuth tokens using Cloudflare Worker Secrets only
    - Never log access tokens, refresh tokens, email bodies, or calendar bodies
    - _Requirements: 15.1, 11.4_

  - [ ]* 10.4 Write security validation tests
    - **Property 16: Security and Input Validation**
    - **Validates: Requirements 15.1, 15.2, 15.3, 15.4, 15.5**

### Phase 11: Reliability Engine Implementation

- [ ] 11. Create comprehensive reliability and status management
  - [ ] 11.1 Implement sync status classification system
    - Classify sync results as complete, partial, failed, unauthorized, rate_limited, source_unavailable
    - Track comprehensive sync statistics: itemsProcessed, pagesProcessed, paginationComplete
    - Distinguish between "no new data" and "sync incomplete"
    - _Requirements: 7.1, 7.2, 7.3, 6.5_

  - [ ] 11.2 Create reliability validation engine
    - Validate sync completeness and generate operational warnings
    - Never report empty results without proper status classification
    - Implement failure classification for operational troubleshooting
    - _Requirements: 7.4, 7.5, 2.4, 14.1_

  - [ ] 11.3 Implement comprehensive error handling
    - Handle database connectivity and Microsoft Graph availability issues
    - Preserve previous successful state during service unavailability
    - _Requirements: 14.3, 14.4, 14.5_

  - [ ]* 11.4 Write reliability engine tests
    - **Property 7: Sync Status Classification**
    - **Validates: Requirements 6.5, 7.1, 7.2, 7.3, 7.4, 7.5**

### Phase 12: Data Retention and Failure Handling

- [ ] 12. Implement failure retention and recovery systems
  - [ ] 12.1 Create failure retention logic
    - Preserve all previously synchronized data during sync failures
    - Retain previous successful checkpoint data unchanged
    - Never delete old data or reset checkpoints on sync failures
    - _Requirements: 6.4, 12.3_

  - [ ] 12.2 Implement comprehensive audit logging
    - Create audit log entries for all data modifications with structured metadata
    - Log sync operations with statistics without sensitive content
    - Record calendar and email operations with operation details
    - _Requirements: 11.1, 11.2, 11.3, 11.5_

  - [ ]* 12.3 Write failure retention tests
    - Test data preservation during various failure scenarios
    - Validate checkpoint integrity and recovery procedures
    - _Requirements: 6.4, 12.3_

### Phase 13: Morning Brief API Implementation

- [ ] 13. Create Morning Brief generation endpoint
  - [ ] 13.1 Implement brief data categorization and formatting
    - Categorize email data: new messages, important messages, marketing messages, unread messages
    - Format calendar data: today's events, next 7 days events
    - _Requirements: 8.3, 8.4_

  - [ ] 13.2 Implement brief status reporting and warnings
    - Include sync status for each data source: overall, email, calendar
    - Generate warnings when any data source is incomplete
    - Return structured JSON with generated timestamp
    - _Requirements: 8.5_

  - [ ] 13.3 Secure brief endpoint with authentication
    - Require Bearer token authentication for /brief endpoint
    - Include data reliability warnings in response
    - _Requirements: 8.1, 8.5_

  - [ ]* 13.4 Write morning brief tests
    - **Property 9: Morning Brief Data Structure**
    - **Validates: Requirements 8.3, 8.4**

### Phase 14: Scheduled Synchronization

- [ ] 14. Implement Cloudflare Cron scheduled operations
  - [ ] 14.1 Create scheduled sync handler
    - Implement scheduled() handler for Cloudflare Cron events
    - Perform complete email and calendar synchronization
    - Validate authentication tokens and refresh if necessary
    - _Requirements: 12.1, 12.2_

  - [ ] 14.2 Implement scheduled sync reliability
    - Update sync status and preserve previous data on failure scenarios
    - Record failure details and maintain system stability during errors
    - Support UTC-based cron configuration with timezone handling
    - _Requirements: 12.3, 12.4, 12.5_

  - [ ]* 14.3 Write scheduled operation tests
    - **Property 13: Scheduled Operation Reliability**
    - **Validates: Requirements 12.1, 12.2, 12.3, 12.4, 12.5**

### Phase 15: Health and Status Monitoring

- [ ] 15. Create comprehensive system monitoring endpoints
  - [ ] 15.1 Implement health monitoring endpoints
    - Create GET /health, GET /status, GET /version endpoints
    - Return overall system health without exposing sensitive data
    - Include sync status, last successful sync times, error conditions
    - _Requirements: 13.1, 13.2, 13.3_

  - [ ] 15.2 Implement secure status reporting
    - Allow public access to /health while protecting detailed status
    - Never expose OAuth tokens, user credentials, or sensitive content
    - _Requirements: 13.4, 13.5_

  - [ ]* 15.3 Write health monitoring tests
    - **Property 14: Status and Health Reporting Security**
    - **Validates: Requirements 13.1, 13.2, 13.3, 13.4, 13.5**

### Phase 16: Comprehensive Testing Suite

- [ ] 16. Create production-quality test coverage
  - [ ]* 16.1 Write comprehensive unit tests
    - Achieve 95% line coverage with focus on critical paths
    - Test OAuth security, token management, and authentication flows
    - Test Graph client error handling, retry logic, and reliability
    - _Requirements: 17.1, 17.2_

  - [ ]* 16.2 Write integration tests  
    - Test Microsoft Graph interactions with proper mocking
    - Test database operations and transaction integrity
    - Test end-to-end workflows and component interactions
    - _Requirements: 17.2_

  - [ ]* 16.3 Write property-based tests
    - Test data processing, deduplication, and reliability validation
    - Test email and calendar sync completeness properties
    - Test authentication and authorization security properties
    - _Requirements: 17.3_

  - [ ]* 16.4 Write critical reliability tests
    - Test pagination failure scenarios and data retention
    - Test sync checkpoint integrity and recovery procedures
    - Test complete error classification and retry strategies
    - _Requirements: 17.1, 17.2_

### Phase 17: Documentation and Setup Guides

- [ ] 17. Create comprehensive documentation suite
  - [ ] 17.1 Write step-by-step setup documentation
    - Document exact Microsoft Entra ID configuration steps
    - Document exact Cloudflare Worker and D1 setup procedures
    - Provide exact commands and configuration values
    - _Requirements: 17.4_

  - [ ] 17.2 Create operational documentation
    - Write troubleshooting guides for common failure scenarios
    - Document API endpoints with specifications and examples
    - Explain system architecture and data flow patterns
    - _Requirements: 17.5_

  - [ ] 17.3 Document security and compliance procedures
    - Document privacy protections and data handling procedures
    - Explain single-user constraints and system boundaries
    - Document audit logging and operational monitoring
    - _Requirements: 18.3, 18.5_

### Phase 18: Final Validation and Production Readiness

- [ ] 18. Complete system validation and deployment preparation
  - [ ] 18.1 Perform comprehensive system validation
    - Run complete test suite with npm test
    - Validate build process with npm run build
    - Test deployment process with npx wrangler deploy --dry-run
    - _Requirements: 17.1, 17.2, 17.3_

  - [ ] 18.2 Security audit and credential verification
    - Search repository for any exposed credentials or secrets
    - Verify git status shows no tracked sensitive files
    - Validate all secrets use Cloudflare Worker Secrets properly
    - _Requirements: 15.1, 18.4_

  - [ ] 18.3 Final single-user constraint validation
    - Verify system authenticates only Reinier's Microsoft 365 account
    - Confirm no multi-user functionality exists in codebase
    - Validate email sending capability is completely absent
    - _Requirements: 18.1, 18.2, 18.4_

  - [ ] 18.4 Production deployment preparation
    - Prepare production configuration files and secrets
    - Document exact manual setup steps for user execution
    - Create deployment checklist and validation procedures
    - _Requirements: 8.1, 17.4_

## Task Checkpoint Tasks

- [x] Checkpoint 1 - After Phase 6: Email Synchronization Complete
  - Ensure all tests pass, ask the user if questions arise.

- [ ] Checkpoint 2 - After Phase 11: Core Reliability Complete  
  - Ensure all tests pass, ask the user if questions arise.

- [ ] Checkpoint 3 - After Phase 15: All Endpoints Complete
  - Ensure all tests pass, ask the user if questions arise.

- [ ] Final Checkpoint - After Phase 18: Production Ready
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional test-related sub-tasks that can be skipped for faster MVP delivery
- Each task references specific requirements for traceability and validation
- Property-based tests validate universal correctness properties from the design document
- Unit and integration tests provide comprehensive coverage for reliability
- Checkpoints ensure incremental validation and user feedback at key milestones
- All tasks focus exclusively on coding, testing, and implementation activities
- The 18-phase approach ensures production-quality standards throughout development

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "2.1", "2.2", "2.3", "2.4"] },
    { "id": 1, "tasks": ["2.5", "3.1"] },
    { "id": 2, "tasks": ["3.2", "3.3", "4.1"] },
    { "id": 3, "tasks": ["3.4", "3.5", "4.2", "4.3", "5.1"] },
    { "id": 4, "tasks": ["4.4", "5.2", "5.3"] },
    { "id": 5, "tasks": ["5.4", "6.1", "6.2"] },
    { "id": 6, "tasks": ["6.3", "6.4", "6.5", "7.1"] },
    { "id": 7, "tasks": ["7.2", "7.3"] },
    { "id": 8, "tasks": ["7.4", "8.1", "8.2"] },
    { "id": 9, "tasks": ["8.3", "9.1", "9.2"] },
    { "id": 10, "tasks": ["9.3", "9.4", "10.1"] },
    { "id": 11, "tasks": ["10.2", "10.3", "11.1"] },
    { "id": 12, "tasks": ["10.4", "11.2", "11.3"] },
    { "id": 13, "tasks": ["11.4", "12.1", "12.2"] },
    { "id": 14, "tasks": ["12.3", "13.1", "13.2"] },
    { "id": 15, "tasks": ["13.3", "13.4", "14.1"] },
    { "id": 16, "tasks": ["14.2", "14.3", "15.1"] },
    { "id": 17, "tasks": ["15.2", "15.3", "16.1"] },
    { "id": 18, "tasks": ["16.2", "16.3", "16.4", "17.1"] },
    { "id": 19, "tasks": ["17.2", "17.3", "18.1"] },
    { "id": 20, "tasks": ["18.2", "18.3", "18.4"] }
  ]
}
```