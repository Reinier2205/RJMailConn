/**
 * Health Monitoring - System Status and Version Information
 * 
 * Provides comprehensive health checks, status monitoring, and version info
 * for operational monitoring and debugging.
 */

import { Environment } from "../index";
import { TokenStorage } from "../auth/tokens";

/**
 * System status response
 */
export interface SystemStatus {
  status: string;
  timestamp: string;
  version: string;
  authentication: {
    oauth_configured: boolean;
    token_status: string;
  };
  data_sources: {
    email: DataSourceStatus;
    calendar: DataSourceStatus;
  };
  database: DatabaseStats;
  uptime: {
    current_time: string;
    worker_type: string;
  };
}

export interface DataSourceStatus {
  status: string;
  last_sync: string | null;
  last_attempt: string | null;
  items_synced: number;
  error?: string | null;
}

export interface DatabaseStats {
  email_messages: number;
  calendar_events: number;
  audit_entries: number;
  database_type: string;
}

/**
 * Health Monitor Handler
 */
export class HealthMonitor {
  private readonly env: Environment;

  constructor(env: Environment) {
    this.env = env;
  }

  /**
   * Get detailed system status
   */
  async getDetailedStatus(): Promise<SystemStatus> {
    try {
      // Get sync status for both data sources
      const emailStatus = await this.getSyncStatus("email");
      const calendarStatus = await this.getSyncStatus("calendar");

      // Get database statistics
      const dbStats = await this.getDatabaseStatistics();

      // Check OAuth token status
      const tokenStorage = new TokenStorage(this.env);
      const hasTokens = await tokenStorage.hasValidTokens();

      return {
        status: "operational",
        timestamp: new Date().toISOString(),
        version: "1.0.0",
        authentication: {
          oauth_configured: hasTokens,
          token_status: hasTokens ? "valid" : "missing_or_expired"
        },
        data_sources: {
          email: emailStatus,
          calendar: calendarStatus
        },
        database: dbStats,
        uptime: {
          current_time: new Date().toISOString(),
          worker_type: "Cloudflare Workers"
        }
      };
    } catch (error) {
      console.error("Failed to get detailed status:", error);
      throw error;
    }
  }

  /**
   * Get sync status for a specific source
   */
  private async getSyncStatus(source: "email" | "calendar"): Promise<DataSourceStatus> {
    try {
      const stmt = this.env.DB.prepare(`
        SELECT 
          status, 
          last_success_at, 
          last_attempt_at,
          messages_checked,
          events_checked,
          error_message
        FROM sync_state 
        WHERE source = ?
        ORDER BY updated_at DESC
        LIMIT 1
      `);

      const result = await stmt.bind(source).first();

      if (!result) {
        return {
          status: "never_synced",
          last_sync: null,
          last_attempt: null,
          items_synced: 0
        };
      }

      return {
        status: result.status as string,
        last_sync: result.last_success_at as string | null,
        last_attempt: result.last_attempt_at as string | null,
        items_synced: source === "email" 
          ? ((result.messages_checked as number) || 0)
          : ((result.events_checked as number) || 0),
        error: (result.error_message as string) || null
      };
    } catch (error) {
      console.error(`Failed to get ${source} status:`, error);
      return {
        status: "error",
        last_sync: null,
        last_attempt: null,
        items_synced: 0,
        error: "Failed to query sync status"
      };
    }
  }

  /**
   * Get database statistics
   */
  private async getDatabaseStatistics(): Promise<DatabaseStats> {
    try {
      const emailCountStmt = this.env.DB.prepare("SELECT COUNT(*) as count FROM email_messages");
      const emailCount = await emailCountStmt.first();

      const calendarCountStmt = this.env.DB.prepare("SELECT COUNT(*) as count FROM calendar_events");
      const calendarCount = await calendarCountStmt.first();

      const auditCountStmt = this.env.DB.prepare("SELECT COUNT(*) as count FROM audit_log");
      const auditCount = await auditCountStmt.first();

      return {
        email_messages: (emailCount?.count as number) || 0,
        calendar_events: (calendarCount?.count as number) || 0,
        audit_entries: (auditCount?.count as number) || 0,
        database_type: "Cloudflare D1"
      };
    } catch (error) {
      console.error("Failed to get database statistics:", error);
      return {
        email_messages: 0,
        calendar_events: 0,
        audit_entries: 0,
        database_type: "Cloudflare D1"
      };
    }
  }

  /**
   * Get version information
   */
  getVersionInfo(): any {
    return {
      name: "Microsoft 365 Mail Connector",
      version: "1.0.0",
      description: "Production-quality single-user connector for Morning Intelligence Brief",
      capabilities: [
        "OAuth 2.0 authentication",
        "Email synchronization with checkpoints",
        "Calendar synchronization",
        "Draft email creation (no sending)",
        "Calendar event management",
        "Morning brief generation",
        "Scheduled sync operations",
        "Comprehensive audit logging"
      ],
      endpoints: {
        auth: ["/auth/login", "/auth/callback", "/auth/logout"],
        sync: ["/sync/email", "/sync/calendar", "/sync/all"],
        email: ["/email/messages"],
        calendar: ["/calendar", "/calendar/events"],
        drafts: ["/drafts", "/drafts/reply"],
        brief: ["/brief"],
        health: ["/health", "/status", "/version"]
      },
      security: {
        authentication: "Bearer token + OAuth 2.0",
        no_email_sending: true,
        single_user_only: true,
        audit_logging: true
      }
    };
  }
}
