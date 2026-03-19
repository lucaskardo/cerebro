-- Migration 020: Add metadata jsonb column to content_assets
-- Used by pipeline to store sources_used (Step 2) and low_quality flag (Step 3.5)
ALTER TABLE content_assets ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT '{}';
