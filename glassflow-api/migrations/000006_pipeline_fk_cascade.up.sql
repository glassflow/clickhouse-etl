-- Add pipeline_id FK to sources, sinks, and transformations with ON DELETE CASCADE.
--
-- DEFERRABLE INITIALLY DEFERRED is required because these rows are inserted before
-- the pipeline row within the same transaction (pipelines.source_id and pipelines.sink_id
-- are NOT NULL FKs that require source/sink to exist first). With DEFERRABLE, PostgreSQL
-- validates the FK at COMMIT time rather than at INSERT time, at which point all rows exist.
ALTER TABLE sources
    ADD COLUMN pipeline_id TEXT REFERENCES pipelines(id) ON DELETE CASCADE
    DEFERRABLE INITIALLY DEFERRED;

-- Backfill pipeline_id for existing sources
UPDATE sources s SET pipeline_id = p.id FROM pipelines p WHERE p.source_id = s.id;

ALTER TABLE sinks
    ADD COLUMN pipeline_id TEXT REFERENCES pipelines(id) ON DELETE CASCADE
    DEFERRABLE INITIALLY DEFERRED;

-- Backfill pipeline_id for existing sinks
UPDATE sinks s SET pipeline_id = p.id FROM pipelines p WHERE p.sink_id = s.id;

ALTER TABLE transformations
    ADD COLUMN pipeline_id TEXT REFERENCES pipelines(id) ON DELETE CASCADE
    DEFERRABLE INITIALLY DEFERRED;

-- Backfill pipeline_id for existing transformations
UPDATE transformations t SET pipeline_id = p.id
FROM pipelines p
WHERE t.id = ANY(p.transformation_ids);
