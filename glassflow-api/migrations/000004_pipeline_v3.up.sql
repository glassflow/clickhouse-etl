-- Add schema data format enum
CREATE TYPE schema_data_format AS ENUM (
    'json'
);

-- Create new schema_versions table
CREATE TABLE schema_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pipeline_id TEXT NOT NULL REFERENCES pipelines(id) ON DELETE CASCADE,
    source_id TEXT NOT NULL,
    version_id TEXT NOT NULL,
    data_format schema_data_format NOT NULL DEFAULT 'json',
    fields JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(pipeline_id, source_id, version_id)
);

-- Create new transfromation_configs
CREATE TABLE transformation_configs (
    pipeline_id TEXT NOT NULL REFERENCES pipelines(id) ON DELETE CASCADE,
    source_id TEXT NOT NULL,
    schema_version_id TEXT NOT NULL,
    transformation_id TEXT NOT NULL,
    output_schema_version_id TEXT NOT NULL,
    config JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(pipeline_id, source_id, schema_version_id)
);

-- Create new join_configs table
CREATE TABLE join_configs (
    pipeline_id TEXT NOT NULL REFERENCES pipelines(id) ON DELETE CASCADE,
    source_id TEXT NOT NULL,
    schema_version_id TEXT NOT NULL,
    join_id TEXT NOT NULL,
    output_schema_version_id TEXT NOT NULL,
    config JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(pipeline_id, source_id, schema_version_id, join_id, output_schema_version_id)
);

-- Create new sink_configs table
CREATE TABLE sink_configs (
    pipeline_id TEXT NOT NULL REFERENCES pipelines(id) ON DELETE CASCADE,
    source_id TEXT NOT NULL,
    schema_version_id TEXT NOT NULL,
    config JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(pipeline_id, source_id, schema_version_id)
);

-- Relax sources.type CHECK constraint to allow OTLP source types
ALTER TABLE sources DROP CONSTRAINT sources_type_check;
ALTER TABLE sources ADD CONSTRAINT sources_type_check
    CHECK (type IN ('kafka', 'otlp.logs', 'otlp.traces', 'otlp.metrics'));

-- Make sources.connection_id nullable (OTLP sources have no Kafka connection)
ALTER TABLE sources ALTER COLUMN connection_id DROP NOT NULL;

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

-- Create data_migrations tracking table
CREATE TABLE data_migrations (
    version    TEXT        PRIMARY KEY,
    name       TEXT        NOT NULL,
    status     TEXT        NOT NULL DEFAULT 'applied',
    error      TEXT,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
