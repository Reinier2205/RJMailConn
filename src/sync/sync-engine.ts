/**
 * Sync Engine - Reliable Gmail and Google Calendar Synchronization
 *
 * Orchestrates checkpoint-based synchronization with failure retention,
 * completeness validation, and comprehensive error handling.
 */

import { Environment } from '../index';
import { GmailClient, classifyMessage, RetrievalStatus } from '../google/gmail';
import { GoogleCalendarClient } from '../google/calendar';
import { SyncSource, CompleteSyncResult, SyncResult, SyncCheckpoint } from '../database/models';
import { auditLog } from '../database/audit';

interface SyncValidation {
  isComplete: boolean;
  isReliable: boolean;
  recommendedAction: 'proceed' | 'retry' | 'alert';
  warningMessage?: string;
}

export class SyncEngine {
  private readonly env: Environment;
  private readonly gmailClient: GmailClient;
  private readonly calendarClient: GoogleCalendarClient;

  constructor(env: Environment) {
    this.env = env;
    this.gmailClient = new GmailClient(env);
    this.calendarClient = new GoogleCalendarClient(env);
  }

  // ─── Public API ─────────────────────────────────────────────────────────────

  async syncAll(): Promise<CompleteSyncResult> {
    const startTime = new Date().toISOString();

    const result: CompleteSyncResult = {
      overall: 'failed',
      email: this.emptyResult('email', startTime),
      calendar: this.emptyResult('calendar', startTime),
      warnings: [],
    };

    try {
      result.email = await this.syncEmails();
      result.calendar = await this.syncCalendar();
      result.overall = this.determineOverallStatus(result.email, result.calendar);
      result.warnings = this.generateWarnings(result);

      await auditLog(this.env.DB, {
        operation: 'sync',
        resourceType: 'sync_state',
        resourceId: null,
        result: result.overall === 'complete' ? 'success' : result.overall === 'partial' ? 'partial' : 'failure',
        requestedBy: 'system',
        details: {
          emailStatus: result.email.status,
          calendarStatus: result.calendar.status,
          emailItems: result.email.itemsProcessed,
          calendarItems: result.calendar.itemsProcessed,
          warnings: result.warnings,
        },
      });

      return result;
    } catch (error) {
      await auditLog(this.env.DB, {
        operation: 'sync',
        resourceType: 'sync_state',
        resourceId: null,
        result: 'failure',
        requestedBy: 'system',
        details: { error: error instanceof Error ? error.message : 'Unknown error', phase: 'complete_sync' },
      });
      throw error;
    }
  }

  async syncEmails(): Promise<SyncResult> {
    const startTime = new Date().toISOString();
    const result: SyncResult = this.emptyResult('email', startTime);

    try {
      await this.updateSyncAttempt('email');

      // Safety overlap: go back 1 hour before last successful sync
      const checkpoint = await this.getLastSuccessfulSync('email');
      const safetyOverlap = checkpoint
        ? new Date(new Date(checkpoint.timestamp).getTime() - 3_600_000)
        : null;

      const retrieval = await this.gmailClient.getMessages(safetyOverlap);
      const validation = this.validateCompleteness(retrieval);

      if (validation.isReliable) {
        // Upsert messages into D1
        let created = 0;
        let updated = 0;

        for (const msg of retrieval.items) {
          const classification = classifyMessage(msg);
          const existing = await this.findByGmailId(msg.id);

          if (existing) {
            await this.updateMessageLastSeen(msg.id, new Date());
            updated++;
          } else {
            await this.insertMessage(msg, classification);
            created++;
          }
        }

        const itemsProcessed = created + updated;

        const newCheckpoint: SyncCheckpoint = {
          source: 'email',
          timestamp: new Date().toISOString(),
          itemCount: itemsProcessed,
        };

        await this.saveSyncSuccess(
          'email',
          newCheckpoint,
          itemsProcessed,
          retrieval.pagesChecked,
          validation.isComplete,
        );

        return {
          source: 'email',
          status: validation.isComplete ? 'complete' : 'partial',
          itemsProcessed,
          pagesProcessed: retrieval.pagesChecked,
          startedAt: startTime,
          completedAt: new Date().toISOString(),
          checkpoint: newCheckpoint,
          retainedPrevious: false,
        };
      }

      // Unreliable result - retain previous data
      await this.saveSyncFailure('email', validation.warningMessage ?? 'Sync validation failed');
      return { ...result, status: 'failed', retainedPrevious: true, completedAt: new Date().toISOString() };

    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unknown error';
      await this.saveSyncFailure('email', msg);
      return {
        ...result,
        status: 'failed',
        retainedPrevious: true,
        completedAt: new Date().toISOString(),
        error: { code: 'SYNC_ERROR', message: msg, type: 'permanent', retryable: false },
      };
    }
  }

