-- ============================================
-- CEREBRO — Migration 004: Strategy & Knowledge
-- Idempotent: safe to re-run
-- Tables: goals, strategies, strategy_variations,
--         knowledge_entries, compliance_rules
-- Requires: 001_core.sql
-- ============================================

-- ─── goals ───────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS goals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    site_id UUID REFERENCES domain_sites(id) ON DELETE SET NULL,
    mission_id UUID REFERENCES missions(id) ON DELETE CASCADE,
    description TEXT NOT NULL,
    target_metric TEXT NOT NULL,
    target_value NUMERIC,
    current_value NUMERIC DEFAULT 0,
    status TEXT DEFAULT 'active' CHECK (status IN ('active','achieved','paused')),
    created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE goals ADD COLUMN IF NOT EXISTS site_id UUID REFERENCES domain_sites(id) ON DELETE SET NULL;

-- ─── strategies ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS strategies (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    site_id UUID REFERENCES domain_sites(id) ON DELETE SET NULL,
    goal_id UUID REFERENCES goals(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    channel TEXT NOT NULL,
    skills_needed JSONB DEFAULT '[]',
    estimated_leads INTEGER DEFAULT 0,
    estimated_cost NUMERIC(10,2) DEFAULT 0,
    confidence_score NUMERIC(5,2) DEFAULT 0,
    status TEXT DEFAULT 'proposed' CHECK (status IN ('proposed','approved','running','completed','failed')),
    results JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE strategies ADD COLUMN IF NOT EXISTS site_id UUID REFERENCES domain_sites(id) ON DELETE SET NULL;

-- ─── strategy_variations ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS strategy_variations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    strategy_id UUID REFERENCES strategies(id) ON DELETE CASCADE,
    variation_type TEXT NOT NULL,
    parameters JSONB NOT NULL,
    simulation_score NUMERIC(5,2) DEFAULT 0,
    actual_score NUMERIC(5,2),
    status TEXT DEFAULT 'simulated' CHECK (status IN ('simulated','running','completed','discarded')),
    created_at TIMESTAMPTZ DEFAULT now()
);

-- ─── knowledge_entries ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS knowledge_entries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    site_id UUID REFERENCES domain_sites(id) ON DELETE SET NULL,
    category TEXT NOT NULL,
    condition_json JSONB DEFAULT '{}',
    metric_name TEXT,
    metric_value DECIMAL,
    sample_size INTEGER DEFAULT 0,
    confidence TEXT DEFAULT 'low' CHECK (confidence IN ('low','medium','high')),
    -- legacy fields
    insight TEXT,
    evidence JSONB DEFAULT '{}',
    source_strategy_id UUID REFERENCES strategies(id),
    supporting_experiment_ids UUID[],
    valid_until TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE knowledge_entries ADD COLUMN IF NOT EXISTS site_id UUID REFERENCES domain_sites(id) ON DELETE SET NULL;
ALTER TABLE knowledge_entries ADD COLUMN IF NOT EXISTS condition_json JSONB DEFAULT '{}';
ALTER TABLE knowledge_entries ADD COLUMN IF NOT EXISTS metric_name TEXT;
ALTER TABLE knowledge_entries ADD COLUMN IF NOT EXISTS metric_value DECIMAL;
ALTER TABLE knowledge_entries ADD COLUMN IF NOT EXISTS sample_size INTEGER DEFAULT 0;
ALTER TABLE knowledge_entries ADD COLUMN IF NOT EXISTS confidence TEXT DEFAULT 'low';
ALTER TABLE knowledge_entries ADD COLUMN IF NOT EXISTS supporting_experiment_ids UUID[];
ALTER TABLE knowledge_entries ADD COLUMN IF NOT EXISTS valid_until TIMESTAMPTZ;

-- ─── compliance_rules ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS compliance_rules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    site_id UUID REFERENCES domain_sites(id) ON DELETE SET NULL,
    mission_id UUID REFERENCES missions(id) ON DELETE CASCADE,
    rule_type TEXT NOT NULL CHECK (rule_type IN ('legal','brand','geographic','claim','approval')),
    description TEXT NOT NULL,
    config JSONB DEFAULT '{}',
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE compliance_rules ADD COLUMN IF NOT EXISTS site_id UUID REFERENCES domain_sites(id) ON DELETE SET NULL;

-- ─── prompt_versions ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS prompt_versions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    prompt_name TEXT NOT NULL,
    version INTEGER NOT NULL,
    template TEXT NOT NULL,
    is_active BOOLEAN DEFAULT false,
    performance_notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(prompt_name, version)
);

-- ─── indexes ─────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_goals_mission ON goals(mission_id);
CREATE INDEX IF NOT EXISTS idx_goals_site ON goals(site_id);
CREATE INDEX IF NOT EXISTS idx_strategies_goal ON strategies(goal_id);
CREATE INDEX IF NOT EXISTS idx_strategies_status ON strategies(status);
CREATE INDEX IF NOT EXISTS idx_variations_strategy ON strategy_variations(strategy_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_category ON knowledge_entries(category);
CREATE INDEX IF NOT EXISTS idx_knowledge_site ON knowledge_entries(site_id);
CREATE INDEX IF NOT EXISTS idx_compliance_mission ON compliance_rules(mission_id);

-- ─── seed ────────────────────────────────────────────────────────────────────
INSERT INTO goals (mission_id, description, target_metric, target_value)
SELECT id,
    'Capturar leads calificados interesados en finanzas internacionales, protección cambiaria y remesas en LATAM',
    'qualified_leads_per_month', 100
FROM missions WHERE name = 'Finanzas LATAM'
ON CONFLICT DO NOTHING;
