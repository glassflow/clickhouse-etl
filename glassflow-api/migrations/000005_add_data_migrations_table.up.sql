CREATE TABLE data_migrations (
    version    TEXT        PRIMARY KEY,
    name       TEXT        NOT NULL,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
