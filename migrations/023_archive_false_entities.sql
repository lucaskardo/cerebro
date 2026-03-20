BEGIN;

-- Archive Restonic (NOT in Panama — Mexican market only)
UPDATE intelligence_entities
SET status = 'archived',
    metadata = COALESCE(metadata, '{}'::jsonb) || '{"archived_reason": "Not present in Panama market - Mexican brand only", "archived_at": "2026-03-19"}'::jsonb
WHERE site_id = 'd3920d22-2c34-40b1-9e8e-59142af08e2a'
  AND name ILIKE '%restonic%'
  AND status != 'archived';

-- Archive Sealy (NOT in Panama)
UPDATE intelligence_entities
SET status = 'archived',
    metadata = COALESCE(metadata, '{}'::jsonb) || '{"archived_reason": "No verified presence in Panama market", "archived_at": "2026-03-19"}'::jsonb
WHERE site_id = 'd3920d22-2c34-40b1-9e8e-59142af08e2a'
  AND name ILIKE '%sealy%'
  AND status != 'archived';

-- NOTE: Indufoam STAYS — it IS in Panama

-- Remove relations involving archived entities
DELETE FROM intelligence_relations
WHERE site_id = 'd3920d22-2c34-40b1-9e8e-59142af08e2a'
  AND (
    from_entity_id IN (SELECT id FROM intelligence_entities WHERE status = 'archived' AND site_id = 'd3920d22-2c34-40b1-9e8e-59142af08e2a')
    OR to_entity_id IN (SELECT id FROM intelligence_entities WHERE status = 'archived' AND site_id = 'd3920d22-2c34-40b1-9e8e-59142af08e2a')
  );

-- Remove facts linked to archived entities
DELETE FROM intelligence_facts
WHERE site_id = 'd3920d22-2c34-40b1-9e8e-59142af08e2a'
  AND entity_id IN (SELECT id FROM intelligence_entities WHERE status = 'archived' AND site_id = 'd3920d22-2c34-40b1-9e8e-59142af08e2a');

COMMIT;
