/**
 * Actions Handler - Master Action List CRUD
 *
 * GET  /actions        - returns full action list (used by /getmymail export)
 * POST /actions/import - replaces the full action list from ChatGPT JSON
 */

import { Environment } from '../index';

export interface Action {
  migration_key: string;
  title: string;
  project?: string;
  status: string;
  priority: string;
  next_action?: string;
  due_date?: string | null;
  recurrence?: string | null;
  details?: string;
  acceptance_criteria?: string[];
}

export interface DailyBriefRequirement {
  key: string;
  title: string;
  type: string;
  frequency?: string;
  current_value?: string;
  update_rule?: string;
  next_action?: string;
  details?: string;
}

export interface ActionListPayload {
  schema_version?: string;
  list_name?: string;
  export_date?: string;
  migration_rules?: Record<string, unknown>;
  actions: Action[];
  daily_brief_requirements?: DailyBriefRequirement[];
  standing_rules?: string[];
}

export class ActionsHandler {
  private readonly db: D1Database;

  constructor(env: Environment) {
    this.db = env.DB;
  }

  // ── GET /actions ─────────────────────────────────────────────────────────

  async getActionList(): Promise<ActionListPayload> {
    const [actionsResult, reqsResult, rulesResult, metaResult] = await Promise.all([
      this.db.prepare(`SELECT * FROM actions ORDER BY
        CASE priority WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END,
        migration_key`).all(),
      this.db.prepare('SELECT * FROM daily_brief_requirements ORDER BY key').all(),
      this.db.prepare('SELECT rule FROM standing_rules ORDER BY sort_order').all(),
      this.db.prepare('SELECT * FROM action_list_meta WHERE id = 1').first(),
    ]);

    const actions = (actionsResult.results || []).map((r: any) => ({
      migration_key: r.migration_key,
      title: r.title,
      project: r.project,
      status: r.status,
      priority: r.priority,
      next_action: r.next_action,
      due_date: r.due_date,
      recurrence: r.recurrence,
      details: r.details,
      acceptance_criteria: r.acceptance_criteria ? JSON.parse(r.acceptance_criteria) : undefined,
      updated_at: r.updated_at,
    }));

    const daily_brief_requirements = (reqsResult.results || []).map((r: any) => ({
      key: r.key,
      title: r.title,
      type: r.type,
      frequency: r.frequency,
      current_value: r.current_value,
      update_rule: r.update_rule,
      next_action: r.next_action,
      details: r.details,
    }));

    const standing_rules = (rulesResult.results || []).map((r: any) => r.rule);

    const meta = metaResult as any;

    return {
      schema_version: meta?.schema_version ?? '1.0',
      list_name: meta?.list_name ?? 'Morning Intelligence Brief — Master Action List',
      last_imported_at: meta?.last_imported_at,
      migration_rules: meta?.migration_rules ? JSON.parse(meta.migration_rules) : undefined,
      actions,
      daily_brief_requirements,
      standing_rules,
    } as any;
  }

  // ── POST /actions/import ─────────────────────────────────────────────────

  async importActionList(payload: ActionListPayload): Promise<{ imported: number; message: string }> {
    const now = new Date().toISOString();

    // Run everything in a batch for atomicity
    const statements: D1PreparedStatement[] = [];

    // 1. Clear existing data
    statements.push(this.db.prepare('DELETE FROM actions'));
    statements.push(this.db.prepare('DELETE FROM daily_brief_requirements'));
    statements.push(this.db.prepare('DELETE FROM standing_rules'));

    // 2. Upsert meta singleton
    statements.push(
      this.db.prepare(`
        INSERT INTO action_list_meta (id, schema_version, list_name, last_imported_at, migration_rules)
        VALUES (1, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          schema_version = excluded.schema_version,
          list_name = excluded.list_name,
          last_imported_at = excluded.last_imported_at,
          migration_rules = excluded.migration_rules
      `).bind(
        payload.schema_version ?? '1.0',
        payload.list_name ?? 'Morning Intelligence Brief — Master Action List',
        now,
        payload.migration_rules ? JSON.stringify(payload.migration_rules) : null,
      )
    );

    // 3. Insert actions
    for (const a of payload.actions) {
      statements.push(
        this.db.prepare(`
          INSERT INTO actions
            (migration_key, title, project, status, priority, next_action,
             due_date, recurrence, details, acceptance_criteria, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(
          a.migration_key,
          a.title,
          a.project ?? null,
          a.status ?? 'open',
          a.priority ?? 'medium',
          a.next_action ?? null,
          a.due_date ?? null,
          a.recurrence ?? null,
          a.details ?? null,
          a.acceptance_criteria ? JSON.stringify(a.acceptance_criteria) : null,
          now,
          now,
        )
      );
    }

    // 4. Insert daily brief requirements
    for (const r of (payload.daily_brief_requirements ?? [])) {
      statements.push(
        this.db.prepare(`
          INSERT INTO daily_brief_requirements
            (key, title, type, frequency, current_value, update_rule, next_action, details, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(
          r.key, r.title, r.type,
          r.frequency ?? null, r.current_value ?? null,
          r.update_rule ?? null, r.next_action ?? null,
          r.details ?? null, now,
        )
      );
    }

    // 5. Insert standing rules
    let order = 0;
    for (const rule of (payload.standing_rules ?? [])) {
      statements.push(
        this.db.prepare('INSERT INTO standing_rules (rule, sort_order, created_at) VALUES (?, ?, ?)')
          .bind(rule, order++, now)
      );
    }

    await this.db.batch(statements);

    return {
      imported: payload.actions.length,
      message: `Imported ${payload.actions.length} actions, ${(payload.daily_brief_requirements ?? []).length} requirements, ${(payload.standing_rules ?? []).length} standing rules.`,
    };
  }
}