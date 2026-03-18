-- Migration 014: Channels table
-- Already applied via Supabase MCP
-- Kept here for reference and version tracking

CREATE TABLE IF NOT EXISTS channels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id UUID REFERENCES domain_sites(id) ON DELETE SET NULL,
  persona_id UUID REFERENCES personas(id) ON DELETE SET NULL,
  channel_type TEXT NOT NULL CHECK (channel_type IN (
    'whatsapp', 'email', 'instagram', 'reddit', 'tiktok',
    'twitter', 'linkedin', 'facebook', 'youtube', 'telegram', 'website'
  )),
  identifier TEXT NOT NULL,
  display_name TEXT,
  credentials_encrypted TEXT,
  config JSONB DEFAULT '{}',
  status TEXT DEFAULT 'setup' CHECK (status IN ('active','paused','setup','disabled')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_channels_site ON channels(site_id);
CREATE INDEX IF NOT EXISTS idx_channels_type ON channels(channel_type);
CREATE INDEX IF NOT EXISTS idx_channels_persona ON channels(persona_id);

INSERT INTO channels (site_id, channel_type, identifier, display_name, status)
VALUES (
  'd3920d22-2c34-40b1-9e8e-59142af08e2a',
  'website',
  'colchonespanama.com',
  'Colchones Panamá - Sitio Web',
  'active'
);
