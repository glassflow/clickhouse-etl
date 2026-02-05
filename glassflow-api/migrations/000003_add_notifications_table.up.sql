-- Create notification severity enum
CREATE TYPE notification_severity AS ENUM (
    'info',
    'warning',
    'error',
    'critical'
);

-- Create notifications table
CREATE TABLE notifications (
    notification_id UUID PRIMARY KEY,
    pipeline_id TEXT NOT NULL REFERENCES pipelines(id) ON DELETE CASCADE,
    timestamp TIMESTAMPTZ NOT NULL,
    severity notification_severity NOT NULL,
    event_type TEXT NOT NULL,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    metadata JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create index on pipeline_id for efficient queries
CREATE INDEX idx_notifications_pipeline_id ON notifications(pipeline_id);

