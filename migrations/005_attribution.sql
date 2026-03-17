-- ============================================
-- CEREBRO — Migration 005: Attribution & Experiments
-- Idempotent: safe to re-run
-- Tables: attribution_events, channel_performance,
--         metrics_daily, experiments,
--         visitors, sessions, touchpoints,
--         fact_daily_asset_performance, fact_daily_channel_performance
-- Requires: 001_core.sql, 002_content.sql, 003_leads.sql
-- ============================================

-- ─── visitors ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS visitors (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    site_id UUID REFERENCES domain_sites(id) ON DELETE SET NULL,
    fingerprint_hash TEXT,
    first_seen TIMESTAMPTZ DEFAULT now(),
    last_seen TIMESTAMPTZ DEFAULT now()
);

-- ─── sessions ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    site_id UUID REFERENCES domain_sites(id) ON DELETE SET NULL,
    visitor_id UUID REFERENCES visitors(id) ON DELETE SET NULL,
    source TEXT,
    medium TEXT,
    campaign TEXT,
    content TEXT,
    referrer TEXT,
    landed_on TEXT,
    started_at TIMESTAMPTZ DEFAULT now()
);

-- ─── touchpoints ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS touchpoints (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    site_id UUID REFERENCES domain_sites(id) ON DELETE SET NULL,
    session_id UUID REFERENCES sessions(id) ON DELETE SET NULL,
    event_type TEXT NOT NULL CHECK (event_type IN ('page_view','cta_click','calculator_complete','quiz_complete','form_start','form_submit','email_capture')),
    asset_id UUID REFERENCES content_assets(id) ON DELETE SET NULL,
    cta_id UUID REFERENCES cta_variants(id) ON DELETE SET NULL,
    page_url TEXT,
    metadata_json JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now()
);

-- ─── attribution_events (legacy — keep for compat) ───────────────────────────
CREATE TABLE IF NOT EXISTS attribution_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    site_id UUID REFERENCES domain_sites(id) ON DELETE SET NULL,
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

ALTER TABLE attribution_events ADD COLUMN IF NOT EXISTS site_id UUID REFERENCES domain_sites(id) ON DELETE SET NULL;

-- ─── channel_performance ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS channel_performance (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    site_id UUID REFERENCES domain_sites(id) ON DELETE SET NULL,
    channel TEXT NOT NULL,
    date DATE NOT NULL,
    impressions INTEGER DEFAULT 0,
    clicks INTEGER DEFAULT 0,
    leads INTEGER DEFAULT 0,
    qualified_leads INTEGER DEFAULT 0,
    conversions INTEGER DEFAULT 0,
    cost NUMERIC(10,2) DEFAULT 0,
    revenue NUMERIC(10,2) DEFAULT 0,
    UNIQUE(site_id, channel, date)
);

ALTER TABLE channel_performance ADD COLUMN IF NOT EXISTS site_id UUID REFERENCES domain_sites(id) ON DELETE SET NULL;

