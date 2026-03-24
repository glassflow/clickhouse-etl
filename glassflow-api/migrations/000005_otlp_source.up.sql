-- Relax sources.type CHECK constraint to allow OTLP source types
ALTER TABLE sources DROP CONSTRAINT sources_type_check;
ALTER TABLE sources ADD CONSTRAINT sources_type_check
    CHECK (type IN ('kafka', 'otlp.logs', 'otlp.traces', 'otlp.metrics'));

-- Make sources.connection_id nullable (OTLP sources have no Kafka connection)
ALTER TABLE sources ALTER COLUMN connection_id DROP NOT NULL;
