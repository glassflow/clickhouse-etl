CREATE TABLE pipelines (
    id UUID PRIMARY KEY DEFAULT uuidv7(),
    name VARCHAR(255) NOT NULL,
    status pipeline_status NOT NULL DEFAULT 'Created',
    source_id UUID NOT NULL REFERENCES sources(id) ON DELETE RESTRICT,
    sink_id UUID NOT NULL REFERENCES sinks(id) ON DELETE RESTRICT,
    transformation_ids UUID[] NOT NULL DEFAULT '{}',
    metadata JSONB DEFAULT '{}',
    version VARCHAR(50) DEFAULT '1.0.0',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

CREATE TYPE pipeline_status AS ENUM (
    'Created',
    'Running',
    'Stopping',
    'Stopped',
    'Terminating',
    'Failed',
    'Resuming'
);

CREATE TABLE connections (
    id UUID PRIMARY KEY DEFAULT uuidv7(),
    type VARCHAR(50) NOT NULL CHECK (type IN ('kafka', 'clickhouse')),
    name VARCHAR(255) NOT NULL DEFAULT '',
    config JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

CREATE TABLE sources (
    id UUID PRIMARY KEY DEFAULT uuidv7(),
    type VARCHAR(50) NOT NULL CHECK (type IN ('kafka')),
    connection_id UUID NOT NULL REFERENCES connections(id) ON DELETE RESTRICT,
    config JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

CREATE TABLE sinks (
    id UUID PRIMARY KEY DEFAULT uuidv7(),
    type VARCHAR(50) NOT NULL CHECK (type IN ('clickhouse')),
    connection_id UUID NOT NULL REFERENCES connections(id) ON DELETE RESTRICT,
    config JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);


CREATE TABLE transformations (
    id UUID PRIMARY KEY DEFAULT uuidv7(),
    type VARCHAR(50) NOT NULL CHECK (type IN ('deduplication', 'join', 'filter')),
    config JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);


CREATE TABLE schemas (
    id UUID PRIMARY KEY DEFAULT uuidv7(),
    pipeline_id UUID NOT NULL REFERENCES pipelines(id) ON DELETE CASCADE,
    version VARCHAR(50) NOT NULL,
    active BOOLEAN NOT NULL DEFAULT false,
    schema_data JSONB NOT NULL, -- Full schema JSON matching the provided structure
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    UNIQUE(pipeline_id, version)
);


CREATE TABLE pipeline_status_history (
    id UUID PRIMARY KEY DEFAULT uuidv7(),
    pipeline_id UUID NOT NULL REFERENCES pipelines(id) ON DELETE CASCADE,
    status pipeline_status NOT NULL,
    changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    metadata JSONB DEFAULT '{}'
);


-- CREATE TABLE dlq_configs (
--     id UUID PRIMARY KEY DEFAULT uuidv7(),
--     type VARCHAR(50) NOT NULL CHECK (type IN ('nats','s3','kafka')),
--     connection_id UUID REFERENCES connections(id) ON DELETE SET NULL,
--     config JSONB NOT NULL,
--     created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
--     updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
--     deleted_at TIMESTAMPTZ
-- );