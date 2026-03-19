-- 015: Content quality scoring — 5-dimension scores per article
ALTER TABLE content_assets ADD COLUMN IF NOT EXISTS score_humanity     INTEGER DEFAULT 0;
ALTER TABLE content_assets ADD COLUMN IF NOT EXISTS score_specificity  INTEGER DEFAULT 0;
ALTER TABLE content_assets ADD COLUMN IF NOT EXISTS score_structure    INTEGER DEFAULT 0;
ALTER TABLE content_assets ADD COLUMN IF NOT EXISTS score_seo         INTEGER DEFAULT 0;
ALTER TABLE content_assets ADD COLUMN IF NOT EXISTS score_readability  INTEGER DEFAULT 0;
ALTER TABLE content_assets ADD COLUMN IF NOT EXISTS score_feedback     TEXT;
