-- ============================================
-- CEREBRO — Migration 007: Personas & Identities
-- Idempotent: safe to re-run
-- Tables: personas, persona_identities
-- Requires: 001_core.sql
-- ============================================

-- ─── personas ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS personas (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    site_id UUID REFERENCES domain_sites(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    age INTEGER,
    city TEXT,
    backstory TEXT,
    personality_traits JSONB DEFAULT '{}',
    visual_prompt TEXT,
    voice_reference_url TEXT,
    platforms JSONB DEFAULT '{}',
    posting_schedule JSONB DEFAULT '{}',
    content_ratio JSONB DEFAULT '{}',
    anti_detection_rules JSONB DEFAULT '{}',
    status TEXT DEFAULT 'inactive' CHECK (status IN ('active','inactive','suspended')),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE personas ADD COLUMN IF NOT EXISTS site_id UUID REFERENCES domain_sites(id) ON DELETE SET NULL;

-- ─── persona_identities ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS persona_identities (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    persona_id UUID REFERENCES personas(id) ON DELETE CASCADE,
    platform TEXT NOT NULL CHECK (platform IN ('instagram','tiktok','x','reddit','linkedin','whatsapp','email','facebook','youtube','telegram')),
    handle_or_email TEXT,
    password_encrypted TEXT,
    recovery_email TEXT,
    recovery_phone TEXT,
    api_keys JSONB DEFAULT '{}',
    two_factor_secret TEXT,
    notes TEXT,
    status TEXT DEFAULT 'pending_setup' CHECK (status IN ('active','suspended','pending_setup')),
    last_used_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- ─── triggers ────────────────────────────────────────────────────────────────
DROP TRIGGER IF EXISTS tr_personas_updated ON personas;
CREATE TRIGGER tr_personas_updated
    BEFORE UPDATE ON personas FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ─── indexes ─────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_personas_site ON personas(site_id);
CREATE INDEX IF NOT EXISTS idx_personas_status ON personas(status);
CREATE INDEX IF NOT EXISTS idx_identities_persona ON persona_identities(persona_id);
CREATE INDEX IF NOT EXISTS idx_identities_platform ON persona_identities(platform);

-- ─── seed: 3 personas ────────────────────────────────────────────────────────
INSERT INTO personas (site_id, name, age, city, backstory, personality_traits, platforms, status)
SELECT
    d.id,
    'Ana Gutiérrez', 34, 'Bogotá → Ciudad de Panamá',
    'Colombiana que se mudó a Panamá hace 3 años. Documentó todo el proceso y ahora ayuda a otros.',
    '{"tone": "empático y práctico", "role": "experta en migración LATAM", "style": "experiencia personal + datos"}'::jsonb,
    '{"instagram": {}, "tiktok": {}, "x": {}, "reddit": {}, "linkedin": {}, "whatsapp": {}, "email": {}}'::jsonb,
    'inactive'
FROM domain_sites d WHERE d.domain = 'mudateapanama.com'
ON CONFLICT DO NOTHING;

INSERT INTO personas (site_id, name, age, city, backstory, personality_traits, platforms, status)
SELECT
    d.id,
    'Carlos Medina', 41, 'Medellín',
    'Asesor financiero con 10+ años ayudando a colombianos a manejar su plata fuera del sistema bancario tradicional.',
    '{"tone": "directo y cercano", "role": "asesor financiero LATAM", "style": "directo + sin jerga bancaria"}'::jsonb,
    '{"instagram": {}, "tiktok": {}, "x": {}, "reddit": {}, "linkedin": {}, "whatsapp": {}, "email": {}}'::jsonb,
    'inactive'
FROM domain_sites d WHERE d.domain = 'dolarizate.co'
ON CONFLICT DO NOTHING;

INSERT INTO personas (site_id, name, age, city, backstory, personality_traits, platforms, status)
SELECT
    d.id,
    'Diego Restrepo', 29, 'Cali',
    'Ex-empleado bancario que entendió los costos ocultos del sistema y ahora educa a colombianos sobre remesas.',
    '{"tone": "comparativo y ahorrativo", "role": "experto en remesas Colombia", "style": "datos + comparaciones claras"}'::jsonb,
    '{"instagram": {}, "tiktok": {}, "x": {}, "reddit": {}, "linkedin": {}, "whatsapp": {}, "email": {}}'::jsonb,
    'inactive'
FROM domain_sites d WHERE d.domain = 'remesas.co'
ON CONFLICT DO NOTHING;
