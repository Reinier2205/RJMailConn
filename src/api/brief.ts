/**
 * Morning Brief Handler - Structured Daily Briefing Generation
 * 
 * Generates categorized email and calendar data with sync status reporting
 * and reliability warnings for the Morning Intelligence Brief.
 */

import { Environment } from "../index";
import { EmailMessage } from "../microsoft/email";
import { CalendarEvent } from "../microsoft/calendar";
import { SyncSource, SyncStatus } from "../database/models";
import { auditLog } from "../database/audit";

/**
 * Data source status for morning brief
 */
export interface DataSourceStatus {
  status: SyncStatus;
  last_sync: string | null;
  items: number;
}

/**
 * Email data categorization for brief
 */
export interface EmailBriefData {
  new_messages: EmailMessage[];
  important_messages: EmailMessage[];
  marketing_messages: EmailMessage[];
  unread_count: number;
}

/**
 * Calendar data categorization for brief
 */
export interface CalendarBriefData {
  today_events: CalendarEvent[];
  upcoming_events: CalendarEvent[];
}

/**
 * Complete morning brief response
 */
export interface MorningBriefResponse {
  generated_at: string;
  status: SyncStatus;
  data_sources: {
    email: DataSourceStatus;
    calendar: DataSourceStatus;
  };
  emails: EmailBriefData;
  calendar: CalendarBriefData;
  warnings: string[];
}

/**
 * Morning Brief Handler Class
 */
export class BriefHandler {
  private readonly env: Environment;

  constructor(env: Environment) {
    this.env = env;
  }

  /**
   * Generate complete morning brief
   */
  async generateBrief(): Promise<MorningBriefResponse> {
    const generatedAt = new Date().toISOString();
    
    try {
      // Get sync status for both data sources
      const emailStatus = await this.getDataSourceStatus("email");
      const calendarStatus = await this.getDataSourceStatus("calendar");
      
      // Determine overall status
      const overallStatus = this.determineOverallStatus(emailStatus.status, calendarStatus.status);
      
      // Categorize email data
      const emails = await this.categorizeEmails();
      
      // Format calendar data
      const calendar = await this.formatCalendarData();
      
      // Generate warnings based on sync status
      const warnings = this.generateDataWarnings(emailStatus, calendarStatus);
      
      const response: MorningBriefResponse = {
        generated_at: generatedAt,
        status: overallStatus,
        data_sources: {
          email: emailStatus,
          calendar: calendarStatus
        },
        emails,
        calendar,
        warnings
      };
      
      // Log brief generation
      await auditLog(this.env.DB, {
        operation: "brief",
        resourceType: "morning_brief",
        resourceId: null,
        result: "success",
        requestedBy: "api",
        details: {
          generatedAt,
          overallStatus,
          emailItems: emailStatus.items,
          calendarItems: calendarStatus.items,
          warningCount: warnings.length
        }
      });
      
      return response;
      
    } catch (error) {
      // Log brief generation failure
      await auditLog(this.env.DB, {
        operation: "brief",
        resourceType: "morning_brief",
        resourceId: null,
        result: "failure",
        requestedBy: "api",
        details: {
          error: error instanceof Error ? error.message : "Unknown error"
        }
      });
      
      throw error;
    }
  }

  /**
   * Get data source status from sync_state table
   */
  private async getDataSourceStatus(source: SyncSource): Promise<DataSourceStatus> {
    try {
      const stmt = this.env.DB.prepare(`
        SELECT status, last_success_at, messages_checked, events_checked
        FROM sync_state 
        WHERE source = ?
        ORDER BY updated_at DESC
        LIMIT 1
      `);
      
      const result = await stmt.bind(source).first();
      
      if (!result) {
        return {
          status: "source_unavailable",
          last_sync: null,
          items: 0
        };
      }
      
      const itemCount = source === "email" 
        ? (result.messages_checked as number || 0)
        : (result.events_checked as number || 0);
      
      return {
        status: result.status as SyncStatus,
        last_sync: result.last_success_at as string | null,
        items: itemCount
      };
      
    } catch (error) {
      console.error(`Failed to get status for ${source}:`, error);
      return {
        status: "failed",
        last_sync: null,
        items: 0
      };
    }
  }

