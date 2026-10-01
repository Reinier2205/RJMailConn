/**
 * Sync Engine - Reliable Email and Calendar Synchronization
 * 
 * Orchestrates checkpoint-based synchronization with failure retention,
 * completeness validation, and comprehensive error handling.
 */

import { Environment } from "../index";
import { GraphClient, RetrievalResult, RetrievalStatus } from "../microsoft/graph";
import { EmailMessage,  EmailRepository, processBatchMessages } from "../microsoft/email";
import { SyncSource, CompleteSyncResult, SyncResult, SyncCheckpoint, SyncValidation } from "../database/models";
import { auditLog } from "../database/audit";

/**
 * Email Synchronization Engine
 */
export class SyncEngine {
  private readonly env: Environment;
  private readonly graphClient: GraphClient;

  constructor(env: Environment) {
    this.env = env;
    this.graphClient = new GraphClient(env);
  }

  /**
   * Synchronize all sources (email and calendar)
   */
  async syncAll(): Promise<CompleteSyncResult> {
    const startTime = new Date().toISOString();
    
    const result: CompleteSyncResult = {
      overall: "failed",
      email: {
        source: "email",
        status: "failed",
        itemsProcessed: 0,
        pagesProcessed: 0,
        startedAt: startTime,
        completedAt: startTime,
        retainedPrevious: false
      },
      calendar: {
        source: "calendar", 
        status: "failed",
        itemsProcessed: 0,
        pagesProcessed: 0,
        startedAt: startTime,
        completedAt: startTime,
        retainedPrevious: false
      },
      warnings: []
    };

    try {
      // Synchronize email with checkpoint recovery
      result.email = await this.syncEmails();
      
      // Synchronize calendar with checkpoint recovery
      result.calendar = await this.syncCalendar();
      
      // Determine overall status
      result.overall = this.determineOverallStatus(result.email, result.calendar);
      
      // Generate warnings for incomplete results
      result.warnings = this.generateSyncWarnings(result);
      
      // Log complete sync operation
      await auditLog(this.env.DB, {
        operation: "sync",
        resourceType: "sync_state",
        resourceId: null,
        result: result.overall === "complete" ? "success" : (result.overall === "partial" ? "partial" : "failure"),
        requestedBy: "system",
        details: {
          emailStatus: result.email.status,
          calendarStatus: result.calendar.status,
          emailItems: result.email.itemsProcessed,
          calendarItems: result.calendar.itemsProcessed,
          warnings: result.warnings
        }
      });
      
      return result;
      
    } catch (error) {
      // Log critical sync failure
      await auditLog(this.env.DB, {
        operation: "sync",
        resourceType: "sync_state",
        resourceId: null,
        result: "failure",
        requestedBy: "system",
        details: { 
          error: error instanceof Error ? error.message : "Unknown error",
          phase: "complete_sync"
        }
      });
      
      throw error;
    }
  }

  /**
   * Synchronize email messages with checkpoint-based recovery
   */
  async syncEmails(): Promise<SyncResult> {
    const startTime = new Date().toISOString();
    let result: SyncResult = {
      source: "email",
      status: "failed",
      itemsProcessed: 0,
      pagesProcessed: 0,
      startedAt: startTime,
      completedAt: startTime,
      retainedPrevious: false
    };

    try {
      // Update sync attempt timestamp
      await this.updateSyncAttempt("email");
      
      // Get last successful checkpoint
      const checkpoint = await this.getLastSuccessfulSync("email");
      
      // Build query with safety overlap window (1 hour)
      const safetyOverlap = checkpoint ? new Date(new Date(checkpoint.timestamp).getTime() - 3600000) : null;
      const query = this.buildEmailQuery(safetyOverlap);
      
      // Retrieve emails with complete pagination
      const retrievalResult = await this.graphClient.getMessages(query);
      
      // Validate completeness
      const validation = this.validateCompleteness(retrievalResult);
      
      if (validation.isReliable) {
        // Process and deduplicate messages
        const emailRepo = new EmailRepositoryImpl(this.env.DB);
        const batchResult = await processBatchMessages(retrievalResult.items, emailRepo);
        
        // Create new checkpoint on success
        const newCheckpoint: SyncCheckpoint = {
          source: "email",
          timestamp: new Date().toISOString(),
          itemCount: batchResult.processed,
          cursor: retrievalResult.nextLink || undefined
        };
        
        // Update sync success state
        await this.saveSyncSuccess("email", newCheckpoint, batchResult.processed, retrievalResult.pagesChecked, validation.isComplete);
        
        result = {
          source: "email",
          status: validation.isComplete ? "complete" : "partial",
          itemsProcessed: batchResult.created + batchResult.updated,
          pagesProcessed: retrievalResult.pagesChecked,
          startedAt: startTime,
          completedAt: new Date().toISOString(),
          checkpoint: newCheckpoint,
          retainedPrevious: false
        };
        
      } else {
        // Failure - retain previous data
        await this.saveSyncFailure("email", validation.warningMessage || "Sync validation failed");
        
        result.retainedPrevious = true;
        result.status = "failed";
        result.completedAt = new Date().toISOString();
      }
      
      return result;
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      
      // Save failure state
      await this.saveSyncFailure("email", errorMessage);
      
      result.retainedPrevious = true;
      result.status = "failed";
      result.completedAt = new Date().toISOString();
      result.error = {
        code: "SYNC_ERROR",
        message: errorMessage,
        type: "permanent",
        retryable: false
      };
      
      return result;
    }
  }

