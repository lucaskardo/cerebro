-- ============================================
-- CEREBRO — Migration 006: Multi-Brand Columns
-- Idempotent: safe to re-run
-- Adds brand identity columns to domain_sites,
-- and ensures site_id propagation is complete.
-- Requires: 001_core.sql
-- ============================================

-- ─── domain_sites: brand identity columns ────────────────────────────────────
ALTER TABLE domain_sites ADD COLUMN IF NOT EXISTS brand_name TEXT;
ALTER TABLE domain_sites ADD COLUMN IF NOT EXISTS brand_persona TEXT;
ALTER TABLE domain_sites ADD COLUMN IF NOT EXISTS brand_tone TEXT;
ALTER TABLE domain_sites ADD COLUMN IF NOT EXISTS brand_audience JSONB DEFAULT '{}';
ALTER TABLE domain_sites ADD COLUMN IF NOT EXISTS brand_topics JSONB DEFAULT '[]';
ALTER TABLE domain_sites ADD COLUMN IF NOT EXISTS brand_cta JSONB DEFAULT '{}';
ALTER TABLE domain_sites ADD COLUMN IF NOT EXISTS brand_colors JSONB DEFAULT '{}';
ALTER TABLE domain_sites ADD COLUMN IF NOT EXISTS logo_url TEXT;
ALTER TABLE domain_sites ADD COLUMN IF NOT EXISTS author_name TEXT;
ALTER TABLE domain_sites ADD COLUMN IF NOT EXISTS author_bio TEXT;
ALTER TABLE domain_sites ADD COLUMN IF NOT EXISTS author_avatar_url TEXT;
ALTER TABLE domain_sites ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

-- ─── trigger for domain_sites updated_at ────────────────────────────────────
DROP TRIGGER IF EXISTS tr_sites_updated ON domain_sites;
CREATE TRIGGER tr_sites_updated
    BEFORE UPDATE ON domain_sites FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ─── seed: brand profiles ────────────────────────────────────────────────────
UPDATE domain_sites SET
    brand_name = 'Dólar Afuera',
    brand_persona = 'Carlos Medina — asesor financiero LATAM',
    brand_tone = 'directo, práctico, sin jerga bancaria',
    brand_topics = '["cuentas USD","remesas","finanzas internacionales","protección cambiaria"]'::jsonb,
    brand_cta = '{"primary": "Recibe la guía gratis", "secondary": "Suscríbete"}'::jsonb,
    brand_colors = '{"primary": "#22c55e", "bg": "#0f172a"}'::jsonb,
    author_name = 'Carlos Medina'
WHERE domain = 'dolarafuera.co';

UPDATE domain_sites SET
    brand_name = 'Dolarízate',
    brand_persona = 'Carlos Medina — educación financiera LATAM',
    brand_tone = 'educativo, accesible, motivador',
    brand_topics = '["educación financiera","inversión USD","protección ahorros","fintech LATAM"]'::jsonb,
    brand_cta = '{"primary": "Aprende a proteger tus ahorros", "secondary": "Suscríbete gratis"}'::jsonb,
    brand_colors = '{"primary": "#3b82f6", "bg": "#0f172a"}'::jsonb,
    author_name = 'Carlos Medina'
WHERE domain = 'dolarizate.co';

UPDATE domain_sites SET
    brand_name = 'Múdate a Panamá',
    brand_persona = 'Ana Gutiérrez — experta en migración LATAM',
    brand_tone = 'empático, informativo, orientado a acción',
    brand_topics = '["migración a Panamá","visa jubilado","cuenta bancaria Panamá","costo de vida Panamá"]'::jsonb,
    brand_cta = '{"primary": "Descarga la guía de migración", "secondary": "Consúltanos"}'::jsonb,
    brand_colors = '{"primary": "#f97316", "bg": "#0f172a"}'::jsonb,
    author_name = 'Ana Gutiérrez'
WHERE domain = 'mudateapanama.com';

UPDATE domain_sites SET
    brand_name = 'Remesas.co',
    brand_persona = 'Diego Restrepo — experto en remesas Colombia',
    brand_tone = 'práctico, comparativo, centrado en ahorro',
    brand_topics = '["remesas Colombia","comparador remesas","Wise vs Western Union","cómo enviar dinero"]'::jsonb,
    brand_cta = '{"primary": "Compara y ahorra en remesas", "secondary": "Calcula tu ahorro"}'::jsonb,
    brand_colors = '{"primary": "#a855f7", "bg": "#0f172a"}'::jsonb,
    author_name = 'Diego Restrepo'
WHERE domain = 'remesas.co';
