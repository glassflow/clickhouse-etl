-- Add schema type enum
CREATE TYPE schema_config_type AS ENUM (
    'internal',
    'external'
);

-- Add schema data format enum
CREATE TYPE schema_data_format AS ENUM (
    'json'
);

-- Add schema type enum
CREATE TYPE schema_type AS ENUM (
    'kafka',
    'clickhouse'
);

CREATE TYPE mapping_type AS ENUM (
    'one_to_one',
    'many_to_one'
);

-- Create new schemas table
CREATE TABLE schemas_v2 (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pipeline_id TEXT NOT NULL REFERENCES pipelines(id) ON DELETE CASCADE,
    source_name TEXT NOT NULL,
    config_type schema_config_type NOT NULL DEFAULT 'internal',
    external_schema_config JSONB NOT NULL DEFAULT '{}'::JSONB,
    data_format schema_data_format NOT NULL DEFAULT 'json',
    schema_type schema_type NOT NULL DEFAULT 'kafka',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(pipeline_id, source_name)
);

-- Schema_versions table for versioned schema definitions
CREATE TABLE schema_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    schema_id UUID NOT NULL REFERENCES schemas_v2(id) ON DELETE CASCADE,
    version TEXT NOT NULL,
    schema_fields JSONB NOT NULL,
    status schema_status NOT NULL DEFAULT 'Active',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(schema_id, version)
);

CREATE TABLE mappings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pipeline_id TEXT NOT NULL REFERENCES pipelines(id) ON DELETE CASCADE,
    mapping_type mapping_type NOT NULL DEFAULT 'one_to_one',
    mapping_fields JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(pipeline_id, mapping_type)
);
