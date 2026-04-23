ALTER TABLE data_migrations
    DROP COLUMN IF EXISTS status,
    DROP COLUMN IF EXISTS error;
