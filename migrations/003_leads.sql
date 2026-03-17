-- ============================================
-- CEREBRO — Migration 003: Leads & Lifecycle
-- Idempotent: safe to re-run
-- Tables: leads, lead_events, lead_outcomes, partner_deliveries
-- Requires: 001_core.sql, 002_content.sql
-- ============================================

-- ─── leads ───────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS leads (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    site_id UUID REFERENCES domain_sites(id) ON DELETE SET NULL,
    mission_id UUID REFERENCES missions(id) ON DELETE CASCADE,
    page_id UUID REFERENCES pages(id) ON DELETE SET NULL,
    -- contact
    email TEXT NOT NULL,
    nombre TEXT,
    telefono TEXT,
    -- source context
    origen_url TEXT,
    utm_source TEXT,
    utm_medium TEXT,
    utm_campaign TEXT,
    utm_content TEXT,
    visitor_id UUID,
    session_id UUID,
    asset_id UUID REFERENCES content_assets(id) ON DELETE SET NULL,
    cta_variant TEXT,
    source TEXT,
    medium TEXT,
    campaign TEXT,
    -- qualification
    tema_interes TEXT,
    cta_que_convirtio TEXT,
    intent_score INTEGER DEFAULT 0 CHECK (intent_score >= 0 AND intent_score <= 100),
    quiz_responses JSONB DEFAULT '{}',
    -- lifecycle
    current_status TEXT DEFAULT 'new' CHECK (current_status IN ('new','confirmed','nurturing','qualified','delivered','accepted','rejected','closed')),
    -- consent
    consent_timestamp TIMESTAMPTZ,
    double_optin_ok BOOLEAN DEFAULT false,
    -- delivery (legacy, prefer lead_outcomes)
    delivery_status TEXT DEFAULT 'pending' CHECK (delivery_status IN ('pending','delivered','accepted','rejected')),
    canonical_lead_id UUID,
    created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE leads ADD COLUMN IF NOT EXISTS site_id UUID REFERENCES domain_sites(id) ON DELETE SET NULL;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS current_status TEXT DEFAULT 'new';
ALTER TABLE leads ADD COLUMN IF NOT EXISTS visitor_id UUID;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS session_id UUID;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS asset_id UUID REFERENCES content_assets(id) ON DELETE SET NULL;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS cta_variant TEXT;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS utm_content TEXT;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS canonical_lead_id UUID;

-- ─── lead_events (state machine audit log) ───────────────────────────────────
CREATE TABLE IF NOT EXISTS lead_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    site_id UUID REFERENCES domain_sites(id) ON DELETE SET NULL,
    lead_id UUID REFERENCES leads(id) ON DELETE CASCADE,
    from_status TEXT,
    to_status TEXT NOT NULL,
    reason TEXT,
    triggered_by TEXT,
    metadata_json JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now()
);

-- ─── lead_outcomes (revenue source of truth) ─────────────────────────────────
CREATE TABLE IF NOT EXISTS lead_outcomes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    site_id UUID REFERENCES domain_sites(id) ON DELETE SET NULL,
    lead_id UUID REFERENCES leads(id) ON DELETE CASCADE UNIQUE,
    status TEXT CHECK (status IN ('pending','accepted','rejected')),
    revenue_value DECIMAL(10,2),
    partner TEXT,
    reason TEXT,
    source TEXT DEFAULT 'manual' CHECK (source IN ('manual','webhook','system')),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- ─── partner_deliveries ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS partner_deliveries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    site_id UUID REFERENCES domain_sites(id) ON DELETE SET NULL,
    lead_id UUID REFERENCES leads(id) ON DELETE CASCADE,
    partner_name TEXT NOT NULL,
    delivery_url TEXT,
    delivery_status TEXT DEFAULT 'pending',
    response_payload JSONB DEFAULT '{}',
    accepted BOOLEAN,
    revenue_usd NUMERIC(10,2) DEFAULT 0,
    delivered_at TIMESTAMPTZ
);

ALTER TABLE partner_deliveries ADD COLUMN IF NOT EXISTS site_id UUID REFERENCES domain_sites(id) ON DELETE SET NULL;

-- ─── partner_webhooks ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS partner_webhooks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    site_id UUID REFERENCES domain_sites(id) ON DELETE CASCADE,
    url TEXT NOT NULL,
    secret TEXT,
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- ─── indexes ─────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_leads_mission ON leads(mission_id);
CREATE INDEX IF NOT EXISTS idx_leads_site ON leads(site_id);
CREATE INDEX IF NOT EXISTS idx_leads_created ON leads(created_at);
CREATE INDEX IF NOT EXISTS idx_leads_email ON leads(email);
CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(current_status);
CREATE INDEX IF NOT EXISTS idx_lead_events_lead ON lead_events(lead_id);
CREATE INDEX IF NOT EXISTS idx_lead_outcomes_lead ON lead_outcomes(lead_id);
CREATE INDEX IF NOT EXISTS idx_partner_deliveries_lead ON partner_deliveries(lead_id);