  /**
   * Synchronize calendar events (placeholder - will be implemented in Phase 7)
   */
  async syncCalendar(): Promise<SyncResult> {
    const startTime = new Date().toISOString();
    
    // TODO: Implement calendar synchronization in Phase 7
    return {
      source: "calendar",
      status: "complete",
      itemsProcessed: 0,
      pagesProcessed: 0,
      startedAt: startTime,
      completedAt: new Date().toISOString(),
      retainedPrevious: false
    };
  }

  /**
   * Get last successful sync checkpoint
   */
  async getLastSuccessfulSync(source: SyncSource): Promise<SyncCheckpoint | null> {
    try {
      const stmt = this.env.DB.prepare(`
        SELECT last_success_at, last_success_cursor, messages_checked, events_checked
        FROM sync_state 
        WHERE source = ? AND last_success_at IS NOT NULL
        ORDER BY last_success_at DESC
        LIMIT 1
      `);
      
      const result = await stmt.bind(source).first();
      
      if (!result) {
        return null;
      }
      
      return {
        source,
        timestamp: result.last_success_at as string,
        cursor: result.last_success_cursor as string | undefined,
        itemCount: source === "email" ? (result.messages_checked as number) : (result.events_checked as number)
      };
      
    } catch (error) {
      console.error(`Failed to get last successful sync for ${source}:`, error);
      return null;
    }
  }

  /**
   * Validate sync completeness and reliability
   */
  validateCompleteness<T>(result: RetrievalResult<T>): SyncValidation {
    const validation: SyncValidation = {
      isComplete: result.status === "complete" && result.paginationComplete,
      isReliable: false,
      recommendedAction: "proceed"
    };
    
    switch (result.status) {
      case "complete":
        validation.isReliable = true;
        validation.isComplete = result.paginationComplete;
        break;
        
      case "partial":
        validation.isReliable = result.itemsChecked > 0;
        validation.isComplete = false;
        validation.warningMessage = `Sync incomplete: processed ${result.itemsChecked} items from ${result.pagesChecked} pages`;
        validation.recommendedAction = "retry";
        break;
        
      case "unauthorized":
        validation.isReliable = false;
        validation.warningMessage = "Authentication failed - token refresh required";
        validation.recommendedAction = "alert";
        break;
        
      case "rate_limited":
        validation.isReliable = false;
        validation.warningMessage = "Rate limited by Microsoft Graph API";
        validation.recommendedAction = "retry";
        break;
        
      case "source_unavailable":
        validation.isReliable = false;
        validation.warningMessage = "Microsoft Graph API temporarily unavailable";
        validation.recommendedAction = "retry";
        break;
        
      default:
        validation.isReliable = false;
        validation.warningMessage = "Sync failed with unknown error";
        validation.recommendedAction = "alert";
    }
    
    return validation;
  }

