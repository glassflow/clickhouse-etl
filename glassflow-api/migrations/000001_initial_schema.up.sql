
-- Create pipeline status enum
CREATE TYPE pipeline_status AS ENUM (
    'Created',
    'Running',
    'Stopping',
    'Stopped',
    'Terminating',
    'Failed',
    'Resuming'
);

-- Create pipeline status enum
CREATE TYPE schema_status AS ENUM (
    'Active',
    'Inactive',
    'Invalid'
);

-- Connections table
CREATE TABLE connections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type TEXT NOT NULL CHECK (type IN ('kafka', 'clickhouse')),
    config JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Sources table
CREATE TABLE sources (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type TEXT NOT NULL CHECK (type IN ('kafka')),
    connection_id UUID NOT NULL REFERENCES connections(id) ON DELETE RESTRICT,
    config JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Sinks table
CREATE TABLE sinks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type TEXT NOT NULL CHECK (type IN ('clickhouse')),
    connection_id UUID NOT NULL REFERENCES connections(id) ON DELETE RESTRICT,
    config JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Transformations table
CREATE TABLE transformations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type TEXT NOT NULL CHECK (type IN ('deduplication', 'join', 'filter')),
    config JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Pipelines table
CREATE TABLE pipelines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    status pipeline_status NOT NULL DEFAULT 'Created',
    source_id UUID NOT NULL REFERENCES sources(id) ON DELETE RESTRICT,
    sink_id UUID NOT NULL REFERENCES sinks(id) ON DELETE RESTRICT,
    transformation_ids UUID[] DEFAULT '{}',
    metadata JSONB DEFAULT '{}',
    version TEXT DEFAULT '1.0.0',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Schemas table for schema versioning and evolution
CREATE TABLE schemas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pipeline_id UUID NOT NULL REFERENCES pipelines(id) ON DELETE CASCADE,
    version TEXT NOT NULL,
    active schema_status NOT NULL DEFAULT 'Active',
    schema_data JSONB NOT NULL, -- Full schema JSON matching the provided structure
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(pipeline_id, version)
);

-- Pipeline status history table
CREATE TABLE pipeline_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pipeline_id UUID NOT NULL REFERENCES pipelines(id) ON DELETE CASCADE,
    event JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);