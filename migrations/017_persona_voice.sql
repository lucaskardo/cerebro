-- Migration 017: Add persona_voice to client_profiles
-- Stores structured persona data for content humanization
ALTER TABLE client_profiles ADD COLUMN IF NOT EXISTS persona_voice JSONB DEFAULT NULL;
