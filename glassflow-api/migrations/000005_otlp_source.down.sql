-- Restore NOT NULL on sources.connection_id
ALTER TABLE sources ALTER COLUMN connection_id SET NOT NULL;

-- Restore sources.type CHECK constraint to kafka only
ALTER TABLE sources DROP CONSTRAINT sources_type_check;
ALTER TABLE sources ADD CONSTRAINT sources_type_check CHECK (type IN ('kafka'));
