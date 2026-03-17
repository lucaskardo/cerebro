-- ============================================
-- CEREBRO — Migration 008: Operations Layer
-- Idempotent: safe to re-run
-- Tables: jobs, audit_log, approvals, feature_flags
-- Requires: 001_core.sql
-- ============================================

-- ─── jobs (persistent task queue) ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS jobs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    site_id UUID REFERENCES domain_sites(id) ON DELETE SET NULL,
    type TEXT NOT NULL,
    payload_json JSONB DEFAULT '{}',
    status TEXT DEFAULT 'queued' CHECK (status IN ('queued','running','completed','failed','cancelled','dead_lettered')),
    attempts INTEGER DEFAULT 0,
    max_attempts INTEGER DEFAULT 3,
    error TEXT,
    idempotency_key TEXT UNIQUE,
    run_id TEXT,
    priority INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now(),
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status);
CREATE INDEX IF NOT EXISTS idx_jobs_type ON jobs(type);
CREATE INDEX IF NOT EXISTS idx_jobs_site ON jobs(site_id);
CREATE INDEX IF NOT EXISTS idx_jobs_idempotency ON jobs(idempotency_key);

-- ─── audit_log ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS audit_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    site_id UUID REFERENCES domain_sites(id) ON DELETE SET NULL,
    actor TEXT,
    action TEXT NOT NULL,
    entity_type TEXT,
    entity_id TEXT,
    ip TEXT,
    payload_summary JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_log_entity ON audit_log(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_actor ON audit_log(actor);
CREATE INDEX IF NOT EXISTS idx_audit_log_created ON audit_log(created_at);

-- ─── approvals ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS approvals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    site_id UUID REFERENCES domain_sites(id) ON DELETE SET NULL,
    entity_type TEXT NOT NULL,
    entity_id UUID,
    action TEXT NOT NULL,
    requested_by TEXT DEFAULT 'system',
    approved_by TEXT,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','executed','expired')),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    resolved_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_approvals_status ON approvals(status);
CREATE INDEX IF NOT EXISTS idx_approvals_site ON approvals(site_id);
CREATE INDEX IF NOT EXISTS idx_approvals_entity ON approvals(entity_type, entity_id);

-- ─── feature_flags ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS feature_flags (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    site_id UUID REFERENCES domain_sites(id) ON DELETE CASCADE,
    flag_name TEXT NOT NULL,
    enabled BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(site_id, flag_name)
);

CREATE INDEX IF NOT EXISTS idx_feature_flags_site ON feature_flags(site_id);
CREATE INDEX IF NOT EXISTS idx_feature_flags_name ON feature_flags(flag_name);

-- ─── seed: default feature flags per site ────────────────────────────────────
INSERT INTO feature_flags (site_id, flag_name, enabled)
SELECT d.id, f.flag_name, false
FROM domain_sites d
CROSS JOIN (VALUES
    ('auto_publish_articles'),
    ('social_scheduler_enabled'),
    ('whatsapp_enabled'),
    ('sandbox_mode'),
    ('loop_scheduler_enabled')
) AS f(flag_name)
ON CONFLICT (site_id, flag_name) DO NOTHING;
