BEGIN;

-- 1. EXPAND entity_type constraints
ALTER TABLE intelligence_entities DROP CONSTRAINT IF EXISTS intelligence_entities_entity_type_check;
ALTER TABLE intelligence_entities ADD CONSTRAINT intelligence_entities_entity_type_check CHECK (entity_type IN (
  'product','competitor','competitor_product','brand','store',
  'segment','pain_point','objection','channel','persona',
  'location','feature','promotion','market','other'
));

ALTER TABLE discovery_policies DROP CONSTRAINT IF EXISTS discovery_policies_entity_type_check;
ALTER TABLE discovery_policies ADD CONSTRAINT discovery_policies_entity_type_check CHECK (entity_type IN (
  'product','competitor','competitor_product','brand','store',
  'segment','pain_point','objection','channel','persona',
  'location','feature','promotion','market','other'
));

-- 2. EXPAND relation_type constraint
ALTER TABLE intelligence_relations DROP CONSTRAINT IF EXISTS intelligence_relations_relation_type_check;
ALTER TABLE intelligence_relations ADD CONSTRAINT intelligence_relations_relation_type_check CHECK (relation_type IN (
  'solves','recommended_for','cheaper_than','competes_with',
  'targets','supports','contradicts','related_to','derived_from',
  'sold_at','owned_by','belongs_to','potential_partner',
  'competes_directly_with','alternative_to','stronger_than',
  'best_response_to','upsells_to','cross_sells_with',
  'mentioned_together','triggers','causes','converts_to'
));

-- 2b. ADD unique index on relations for idempotent inserts
CREATE UNIQUE INDEX IF NOT EXISTS uq_relations_entity_pair
  ON intelligence_relations(
    site_id,
    COALESCE(from_entity_id, '00000000-0000-0000-0000-000000000000'::uuid),
    COALESCE(to_entity_id, '00000000-0000-0000-0000-000000000000'::uuid),
    relation_type
  );

-- 3. MIGRATE existing competitors → brands and stores
UPDATE intelligence_entities
SET entity_type = 'brand',
    metadata = COALESCE(metadata, '{}'::jsonb) || '{"migrated_from": "competitor", "migrated_at": "2026-03-19"}'::jsonb
WHERE site_id = 'd3920d22-2c34-40b1-9e8e-59142af08e2a'
  AND entity_type = 'competitor'
  AND (name ILIKE '%restonic%' OR name ILIKE '%sealy%' OR name ILIKE '%simmons%' OR name ILIKE '%indufoam%')
  AND NOT EXISTS (
    SELECT 1 FROM intelligence_entities e2
    WHERE e2.site_id = intelligence_entities.site_id
      AND e2.entity_type = 'brand' AND e2.slug = intelligence_entities.slug
  );

UPDATE intelligence_entities
SET entity_type = 'store',
    metadata = COALESCE(metadata, '{}'::jsonb) || '{"migrated_from": "competitor", "migrated_at": "2026-03-19"}'::jsonb
WHERE site_id = 'd3920d22-2c34-40b1-9e8e-59142af08e2a'
  AND entity_type = 'competitor' AND name ILIKE '%sleep store%'
  AND NOT EXISTS (
    SELECT 1 FROM intelligence_entities e2
    WHERE e2.site_id = intelligence_entities.site_id
      AND e2.entity_type = 'store' AND e2.slug = intelligence_entities.slug
  );

UPDATE intelligence_entities
SET entity_type = 'store',
    metadata = COALESCE(metadata, '{}'::jsonb) || '{"migrated_from": "competitor", "migrated_at": "2026-03-19", "note": "Brand=Colchones Flex, Store=Sleep Shop"}'::jsonb
WHERE site_id = 'd3920d22-2c34-40b1-9e8e-59142af08e2a'
  AND entity_type = 'competitor'
  AND (name ILIKE '%sleep shop%' OR name ILIKE '%colchones flex%')
  AND NOT EXISTS (
    SELECT 1 FROM intelligence_entities e2
    WHERE e2.site_id = intelligence_entities.site_id
      AND e2.entity_type = 'store' AND e2.slug = intelligence_entities.slug
  );

