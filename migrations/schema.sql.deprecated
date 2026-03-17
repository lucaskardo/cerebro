-- ============================================
-- CEREBRO v7 — Supabase Schema
-- Run this ONCE in Supabase SQL Editor
-- ============================================

-- Enable extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- 1. MISSIONS
-- ============================================
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

-- ============================================
-- 2. DOMAIN SITES
-- ============================================
CREATE TABLE IF NOT EXISTS domain_sites (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    mission_id UUID REFERENCES missions(id) ON DELETE CASCADE,
    domain TEXT NOT NULL UNIQUE,
    site_type TEXT DEFAULT 'editorial' CHECK (site_type IN ('editorial','comparison','tools','migration')),
    status TEXT DEFAULT 'active',
    metrics JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- 3. CLUSTERS
-- ============================================
CREATE TABLE IF NOT EXISTS clusters (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    mission_id UUID REFERENCES missions(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    pillar_query TEXT NOT NULL,
    spokes JSONB DEFAULT '[]',
    topic_coverage_score NUMERIC(5,2) DEFAULT 0,
    target_tcs NUMERIC(5,2) DEFAULT 70,
    status TEXT DEFAULT 'active' CHECK (status IN ('active','complete','paused')),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- 4. OPPORTUNITIES
-- ============================================
CREATE TABLE IF NOT EXISTS opportunities (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    mission_id UUID REFERENCES missions(id) ON DELETE CASCADE,
    cluster_id UUID REFERENCES clusters(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    keyword TEXT NOT NULL,
    topic_type TEXT DEFAULT 'spoke' CHECK (topic_type IN ('pillar','spoke','faq','comparison','tool','landing')),
    opportunity_score NUMERIC(5,2) DEFAULT 0,
    search_volume INTEGER DEFAULT 0,
    competition TEXT DEFAULT 'medium' CHECK (competition IN ('low','medium','high')),
    search_intent TEXT DEFAULT 'informational' CHECK (search_intent IN ('informational','transactional','comparison','navigational')),
    monetization_fit NUMERIC(5,2) DEFAULT 0,
    status TEXT DEFAULT 'backlog' CHECK (status IN ('backlog','queued','in_progress','published','archived')),
    created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- 5. CONTENT ASSETS
-- ============================================
CREATE TABLE IF NOT EXISTS content_assets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    opportunity_id UUID REFERENCES opportunities(id) ON DELETE SET NULL,
    mission_id UUID REFERENCES missions(id) ON DELETE CASCADE,
    asset_type TEXT DEFAULT 'article' CHECK (asset_type IN ('article','landing','calculator','comparator','guide','faq')),
    title TEXT NOT NULL,
    slug TEXT NOT NULL,
    keyword TEXT,
    brief JSONB DEFAULT '{}',
    outline JSONB DEFAULT '{}',
    body_md TEXT DEFAULT '',
    body_html TEXT DEFAULT '',
    meta_description TEXT DEFAULT '',
    quality_score NUMERIC(5,2) DEFAULT 0,
    humanization_score NUMERIC(5,2) DEFAULT 0,
    validation_results JSONB DEFAULT '{}',
    seo_rules_version TEXT DEFAULT 'v2026.03',
    partner_mentions JSONB DEFAULT '[]',
    faq_section JSONB DEFAULT '[]',
    data_claims JSONB DEFAULT '[]',
    images JSONB DEFAULT '[]',
    status TEXT DEFAULT 'generating' CHECK (status IN ('generating','draft','review','approved','published','archived','error')),
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- 6. PAGES (published)
-- ============================================
CREATE TABLE IF NOT EXISTS pages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    content_asset_id UUID REFERENCES content_assets(id) ON DELETE CASCADE,
    site_domain TEXT NOT NULL,
    page_type TEXT DEFAULT 'article',
    slug TEXT NOT NULL,
    url TEXT NOT NULL,
    publish_status TEXT DEFAULT 'draft' CHECK (publish_status IN ('draft','published','unpublished')),
    seo_meta JSONB DEFAULT '{}',
    schema_markup JSONB DEFAULT '{}',
    core_web_vitals JSONB DEFAULT '{}',
    published_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(site_domain, slug)
);

-- ============================================
-- 7. LEADS
-- ============================================
CREATE TABLE IF NOT EXISTS leads (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    mission_id UUID REFERENCES missions(id) ON DELETE CASCADE,
    page_id UUID REFERENCES pages(id) ON DELETE SET NULL,
    email TEXT NOT NULL,
    nombre TEXT,
    telefono TEXT,
    origen_url TEXT,
    utm_source TEXT,
    utm_medium TEXT,
    utm_campaign TEXT,
    tema_interes TEXT,
    cta_que_convirtio TEXT,
    intent_score INTEGER DEFAULT 0 CHECK (intent_score >= 0 AND intent_score <= 100),
    quiz_responses JSONB DEFAULT '{}',
    consent_timestamp TIMESTAMPTZ,
    double_optin_ok BOOLEAN DEFAULT false,
    delivery_status TEXT DEFAULT 'pending' CHECK (delivery_status IN ('pending','delivered','accepted','rejected')),
    created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- 8. PARTNER DELIVERIES
-- ============================================
CREATE TABLE IF NOT EXISTS partner_deliveries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    lead_id UUID REFERENCES leads(id) ON DELETE CASCADE,
    partner_name TEXT NOT NULL,
    delivery_url TEXT,
    delivery_status TEXT DEFAULT 'pending',
    response_payload JSONB DEFAULT '{}',
    accepted BOOLEAN,
    revenue_usd NUMERIC(10,2) DEFAULT 0,
    delivered_at TIMESTAMPTZ
);

-- ============================================
-- 9. METRICS DAILY
-- ============================================
CREATE TABLE IF NOT EXISTS metrics_daily (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
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

-- ============================================
-- 10. COST EVENTS (Circuit Breaker)
-- ============================================
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

-- ============================================
-- 11. EXPERIMENTS (AutoLoop)
-- ============================================
CREATE TABLE IF NOT EXISTS experiments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    page_id UUID REFERENCES pages(id) ON DELETE CASCADE,
    hypothesis TEXT NOT NULL,
    change_type TEXT,
    variant_a JSONB DEFAULT '{}',
    variant_b JSONB DEFAULT '{}',
    status TEXT DEFAULT 'running' CHECK (status IN ('running','completed','paused','failed')),
    metric_baseline NUMERIC(10,4),
    metric_variant NUMERIC(10,4),
    visits_a INTEGER DEFAULT 0,
    visits_b INTEGER DEFAULT 0,
    winner TEXT CHECK (winner IN ('baseline','variant','inconclusive')),
    result JSONB DEFAULT '{}',
    started_at TIMESTAMPTZ DEFAULT now(),
    completed_at TIMESTAMPTZ
);

-- ============================================
-- 12. SOCIAL CONTENT QUEUE
-- ============================================
CREATE TABLE IF NOT EXISTS social_content_queue (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    content_asset_id UUID REFERENCES content_assets(id) ON DELETE CASCADE,
    platform TEXT NOT NULL CHECK (platform IN ('instagram','tiktok','x','linkedin','reddit','facebook')),
    content_type TEXT DEFAULT 'post' CHECK (content_type IN ('post','reel','carousel','thread','story','comment')),
    content_text TEXT,
    image_url TEXT,
    scheduled_at TIMESTAMPTZ,
    status TEXT DEFAULT 'draft' CHECK (status IN ('draft','approved','scheduled','published','rejected')),
    approved_by TEXT,
    performance JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- 13. DEMAND SIGNALS
-- ============================================
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
    content_asset_id UUID REFERENCES content_assets(id) ON DELETE SET NULL,
    detected_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- 14. OPERATOR ALERTS
-- ============================================
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

-- ============================================
-- 15. EMAIL SEQUENCES
-- ============================================
CREATE TABLE IF NOT EXISTS email_sequences (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    lead_id UUID REFERENCES leads(id) ON DELETE CASCADE,
    sequence_name TEXT NOT NULL,
    step_number INTEGER NOT NULL,
    subject TEXT,
    body_html TEXT,
    sent_at TIMESTAMPTZ,
    opened_at TIMESTAMPTZ,
    clicked_at TIMESTAMPTZ,
    converted BOOLEAN DEFAULT false
);

-- ============================================
-- 16. SEO RULE VERSIONS
-- ============================================
CREATE TABLE IF NOT EXISTS seo_rule_versions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    version_tag TEXT NOT NULL UNIQUE,
    rules JSONB NOT NULL,
    active BOOLEAN DEFAULT false,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    activated_at TIMESTAMPTZ
);

-- ============================================
-- INDEXES
-- ============================================
CREATE INDEX idx_content_status ON content_assets(status);
CREATE INDEX idx_content_mission ON content_assets(mission_id);
CREATE INDEX idx_pages_domain ON pages(site_domain);
CREATE INDEX idx_pages_slug ON pages(site_domain, slug);
CREATE INDEX idx_leads_mission ON leads(mission_id);
CREATE INDEX idx_leads_created ON leads(created_at);
CREATE INDEX idx_metrics_date ON metrics_daily(date);
CREATE INDEX idx_metrics_page ON metrics_daily(page_id);
CREATE INDEX idx_cost_created ON cost_events(created_at);
CREATE INDEX idx_demand_source ON demand_signals(source);
CREATE INDEX idx_demand_processed ON demand_signals(processed);
CREATE INDEX idx_opportunities_status ON opportunities(status);
CREATE INDEX idx_social_status ON social_content_queue(status);
CREATE INDEX idx_alerts_dismissed ON operator_alerts(dismissed);

-- ============================================
-- FUNCTIONS
-- ============================================

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_missions_updated BEFORE UPDATE ON missions FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER tr_content_updated BEFORE UPDATE ON content_assets FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER tr_clusters_updated BEFORE UPDATE ON clusters FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Daily cost total view
CREATE OR REPLACE VIEW daily_cost_summary AS
SELECT 
    DATE(created_at) as date,
    SUM(cost_usd) as total_cost,
    COUNT(*) as total_calls,
    SUM(tokens_in) as total_tokens_in,
    SUM(tokens_out) as total_tokens_out
FROM cost_events
GROUP BY DATE(created_at)
ORDER BY date DESC;

-- ============================================
-- SEED DATA
-- ============================================
INSERT INTO missions (name, country, objective, partner_name, target_audience, core_topics, cta_config, budget_daily_usd)
VALUES (
    'Finanzas LATAM',
    'Colombia',
    'Capturar leads calificados interesados en finanzas internacionales, protección cambiaria, y remesas en LATAM',
    'Dólar Afuera',
    '{"segments": ["colombianos_exterior", "colombianos_remesas", "colombianos_inversion_usd", "colombianos_panama"], "age_range": "25-45", "pain_points": ["perdida_remesas", "acceso_usd", "proteccion_devaluacion", "banca_internacional"]}',
    '["abrir cuenta en dolares", "remesas colombia", "dolares desde colombia", "cuenta panama", "cuenta offshore legal", "proteger ahorros devaluacion", "wise vs western union colombia", "transferir dolares", "finanzas internacionales latam"]',
    '{"primary_cta": "Recibe nuestra guía gratis", "cta_url": "/suscribirse", "mention_style": "natural", "max_mentions_per_article": 2, "disclosure": "Este artículo es solo informativo. No constituye asesoría financiera."}',
    30.00
) ON CONFLICT DO NOTHING;

INSERT INTO domain_sites (mission_id, domain, site_type)
SELECT id, 'dolarafuera.co', 'editorial'
FROM missions WHERE name = 'Finanzas LATAM'
ON CONFLICT (domain) DO NOTHING;

INSERT INTO clusters (mission_id, name, pillar_query, spokes)
SELECT id, 'Abrir Cuenta USD', 'como abrir cuenta en dolares desde colombia',
    '["bancos panameños para colombianos", "documentos para abrir cuenta panama", "costo abrir cuenta usd", "cuenta dolares online colombia", "wise vs bancos para dolares"]'::jsonb
FROM missions WHERE name = 'Finanzas LATAM';

INSERT INTO clusters (mission_id, name, pillar_query, spokes)
SELECT id, 'Remesas Colombia', 'como enviar remesas a colombia sin perder plata',
    '["western union vs wise colombia", "mejores apps remesas colombia", "calculadora remesas", "remesas cripto colombia", "costos ocultos remesas"]'::jsonb
FROM missions WHERE name = 'Finanzas LATAM';

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
    "allowed_ai_crawlers": ["Googlebot", "OAI-SearchBot", "ChatGPT-User", "PerplexityBot", "ClaudeBot"]
}', true, 'Initial SEO rules for CEREBRO v7');
