-- CEREBRO v7 — Conversation Layer
-- Stores operator chat sessions with CEREBRO

CREATE TABLE IF NOT EXISTS conversations (
  id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id     UUID         REFERENCES domain_sites(id),
  title       TEXT         DEFAULT 'Nueva conversación',
  messages    JSONB        DEFAULT '[]',
  created_at  TIMESTAMPTZ  DEFAULT now(),
  updated_at  TIMESTAMPTZ  DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_conversations_site ON conversations(site_id);
CREATE INDEX IF NOT EXISTS idx_conversations_updated ON conversations(updated_at DESC);