-- 4. CREATE new brand entities
INSERT INTO intelligence_entities (site_id, entity_type, name, slug, description, metadata) VALUES
  ('d3920d22-2c34-40b1-9e8e-59142af08e2a', 'brand', 'Colchones Flex', 'colchones-flex',
   'Marca propia de Sleep Shop Panama. Colchones resortes/espuma. Rango medio-bajo.',
   '{"website":"sleepshoppanama.com","instagram":"@sleepshoppanama","followers_ig":12000,"price_range":"medio-bajo","country":"PA"}'::jsonb),
  ('d3920d22-2c34-40b1-9e8e-59142af08e2a', 'brand', 'Malouf', 'malouf',
   'Marca estadounidense de colchones y accesorios. Distribuida via The Sleep Store.',
   '{"website":"maloufhome.com","origin":"US","price_range":"medio-alto"}'::jsonb),
  ('d3920d22-2c34-40b1-9e8e-59142af08e2a', 'brand', 'Weekender', 'weekender',
   'Linea asequible de Malouf. Posicionamiento valor/precio.',
   '{"origin":"US","price_range":"medio","parent_brand":"Malouf"}'::jsonb),
  ('d3920d22-2c34-40b1-9e8e-59142af08e2a', 'brand', 'Magnaflex', 'magnaflex',
   'Marca italiana premium. Distribuida via The Sleep Store.',
   '{"origin":"IT","price_range":"alto"}'::jsonb)
ON CONFLICT (site_id, entity_type, slug) DO NOTHING;

-- 5. CREATE new store entities
INSERT INTO intelligence_entities (site_id, entity_type, name, slug, description, metadata) VALUES
  ('d3920d22-2c34-40b1-9e8e-59142af08e2a', 'store', 'El Titan', 'el-titan',
   'Cadena de muebles y hogar. Vende Restonic. Multiples sucursales.',
   '{"type":"furniture_chain","country":"PA","potential_partner":true}'::jsonb),
  ('d3920d22-2c34-40b1-9e8e-59142af08e2a', 'store', 'Novey', 'novey',
   'Cadena de ferreterias y hogar (grupo Empresas Bern).',
   '{"type":"home_improvement","country":"PA","potential_partner":true}'::jsonb),
  ('d3920d22-2c34-40b1-9e8e-59142af08e2a', 'store', 'Multimax', 'multimax',
   'Cadena electronica/electrodomesticos. Seccion colchones. Alto trafico.',
   '{"type":"electronics_chain","country":"PA","potential_partner":true}'::jsonb)
ON CONFLICT (site_id, entity_type, slug) DO NOTHING;

-- 6. CREATE relations
INSERT INTO intelligence_relations (site_id, from_entity_id, to_entity_id, relation_type, strength, metadata)
SELECT 'd3920d22-2c34-40b1-9e8e-59142af08e2a', src.id, tgt.id, 'owned_by', 10.0,
       '{"note":"Colchones Flex is Sleep Shop private label"}'::jsonb
FROM intelligence_entities src, intelligence_entities tgt
WHERE src.site_id = 'd3920d22-2c34-40b1-9e8e-59142af08e2a' AND src.slug = 'colchones-flex' AND src.entity_type = 'brand'
  AND tgt.site_id = 'd3920d22-2c34-40b1-9e8e-59142af08e2a' AND tgt.entity_type = 'store' AND tgt.name ILIKE '%sleep shop%'
ON CONFLICT DO NOTHING;

INSERT INTO intelligence_relations (site_id, from_entity_id, to_entity_id, relation_type, strength, metadata)
SELECT 'd3920d22-2c34-40b1-9e8e-59142af08e2a', src.id, tgt.id, 'sold_at', 9.0, '{}'::jsonb
FROM intelligence_entities src, intelligence_entities tgt
WHERE src.site_id = 'd3920d22-2c34-40b1-9e8e-59142af08e2a' AND src.slug = 'malouf' AND src.entity_type = 'brand'
  AND tgt.site_id = 'd3920d22-2c34-40b1-9e8e-59142af08e2a' AND tgt.entity_type = 'store' AND tgt.name ILIKE '%sleep store%'
ON CONFLICT DO NOTHING;

