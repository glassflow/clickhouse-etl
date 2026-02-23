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