  /**
   * Update sync attempt timestamp
   */
  private async updateSyncAttempt(source: SyncSource): Promise<void> {
    try {
      const stmt = this.env.DB.prepare(`
        INSERT OR REPLACE INTO sync_state (
          id, source, last_attempt_at, status, messages_checked, 
          events_checked, pages_checked, pagination_complete, updated_at
        ) VALUES (?, ?, datetime('now'), 'failed', 0, 0, 0, 0, datetime('now'))
      `);
      
      await stmt.bind(`${source}-sync-state`, source).run();
      
    } catch (error) {
      console.error(`Failed to update sync attempt for ${source}:`, error);
    }
  }

  /**
   * Save successful sync state
   */
  private async saveSyncSuccess(
    source: SyncSource,
    checkpoint: SyncCheckpoint,
    itemsProcessed: number,
    pagesProcessed: number,
    isComplete: boolean
  ): Promise<void> {
    try {
      const stmt = this.env.DB.prepare(`
        UPDATE sync_state 
        SET 
          last_success_at = datetime('now'),
          last_success_cursor = ?,
          status = ?,
          error_code = NULL,
          error_message = NULL,
          messages_checked = ?,
          events_checked = ?,
          pages_checked = ?,
          pagination_complete = ?,
          updated_at = datetime('now')
        WHERE id = ?
      `);
      
      const status = isComplete ? "complete" : "partial";
      const messagesChecked = source === "email" ? itemsProcessed : 0;
      const eventsChecked = source === "calendar" ? itemsProcessed : 0;
      
      await stmt.bind(
        checkpoint.cursor,
        status,
        messagesChecked,
        eventsChecked,
        pagesProcessed,
        isComplete ? 1 : 0,
        `${source}-sync-state`
      ).run();
      
    } catch (error) {
      console.error(`Failed to save sync success for ${source}:`, error);
    }
  }

  /**
   * Save failed sync state
   */
  private async saveSyncFailure(source: SyncSource, errorMessage: string): Promise<void> {
    try {
      const stmt = this.env.DB.prepare(`
        UPDATE sync_state 
        SET 
          status = 'failed',
          error_code = 'SYNC_FAILED',
          error_message = ?,
          pagination_complete = 0,
          updated_at = datetime('now')
        WHERE id = ?
      `);
      
      await stmt.bind(errorMessage, `${source}-sync-state`).run();
      
    } catch (error) {
      console.error(`Failed to save sync failure for ${source}:`, error);
    }
  }

  /**
   * Build email query with safety overlap
   */
  private buildEmailQuery(safetyOverlap: Date | null) {
    const query: any = {
      top: 50,
      orderBy: "receivedDateTime desc"
    };
    
    if (safetyOverlap) {
      query.from = safetyOverlap;
    }
    
    return query;
  }

  /**
   * Determine overall sync status
   */
  private determineOverallStatus(email: SyncResult, calendar: SyncResult): RetrievalStatus {
    if (email.status === "failed" || calendar.status === "failed") {
      return "failed";
    }
    
    if (email.status === "unauthorized" || calendar.status === "unauthorized") {
      return "unauthorized";
    }
    
    if (email.status === "rate_limited" || calendar.status === "rate_limited") {
      return "rate_limited";
    }
    
    if (email.status === "source_unavailable" || calendar.status === "source_unavailable") {
      return "source_unavailable";
    }
    
    if (email.status === "partial" || calendar.status === "partial") {
      return "partial";
    }
    
    return "complete";
  }

  /**
   * Generate sync warnings
   */
  private generateSyncWarnings(result: CompleteSyncResult): string[] {
    const warnings: string[] = [];
    
    if (result.email.status !== "complete") {
      warnings.push(`Email sync incomplete (${result.email.status}): Only ${result.email.itemsProcessed} messages processed`);
    }
    
    if (result.calendar.status !== "complete") {
      warnings.push(`Calendar sync incomplete (${result.calendar.status}): Only ${result.calendar.itemsProcessed} events processed`);
    }
    
    if (result.email.retainedPrevious) {
      warnings.push("Email sync failed - previous email data retained");
    }
    
    if (result.calendar.retainedPrevious) {
      warnings.push("Calendar sync failed - previous calendar data retained");
    }
    
    return warnings;
  }
}

/**
 * Email Repository Implementation
 */
class EmailRepositoryImpl implements EmailRepository {
  constructor(private readonly db: D1Database) {}