INSERT INTO intelligence_relations (site_id, from_entity_id, to_entity_id, relation_type, strength, metadata)
SELECT 'd3920d22-2c34-40b1-9e8e-59142af08e2a', src.id, tgt.id, 'sold_at', 9.0, '{}'::jsonb
FROM intelligence_entities src, intelligence_entities tgt
WHERE src.site_id = 'd3920d22-2c34-40b1-9e8e-59142af08e2a' AND src.slug = 'weekender' AND src.entity_type = 'brand'
  AND tgt.site_id = 'd3920d22-2c34-40b1-9e8e-59142af08e2a' AND tgt.entity_type = 'store' AND tgt.name ILIKE '%sleep store%'
ON CONFLICT DO NOTHING;

INSERT INTO intelligence_relations (site_id, from_entity_id, to_entity_id, relation_type, strength, metadata)
SELECT 'd3920d22-2c34-40b1-9e8e-59142af08e2a', src.id, tgt.id, 'belongs_to', 10.0,
       '{"note":"Weekender is Malouf value line"}'::jsonb
FROM intelligence_entities src, intelligence_entities tgt
WHERE src.site_id = 'd3920d22-2c34-40b1-9e8e-59142af08e2a' AND src.slug = 'weekender' AND src.entity_type = 'brand'
  AND tgt.site_id = 'd3920d22-2c34-40b1-9e8e-59142af08e2a' AND tgt.slug = 'malouf' AND tgt.entity_type = 'brand'
ON CONFLICT DO NOTHING;

INSERT INTO intelligence_relations (site_id, from_entity_id, to_entity_id, relation_type, strength, metadata)
SELECT 'd3920d22-2c34-40b1-9e8e-59142af08e2a', src.id, tgt.id, 'sold_at', 9.0, '{}'::jsonb
FROM intelligence_entities src, intelligence_entities tgt
WHERE src.site_id = 'd3920d22-2c34-40b1-9e8e-59142af08e2a' AND src.slug = 'magnaflex' AND src.entity_type = 'brand'
  AND tgt.site_id = 'd3920d22-2c34-40b1-9e8e-59142af08e2a' AND tgt.entity_type = 'store' AND tgt.name ILIKE '%sleep store%'
ON CONFLICT DO NOTHING;

INSERT INTO intelligence_relations (site_id, from_entity_id, to_entity_id, relation_type, strength, metadata)
SELECT 'd3920d22-2c34-40b1-9e8e-59142af08e2a', src.id, tgt.id, 'sold_at', 7.0, '{}'::jsonb
FROM intelligence_entities src, intelligence_entities tgt
WHERE src.site_id = 'd3920d22-2c34-40b1-9e8e-59142af08e2a'
  AND src.name ILIKE '%restonic%' AND src.entity_type = 'brand'
  AND tgt.site_id = 'd3920d22-2c34-40b1-9e8e-59142af08e2a'
  AND tgt.entity_type = 'store' AND tgt.slug IN ('el-titan','novey','multimax')
ON CONFLICT DO NOTHING;

-- 7. COMPETITIVE relations between ALL mattress brands
INSERT INTO intelligence_relations (site_id, from_entity_id, to_entity_id, relation_type, strength, metadata)
SELECT 'd3920d22-2c34-40b1-9e8e-59142af08e2a', a.id, b.id, 'competes_directly_with', 7.0,
       '{"market":"PA","category":"mattresses"}'::jsonb
FROM intelligence_entities a, intelligence_entities b
WHERE a.site_id = 'd3920d22-2c34-40b1-9e8e-59142af08e2a'
  AND b.site_id = 'd3920d22-2c34-40b1-9e8e-59142af08e2a'
  AND a.entity_type = 'brand' AND b.entity_type = 'brand'
  AND a.id < b.id
ON CONFLICT DO NOTHING;

-- 8. Discovery policies for new types
INSERT INTO discovery_policies (site_id, entity_type, min_observations, observation_ttl_days) VALUES
  ('d3920d22-2c34-40b1-9e8e-59142af08e2a', 'brand', 5, 60),
  ('d3920d22-2c34-40b1-9e8e-59142af08e2a', 'store', 3, 90)
ON CONFLICT (site_id, entity_type) DO NOTHING;

COMMIT;
