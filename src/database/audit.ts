/**
 * Audit Logging - Comprehensive System Operation Tracking
 * 
 * Provides audit trail functionality for all data modifications and system operations
 * without exposing sensitive authentication tokens or user content.
 */

/**
 * Audit log entry data structure
 */
export interface AuditLogEntry {
  operation: "create" | "update" | "delete" | "sync" | "auth" | "request" | "brief";
  resourceType: "email" | "calendar" | "calendar_event" | "draft" | "token" | "sync_state" | "system" | "morning_brief";
  resourceId: string | null;
  result: "success" | "failure" | "partial";
  requestedBy: string | null;
  details?: any;
}

/**
 * Create audit log entry
 */
export async function auditLog(
  db: D1Database,
  entry: AuditLogEntry
): Promise<void> {
  try {
    const id = crypto.randomUUID();
    const timestamp = new Date().toISOString();
    const detailsJson = entry.details ? JSON.stringify(entry.details) : null;

    const stmt = db.prepare(`
      INSERT INTO audit_log (
        id, timestamp, operation, resource_type, resource_id, 
        result, requested_by, details_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    await stmt.bind(
      id,
      timestamp,
      entry.operation,
      entry.resourceType,
      entry.resourceId,
      entry.result,
      entry.requestedBy,
      detailsJson
    ).run();

  } catch (error) {
    console.error("Failed to write audit log:", error);
    // Don not throw - audit logging should not break main operations
  }
}

/**
 * Query audit log entries
 */
export async function getAuditLogs(
  db: D1Database,
  options: {
    limit?: number;
    offset?: number;
    operation?: string;
    resourceType?: string;
    result?: string;
    since?: Date;
  } = {}
): Promise<any[]> {
  try {
    const { limit = 50, offset = 0, operation, resourceType, result, since } = options;

    let whereClause = "1=1";
    const bindings: any[] = [];

    if (operation) {
      whereClause += " AND operation = ?";
      bindings.push(operation);
    }

    if (resourceType) {
      whereClause += " AND resource_type = ?";
      bindings.push(resourceType);
    }

    if (result) {
      whereClause += " AND result = ?";
      bindings.push(result);
    }

    if (since) {
      whereClause += " AND timestamp >= ?";
      bindings.push(since.toISOString());
    }

    const stmt = db.prepare(`
      SELECT * FROM audit_log 
      WHERE ${whereClause}
      ORDER BY timestamp DESC 
      LIMIT ? OFFSET ?
    `);

    bindings.push(limit, offset);
    
    const result_set = await stmt.bind(...bindings).all();
    return result_set.results || [];

  } catch (error) {
    console.error("Failed to query audit logs:", error);
    return [];
  }
}

/**
 * Get audit log statistics
 */
export async function getAuditStats(
  db: D1Database,
  since?: Date
): Promise<{
  totalOperations: number;
  operationsByType: Record<string, number>;
  operationsByResult: Record<string, number>;
}> {
  try {
    let whereClause = "1=1";
    const bindings: any[] = [];

    if (since) {
      whereClause += " AND timestamp >= ?";
      bindings.push(since.toISOString());
    }

    // Total operations
    const totalStmt = db.prepare(`SELECT COUNT(*) as count FROM audit_log WHERE ${whereClause}`);
    const totalResult = await totalStmt.bind(...bindings).first();
    const totalOperations = (totalResult?.count as number) || 0;

    // Operations by type
    const typeStmt = db.prepare(`
      SELECT operation, COUNT(*) as count 
      FROM audit_log 
      WHERE ${whereClause}
      GROUP BY operation
    `);
    const typeResults = await typeStmt.bind(...bindings).all();
    const operationsByType: Record<string, number> = {};
    typeResults.results?.forEach((row: any) => {
      operationsByType[row.operation] = row.count;
    });

    // Operations by result
    const resultStmt = db.prepare(`
      SELECT result, COUNT(*) as count 
      FROM audit_log 
      WHERE ${whereClause}
      GROUP BY result
    `);
    const resultResults = await resultStmt.bind(...bindings).all();
    const operationsByResult: Record<string, number> = {};
    resultResults.results?.forEach((row: any) => {
      operationsByResult[row.result] = row.count;
    });

    return {
      totalOperations,
      operationsByType,
      operationsByResult
    };

  } catch (error) {
    console.error("Failed to get audit stats:", error);
    return {
      totalOperations: 0,
      operationsByType: {},
      operationsByResult: {}
    };
  }
}
