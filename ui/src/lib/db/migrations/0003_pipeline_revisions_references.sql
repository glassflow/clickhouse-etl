CREATE TABLE IF NOT EXISTS ui_library.pipeline_revisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pipeline_id TEXT NOT NULL,
  revision INTEGER NOT NULL,
  config JSONB NOT NULL,
  env TEXT NOT NULL DEFAULT 'production',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by TEXT
);

CREATE INDEX IF NOT EXISTS pipeline_revisions_pipeline_id_idx
  ON ui_library.pipeline_revisions(pipeline_id);

CREATE UNIQUE INDEX IF NOT EXISTS pipeline_revisions_pipeline_id_revision_uidx
  ON ui_library.pipeline_revisions(pipeline_id, revision);

CREATE TABLE IF NOT EXISTS ui_library.pipeline_references (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  revision_id UUID NOT NULL REFERENCES ui_library.pipeline_revisions(id) ON DELETE CASCADE,
  pipeline_id TEXT NOT NULL,
  resource_kind TEXT NOT NULL,
  resource_id UUID NOT NULL,
  pinned_version TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS pipeline_references_revision_id_idx
  ON ui_library.pipeline_references(revision_id);

CREATE INDEX IF NOT EXISTS pipeline_references_resource_idx
  ON ui_library.pipeline_references(resource_kind, resource_id);

CREATE INDEX IF NOT EXISTS pipeline_references_pipeline_id_idx
  ON ui_library.pipeline_references(pipeline_id);
