-- ============================================
-- CEREBRO — Migration 009: Execution Engine
-- Idempotent: safe to re-run
-- Tables: tasks, skill_runs
-- Alters: opportunities (add execution columns)
-- Requires: 002_content.sql, 004_strategy.sql, 005_attribution.sql
-- ============================================

-- ─── tasks (typed skill execution graph) ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS tasks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    experiment_id UUID REFERENCES experiments(id) ON DELETE CASCADE,
    site_id UUID REFERENCES domain_sites(id) ON DELETE SET NULL,
    skill_name TEXT NOT NULL,
    input_json JSONB DEFAULT '{}',
    depends_on UUID REFERENCES tasks(id) ON DELETE SET NULL,
    status TEXT DEFAULT 'pending' CHECK (status IN (
        'pending','running','completed','failed','retrying','dead_lettered'
    )),
    output_json JSONB DEFAULT '{}',
    error TEXT,
    attempts INTEGER DEFAULT 0,
    idempotency_key TEXT UNIQUE,
    estimated_cost DECIMAL(10,4) DEFAULT 0,
    actual_cost DECIMAL(10,4),
    created_at TIMESTAMPTZ DEFAULT now(),
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ
);

-- ─── skill_runs (execution history per task) ─────────────────────────────────
CREATE TABLE IF NOT EXISTS skill_runs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    task_id UUID REFERENCES tasks(id) ON DELETE SET NULL,
    site_id UUID REFERENCES domain_sites(id) ON DELETE SET NULL,
    skill_name TEXT NOT NULL,
    status TEXT DEFAULT 'running' CHECK (status IN ('running','completed','failed')),
    input_json JSONB DEFAULT '{}',
    output_json JSONB DEFAULT '{}',
    cost DECIMAL(10,4) DEFAULT 0,
    error TEXT,
    started_at TIMESTAMPTZ DEFAULT now(),
    completed_at TIMESTAMPTZ
);

-- ─── opportunities: add Bloque 4 execution columns ───────────────────────────
ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS goal_id UUID REFERENCES goals(id) ON DELETE SET NULL;
ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS query TEXT;
ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS pain_point TEXT;
ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS audience TEXT;
ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS intent TEXT DEFAULT 'awareness';
ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS expected_value DECIMAL(10,2) DEFAULT 0;
ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS confidence TEXT DEFAULT 'low';
ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS execution_status TEXT DEFAULT 'detected'
    CHECK (execution_status IN ('detected','evaluated','planned','executing','measured'));

-- ─── indexes ─────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_tasks_experiment ON tasks(experiment_id);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_site ON tasks(site_id);
CREATE INDEX IF NOT EXISTS idx_tasks_depends ON tasks(depends_on);
CREATE INDEX IF NOT EXISTS idx_skill_runs_task ON skill_runs(task_id);
CREATE INDEX IF NOT EXISTS idx_skill_runs_skill ON skill_runs(skill_name);
CREATE INDEX IF NOT EXISTS idx_skill_runs_site ON skill_runs(site_id);
CREATE INDEX IF NOT EXISTS idx_opportunities_goal ON opportunities(goal_id);
CREATE INDEX IF NOT EXISTS idx_opportunities_exec_status ON opportunities(execution_status);
