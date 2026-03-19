-- Fix claim_unprocessed_observations to return normalized_tags and source_ref
CREATE OR REPLACE FUNCTION claim_unprocessed_observations(
  p_site_id UUID, p_run_id UUID, p_limit INTEGER DEFAULT 50
)
RETURNS TABLE(id UUID, observation_type TEXT, source_type TEXT, raw_value JSONB, entity_id UUID, normalized_tags JSONB, source_ref TEXT)
LANGUAGE plpgsql AS $$
BEGIN
  RETURN QUERY
  UPDATE intelligence_observations obs
  SET processing_run_id = p_run_id
  WHERE obs.id IN (
    SELECT o.id FROM intelligence_observations o
    WHERE o.site_id = p_site_id AND o.processed = false
    ORDER BY o.observed_at ASC LIMIT p_limit
    FOR UPDATE SKIP LOCKED
  )
  RETURNING obs.id, obs.observation_type, obs.source_type, obs.raw_value, obs.entity_id, obs.normalized_tags, obs.source_ref;
END;
$$;

-- Fix rollup to be idempotent and use normalized_tags instead of raw_value->>'tag'
CREATE OR REPLACE FUNCTION rollup_observations_monthly(p_site_id UUID, p_month DATE)
RETURNS INTEGER LANGUAGE plpgsql AS $$
DECLARE v_count INTEGER;
BEGIN
  DELETE FROM monthly_observation_rollups
  WHERE site_id = p_site_id AND month = date_trunc('month', p_month)::DATE;

  INSERT INTO monthly_observation_rollups (site_id, entity_id, month, observation_type, tag, count, sum_value)
  SELECT o.site_id, o.entity_id, date_trunc('month', o.observed_at)::DATE,
    o.observation_type, COALESCE(t.tag, ''), COUNT(*),
    COALESCE(SUM((o.raw_value->>'value')::NUMERIC), 0)
  FROM intelligence_observations o
  LEFT JOIN LATERAL (SELECT jsonb_array_elements_text(o.normalized_tags) AS tag) t ON true
  WHERE o.site_id = p_site_id
    AND date_trunc('month', o.observed_at)::DATE = date_trunc('month', p_month)::DATE
    AND o.processed = true
  GROUP BY o.site_id, o.entity_id, date_trunc('month', o.observed_at)::DATE, o.observation_type, tag;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

-- Add missing index
CREATE INDEX IF NOT EXISTS idx_observations_processing_run
  ON intelligence_observations(processing_run_id) WHERE processing_run_id IS NOT NULL;
