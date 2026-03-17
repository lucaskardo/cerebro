-- CEREBRO Bloque 5: Distribution & Personas
-- social_schedule_config per persona

CREATE TABLE IF NOT EXISTS social_schedule_config (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    persona_id UUID NOT NULL REFERENCES personas(id) ON DELETE CASCADE,
    platform TEXT NOT NULL,
    max_posts_per_day INT NOT NULL DEFAULT 3,
    min_minutes_between_posts INT NOT NULL DEFAULT 30,
    variation_hours INT NOT NULL DEFAULT 2,
    skip_days_per_week INT NOT NULL DEFAULT 1,
    value_to_promo_ratio TEXT NOT NULL DEFAULT '9:1',
    active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(persona_id, platform)
);

CREATE INDEX IF NOT EXISTS idx_social_schedule_persona ON social_schedule_config(persona_id);
