/**
 * Test suite for sync_state table migration
 * Validates migration execution and table structure
 */
interface MockD1Result {
    results: any[];
    success: boolean;
    meta: {
        changed_db: boolean;
        changes: number;
        duration: number;
        last_row_id: number;
        rows_read: number;
        rows_written: number;
    };
}
interface MockD1Database {
    prepare(sql: string): MockD1Statement;
    exec(sql: string): Promise<MockD1Result>;
}
interface MockD1Statement {
    bind(...values: any[]): MockD1Statement;
    run(): Promise<MockD1Result>;
    all(): Promise<MockD1Result>;
    first(): Promise<any>;
}
/**
 * Integration test helper for actual D1 database testing
 * This would be used in a real Cloudflare Workers environment
 */
export declare function testMigrationExecution(db: MockD1Database): Promise<boolean>;
/**
 * Validate sync state record creation and updates
 */
export declare function validateSyncStateRecord(record: any): boolean;
export {};
//# sourceMappingURL=sync-state-migration.test.d.ts.map