  /**
   * Categorize email messages for morning brief
   */
  private async categorizeEmails(): Promise<EmailBriefData> {
    const briefData: EmailBriefData = {
      new_messages: [],
      important_messages: [],
      marketing_messages: [],
      unread_count: 0
    };
    
    try {
      // Get recent unread messages (last 24 hours)
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      
      // New messages: unread messages from last 24 hours
      const newMessagesStmt = this.env.DB.prepare(`
        SELECT * FROM email_messages 
        WHERE is_read = 0 
          AND received_at > ?
          AND classification IN ('new', 'unclassified')
        ORDER BY received_at DESC 
        LIMIT 20
      `);
      
      const newMessagesResult = await newMessagesStmt.bind(yesterday.toISOString()).all();
      briefData.new_messages = (newMessagesResult.results || []).map(row => this.mapRowToEmailMessage(row));
      
      // Important messages: high importance or classified as important from last 7 days
      const lastWeek = new Date();
      lastWeek.setDate(lastWeek.getDate() - 7);
      
      const importantStmt = this.env.DB.prepare(`
        SELECT * FROM email_messages 
        WHERE (importance = 'high' OR classification = 'important')
          AND received_at > ?
        ORDER BY received_at DESC 
        LIMIT 15
      `);
      
      const importantResult = await importantStmt.bind(lastWeek.toISOString()).all();
      briefData.important_messages = (importantResult.results || []).map(row => this.mapRowToEmailMessage(row));
      
      // Marketing messages: recent marketing emails for reference
      const marketingStmt = this.env.DB.prepare(`
        SELECT * FROM email_messages 
        WHERE classification = 'marketing'
          AND received_at > ?
        ORDER BY received_at DESC 
        LIMIT 10
      `);
      
      const marketingResult = await marketingStmt.bind(yesterday.toISOString()).all();
      briefData.marketing_messages = (marketingResult.results || []).map(row => this.mapRowToEmailMessage(row));
      
      // Total unread count
      const unreadStmt = this.env.DB.prepare(`
        SELECT COUNT(*) as count FROM email_messages WHERE is_read = 0
      `);
      
      const unreadResult = await unreadStmt.first();
      briefData.unread_count = (unreadResult?.count as number) || 0;
      
    } catch (error) {
      console.error("Failed to categorize emails:", error);
      // Return empty data rather than failing the entire brief
    }
    
    return briefData;
  }

  /**
   * Format calendar data for morning brief
   */
  private async formatCalendarData(): Promise<CalendarBriefData> {
    const calendarData: CalendarBriefData = {
      today_events: [],
      upcoming_events: []
    };
    
    try {
      // Today's events
      const today = new Date();
      const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      const endOfDay = new Date(startOfDay);
      endOfDay.setDate(endOfDay.getDate() + 1);
      
      const todayStmt = this.env.DB.prepare(`
        SELECT * FROM calendar_events 
        WHERE is_cancelled = 0
          AND start_at < ?
          AND end_at > ?
        ORDER BY start_at ASC
      `);
      
      const todayResult = await todayStmt.bind(
        endOfDay.toISOString(),
        startOfDay.toISOString()
      ).all();
      
      calendarData.today_events = (todayResult.results || []).map(row => this.mapRowToCalendarEvent(row));
      
      // Next 7 days events (excluding today)
      const nextWeek = new Date(today);
      nextWeek.setDate(nextWeek.getDate() + 7);
      
      const upcomingStmt = this.env.DB.prepare(`
        SELECT * FROM calendar_events 
        WHERE is_cancelled = 0
          AND start_at > ?
          AND start_at < ?
        ORDER BY start_at ASC 
        LIMIT 20
      `);
      
      const upcomingResult = await upcomingStmt.bind(
        endOfDay.toISOString(),
        nextWeek.toISOString()
      ).all();
      
      calendarData.upcoming_events = (upcomingResult.results || []).map(row => this.mapRowToCalendarEvent(row));
      
    } catch (error) {
      console.error("Failed to format calendar data:", error);
      // Return empty data rather than failing the entire brief
    }
    
    return calendarData;
  }

