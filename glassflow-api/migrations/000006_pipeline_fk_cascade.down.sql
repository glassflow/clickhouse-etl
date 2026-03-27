ALTER TABLE transformations DROP COLUMN IF EXISTS pipeline_id;
ALTER TABLE sinks DROP COLUMN IF EXISTS pipeline_id;
ALTER TABLE sources DROP COLUMN IF EXISTS pipeline_id;
