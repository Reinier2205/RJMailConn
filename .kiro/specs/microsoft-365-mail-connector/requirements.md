# Requirements Document

## Introduction

This document specifies the requirements for the Microsoft 365 Mail Connector, a production-quality, single-user system that provides a reliable bridge between Microsoft 365 services and Reinier's Morning Intelligence Brief. The requirements are derived from the approved technical design and align with the 18-phase development approach specified in the original specification.

## Glossary

- **System**: The Microsoft 365 Mail Connector application
- **Graph_Client**: The Microsoft Graph API client component
- **Sync_Engine**: The data synchronization orchestration component  
- **OAuth_Handler**: The authentication and token management component
- **API_Router**: The HTTP request routing and authentication component
- **Reliability_Engine**: The completeness validation and failure handling component
- **Worker**: The Cloudflare Workers runtime environment
- **D1_Database**: The Cloudflare D1 SQL database instance
- **Morning_Brief**: The consumer system that retrieves structured daily briefing data
- **Microsoft_Graph**: The Microsoft Graph API service
- **Entra_ID**: Microsoft Entra ID (formerly Azure AD) authentication service

## Requirements

### Requirement 1

**User Story:** As Reinier, I want secure authentication to my Microsoft 365 account, so that the connector can access my email and calendar data without compromising security.

#### Acceptance Criteria

1. WHEN initiating authentication, THE OAuth_Handler SHALL generate a cryptographically secure state parameter for CSRF protection
2. WHEN exchanging authorization codes, THE OAuth_Handler SHALL validate the state parameter matches the generated value
3. WHEN authentication completes successfully, THE OAuth_Handler SHALL retrieve user identity from Microsoft Graph /me endpoint
4. THE System SHALL request only delegated permissions: openid, profile, email, offline_access, User.Read, Mail.Read, Mail.ReadWrite, Calendars.ReadWrite
5. THE System SHALL NOT request Mail.Send permission under any circumstances

### Requirement 2

**User Story:** As the system, I want automatic token lifecycle management, so that authentication remains valid without manual intervention.

#### Acceptance Criteria

1. WHEN access tokens expire within 5 minutes, THE OAuth_Handler SHALL automatically refresh them using stored refresh tokens
2. WHEN Graph API returns 401 unauthorized, THE OAuth_Handler SHALL attempt token refresh before retrying the operation
3. WHEN refresh tokens become invalid, THE OAuth_Handler SHALL clear stored tokens and require fresh authentication
4. WHEN tokens are successfully refreshed, THE OAuth_Handler SHALL store new tokens securely using Cloudflare Worker Secrets
5. THE OAuth_Handler SHALL validate token scope matches required permissions before API operations

### Requirement 3

**User Story:** As the system, I want reliable Microsoft Graph API communication, so that I can retrieve email and calendar data with proper error handling.

#### Acceptance Criteria

1. WHEN making Graph API requests, THE Graph_Client SHALL include automatic Authorization header management
2. WHEN Graph API returns rate limiting (429), THE Graph_Client SHALL implement exponential backoff with Retry-After header compliance
3. WHEN Graph API returns transient errors, THE Graph_Client SHALL retry operations with appropriate backoff intervals
4. WHEN Graph API operations timeout, THE Graph_Client SHALL handle timeouts gracefully and classify failures appropriately
5. THE Graph_Client SHALL generate unique request IDs for diagnostic correlation without logging sensitive data

### Requirement 4

**User Story:** As the system, I want complete email synchronization, so that no messages are missed during data retrieval.

#### Acceptance Criteria

1. WHEN retrieving emails, THE Sync_Engine SHALL follow ALL @odata.nextLink pagination until no more pages exist
2. WHEN any pagination page fails, THE Sync_Engine SHALL mark the sync as partial and set paginationComplete to false
3. WHEN processing email messages, THE Sync_Engine SHALL deduplicate using graph_message_id as the unique identifier
4. WHEN retrieving messages, THE Graph_Client SHALL collect: message ID, conversation ID, received date, sender, subject, read state, importance, attachments, body preview, web link
5. THE Sync_Engine SHALL implement checkpoint-based incremental sync with safety overlap window to prevent data gaps

### Requirement 5

**User Story:** As the system, I want complete calendar synchronization, so that all events are accurately retrieved and stored.