  /**
   * Determine overall status from individual data sources
   */
  private determineOverallStatus(emailStatus: SyncStatus, calendarStatus: SyncStatus): SyncStatus {
    // Prioritize failed states
    if (emailStatus === "failed" || calendarStatus === "failed") {
      return "failed";
    }
    
    // Handle authentication issues
    if (emailStatus === "unauthorized" || calendarStatus === "unauthorized") {
      return "unauthorized";
    }
    
    // Handle rate limiting
    if (emailStatus === "rate_limited" || calendarStatus === "rate_limited") {
      return "rate_limited";
    }
    
    // Handle service unavailable
    if (emailStatus === "source_unavailable" || calendarStatus === "source_unavailable") {
      return "source_unavailable";
    }
    
    // Handle partial sync
    if (emailStatus === "partial" || calendarStatus === "partial") {
      return "partial";
    }
    
    // Both complete
    return "complete";
  }

  /**
   * Generate data reliability warnings
   */
  private generateDataWarnings(
    emailStatus: DataSourceStatus,
    calendarStatus: DataSourceStatus
  ): string[] {
    const warnings: string[] = [];
    
    // Email warnings
    if (emailStatus.status === "failed") {
      warnings.push("Email sync failed - email data may be incomplete or outdated");
    } else if (emailStatus.status === "partial") {
      warnings.push("Email sync incomplete - some messages may be missing");
    } else if (emailStatus.status === "rate_limited") {
      warnings.push("Email sync rate limited - data refresh delayed");
    } else if (emailStatus.status === "source_unavailable") {
      warnings.push("Microsoft Email service temporarily unavailable");
    } else if (!emailStatus.last_sync) {
      warnings.push("No successful email sync found - email data not available");
    }
    
    // Calendar warnings
    if (calendarStatus.status === "failed") {
      warnings.push("Calendar sync failed - calendar data may be incomplete or outdated");
    } else if (calendarStatus.status === "partial") {
      warnings.push("Calendar sync incomplete - some events may be missing");
    } else if (calendarStatus.status === "rate_limited") {
      warnings.push("Calendar sync rate limited - data refresh delayed");
    } else if (calendarStatus.status === "source_unavailable") {
      warnings.push("Microsoft Calendar service temporarily unavailable");
    } else if (!calendarStatus.last_sync) {
      warnings.push("No successful calendar sync found - calendar data not available");
    }
    
    // Age-based warnings
    if (emailStatus.last_sync) {
      const emailAge = Date.now() - new Date(emailStatus.last_sync).getTime();
      const hoursOld = emailAge / (1000 * 60 * 60);
      
      if (hoursOld > 24) {
        warnings.push(`Email data is ${Math.round(hoursOld)} hours old - may not reflect recent messages`);
      }
    }
    
    if (calendarStatus.last_sync) {
      const calendarAge = Date.now() - new Date(calendarStatus.last_sync).getTime();
      const hoursOld = calendarAge / (1000 * 60 * 60);
      
      if (hoursOld > 24) {
        warnings.push(`Calendar data is ${Math.round(hoursOld)} hours old - may not reflect recent changes`);
      }
    }
    
    return warnings;
  }

  /**
   * Map database row to EmailMessage
   */
  private mapRowToEmailMessage(row: any): EmailMessage {
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

  /**
   * Map database row to CalendarEvent
   */
  private mapRowToCalendarEvent(row: any): CalendarEvent {
    return {
      id: row.id,
      graph_event_id: row.graph_event_id,
      subject: row.subject,
      start_at: new Date(row.start_at),
      end_at: new Date(row.end_at),
      timezone: row.timezone,
      location: row.location,
      organiser: row.organiser,
      response_status: row.response_status,
      is_cancelled: Boolean(row.is_cancelled),
      body_preview: row.body_preview,
      first_seen_at: new Date(row.first_seen_at),
      last_seen_at: new Date(row.last_seen_at)
    };
  }
}