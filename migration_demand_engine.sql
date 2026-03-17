-- ============================================
-- CEREBRO — Migration: Demand Generation Engine
-- Run this AFTER schema.sql in Supabase SQL Editor
-- ============================================

-- GOALS
CREATE TABLE IF NOT EXISTS goals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    mission_id UUID REFERENCES missions(id) ON DELETE CASCADE,
    description TEXT NOT NULL,
    target_metric TEXT NOT NULL,
    target_value NUMERIC,
    current_value NUMERIC DEFAULT 0,
    status TEXT DEFAULT 'active' CHECK (status IN ('active','achieved','paused')),
    created_at TIMESTAMPTZ DEFAULT now()
);

-- STRATEGIES
CREATE TABLE IF NOT EXISTS strategies (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
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

-- STRATEGY VARIATIONS (autosearch)
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

-- KNOWLEDGE
CREATE TABLE IF NOT EXISTS knowledge_entries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    category TEXT NOT NULL,
    insight TEXT NOT NULL,
    evidence JSONB DEFAULT '{}',
    confidence NUMERIC(5,2) DEFAULT 0,
    source_strategy_id UUID REFERENCES strategies(id),
    created_at TIMESTAMPTZ DEFAULT now()
);

-- ATTRIBUTION
CREATE TABLE IF NOT EXISTS attribution_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    visitor_id TEXT,
    session_id TEXT,
    event_type TEXT NOT NULL CHECK (event_type IN ('pageview','click','form_start','lead_capture','conversion')),
    asset_id UUID,
    asset_type TEXT,
    channel TEXT,
    utm_source TEXT,
    utm_medium TEXT,
    utm_campaign TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now()
);

-- CHANNEL PERFORMANCE
CREATE TABLE IF NOT EXISTS channel_performance (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    channel TEXT NOT NULL,
    date DATE NOT NULL,
    impressions INTEGER DEFAULT 0,
    clicks INTEGER DEFAULT 0,
    leads INTEGER DEFAULT 0,
    qualified_leads INTEGER DEFAULT 0,
    conversions INTEGER DEFAULT 0,
    cost NUMERIC(10,2) DEFAULT 0,
    revenue NUMERIC(10,2) DEFAULT 0,
    UNIQUE(channel, date)
);

-- COMPLIANCE
CREATE TABLE IF NOT EXISTS compliance_rules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    mission_id UUID REFERENCES missions(id) ON DELETE CASCADE,
    rule_type TEXT NOT NULL CHECK (rule_type IN ('legal','brand','geographic','claim','approval')),
    description TEXT NOT NULL,
    config JSONB DEFAULT '{}',
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- INDEXES
CREATE INDEX IF NOT EXISTS idx_goals_mission ON goals(mission_id);
CREATE INDEX IF NOT EXISTS idx_strategies_goal ON strategies(goal_id);
CREATE INDEX IF NOT EXISTS idx_strategies_status ON strategies(status);
CREATE INDEX IF NOT EXISTS idx_variations_strategy ON strategy_variations(strategy_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_category ON knowledge_entries(category);
CREATE INDEX IF NOT EXISTS idx_attribution_visitor ON attribution_events(visitor_id);
CREATE INDEX IF NOT EXISTS idx_attribution_type ON attribution_events(event_type);
CREATE INDEX IF NOT EXISTS idx_channel_perf_date ON channel_performance(date);
CREATE INDEX IF NOT EXISTS idx_compliance_mission ON compliance_rules(mission_id);

-- SEED: First goal
INSERT INTO goals (mission_id, description, target_metric, target_value)
SELECT id,
    'Capturar leads calificados interesados en finanzas internacionales, protección cambiaria y remesas en LATAM',
    'qualified_leads_per_month',
    100
FROM missions WHERE name = 'Finanzas LATAM';