#### Acceptance Criteria

1. WHEN retrieving calendar events, THE Sync_Engine SHALL follow complete pagination until no @odata.nextLink exists
2. WHEN retrieving events, THE Graph_Client SHALL collect: event ID, subject, start/end times, timezone, location, organizer, response status, cancellation status, body preview
3. WHEN processing calendar events, THE Sync_Engine SHALL deduplicate using graph_event_id as the unique identifier
4. WHEN calendar sync fails partially, THE Sync_Engine SHALL retain previous successful data and mark sync status appropriately
5. THE Sync_Engine SHALL support date range filtering for calendar queries with proper timezone handling

### Requirement 6

**User Story:** As the system, I want checkpoint-based reliability, so that sync failures don't result in data loss or corruption.

#### Acceptance Criteria

1. WHEN sync completes successfully, THE Sync_Engine SHALL save checkpoint data including timestamp and pagination cursor
2. WHEN sync fails or is incomplete, THE Sync_Engine SHALL retain previous successful checkpoint data unchanged
3. WHEN starting incremental sync, THE Sync_Engine SHALL use safety overlap window from last successful checkpoint
4. WHEN sync fails, THE Sync_Engine SHALL preserve all previously synchronized data without deletion or modification
5. THE Reliability_Engine SHALL validate sync completeness and never report empty results without proper status classification

### Requirement 7

**User Story:** As the system, I want comprehensive status tracking, so that sync reliability can be monitored and reported accurately.

#### Acceptance Criteria

1. THE Sync_Engine SHALL classify all sync results as: complete, partial, failed, unauthorized, rate_limited, or source_unavailable
2. THE Sync_Engine SHALL track sync statistics: itemsProcessed, pagesProcessed, paginationComplete, startedAt, completedAt
3. WHEN generating status reports, THE Reliability_Engine SHALL distinguish between "no new data" and "sync incomplete"
4. WHEN sync is incomplete, THE Reliability_Engine SHALL generate appropriate warning messages for operational visibility
5. THE System SHALL record sync attempts, success states, and failure details in the sync_state table

### Requirement 8

**User Story:** As the Morning_Brief consumer, I want secure API access to synchronized data, so that I can retrieve structured briefing information.

#### Acceptance Criteria

1. WHEN accessing private endpoints, THE API_Router SHALL validate Bearer token authentication against stored Cloudflare secrets
2. WHEN unauthenticated requests access private endpoints, THE API_Router SHALL return 401 Unauthorized status
3. WHEN generating morning brief, THE API_Router SHALL return categorized email data: new messages, important messages, marketing messages, unread messages
4. WHEN generating morning brief, THE API_Router SHALL return calendar data: today's events and next 7 days events
5. WHEN any data source is incomplete, THE API_Router SHALL include warnings in the brief response indicating data reliability status

### Requirement 9

**User Story:** As a user, I want email draft creation capability, so that I can compose messages without sending them automatically.

#### Acceptance Criteria

1. WHEN creating drafts via POST /drafts, THE Graph_Client SHALL create email drafts in Microsoft Graph that appear in Outlook Drafts folder
2. WHEN creating reply drafts via POST /drafts/reply, THE Graph_Client SHALL create reply drafts linked to existing message conversations
3. WHEN validating draft content, THE API_Router SHALL require subject, body, and valid recipient email addresses
4. THE System SHALL NOT implement email sending endpoints or request Mail.Send permissions
5. WHEN draft creation fails, THE Graph_Client SHALL return appropriate error details for troubleshooting

### Requirement 10

**User Story:** As a user, I want calendar event management, so that I can create and update calendar events through authenticated API requests.

#### Acceptance Criteria

1. WHEN creating events via POST /calendar/events, THE Graph_Client SHALL validate required fields: subject, start time, end time, timezone
2. WHEN updating events via PATCH /calendar/events/:id, THE Graph_Client SHALL retrieve existing event first to verify ID and prevent conflicts
3. WHEN performing calendar operations, THE API_Router SHALL require valid Bearer token authentication
4. WHEN calendar modifications occur, THE System SHALL record operations in audit_log table with operation details
5. THE Graph_Client SHALL ensure start time is before or equal to end time for all calendar events

### Requirement 11

**User Story:** As the system, I want comprehensive audit logging, so that all data modifications and system operations are traceable.