  async create(message: EmailMessage): Promise<void> {
    const stmt = this.db.prepare(`
      INSERT INTO email_messages (
        id, graph_message_id, conversation_id, internet_message_id,
        received_at, sender_email, sender_name, subject, is_read,
        importance, has_attachments, classification, body_preview,
        web_link, first_seen_at, last_seen_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    await stmt.bind(
      message.id,
      message.graph_message_id,
      message.conversation_id,
      message.internet_message_id,
      message.received_at.toISOString(),
      message.sender_email,
      message.sender_name,
      message.subject,
      message.is_read ? 1 : 0,
      message.importance,
      message.has_attachments ? 1 : 0,
      message.classification,
      message.body_preview,
      message.web_link,
      message.first_seen_at.toISOString(),
      message.last_seen_at.toISOString()
    ).run();
  }

  async findByGraphId(graphMessageId: string): Promise<EmailMessage | null> {
    const stmt = this.db.prepare(`
      SELECT * FROM email_messages WHERE graph_message_id = ?
    `);
    
    const result = await stmt.bind(graphMessageId).first();
    
    if (!result) {
      return null;
    }
    
    return this.mapRowToMessage(result);
  }

  async updateLastSeen(graphMessageId: string, timestamp: Date): Promise<void> {
    const stmt = this.db.prepare(`
      UPDATE email_messages 
      SET last_seen_at = ?
      WHERE graph_message_id = ?
    `);
    
    await stmt.bind(timestamp.toISOString(), graphMessageId).run();
  }

  async updateClassification(graphMessageId: string, classification: any): Promise<void> {
    const stmt = this.db.prepare(`
      UPDATE email_messages 
      SET classification = ?
      WHERE graph_message_id = ?
    `);
    
    await stmt.bind(classification, graphMessageId).run();
  }

  async findRecent(limit: number, offset = 0): Promise<EmailMessage[]> {
    const stmt = this.db.prepare(`
      SELECT * FROM email_messages 
      ORDER BY received_at DESC 
      LIMIT ? OFFSET ?
    `);
    
    const result = await stmt.bind(limit, offset).all();
    return (result.results || []).map(row => this.mapRowToMessage(row));
  }

  async findUnread(limit: number, offset = 0): Promise<EmailMessage[]> {
    const stmt = this.db.prepare(`
      SELECT * FROM email_messages 
      WHERE is_read = 0
      ORDER BY received_at DESC 
      LIMIT ? OFFSET ?
    `);
    
    const result = await stmt.bind(limit, offset).all();
    return (result.results || []).map(row => this.mapRowToMessage(row));
  }

  async findByClassification(classification: any, limit: number, offset = 0): Promise<EmailMessage[]> {
    const stmt = this.db.prepare(`
      SELECT * FROM email_messages 
      WHERE classification = ?
      ORDER BY received_at DESC 
      LIMIT ? OFFSET ?
    `);
    
    const result = await stmt.bind(classification, limit, offset).all();
    return (result.results || []).map(row => this.mapRowToMessage(row));
  }

  async count(): Promise<number> {
    const stmt = this.db.prepare(`SELECT COUNT(*) as count FROM email_messages`);
    const result = await stmt.first();
    return (result?.count as number) || 0;
  }

  async countByClassification(classification: any): Promise<number> {
    const stmt = this.db.prepare(`
      SELECT COUNT(*) as count FROM email_messages WHERE classification = ?
    `);
    const result = await stmt.bind(classification).first();
    return (result?.count as number) || 0;
  }

  private mapRowToMessage(row: any): EmailMessage {
    return {
      id: row.id,
      graph_message_id: row.graph_message_id,
      conversation_id: row.conversation_id,
      internet_message_id: row.internet_message_id,
      received_at: new Date(row.received_at),
      sender_email: row.sender_email,
      sender_name: row.sender_name,
      subject: row.subject,
      is_read: Boolean(row.is_read),
      importance: row.importance,
      has_attachments: Boolean(row.has_attachments),
      classification: row.classification,
      body_preview: row.body_preview,
      web_link: row.web_link,
      first_seen_at: new Date(row.first_seen_at),
      last_seen_at: new Date(row.last_seen_at)
    };
  }
}
