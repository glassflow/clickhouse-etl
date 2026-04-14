ALTER TABLE transformations DROP COLUMN IF EXISTS pipeline_id;
ALTER TABLE sinks DROP COLUMN IF EXISTS pipeline_id;
ALTER TABLE sources DROP COLUMN IF EXISTS pipeline_id;

-- Restore NOT NULL on sources.connection_id
ALTER TABLE sources ALTER COLUMN connection_id SET NOT NULL;

-- Restore sources.type CHECK constraint to kafka only
ALTER TABLE sources DROP CONSTRAINT sources_type_check;
ALTER TABLE sources ADD CONSTRAINT sources_type_check CHECK (type IN ('kafka'));

-- Drop tables in reverse order
DROP TABLE IF EXISTS sink_configs;
DROP TABLE IF EXISTS join_configs;
DROP TABLE IF EXISTS transformation_configs;
DROP TABLE IF EXISTS schema_versions;

-- Drop enum type
DROP TYPE IF EXISTS schema_data_format;
