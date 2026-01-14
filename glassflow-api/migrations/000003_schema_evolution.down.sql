-- Drop tables in reverse order
DROP TABLE IF EXISTS sink_configs;
DROP TABLE IF EXISTS join_configs;
DROP TABLE IF EXISTS transformation_configs;
DROP TABLE IF EXISTS schema_verions;

-- Drop enum type
DROP TYPE IF EXISTS schema_data_format;
