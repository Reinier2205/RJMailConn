-- Migration 0004: Master Action List
-- Stores actions, daily brief requirements and standing rules
-- managed via ChatGPT morning brief workflow

CREATE TABLE IF NOT EXISTS actions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  migration_key TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  project TEXT,
  status TEXT NOT NULL DEFAULT 'open',   -- open | closed | paused
  priority TEXT NOT NULL DEFAULT 'medium', -- high | medium | low
  next_action TEXT,
  due_date TEXT,
  recurrence TEXT,
  details TEXT,
  acceptance_criteria TEXT,              -- JSON array stored as text
  history TEXT,                          -- JSON array of {date, change, reason}
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS daily_brief_requirements (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  key TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  type TEXT NOT NULL,                    -- recurring_check | recurring_workflow
  frequency TEXT,
  current_value TEXT,
  update_rule TEXT,
  next_action TEXT,
  details TEXT,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS standing_rules (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  rule TEXT NOT NULL UNIQUE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS action_list_meta (
  id INTEGER PRIMARY KEY CHECK (id = 1),  -- singleton row
  schema_version TEXT NOT NULL DEFAULT '1.0',
  list_name TEXT,
  last_imported_at TEXT NOT NULL DEFAULT (datetime('now')),
  migration_rules TEXT                    -- JSON object
);