-- CEREBRO v7 — Migration 012: Maintenance Tables + Performance Indexes
-- backup_snapshots, retention_policies, and indexes on hot query paths.

-- ── Backup snapshots ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS backup_snapshots (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    snapshot_type   TEXT NOT NULL CHECK (snapshot_type IN ('daily_counts', 'health_check', 'export')),
    status          TEXT DEFAULT 'completed' CHECK (status IN ('running', 'completed', 'failed')),
    tables_checked  JSONB DEFAULT '{}',   -- {table_name: row_count}
    anomalies       JSONB DEFAULT '[]',   -- [{table, issue, value}]
    size_estimate_mb NUMERIC(10,2),
    error           TEXT,
    created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_backup_snapshots_type ON backup_snapshots(snapshot_type);
CREATE INDEX IF NOT EXISTS idx_backup_snapshots_created ON backup_snapshots(created_at DESC);

-- ── Retention policies ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS retention_policies (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    table_name      TEXT NOT NULL UNIQUE,
    max_age_days    INTEGER,            -- delete rows older than N days (NULL = no age limit)
    max_rows        INTEGER,            -- keep only most recent N rows (NULL = no row limit)
    status_filter   TEXT,              -- only apply to rows with this status value (NULL = all)
    action          TEXT DEFAULT 'delete' CHECK (action IN ('delete', 'archive')),
    active          BOOLEAN DEFAULT true,
    created_at      TIMESTAMPTZ DEFAULT now()
);

-- Default retention policies — conservative, safe defaults
INSERT INTO retention_policies (table_name, max_age_days, max_rows, status_filter, action) VALUES
    ('audit_log',            90,   NULL,   NULL,        'delete'),
    ('attribution_events',  180,   NULL,   NULL,        'delete'),
    ('skill_runs',           30,   NULL,   'completed', 'delete'),
    ('jobs',                 30,   NULL,   'completed', 'delete'),
    ('social_content_queue', 60,   NULL,   'published', 'delete'),
    ('touchpoints',         180,   NULL,   NULL,        'delete'),
    ('alerts',               30,  1000,   NULL,        'delete')
ON CONFLICT (table_name) DO NOTHING;

-- ── Performance indexes on hot query paths ─────────────────────────────────

-- leads
CREATE INDEX IF NOT EXISTS idx_leads_site_status    ON leads(site_id, current_status);
CREATE INDEX IF NOT EXISTS idx_leads_created        ON leads(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_leads_intent         ON leads(intent_score DESC);

-- content_assets
CREATE INDEX IF NOT EXISTS idx_content_site_status  ON content_assets(site_id, status);
CREATE INDEX IF NOT EXISTS idx_content_created      ON content_assets(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_content_keyword      ON content_assets(keyword);

-- attribution_events
CREATE INDEX IF NOT EXISTS idx_attr_visitor         ON attribution_events(visitor_id);
CREATE INDEX IF NOT EXISTS idx_attr_type            ON attribution_events(event_type);
CREATE INDEX IF NOT EXISTS idx_attr_created         ON attribution_events(created_at DESC);

-- touchpoints
CREATE INDEX IF NOT EXISTS idx_touch_site_asset     ON touchpoints(site_id, asset_id);
CREATE INDEX IF NOT EXISTS idx_touch_visitor        ON touchpoints(visitor_id);
CREATE INDEX IF NOT EXISTS idx_touch_created        ON touchpoints(created_at DESC);

-- jobs
CREATE INDEX IF NOT EXISTS idx_jobs_status_priority ON jobs(status, priority DESC, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_jobs_created         ON jobs(created_at DESC);

-- audit_log
CREATE INDEX IF NOT EXISTS idx_audit_created        ON audit_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_actor          ON audit_log(actor);
CREATE INDEX IF NOT EXISTS idx_audit_entity         ON audit_log(entity_type, entity_id);

-- skill_runs
CREATE INDEX IF NOT EXISTS idx_skillruns_skill      ON skill_runs(skill_name);
CREATE INDEX IF NOT EXISTS idx_skillruns_status     ON skill_runs(status);
CREATE INDEX IF NOT EXISTS idx_skillruns_created    ON skill_runs(created_at DESC);

-- experiments
CREATE INDEX IF NOT EXISTS idx_exp_site_status      ON experiments(site_id, status);
CREATE INDEX IF NOT EXISTS idx_exp_created          ON experiments(created_at DESC);

-- opportunities
CREATE INDEX IF NOT EXISTS idx_opp_goal             ON opportunities(goal_id);
CREATE INDEX IF NOT EXISTS idx_opp_exec_status      ON opportunities(execution_status);

-- cycle_runs
CREATE INDEX IF NOT EXISTS idx_cycle_goal           ON cycle_runs(goal_id);
CREATE INDEX IF NOT EXISTS idx_cycle_created        ON cycle_runs(created_at DESC);