-- ─── metrics_daily ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS metrics_daily (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    site_id UUID REFERENCES domain_sites(id) ON DELETE SET NULL,
    page_id UUID REFERENCES pages(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    visits INTEGER DEFAULT 0,
    unique_visits INTEGER DEFAULT 0,
    cta_clicks INTEGER DEFAULT 0,
    partner_link_clicks INTEGER DEFAULT 0,
    lead_captures INTEGER DEFAULT 0,
    revenue_attributed NUMERIC(10,2) DEFAULT 0,
    revenue_per_100_visits NUMERIC(10,4) DEFAULT 0,
    UNIQUE(page_id, date)
);

ALTER TABLE metrics_daily ADD COLUMN IF NOT EXISTS site_id UUID REFERENCES domain_sites(id) ON DELETE SET NULL;

-- ─── experiments ─────────────────────────────────────────────────────────────
-- Replaces old single-variant experiments with proper A/B state machine
CREATE TABLE IF NOT EXISTS experiments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    site_id UUID REFERENCES domain_sites(id) ON DELETE SET NULL,
    opportunity_id UUID,
    hypothesis TEXT NOT NULL,
    target_metric TEXT,
    variant_a_json JSONB DEFAULT '{}',
    variant_b_json JSONB DEFAULT '{}',
    run_window_days INTEGER DEFAULT 14,
    status TEXT DEFAULT 'planned' CHECK (status IN ('planned','running','evaluated','winner_declared','archived')),
    outcome_json JSONB DEFAULT '{}',
    winner TEXT,
    learnings TEXT,
    -- legacy compat columns
    page_id UUID REFERENCES pages(id) ON DELETE SET NULL,
    change_type TEXT,
    variant_a JSONB DEFAULT '{}',
    variant_b JSONB DEFAULT '{}',
    metric_baseline NUMERIC(10,4),
    metric_variant NUMERIC(10,4),
    visits_a INTEGER DEFAULT 0,
    visits_b INTEGER DEFAULT 0,
    result JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now(),
    evaluated_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    started_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE experiments ADD COLUMN IF NOT EXISTS site_id UUID REFERENCES domain_sites(id) ON DELETE SET NULL;
ALTER TABLE experiments ADD COLUMN IF NOT EXISTS opportunity_id UUID;
ALTER TABLE experiments ADD COLUMN IF NOT EXISTS target_metric TEXT;
ALTER TABLE experiments ADD COLUMN IF NOT EXISTS variant_a_json JSONB DEFAULT '{}';
ALTER TABLE experiments ADD COLUMN IF NOT EXISTS variant_b_json JSONB DEFAULT '{}';
ALTER TABLE experiments ADD COLUMN IF NOT EXISTS run_window_days INTEGER DEFAULT 14;
ALTER TABLE experiments ADD COLUMN IF NOT EXISTS outcome_json JSONB DEFAULT '{}';
ALTER TABLE experiments ADD COLUMN IF NOT EXISTS learnings TEXT;
ALTER TABLE experiments ADD COLUMN IF NOT EXISTS evaluated_at TIMESTAMPTZ;

-- ─── fact tables ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS fact_daily_asset_performance (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    site_id UUID REFERENCES domain_sites(id) ON DELETE SET NULL,
    asset_id UUID REFERENCES content_assets(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    visits INTEGER DEFAULT 0,
    unique_visitors INTEGER DEFAULT 0,
    leads INTEGER DEFAULT 0,
    qualified_leads INTEGER DEFAULT 0,
    revenue DECIMAL(10,2) DEFAULT 0,
    cta_clicks INTEGER DEFAULT 0,
    UNIQUE(site_id, asset_id, date)
);

CREATE TABLE IF NOT EXISTS fact_daily_channel_performance (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    site_id UUID REFERENCES domain_sites(id) ON DELETE SET NULL,
    channel TEXT NOT NULL,
    date DATE NOT NULL,
    visits INTEGER DEFAULT 0,
    leads INTEGER DEFAULT 0,
    qualified_leads INTEGER DEFAULT 0,
    revenue DECIMAL(10,2) DEFAULT 0,
    UNIQUE(site_id, channel, date)
);

-- ─── indexes ─────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_metrics_date ON metrics_daily(date);
CREATE INDEX IF NOT EXISTS idx_metrics_page ON metrics_daily(page_id);
CREATE INDEX IF NOT EXISTS idx_metrics_site ON metrics_daily(site_id);
CREATE INDEX IF NOT EXISTS idx_attribution_visitor ON attribution_events(visitor_id);
CREATE INDEX IF NOT EXISTS idx_attribution_type ON attribution_events(event_type);
CREATE INDEX IF NOT EXISTS idx_attribution_site ON attribution_events(site_id);
CREATE INDEX IF NOT EXISTS idx_channel_perf_date ON channel_performance(date);
CREATE INDEX IF NOT EXISTS idx_channel_perf_site ON channel_performance(site_id);
CREATE INDEX IF NOT EXISTS idx_visitors_site ON visitors(site_id);
CREATE INDEX IF NOT EXISTS idx_sessions_visitor ON sessions(visitor_id);
CREATE INDEX IF NOT EXISTS idx_sessions_site ON sessions(site_id);
CREATE INDEX IF NOT EXISTS idx_touchpoints_session ON touchpoints(session_id);
CREATE INDEX IF NOT EXISTS idx_touchpoints_site ON touchpoints(site_id);
CREATE INDEX IF NOT EXISTS idx_fact_asset_date ON fact_daily_asset_performance(date);
CREATE INDEX IF NOT EXISTS idx_fact_channel_date ON fact_daily_channel_performance(date);
