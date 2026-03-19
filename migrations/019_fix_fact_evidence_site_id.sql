-- 019_fix_fact_evidence_site_id.sql
-- Add site_id to intelligence_fact_evidence for convention compliance

ALTER TABLE intelligence_fact_evidence
  ADD COLUMN IF NOT EXISTS site_id UUID REFERENCES domain_sites(id) ON DELETE CASCADE;

-- Backfill from parent fact
UPDATE intelligence_fact_evidence ife
SET site_id = f.site_id
FROM intelligence_facts f
WHERE ife.fact_id = f.id
  AND ife.site_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_evidence_site ON intelligence_fact_evidence(site_id);
