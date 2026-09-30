/**
 * Database Models for Microsoft 365 Mail Connector
 * 
 * TypeScript interfaces corresponding to D1 database tables
 */

/**
 * Sync status enumeration matching database constraints
 */
export type SyncStatus = 
  | 'complete'
  | 'partial' 
  | 'failed'
  | 'unauthorized'
  | 'rate_limited'
  | 'source_unavailable';

/**
 * Data source types for synchronization
 */
export type SyncSource = 'email' | 'calendar';

/**
 * Sync State table model
 * Tracks synchronization state for email and calendar data sources
 * 
 * Requirements: 2.3, 7.1, 7.2
 */
export interface SyncStateRecord {
  /** Primary identifier */
  id: string;
  
  /** Data source identifier ('email' or 'calendar') */
  source: SyncSource;
  
  /** Timestamp of last sync attempt */
  last_attempt_at: string; // ISO 8601 datetime string
  
  /** Timestamp of last successful sync (null until first success) */
  last_success_at: string | null; // ISO 8601 datetime string
  
  /** Pagination cursor from last successful sync */
  last_success_cursor: string | null;
  
  /** Current sync status */
  status: SyncStatus;
  
  /** Error code for failed syncs */
  error_code: string | null;
  
  /** Human-readable error message */
  error_message: string | null;
  
  /** Count of email messages processed in last sync */
  messages_checked: number;
  
  /** Count of calendar events processed in last sync */
  events_checked: number;
  
  /** Count of pagination pages processed */
  pages_checked: number;
  
  /** Boolean indicating if pagination completed successfully */
  pagination_complete: boolean;
  
  /** Automatic timestamp for last record update */
  updated_at: string; // ISO 8601 datetime string
}

/**
 * Input data for creating a new sync state record
 */
export interface CreateSyncStateInput {
  id: string;
  source: SyncSource;
  last_attempt_at: string;
  status: SyncStatus;
  error_code?: string;
  error_message?: string;
  messages_checked?: number;
  events_checked?: number;
  pages_checked?: number;
  pagination_complete?: boolean;
}

/**
 * Input data for updating an existing sync state record
 */
export interface UpdateSyncStateInput {
  last_attempt_at?: string;
  last_success_at?: string | null;
  last_success_cursor?: string | null;
  status?: SyncStatus;
  error_code?: string | null;
  error_message?: string | null;
  messages_checked?: number;
  events_checked?: number;
  pages_checked?: number;
  pagination_complete?: boolean;
}

/**
 * Checkpoint data for incremental synchronization
 */
export interface SyncCheckpoint {
  source: SyncSource;
  timestamp: string; // ISO 8601 datetime string
  cursor?: string;
  itemCount: number;
  lastMessageId?: string;
  lastEventId?: string;
}

/**
 * Sync validation result for reliability checking
 */
export interface SyncValidation {
  isComplete: boolean;
  isReliable: boolean;
  warningMessage?: string;
  recommendedAction: 'proceed' | 'retry' | 'alert' | 'failover';
}

/**
 * Comprehensive sync result for operations
 */
export interface SyncResult {
  source: SyncSource;
  status: SyncStatus;
  itemsProcessed: number;
  pagesProcessed: number;
  startedAt: string; // ISO 8601 datetime string
  completedAt: string; // ISO 8601 datetime string
  checkpoint?: SyncCheckpoint;
  retainedPrevious: boolean;
  error?: SyncError;
}

/**
 * Sync error with classification
 */
export interface SyncError {
  code: string;
  message: string;
  type: 'transient' | 'authentication' | 'rate_limit' | 'service_unavailable' | 'permanent';
  retryable: boolean;
}

/**
 * Complete sync result for all sources
 */
export interface CompleteSyncResult {
  overall: SyncStatus;
  email: SyncResult;
  calendar: SyncResult;
  warnings: string[];
}