-- ============================================
-- CEREBRO — Migration 001: Core Foundation
-- Idempotent: safe to re-run
-- Tables: missions, domain_sites, cost_events,
--         operator_alerts, seo_rule_versions, demand_signals
-- ============================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ─── missions ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS missions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    country TEXT NOT NULL DEFAULT 'Colombia',
    objective TEXT NOT NULL,
    partner_name TEXT NOT NULL,
    target_audience JSONB DEFAULT '{}',
    core_topics JSONB DEFAULT '[]',
    whitelist JSONB DEFAULT '[]',
    blacklist JSONB DEFAULT '[]',
    cta_config JSONB DEFAULT '{}',
    budget_daily_usd NUMERIC(10,2) DEFAULT 30.00,
    budget_monthly_usd NUMERIC(10,2) DEFAULT 600.00,
    status TEXT DEFAULT 'active' CHECK (status IN ('active','paused','archived')),
    config JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- ─── domain_sites ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS domain_sites (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    mission_id UUID REFERENCES missions(id) ON DELETE CASCADE,
    domain TEXT NOT NULL UNIQUE,
    site_type TEXT DEFAULT 'editorial' CHECK (site_type IN ('editorial','comparison','tools','migration')),
    status TEXT DEFAULT 'active',
    metrics JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now()
);

-- ─── cost_events ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS cost_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    service TEXT NOT NULL DEFAULT 'anthropic',
    model TEXT,
    tokens_in INTEGER DEFAULT 0,
    tokens_out INTEGER DEFAULT 0,
    cost_usd NUMERIC(10,6) DEFAULT 0,
    run_id TEXT,
    pipeline_step TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- ─── operator_alerts ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS operator_alerts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    alert_type TEXT NOT NULL,
    severity TEXT DEFAULT 'info' CHECK (severity IN ('info','warning','critical')),
    message TEXT NOT NULL,
    action_url TEXT,
    action_label TEXT,
    dismissed BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- ─── seo_rule_versions ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS seo_rule_versions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    version_tag TEXT NOT NULL UNIQUE,
    rules JSONB NOT NULL,
    active BOOLEAN DEFAULT false,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    activated_at TIMESTAMPTZ
);

-- ─── demand_signals ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS demand_signals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    mission_id UUID REFERENCES missions(id) ON DELETE CASCADE,
    source TEXT NOT NULL CHECK (source IN ('google_news','reddit','x','tiktok','youtube','google_trends','manual')),
    title TEXT NOT NULL,
    url TEXT,
    snippet TEXT,
    relevance_score NUMERIC(5,2) DEFAULT 0,
    trend_velocity TEXT DEFAULT 'normal' CHECK (trend_velocity IN ('breakout','high','normal','low')),
    processed BOOLEAN DEFAULT false,
    content_asset_id UUID,   -- FK to content_assets (defined in 002)
    detected_at TIMESTAMPTZ DEFAULT now()
);

-- ─── auto update_at trigger ──────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_missions_updated ON missions;
CREATE TRIGGER tr_missions_updated
    BEFORE UPDATE ON missions FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ─── daily_cost_summary view ─────────────────────────────────────────────────
CREATE OR REPLACE VIEW daily_cost_summary AS
SELECT
    DATE(created_at) AS date,
    SUM(cost_usd) AS total_cost,
    COUNT(*) AS total_calls,
    SUM(tokens_in) AS total_tokens_in,
    SUM(tokens_out) AS total_tokens_out
FROM cost_events
GROUP BY DATE(created_at)
ORDER BY date DESC;

-- ─── indexes ─────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_cost_created ON cost_events(created_at);
CREATE INDEX IF NOT EXISTS idx_alerts_dismissed ON operator_alerts(dismissed);
CREATE INDEX IF NOT EXISTS idx_demand_processed ON demand_signals(processed);
CREATE INDEX IF NOT EXISTS idx_demand_source ON demand_signals(source);

-- ─── seed ────────────────────────────────────────────────────────────────────
INSERT INTO missions (name, country, objective, partner_name, target_audience, core_topics, cta_config, budget_daily_usd)
VALUES (
    'Finanzas LATAM', 'Colombia',
    'Capturar leads calificados interesados en finanzas internacionales, protección cambiaria, y remesas en LATAM',
    'Dólar Afuera',
    '{"segments": ["colombianos_exterior","colombianos_remesas","colombianos_inversion_usd","colombianos_panama"], "age_range": "25-45", "pain_points": ["perdida_remesas","acceso_usd","proteccion_devaluacion","banca_internacional"]}',
    '["abrir cuenta en dolares","remesas colombia","dolares desde colombia","cuenta panama","cuenta offshore legal","proteger ahorros devaluacion","wise vs western union colombia","transferir dolares","finanzas internacionales latam"]',
    '{"primary_cta": "Recibe nuestra guía gratis", "cta_url": "/suscribirse", "mention_style": "natural", "max_mentions_per_article": 2, "disclosure": "Este artículo es solo informativo. No constituye asesoría financiera."}',
    30.00
) ON CONFLICT DO NOTHING;

INSERT INTO domain_sites (mission_id, domain, site_type)
SELECT id, 'dolarafuera.co', 'editorial' FROM missions WHERE name = 'Finanzas LATAM'
ON CONFLICT (domain) DO NOTHING;

INSERT INTO domain_sites (mission_id, domain, site_type)
SELECT id, 'dolarizate.co', 'editorial' FROM missions WHERE name = 'Finanzas LATAM'
ON CONFLICT (domain) DO NOTHING;

INSERT INTO domain_sites (mission_id, domain, site_type)
SELECT id, 'mudateapanama.com', 'migration' FROM missions WHERE name = 'Finanzas LATAM'
ON CONFLICT (domain) DO NOTHING;

INSERT INTO domain_sites (mission_id, domain, site_type)
SELECT id, 'remesas.co', 'comparison' FROM missions WHERE name = 'Finanzas LATAM'
ON CONFLICT (domain) DO NOTHING;

INSERT INTO seo_rule_versions (version_tag, rules, active, notes)
VALUES ('v2026.03', '{
    "first_paragraph_max_words": 50,
    "section_min_words": 75,
    "section_max_words": 300,
    "min_faq_questions": 3,
    "min_internal_links": 3,
    "min_external_links": 2,
    "max_partner_mentions": 2,
    "min_word_count": 800,
    "max_word_count": 5000,
    "require_schema_article": true,
    "require_schema_faq": true,
    "require_schema_breadcrumb": true,
    "allowed_ai_crawlers": ["Googlebot","OAI-SearchBot","ChatGPT-User","PerplexityBot","ClaudeBot","Bytespider"]
}', true, 'SEO rules v2026.03')
ON CONFLICT (version_tag) DO NOTHING;