  async syncCalendar(): Promise<SyncResult> {
    const startTime = new Date().toISOString();
    const result: SyncResult = this.emptyResult('calendar', startTime);

    try {
      await this.updateSyncAttempt('calendar');

      // Fetch events: today → 30 days ahead
      const now = new Date();
      const thirtyDaysAhead = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
      const retrieval = await this.calendarClient.getEvents(now, thirtyDaysAhead);
      const validation = this.validateCompleteness(retrieval);

      if (validation.isReliable) {
        let created = 0;
        let updated = 0;

        for (const event of retrieval.items) {
          const existing = await this.findCalendarEventByGoogleId(event.id);
          if (existing) {
            await this.updateCalendarEvent(event);
            updated++;
          } else {
            await this.insertCalendarEvent(event);
            created++;
          }
        }

        const itemsProcessed = created + updated;

        const newCheckpoint: SyncCheckpoint = {
          source: 'calendar',
          timestamp: new Date().toISOString(),
          itemCount: itemsProcessed,
        };

        await this.saveSyncSuccess(
          'calendar',
          newCheckpoint,
          itemsProcessed,
          retrieval.pagesChecked,
          validation.isComplete,
        );

        return {
          source: 'calendar',
          status: validation.isComplete ? 'complete' : 'partial',
          itemsProcessed,
          pagesProcessed: retrieval.pagesChecked,
          startedAt: startTime,
          completedAt: new Date().toISOString(),
          checkpoint: newCheckpoint,
          retainedPrevious: false,
        };
      }

      await this.saveSyncFailure('calendar', validation.warningMessage ?? 'Sync validation failed');
      return { ...result, status: 'failed', retainedPrevious: true, completedAt: new Date().toISOString() };

    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unknown error';
      await this.saveSyncFailure('calendar', msg);
      return {
        ...result,
        status: 'failed',
        retainedPrevious: true,
        completedAt: new Date().toISOString(),
        error: { code: 'SYNC_ERROR', message: msg, type: 'permanent', retryable: false },
      };
    }
  }

  // ─── Checkpoint helpers ──────────────────────────────────────────────────────

  async getLastSuccessfulSync(source: SyncSource): Promise<SyncCheckpoint | null> {
    try {
      const result = await this.env.DB
        .prepare(`SELECT last_success_at, last_success_cursor, messages_checked, events_checked
                  FROM sync_state WHERE source = ? AND last_success_at IS NOT NULL
                  ORDER BY last_success_at DESC LIMIT 1`)
        .bind(source)
        .first();

      if (!result) return null;

      return {
        source,
        timestamp: result.last_success_at as string,
        cursor: result.last_success_cursor as string | undefined,
        itemCount: source === 'email'
          ? (result.messages_checked as number)
          : (result.events_checked as number),
      };
    } catch {
      return null;
    }
  }

  // ─── Completeness validation ─────────────────────────────────────────────────

  validateCompleteness(result: { status: RetrievalStatus; itemsChecked: number; pagesChecked: number; paginationComplete: boolean }): SyncValidation {
    switch (result.status) {
      case 'complete':
        return { isComplete: result.paginationComplete, isReliable: true, recommendedAction: 'proceed' };
      case 'partial':
        return {
          isComplete: false, isReliable: result.itemsChecked > 0,
          warningMessage: `Sync incomplete: processed ${result.itemsChecked} items from ${result.pagesChecked} pages`,
          recommendedAction: 'retry',
        };
      case 'unauthorized':
        return { isComplete: false, isReliable: false, warningMessage: 'Authentication failed - re-login required', recommendedAction: 'alert' };
      case 'rate_limited':
        return { isComplete: false, isReliable: false, warningMessage: 'Rate limited by Google APIs', recommendedAction: 'retry' };
      case 'source_unavailable':
        return { isComplete: false, isReliable: false, warningMessage: 'Google API temporarily unavailable', recommendedAction: 'retry' };
      default:
        return { isComplete: false, isReliable: false, warningMessage: 'Sync failed with unknown error', recommendedAction: 'alert' };
    }
  }

  // ─── D1 email helpers ────────────────────────────────────────────────────────

  private async findByGmailId(gmailId: string): Promise<boolean> {
    const row = await this.env.DB
      .prepare('SELECT id FROM email_messages WHERE graph_message_id = ?')
      .bind(gmailId)
      .first();
    return !!row;
  }

  private async updateMessageLastSeen(gmailId: string, ts: Date): Promise<void> {
    await this.env.DB
      .prepare('UPDATE email_messages SET last_seen_at = ? WHERE graph_message_id = ?')
      .bind(ts.toISOString(), gmailId)
      .run();
  }