#### Acceptance Criteria

1. WHEN data modifications occur, THE System SHALL create audit log entries with: timestamp, operation type, resource type, result, requester
2. WHEN sync operations execute, THE System SHALL log sync statistics and status without including sensitive user content  
3. WHEN calendar events are created or updated, THE System SHALL record audit entries with operation details in structured JSON format
4. THE System SHALL NOT log access tokens, refresh tokens, email bodies, or private calendar content in any audit records
5. WHEN system errors occur, THE System SHALL sanitize error messages in logs to prevent sensitive data exposure

### Requirement 12

**User Story:** As the system, I want automated scheduled synchronization, so that email and calendar data stays current without manual intervention.

#### Acceptance Criteria

1. WHEN Cloudflare Cron triggers execute, THE System SHALL perform complete email and calendar synchronization
2. WHEN scheduled sync executes, THE Sync_Engine SHALL validate authentication tokens and refresh if necessary
3. WHEN scheduled sync completes, THE System SHALL update sync status and preserve previous data on failure scenarios
4. WHEN scheduled operations encounter errors, THE System SHALL record failure details and maintain system stability
5. THE System SHALL support UTC-based cron configuration with proper timezone handling for operational scheduling

### Requirement 13

**User Story:** As system operators, I want health monitoring and status endpoints, so that system reliability can be assessed and issues diagnosed.

#### Acceptance Criteria

1. WHEN health status is requested via GET /health, THE API_Router SHALL return overall system health without exposing sensitive data
2. WHEN detailed status is requested via GET /status, THE API_Router SHALL return sync status, last successful sync times, and error conditions
3. WHEN version information is requested via GET /version, THE API_Router SHALL return application version and build information
4. THE API_Router MAY allow public access to /health endpoint while protecting detailed status and version endpoints
5. THE System SHALL never expose OAuth tokens, user credentials, or sensitive mailbox content through status endpoints

### Requirement 14

**User Story:** As the system, I want robust error handling and recovery, so that transient failures don't compromise data integrity or system availability.

#### Acceptance Criteria

1. WHEN transient failures occur, THE Reliability_Engine SHALL classify errors as: transient, authentication, rate_limit, service_unavailable, or permanent
2. WHEN retryable errors occur, THE System SHALL implement exponential backoff with maximum retry limits to prevent infinite loops
3. WHEN database connectivity fails, THE System SHALL handle errors gracefully while maintaining data consistency
4. WHEN Microsoft Graph becomes unavailable, THE System SHALL preserve previous successful state and retry with appropriate delays
5. THE Reliability_Engine SHALL provide detailed failure classification for operational troubleshooting and alerting

### Requirement 15

**User Story:** As the system, I want secure data handling, so that sensitive authentication and user information is properly protected.

#### Acceptance Criteria

1. WHEN storing OAuth tokens, THE System SHALL use only Cloudflare Worker Secrets and never store tokens in source code or configuration
2. WHEN handling user inputs, THE System SHALL validate and sanitize all external data including Microsoft Graph responses
3. WHEN generating error responses, THE System SHALL sanitize error messages to prevent sensitive information leakage
4. WHEN processing email and calendar data, THE System SHALL implement proper SQL parameterization for database queries
5. THE System SHALL validate OAuth callback parameters including state and authorization code format and content

### Requirement 16

**User Story:** As the system, I want efficient performance characteristics, so that operations complete within acceptable time and resource constraints.

#### Acceptance Criteria

1. WHEN processing API requests, THE System SHALL respond within 10 seconds for morning brief generation and 5 seconds for data retrieval
2. WHEN synchronizing data, THE System SHALL limit Microsoft Graph requests to 50 items per page for optimal performance
3. WHEN handling large result sets, THE System SHALL implement streaming processing to minimize memory usage within Cloudflare Workers limits
4. WHEN performing database operations, THE System SHALL use batched transactions and proper connection management
5. THE System SHALL execute email and calendar synchronization in parallel when possible to improve overall throughput

### Requirement 17

**User Story:** As developers and operators, I want comprehensive documentation and testing, so that the system can be properly maintained and operated.

#### Acceptance Criteria

