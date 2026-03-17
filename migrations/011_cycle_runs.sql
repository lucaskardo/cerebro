-- CEREBRO Bloque 6: Supervised Loop
-- cycle_runs: history of each loop execution

CREATE TABLE IF NOT EXISTS cycle_runs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    goal_id UUID REFERENCES goals(id) ON DELETE CASCADE,
    site_id UUID REFERENCES domain_sites(id) ON DELETE SET NULL,
    status TEXT NOT NULL DEFAULT 'running'
        CHECK (status IN ('running','completed','paused','failed')),
    opportunities_generated INT NOT NULL DEFAULT 0,
    experiments_created INT NOT NULL DEFAULT 0,
    tasks_auto_run INT NOT NULL DEFAULT 0,
    tasks_queued_approval INT NOT NULL DEFAULT 0,
    kill_reason TEXT,
    error TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_cycle_runs_goal ON cycle_runs(goal_id);
CREATE INDEX IF NOT EXISTS idx_cycle_runs_created ON cycle_runs(created_at DESC);
