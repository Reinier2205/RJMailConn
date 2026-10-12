-- Migration 0005: Add system_prompt and financial_and_operational_state to action_list_meta
-- These new root-level fields are stored alongside migration_rules in the meta singleton row.

ALTER TABLE action_list_meta ADD COLUMN system_prompt TEXT;
ALTER TABLE action_list_meta ADD COLUMN financial_and_operational_state TEXT; -- JSON object