1. THE System SHALL include unit tests achieving 95% line coverage and 100% coverage of critical authentication and sync paths
2. THE System SHALL include integration tests for Microsoft Graph interactions, database operations, and end-to-end workflows
3. THE System SHALL include property-based tests for data processing, deduplication, and reliability validation logic
4. THE System SHALL provide step-by-step documentation for Microsoft Entra ID and Cloudflare configuration with exact commands and values
5. THE System SHALL include troubleshooting guides covering common failure scenarios and recovery procedures

### Requirement 18

**User Story:** As Reinier, I want single-user system constraints enforced, so that the connector operates securely within its intended scope.

#### Acceptance Criteria

1. THE System SHALL authenticate and authorize only Reinier's specific Microsoft 365 account
2. THE System SHALL NOT implement multi-tenant, multi-user, or user management functionality
3. THE System SHALL use database schema and application logic designed for single-user operation
4. THE System SHALL prevent email sending through any pathway and never request Mail.Send permissions
5. THE System SHALL handle personal email and calendar data with appropriate privacy protections within Cloudflare Workers environment

## 2. Data Synchronization Requirements

### 2.1 Email Synchronization
**Requirement**: The system SHALL implement reliable email synchronization with complete pagination handling and duplicate detection.

**Acceptance Criteria**:
- System retrieves emails from Microsoft Graph `/me/messages` endpoint
- System follows ALL pagination links until no `@odata.nextLink` exists
- System records: message ID, conversation ID, received date, sender, subject, read state, importance, attachments, body preview, web link
- System deduplicates messages using Graph message ID as unique identifier
- System implements checkpoint-based incremental sync with safety overlap window

### 2.2 Calendar Synchronization
**Requirement**: The system SHALL synchronize calendar events with date range filtering and complete event metadata.

**Acceptance Criteria**:
- System retrieves calendar events from Microsoft Graph `/me/events` endpoint
- System supports date range filtering with `startTime` and `endTime` parameters
- System records: event ID, subject, start/end times, timezone, location, organizer, attendees, response status, cancellation status
- System handles timezone conversions and all-day events correctly
- System follows complete pagination for large calendar result sets

### 2.3 Checkpoint-Based Reliability
**Requirement**: The system SHALL implement checkpoint-based synchronization that preserves data integrity during failures.

**Acceptance Criteria**:
- System saves sync checkpoints only after successful complete synchronization
- System uses safety overlap window to prevent data gaps during incremental sync
- System retains previous successful data when current sync fails or is incomplete
- System does NOT reset checkpoints or clear data on sync failures
- System tracks sync statistics: items processed, pages processed, pagination completeness

### 2.4 Completeness Detection
**Requirement**: The system SHALL detect and report incomplete synchronization results with appropriate status classification.

**Acceptance Criteria**:
- System classifies sync results as: `complete`, `partial`, `failed`, `unauthorized`, `rate_limited`, `source_unavailable`
- System sets `paginationComplete = false` when any page request fails
- System generates warnings when sync is incomplete or unreliable
- System never reports empty results without status indicating whether empty is genuine
- System distinguishes between "no new data" and "sync incomplete"

## 3. API Requirements

### 3.1 Authentication Endpoints
**Requirement**: The system SHALL provide secure OAuth endpoints for authentication flow management.

**Acceptance Criteria**:
- `GET /auth/login` initiates OAuth flow with secure state generation
- `GET /auth/callback` handles OAuth callback with state validation
- `GET /auth/logout` clears authentication session and tokens
- All OAuth endpoints implement proper error handling and security measures

### 3.2 Data Access Endpoints  
**Requirement**: The system SHALL provide authenticated API endpoints for accessing synchronized data.

**Acceptance Criteria**:
- `GET /email` returns email messages with filtering and pagination
- `GET /calendar` returns calendar events with date range filtering  
- All data endpoints require valid Bearer token authentication
- Endpoints return structured JSON with consistent error formatting
- Endpoints include data freshness and sync status information

### 3.3 Draft Creation Endpoints
**Requirement**: The system SHALL support email draft creation without sending capability.

**Acceptance Criteria**:
- `POST /drafts` creates new email drafts via Microsoft Graph
- `POST /drafts/reply` creates reply drafts to existing messages
- System validates draft content: subject, body, recipients
- System creates drafts that appear in Microsoft Outlook Drafts folder
- System does NOT implement `/send` endpoints or Mail.Send functionality