  private async insertMessage(
    msg: import('../google/gmail').GmailMessage,
    classification: string,
  ): Promise<void> {
    const id = `gmail-${msg.id}`;
    await this.env.DB.prepare(`
      INSERT INTO email_messages (
        id, graph_message_id, conversation_id, internet_message_id,
        received_at, sender_email, sender_name, subject,
        is_read, importance, has_attachments, classification,
        body_preview, web_link, first_seen_at, last_seen_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      id,
      msg.id,
      msg.threadId,
      msg.internetMessageId,
      msg.receivedAt.toISOString(),
      msg.senderEmail,
      msg.senderName,
      msg.subject,
      msg.isRead ? 1 : 0,
      msg.importance,
      msg.hasAttachments ? 1 : 0,
      classification,
      msg.bodyPreview,
      msg.webLink,
      msg.receivedAt.toISOString(),
      msg.receivedAt.toISOString(),
    ).run();
  }

  // ─── D1 calendar helpers ─────────────────────────────────────────────────────

  private async findCalendarEventByGoogleId(googleId: string): Promise<boolean> {
    const row = await this.env.DB
      .prepare('SELECT id FROM calendar_events WHERE graph_event_id = ?')
      .bind(googleId)
      .first();
    return !!row;
  }

  private async insertCalendarEvent(event: import('../google/calendar').CalendarEvent): Promise<void> {
    const id = `gcal-${event.id}`;
    await this.env.DB.prepare(`
      INSERT INTO calendar_events (
        id, graph_event_id, subject, start_at, end_at, timezone,
        location, organiser, response_status, is_cancelled,
        body_preview, first_seen_at, last_seen_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      id,
      event.id,
      event.subject,
      event.startAt.toISOString(),
      event.endAt.toISOString(),
      event.timezone,
      event.location,
      event.organiser,
      event.responseStatus,
      event.isCancelled ? 1 : 0,
      event.bodyPreview,
      new Date().toISOString(),
      new Date().toISOString(),
    ).run();
  }

  private async updateCalendarEvent(event: import('../google/calendar').CalendarEvent): Promise<void> {
    await this.env.DB.prepare(`
      UPDATE calendar_events SET
        subject = ?, start_at = ?, end_at = ?, timezone = ?,
        location = ?, organiser = ?, response_status = ?,
        is_cancelled = ?, body_preview = ?, last_seen_at = ?
      WHERE graph_event_id = ?
    `).bind(
      event.subject,
      event.startAt.toISOString(),
      event.endAt.toISOString(),
      event.timezone,
      event.location,
      event.organiser,
      event.responseStatus,
      event.isCancelled ? 1 : 0,
      event.bodyPreview,
      new Date().toISOString(),
      event.id,
    ).run();
  }

  // ─── Sync state persistence ──────────────────────────────────────────────────

  private async updateSyncAttempt(source: SyncSource): Promise<void> {
    await this.env.DB.prepare(`
      INSERT OR REPLACE INTO sync_state (
        id, source, last_attempt_at, status,
        messages_checked, events_checked, pages_checked, pagination_complete, updated_at
      ) VALUES (?, ?, datetime('now'), 'failed', 0, 0, 0, 0, datetime('now'))
    `).bind(`${source}-sync-state`, source).run();
  }

  private async saveSyncSuccess(
    source: SyncSource,
    checkpoint: SyncCheckpoint,
    itemsProcessed: number,
    pagesProcessed: number,
    isComplete: boolean,
  ): Promise<void> {
    await this.env.DB.prepare(`
      UPDATE sync_state SET
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
    `).bind(
      checkpoint.cursor ?? null,
      isComplete ? 'complete' : 'partial',
      source === 'email' ? itemsProcessed : 0,
      source === 'calendar' ? itemsProcessed : 0,
      pagesProcessed,
      isComplete ? 1 : 0,
      `${source}-sync-state`,
    ).run();
  }

  private async saveSyncFailure(source: SyncSource, errorMessage: string): Promise<void> {
    await this.env.DB.prepare(`
      UPDATE sync_state SET
        status = 'failed',
        error_code = 'SYNC_FAILED',
        error_message = ?,
        pagination_complete = 0,
        updated_at = datetime('now')
      WHERE id = ?
    `).bind(errorMessage, `${source}-sync-state`).run();
  }

  // ─── Utility ─────────────────────────────────────────────────────────────────

  private emptyResult(source: SyncSource, startTime: string): SyncResult {
    return {
      source,
      status: 'failed',
      itemsProcessed: 0,
      pagesProcessed: 0,
      startedAt: startTime,
      completedAt: startTime,
      retainedPrevious: false,
    };
  }

  private determineOverallStatus(email: SyncResult, calendar: SyncResult): RetrievalStatus {
    const statuses = [email.status, calendar.status];
    if (statuses.includes('unauthorized')) return 'unauthorized';
    if (statuses.includes('rate_limited')) return 'rate_limited';
    if (statuses.includes('source_unavailable')) return 'source_unavailable';
    if (statuses.includes('failed')) return 'failed';
    if (statuses.includes('partial')) return 'partial';
    return 'complete';
  }

  private generateWarnings(result: CompleteSyncResult): string[] {
    const warnings: string[] = [];
    if (result.email.status !== 'complete')
      warnings.push(`Email sync incomplete (${result.email.status}): Only ${result.email.itemsProcessed} messages processed`);
    if (result.calendar.status !== 'complete')
      warnings.push(`Calendar sync incomplete (${result.calendar.status}): Only ${result.calendar.itemsProcessed} events processed`);
    if (result.email.retainedPrevious)
      warnings.push('Email sync failed - previous email data retained');
    if (result.calendar.retainedPrevious)
      warnings.push('Calendar sync failed - previous calendar data retained');
    return warnings;
  }
}
