-- 018_intelligence_layer.sql
-- Structured intelligence graph: entities → facts → observations → insights

-- ─── HELPER TRIGGER ──────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- ─── intelligence_entities ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS intelligence_entities (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id     UUID NOT NULL REFERENCES domain_sites(id) ON DELETE CASCADE,
  entity_type TEXT NOT NULL CHECK (entity_type IN (
    'product','competitor','segment','pain_point','objection','brand','market','other'
  )),
  name        TEXT NOT NULL,
  slug        TEXT NOT NULL,
  description TEXT,
  status      TEXT NOT NULL DEFAULT 'active' CHECK (status IN (
    'proposed','active','archived','merged'
  )),
  metadata    JSONB NOT NULL DEFAULT '{}',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(site_id, entity_type, slug)
);
CREATE INDEX IF NOT EXISTS idx_entities_site_type ON intelligence_entities(site_id, entity_type);
CREATE INDEX IF NOT EXISTS idx_entities_site_status ON intelligence_entities(site_id, status);
DROP TRIGGER IF EXISTS trg_entities_updated_at ON intelligence_entities;
CREATE TRIGGER trg_entities_updated_at
  BEFORE UPDATE ON intelligence_entities
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ─── intelligence_observations ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS intelligence_observations (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id           UUID NOT NULL REFERENCES domain_sites(id) ON DELETE CASCADE,
  entity_id         UUID REFERENCES intelligence_entities(id) ON DELETE SET NULL,
  observation_type  TEXT NOT NULL CHECK (observation_type IN (
    'content_performance','lead_conversion','search_signal',
    'competitor_signal','market_signal','user_behavior','research_finding'
  )),
  source_type       TEXT NOT NULL CHECK (source_type IN (
    'pipeline','analytics','search','manual','ai_research','webhook'
  )),
  source_ref        TEXT,
  raw_value         JSONB NOT NULL DEFAULT '{}',
  normalized_tags   JSONB NOT NULL DEFAULT '[]',
  processed         BOOLEAN NOT NULL DEFAULT false,
  processing_run_id UUID,
  processed_at      TIMESTAMPTZ,
  observed_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_observations_unprocessed
  ON intelligence_observations(site_id, observed_at)
  WHERE processed = false;
CREATE INDEX IF NOT EXISTS idx_observations_cleanup
  ON intelligence_observations(site_id, created_at);
CREATE INDEX IF NOT EXISTS idx_observations_entity
  ON intelligence_observations(entity_id) WHERE entity_id IS NOT NULL;

-- ─── intelligence_facts ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS intelligence_facts (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id        UUID NOT NULL REFERENCES domain_sites(id) ON DELETE CASCADE,
  entity_id      UUID REFERENCES intelligence_entities(id) ON DELETE CASCADE,
  fact_key       TEXT NOT NULL,
  category       TEXT NOT NULL CHECK (category IN (
    'pricing','positioning','audience','competitor','content','product',
    'market','performance','objection','trigger','differentiator','other'
  )),
  value_text     TEXT,
  value_number   NUMERIC,
  value_json     JSONB,
  CONSTRAINT exactly_one_value CHECK (
    num_nonnulls(value_text, value_number, value_json) = 1
  ),
  confidence     NUMERIC NOT NULL DEFAULT 0.5 CHECK (confidence BETWEEN 0 AND 1),
  utility_score  NUMERIC NOT NULL DEFAULT 0.5 CHECK (utility_score BETWEEN 0 AND 1),
  evidence_count INTEGER NOT NULL DEFAULT 1,
  quarantined    BOOLEAN NOT NULL DEFAULT false,
  tags           JSONB NOT NULL DEFAULT '[]',
  source         TEXT,
  last_verified  TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(site_id, fact_key)
);
CREATE INDEX IF NOT EXISTS idx_facts_site_category
  ON intelligence_facts(site_id, category);
CREATE INDEX IF NOT EXISTS idx_facts_site_utility
  ON intelligence_facts(site_id, utility_score DESC)
  WHERE quarantined = false;
CREATE INDEX IF NOT EXISTS idx_facts_tags
  ON intelligence_facts USING gin(tags);
CREATE INDEX IF NOT EXISTS idx_facts_site_key
  ON intelligence_facts(site_id, fact_key);
CREATE INDEX IF NOT EXISTS idx_facts_site_verified
  ON intelligence_facts(site_id, last_verified);
CREATE INDEX IF NOT EXISTS idx_facts_entity
  ON intelligence_facts(entity_id) WHERE entity_id IS NOT NULL;
DROP TRIGGER IF EXISTS trg_facts_updated_at ON intelligence_facts;
CREATE TRIGGER trg_facts_updated_at
  BEFORE UPDATE ON intelligence_facts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ─── intelligence_fact_evidence ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS intelligence_fact_evidence (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fact_id       UUID NOT NULL REFERENCES intelligence_facts(id) ON DELETE CASCADE,
  observation_id UUID REFERENCES intelligence_observations(id) ON DELETE SET NULL,
  source_type   TEXT NOT NULL CHECK (source_type IN (
    'pipeline','analytics','search','manual','ai_research','webhook','migration'
  )),
  source_ref    TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(fact_id, source_ref)
);
CREATE INDEX IF NOT EXISTS idx_evidence_fact ON intelligence_fact_evidence(fact_id);
CREATE INDEX IF NOT EXISTS idx_evidence_obs
  ON intelligence_fact_evidence(observation_id) WHERE observation_id IS NOT NULL;

-- ─── intelligence_relations ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS intelligence_relations (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id        UUID NOT NULL REFERENCES domain_sites(id) ON DELETE CASCADE,
  from_entity_id UUID REFERENCES intelligence_entities(id) ON DELETE CASCADE,
  to_entity_id   UUID REFERENCES intelligence_entities(id) ON DELETE CASCADE,
  from_fact_id   UUID REFERENCES intelligence_facts(id) ON DELETE CASCADE,
  to_fact_id     UUID REFERENCES intelligence_facts(id) ON DELETE CASCADE,
  relation_type  TEXT NOT NULL CHECK (relation_type IN (
    'solves','recommended_for','cheaper_than','competes_with',
    'targets','supports','contradicts','related_to','derived_from'
  )),
  strength       NUMERIC NOT NULL DEFAULT 5 CHECK (strength BETWEEN 0 AND 10),
  metadata       JSONB NOT NULL DEFAULT '{}',
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT has_entity_pair CHECK (
    (from_entity_id IS NOT NULL AND to_entity_id IS NOT NULL)
    OR (from_fact_id IS NOT NULL AND to_fact_id IS NOT NULL)
  )
);
CREATE INDEX IF NOT EXISTS idx_relations_site ON intelligence_relations(site_id);
CREATE INDEX IF NOT EXISTS idx_relations_from_entity
  ON intelligence_relations(from_entity_id) WHERE from_entity_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_relations_to_entity
  ON intelligence_relations(to_entity_id) WHERE to_entity_id IS NOT NULL;

-- ─── intelligence_insights ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS intelligence_insights (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id          UUID NOT NULL REFERENCES domain_sites(id) ON DELETE CASCADE,
  insight_type     TEXT NOT NULL CHECK (insight_type IN (
    'opportunity','threat','gap','trend','positioning','recommendation','anomaly'
  )),
  title            TEXT NOT NULL,
  body             TEXT NOT NULL,
  supporting_facts JSONB NOT NULL DEFAULT '[]',
  impact_score     NUMERIC NOT NULL DEFAULT 5 CHECK (impact_score BETWEEN 0 AND 10),
  status           TEXT NOT NULL DEFAULT 'active' CHECK (status IN (
    'active','actioned','dismissed','stale'
  )),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(site_id, title)
);
CREATE INDEX IF NOT EXISTS idx_insights_site_status
  ON intelligence_insights(site_id, status);
DROP TRIGGER IF EXISTS trg_insights_updated_at ON intelligence_insights;
CREATE TRIGGER trg_insights_updated_at
  BEFORE UPDATE ON intelligence_insights
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ─── discovery_candidates ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS discovery_candidates (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id        UUID NOT NULL REFERENCES domain_sites(id) ON DELETE CASCADE,
  candidate_type TEXT NOT NULL CHECK (candidate_type IN (
    'entity','fact','relation','insight'
  )),
  proposed_slug  TEXT NOT NULL,
  proposed_data  JSONB NOT NULL DEFAULT '{}',
  metrics        JSONB NOT NULL DEFAULT '{}',
  status         TEXT NOT NULL DEFAULT 'proposed' CHECK (status IN (
    'proposed','approved','rejected','merged'
  )),
  decision_reason TEXT,
  decided_at     TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(site_id, candidate_type, proposed_slug)
);
CREATE INDEX IF NOT EXISTS idx_candidates_site_status
  ON discovery_candidates(site_id, status);

-- ─── discovery_policies ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS discovery_policies (
  id                           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id                      UUID NOT NULL REFERENCES domain_sites(id) ON DELETE CASCADE,
  entity_type                  TEXT NOT NULL CHECK (entity_type IN (
    'product','competitor','segment','pain_point','objection','brand','market','other'
  )),
  min_observations             INTEGER NOT NULL DEFAULT 3,
  min_percentage               NUMERIC NOT NULL DEFAULT 0.05,
  min_conversion_lift          NUMERIC NOT NULL DEFAULT 0.1,
  auto_calibrate               BOOLEAN NOT NULL DEFAULT true,
  research_budget_monthly      NUMERIC NOT NULL DEFAULT 10.0,
  research_token_budget_monthly INTEGER NOT NULL DEFAULT 50000,
  observation_ttl_days         INTEGER NOT NULL DEFAULT 90,
  seasonal_observation_ttl_days INTEGER NOT NULL DEFAULT 365,
  created_at                   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(site_id, entity_type)
);
DROP TRIGGER IF EXISTS trg_policies_updated_at ON discovery_policies;
CREATE TRIGGER trg_policies_updated_at
  BEFORE UPDATE ON discovery_policies
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ─── research_runs ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS research_runs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id         UUID NOT NULL REFERENCES domain_sites(id) ON DELETE CASCADE,
  task_type       TEXT NOT NULL,
  trigger         TEXT NOT NULL CHECK (trigger IN (
    'scheduled','manual','threshold','webhook'
  )),
  status          TEXT NOT NULL DEFAULT 'running' CHECK (status IN (
    'running','completed','failed','cancelled'
  )),
  lease_expires_at TIMESTAMPTZ,
  tokens_used     INTEGER NOT NULL DEFAULT 0,
  search_calls    INTEGER NOT NULL DEFAULT 0,
  cost_usd        NUMERIC NOT NULL DEFAULT 0,
  error_message   TEXT,
  started_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_research_runs_site ON research_runs(site_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_research_runs_status ON research_runs(status)
  WHERE status = 'running';

-- ─── intelligence_context_receipts ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS intelligence_context_receipts (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id      UUID NOT NULL REFERENCES domain_sites(id) ON DELETE CASCADE,
  consumer_type TEXT NOT NULL CHECK (consumer_type IN (
    'content_pipeline','strategy_planner','persona','loop','other'
  )),
  consumer_ref  TEXT,
  facts_count   INTEGER NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_receipts_site ON intelligence_context_receipts(site_id, created_at DESC);

CREATE TABLE IF NOT EXISTS intelligence_receipt_facts (
  receipt_id UUID NOT NULL REFERENCES intelligence_context_receipts(id) ON DELETE CASCADE,
  fact_id    UUID NOT NULL REFERENCES intelligence_facts(id) ON DELETE CASCADE,
  PRIMARY KEY (receipt_id, fact_id)
);
CREATE INDEX IF NOT EXISTS idx_receipt_facts_fact ON intelligence_receipt_facts(fact_id);

-- ─── monthly_observation_rollups ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS monthly_observation_rollups (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id          UUID NOT NULL REFERENCES domain_sites(id) ON DELETE CASCADE,
  entity_id        UUID REFERENCES intelligence_entities(id) ON DELETE SET NULL,
  month            DATE NOT NULL,
  observation_type TEXT NOT NULL,
  tag              TEXT NOT NULL DEFAULT '',
  count            INTEGER NOT NULL DEFAULT 0,
  sum_value        NUMERIC NOT NULL DEFAULT 0,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- Expression unique index handles NULL entity_id correctly (plain UNIQUE would not)
CREATE UNIQUE INDEX IF NOT EXISTS uq_rollups_key
  ON monthly_observation_rollups(
    site_id,
    COALESCE(entity_id, '00000000-0000-0000-0000-000000000000'::uuid),
    month,
    observation_type,
    tag
  );
CREATE INDEX IF NOT EXISTS idx_rollups_site ON monthly_observation_rollups(site_id, month DESC);
CREATE INDEX IF NOT EXISTS idx_rollups_entity
  ON monthly_observation_rollups(entity_id) WHERE entity_id IS NOT NULL;

-- ═══════════════════════════════════════════════════════════════════════════
-- SQL FUNCTIONS
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION upsert_intelligence_fact(
  p_site_id       UUID,
  p_entity_id     UUID,
  p_fact_key      TEXT,
  p_category      TEXT,
  p_value_text    TEXT    DEFAULT NULL,
  p_value_number  NUMERIC DEFAULT NULL,
  p_value_json    JSONB   DEFAULT NULL,
  p_confidence    NUMERIC DEFAULT 0.5,
  p_tags          JSONB   DEFAULT '[]',
  p_source        TEXT    DEFAULT NULL,
  p_quarantined   BOOLEAN DEFAULT false,
  p_source_ref    TEXT    DEFAULT NULL
)
RETURNS UUID LANGUAGE plpgsql AS $$
DECLARE
  v_fact_id UUID;
BEGIN
  IF num_nonnulls(p_value_text, p_value_number, p_value_json) != 1 THEN
    RAISE EXCEPTION 'upsert_intelligence_fact: exactly one of value_text, value_number, value_json must be non-null';
  END IF;

  INSERT INTO intelligence_facts (
    site_id, entity_id, fact_key, category,
    value_text, value_number, value_json,
    confidence, utility_score, evidence_count,
    tags, source, quarantined, last_verified
  ) VALUES (
    p_site_id, p_entity_id, p_fact_key, p_category,
    p_value_text, p_value_number, p_value_json,
    p_confidence, 0.5, 1,
    p_tags, p_source, p_quarantined, now()
  )
  ON CONFLICT (site_id, fact_key) DO UPDATE SET
    value_text    = EXCLUDED.value_text,
    value_number  = EXCLUDED.value_number,
    value_json    = EXCLUDED.value_json,
    tags          = (
      SELECT jsonb_agg(DISTINCT tag_val)
      FROM (
        SELECT jsonb_array_elements_text(intelligence_facts.tags) AS tag_val
        UNION
        SELECT jsonb_array_elements_text(p_tags)
      ) t
    ),
    confidence    = GREATEST(intelligence_facts.confidence, p_confidence),
    evidence_count = intelligence_facts.evidence_count + 1,
    last_verified = now(),
    source        = COALESCE(p_source, intelligence_facts.source),
    quarantined   = p_quarantined
  RETURNING id INTO v_fact_id;

  IF p_source_ref IS NOT NULL THEN
    INSERT INTO intelligence_fact_evidence (fact_id, source_type, source_ref)
    VALUES (
      v_fact_id,
      CASE
        WHEN p_source IN ('pipeline','analytics','search','manual','ai_research','webhook','migration')
          THEN p_source
        ELSE 'manual'
      END,
      p_source_ref
    )
    ON CONFLICT (fact_id, source_ref) DO NOTHING;
  END IF;

  RETURN v_fact_id;
END;
$$;

CREATE OR REPLACE FUNCTION update_fact_utility(
  p_fact_id UUID,
  p_reward  NUMERIC
)
RETURNS NUMERIC LANGUAGE plpgsql AS $$
DECLARE
  v_new_utility NUMERIC;
BEGIN
  UPDATE intelligence_facts
  SET utility_score = CASE
    WHEN p_reward >= 0 THEN
      LEAST(0.99, utility_score + p_reward * confidence * (1.0 - utility_score * 0.5))
    ELSE
      GREATEST(0.05, utility_score - abs(p_reward) * utility_score * 0.3)
  END
  WHERE id = p_fact_id
  RETURNING utility_score INTO v_new_utility;
  RETURN v_new_utility;
END;
$$;

CREATE OR REPLACE FUNCTION claim_unprocessed_observations(
  p_site_id UUID,
  p_run_id  UUID,
  p_limit   INTEGER DEFAULT 50
)
RETURNS TABLE(id UUID, observation_type TEXT, source_type TEXT, raw_value JSONB, entity_id UUID)
LANGUAGE plpgsql AS $$
BEGIN
  RETURN QUERY
  UPDATE intelligence_observations obs
  SET processing_run_id = p_run_id
  WHERE obs.id IN (
    SELECT o.id
    FROM intelligence_observations o
    WHERE o.site_id = p_site_id
      AND o.processed = false
    ORDER BY o.observed_at ASC
    LIMIT p_limit
    FOR UPDATE SKIP LOCKED
  )
  RETURNING obs.id, obs.observation_type, obs.source_type, obs.raw_value, obs.entity_id;
END;
$$;

CREATE OR REPLACE FUNCTION mark_observations_processed(p_run_id UUID)
RETURNS INTEGER LANGUAGE plpgsql AS $$
DECLARE
  v_count INTEGER;
BEGIN
  UPDATE intelligence_observations
  SET processed = true,
      processed_at = now()
  WHERE processing_run_id = p_run_id
    AND processed = false;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

CREATE OR REPLACE FUNCTION rollup_observations_monthly(
  p_site_id UUID,
  p_month   DATE
)
RETURNS INTEGER LANGUAGE plpgsql AS $$
DECLARE
  v_count INTEGER;
BEGIN
  INSERT INTO monthly_observation_rollups (
    site_id, entity_id, month, observation_type, tag, count, sum_value
  )
  SELECT
    o.site_id,
    o.entity_id,
    date_trunc('month', o.observed_at)::DATE AS month,
    o.observation_type,
    COALESCE((o.raw_value->>'tag'), '') AS tag,
    COUNT(*) AS count,
    COALESCE(SUM((o.raw_value->>'value')::NUMERIC), 0) AS sum_value
  FROM intelligence_observations o
  WHERE o.site_id = p_site_id
    AND date_trunc('month', o.observed_at)::DATE = date_trunc('month', p_month)::DATE
    AND o.processed = true
  GROUP BY o.site_id, o.entity_id, month, o.observation_type, tag
  ON CONFLICT (site_id, COALESCE(entity_id, '00000000-0000-0000-0000-000000000000'::uuid), month, observation_type, tag) DO UPDATE SET
    count = monthly_observation_rollups.count + EXCLUDED.count,
    sum_value = monthly_observation_rollups.sum_value + EXCLUDED.sum_value,
    updated_at = now();
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

CREATE OR REPLACE FUNCTION decay_stale_facts(p_site_id UUID)
RETURNS INTEGER LANGUAGE plpgsql AS $$
DECLARE
  v_count INTEGER;
BEGIN
  UPDATE intelligence_facts
  SET
    confidence    = GREATEST(0.1, confidence * 0.9),
    utility_score = GREATEST(0.05, utility_score * 0.95)
  WHERE site_id = p_site_id
    AND last_verified < now() - INTERVAL '30 days'
    AND quarantined = false;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

CREATE OR REPLACE FUNCTION check_entity_completeness(p_site_id UUID)
RETURNS TABLE(
  entity_id   UUID,
  name        TEXT,
  entity_type TEXT,
  fact_count  BIGINT,
  categories  TEXT[]
) LANGUAGE sql AS $$
  SELECT
    e.id,
    e.name,
    e.entity_type,
    COUNT(f.id) AS fact_count,
    ARRAY_AGG(DISTINCT f.category ORDER BY f.category) FILTER (WHERE f.id IS NOT NULL) AS categories
  FROM intelligence_entities e
  LEFT JOIN intelligence_facts f
    ON f.entity_id = e.id
    AND f.quarantined = false
  WHERE e.site_id = p_site_id
    AND e.status = 'active'
  GROUP BY e.id, e.name, e.entity_type
  ORDER BY fact_count DESC;
$$;