### 3.4 Calendar Management Endpoints
**Requirement**: The system SHALL provide authenticated calendar event creation and modification.

**Acceptance Criteria**:
- `POST /calendar/events` creates new calendar events with validation
- `PATCH /calendar/events/:id` updates existing events with conflict detection
- System validates event data: subject, start/end times, timezone
- System requires explicit API authentication for all calendar write operations
- System logs all calendar modifications to audit trail

### 3.5 Morning Brief Endpoint
**Requirement**: The system SHALL generate structured morning brief data with sync status reporting.

**Acceptance Criteria**:
- `GET /brief` returns categorized email and calendar data
- Response includes: new messages, important messages, today's events, next 7 days events
- Response includes sync status for each data source: overall, email, calendar
- Response includes warnings when any data source is incomplete
- Response format matches specified JSON structure with generated timestamp

## 4. Security Requirements

### 4.1 API Authentication
**Requirement**: The system SHALL protect all private API endpoints with Bearer token authentication.

**Acceptance Criteria**:
- All private endpoints require `Authorization: Bearer <token>` header
- System validates bearer tokens against stored Cloudflare secret
- Unauthenticated requests to private endpoints return 401 Unauthorized
- `/health` endpoint MAY be public but exposes only non-sensitive status
- System implements proper CORS headers and security controls

### 4.2 Sensitive Data Protection
**Requirement**: The system SHALL protect sensitive authentication and user data in storage and logging.

**Access Criteria**:
- System stores OAuth tokens using Cloudflare Worker Secrets only
- System does NOT log access tokens, refresh tokens, email bodies, or calendar bodies
- System sanitizes error messages to prevent sensitive data leakage
- System implements audit logging for data modifications without sensitive content
- System does NOT store secrets in source code or configuration files

### 4.3 Input Validation and Sanitization
**Requirement**: The system SHALL validate and sanitize all external inputs to prevent injection attacks.

**Acceptance Criteria**:
- System validates all Microsoft Graph API responses before processing
- System sanitizes user inputs for email drafts and calendar events
- System validates data types, formats, and ranges for all inputs  
- System implements proper SQL parameterization for database queries
- System validates OAuth callback parameters including state and code

## 5. Reliability and Error Handling Requirements

### 5.1 Microsoft Graph Error Handling
**Requirement**: The system SHALL implement comprehensive error handling for Microsoft Graph API interactions.

**Acceptance Criteria**:
- System handles rate limiting (429) with exponential backoff and Retry-After compliance
- System handles authentication errors (401) with automatic token refresh
- System handles service unavailable errors (503) with retry logic
- System classifies errors as: transient, authentication, rate_limit, service_unavailable, permanent
- System implements maximum retry limits to prevent infinite loops

### 5.2 Database Error Handling  
**Requirement**: The system SHALL handle database connectivity and constraint errors gracefully.

**Acceptance Criteria**:
- System retries transient database connection failures
- System handles unique constraint violations during deduplication
- System maintains data consistency during partial transaction failures
- System implements database connection pooling and timeout handling
- System gracefully degrades functionality when database is unavailable

### 5.3 Failure Recovery and Data Retention
**Requirement**: The system SHALL implement failure recovery that preserves previously successful data.

**Acceptance Criteria**:
- Failed sync attempts do NOT delete or corrupt existing data
- Previous successful checkpoints are retained when current sync fails
- System clearly distinguishes between "no new data" and "sync failed"
- System provides detailed failure information for troubleshooting
- Recovery procedures restore service without data loss

## 6. Performance Requirements

### 6.1 Response Time Requirements
**Requirement**: The system SHALL respond to API requests within acceptable time limits for operational use.

**Acceptance Criteria**:
- Authentication endpoints respond within 2 seconds under normal conditions
- Data retrieval endpoints respond within 5 seconds for standard queries
- Morning brief generation completes within 10 seconds
- System implements request timeouts to prevent hanging operations
- System provides appropriate HTTP status codes for timeout scenarios

### 6.2 Throughput Requirements
**Requirement**: The system SHALL handle expected email and calendar data volumes efficiently.

**Acceptance Criteria**:
- System processes up to 1000 email messages per sync operation
- System handles calendar events spanning 12-month windows
- System limits Graph API requests to 50 items per page for optimal performance
- System processes email and calendar sync operations in parallel when possible
- System implements batched database operations for improved throughput

