-- ============================================
-- CEREBRO — Migration 002: Content
-- Idempotent: safe to re-run
-- Tables: clusters, opportunities, content_assets,
--         pages, social_content_queue, email_sequences
-- Requires: 001_core.sql
-- ============================================

-- ─── clusters ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS clusters (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    mission_id UUID REFERENCES missions(id) ON DELETE CASCADE,
    site_id UUID REFERENCES domain_sites(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    pillar_query TEXT NOT NULL,
    spokes JSONB DEFAULT '[]',
    topic_coverage_score NUMERIC(5,2) DEFAULT 0,
    target_tcs NUMERIC(5,2) DEFAULT 70,
    status TEXT DEFAULT 'active' CHECK (status IN ('active','complete','paused')),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE clusters ADD COLUMN IF NOT EXISTS site_id UUID REFERENCES domain_sites(id) ON DELETE SET NULL;

-- ─── opportunities ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS opportunities (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    mission_id UUID REFERENCES missions(id) ON DELETE CASCADE,
    site_id UUID REFERENCES domain_sites(id) ON DELETE SET NULL,
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

ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS site_id UUID REFERENCES domain_sites(id) ON DELETE SET NULL;

-- ─── content_assets ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS content_assets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    site_id UUID REFERENCES domain_sites(id) ON DELETE SET NULL,
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
    research_json JSONB DEFAULT '{}',
    conversion_plan_json JSONB DEFAULT '{}',
    status TEXT DEFAULT 'generating' CHECK (status IN ('generating','draft','review','approved','published','archived','error')),
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE content_assets ADD COLUMN IF NOT EXISTS site_id UUID REFERENCES domain_sites(id) ON DELETE SET NULL;
ALTER TABLE content_assets ADD COLUMN IF NOT EXISTS research_json JSONB DEFAULT '{}';
ALTER TABLE content_assets ADD COLUMN IF NOT EXISTS conversion_plan_json JSONB DEFAULT '{}';

-- ─── pages ───────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS pages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    site_id UUID REFERENCES domain_sites(id) ON DELETE SET NULL,
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

ALTER TABLE pages ADD COLUMN IF NOT EXISTS site_id UUID REFERENCES domain_sites(id) ON DELETE SET NULL;

-- ─── social_content_queue ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS social_content_queue (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    site_id UUID REFERENCES domain_sites(id) ON DELETE SET NULL,
    content_asset_id UUID REFERENCES content_assets(id) ON DELETE CASCADE,
    persona_id UUID,   -- FK to personas (defined in 007)
    platform TEXT NOT NULL CHECK (platform IN ('instagram','tiktok','x','linkedin','reddit','facebook','whatsapp')),
    content_type TEXT DEFAULT 'post' CHECK (content_type IN ('post','reel','carousel','thread','story','comment','video_script','whatsapp_message')),
    content_text TEXT,
    image_prompt TEXT,
    image_url TEXT,
    audio_url TEXT,
    video_url TEXT,
    scheduled_at TIMESTAMPTZ,
    published_at TIMESTAMPTZ,
    status TEXT DEFAULT 'draft' CHECK (status IN ('draft','approved','scheduled','published','rejected','failed')),
    approved_by TEXT,
    performance JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE social_content_queue ADD COLUMN IF NOT EXISTS site_id UUID REFERENCES domain_sites(id) ON DELETE SET NULL;
ALTER TABLE social_content_queue ADD COLUMN IF NOT EXISTS persona_id UUID;
ALTER TABLE social_content_queue ADD COLUMN IF NOT EXISTS image_prompt TEXT;
ALTER TABLE social_content_queue ADD COLUMN IF NOT EXISTS audio_url TEXT;
ALTER TABLE social_content_queue ADD COLUMN IF NOT EXISTS video_url TEXT;
ALTER TABLE social_content_queue ADD COLUMN IF NOT EXISTS published_at TIMESTAMPTZ;

-- ─── email_sequences ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS email_sequences (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    site_id UUID REFERENCES domain_sites(id) ON DELETE SET NULL,
    lead_id UUID,   -- FK to leads (defined in 003)
    sequence_name TEXT NOT NULL,
    step_number INTEGER NOT NULL,
    subject TEXT,
    body_html TEXT,
    sent_at TIMESTAMPTZ,
    opened_at TIMESTAMPTZ,
    clicked_at TIMESTAMPTZ,
    converted BOOLEAN DEFAULT false
);

ALTER TABLE email_sequences ADD COLUMN IF NOT EXISTS site_id UUID REFERENCES domain_sites(id) ON DELETE SET NULL;

-- ─── content_versions ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS content_versions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    site_id UUID REFERENCES domain_sites(id) ON DELETE SET NULL,
    asset_id UUID REFERENCES content_assets(id) ON DELETE CASCADE,
    version_number INTEGER NOT NULL,
    body_md TEXT,
    changed_by TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- ─── cta_variants ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS cta_variants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    site_id UUID REFERENCES domain_sites(id) ON DELETE SET NULL,
    asset_id UUID REFERENCES content_assets(id) ON DELETE CASCADE,
    position TEXT CHECK (position IN ('hero','mid','end','sidebar')),
    text TEXT,
    url TEXT,
    variant_name TEXT,
    impressions INTEGER DEFAULT 0,
    clicks INTEGER DEFAULT 0,
    conversions INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- ─── triggers ────────────────────────────────────────────────────────────────
DROP TRIGGER IF EXISTS tr_content_updated ON content_assets;
CREATE TRIGGER tr_content_updated
    BEFORE UPDATE ON content_assets FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS tr_clusters_updated ON clusters;
CREATE TRIGGER tr_clusters_updated
    BEFORE UPDATE ON clusters FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ─── indexes ─────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_content_status ON content_assets(status);
CREATE INDEX IF NOT EXISTS idx_content_mission ON content_assets(mission_id);
CREATE INDEX IF NOT EXISTS idx_content_site ON content_assets(site_id);
CREATE INDEX IF NOT EXISTS idx_pages_domain ON pages(site_domain);
CREATE INDEX IF NOT EXISTS idx_pages_slug ON pages(site_domain, slug);
CREATE INDEX IF NOT EXISTS idx_social_status ON social_content_queue(status);
CREATE INDEX IF NOT EXISTS idx_social_persona ON social_content_queue(persona_id);
CREATE INDEX IF NOT EXISTS idx_social_site ON social_content_queue(site_id);
CREATE INDEX IF NOT EXISTS idx_opportunities_status ON opportunities(status);

-- ─── seed: clusters ──────────────────────────────────────────────────────────
INSERT INTO clusters (mission_id, name, pillar_query, spokes)
SELECT id, 'Abrir Cuenta USD', 'como abrir cuenta en dolares desde colombia',
    '["bancos panameños para colombianos","documentos para abrir cuenta panama","costo abrir cuenta usd","cuenta dolares online colombia","wise vs bancos para dolares"]'::jsonb
FROM missions WHERE name = 'Finanzas LATAM'
ON CONFLICT DO NOTHING;

INSERT INTO clusters (mission_id, name, pillar_query, spokes)
SELECT id, 'Remesas Colombia', 'como enviar remesas a colombia sin perder plata',
    '["western union vs wise colombia","mejores apps remesas colombia","calculadora remesas","remesas cripto colombia","costos ocultos remesas"]'::jsonb
FROM missions WHERE name = 'Finanzas LATAM'
ON CONFLICT DO NOTHING;