### 6.3 Resource Usage Requirements
**Requirement**: The system SHALL operate within Cloudflare Workers resource constraints.

**Acceptance Criteria**:
- System memory usage stays within Cloudflare Workers limits during operation
- System request execution time stays within Cloudflare Workers timeout limits
- System implements streaming for large data sets to minimize memory usage
- System efficiently uses database connections and closes them properly
- System implements appropriate caching for frequently accessed data

## 7. Operational Requirements

### 7.1 Scheduled Synchronization
**Requirement**: The system SHALL implement automated synchronization via Cloudflare Cron triggers.

**Acceptance Criteria**:
- System implements `scheduled()` handler for Cloudflare Cron events
- Scheduled sync performs complete email and calendar synchronization
- Scheduled sync validates completeness and updates sync status
- Scheduled sync preserves previous data on failure scenarios
- System supports configurable cron timing via Cloudflare configuration

### 7.2 Health Monitoring and Status Reporting
**Requirement**: The system SHALL provide comprehensive health and status monitoring endpoints.

**Acceptance Criteria**:
- `GET /health` returns overall system health status
- `GET /status` returns detailed sync status and statistics
- `GET /version` returns application version information  
- Health endpoints report: authentication status, last successful sync times, error conditions
- Status information excludes sensitive tokens and user content

### 7.3 Audit Logging and Traceability
**Requirement**: The system SHALL maintain comprehensive audit logs for all data modifications and system operations.

**Acceptance Criteria**:
- System logs all data creation, update, and deletion operations
- Audit logs include: timestamp, operation type, resource type, result, requester
- System logs sync operations with statistics and status information
- Audit logs exclude sensitive content while providing operational visibility
- System maintains audit log retention and provides query capabilities

## 8. Development and Deployment Requirements

### 8.1 Technology Stack Requirements
**Requirement**: The system SHALL use the specified technology stack for development and deployment.

**Acceptance Criteria**:
- Application implemented in TypeScript with proper type definitions
- Application runs on Cloudflare Workers runtime environment
- Application uses Cloudflare D1 for relational database storage
- Application uses Cloudflare Worker Secrets for credential management
- Application deployment uses Wrangler CLI and Cloudflare infrastructure

### 8.2 Code Quality and Testing Requirements
**Requirement**: The system SHALL meet production-quality code standards with comprehensive testing.

**Acceptance Criteria**:
- Code maintains 95% line coverage with unit tests
- Critical paths have 100% test coverage
- System includes integration tests for external service interactions
- Code follows TypeScript best practices and linting standards
- System includes property-based tests for data processing logic

### 8.3 Documentation Requirements
**Requirement**: The system SHALL provide comprehensive documentation for setup, operation, and troubleshooting.

**Acceptance Criteria**:
- Documentation includes step-by-step setup instructions for Microsoft and Cloudflare
- Documentation provides exact commands and configuration values
- Documentation includes troubleshooting guides for common scenarios
- API documentation includes endpoint specifications and examples
- Architecture documentation explains system design and data flow

## 9. Compliance and Constraints

### 9.1 Single-User Constraint
**Requirement**: The system SHALL be designed and implemented for single-user access only.

**Acceptance Criteria**:
- System does NOT implement multi-tenant or multi-user functionality
- System authenticates and authorizes only Reinier's Microsoft 365 account
- System does NOT include user management, registration, or account switching
- Database schema and application logic assume single-user operation
- System configuration and deployment support only single-user scenarios

### 9.2 Email Sending Prohibition
**Requirement**: The system SHALL NOT implement email sending capability under any circumstances.

**Acceptance Criteria**:
- System does NOT request `Mail.Send` permission from Microsoft Graph
- System does NOT implement `/send` or similar email sending endpoints
- System creates email drafts only - no automatic sending functionality
- System validation prevents accidental email sending through any pathway
- Code review and testing verify no email sending capability exists

### 9.3 Privacy and Data Handling
**Requirement**: The system SHALL handle personal email and calendar data with appropriate privacy protections.

**Acceptance Criteria**:
- System processes data locally within Cloudflare Workers environment
- System does NOT transmit personal data to external analytics or monitoring services
- System implements data retention policies appropriate for personal data
- System provides data export capabilities if required
- System design supports data deletion and privacy compliance requirements