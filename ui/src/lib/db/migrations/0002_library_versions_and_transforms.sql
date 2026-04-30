CREATE TABLE IF NOT EXISTS ui_library.schema_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  schema_id UUID NOT NULL REFERENCES ui_library.schemas(id) ON DELETE CASCADE,
  version TEXT NOT NULL,
  fields JSONB NOT NULL,
  change_summary TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by TEXT
);

CREATE INDEX IF NOT EXISTS schema_versions_schema_id_idx
  ON ui_library.schema_versions(schema_id);

CREATE TABLE IF NOT EXISTS ui_library.transforms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  folder_id UUID REFERENCES ui_library.folders(id) ON DELETE SET NULL,
  tags JSONB NOT NULL DEFAULT '[]',
  language TEXT NOT NULL,
  code TEXT NOT NULL,
  input_schema_id UUID REFERENCES ui_library.schemas(id) ON DELETE SET NULL,
  output_schema_id UUID REFERENCES ui_library.schemas(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ui_library.transform_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transform_id UUID NOT NULL REFERENCES ui_library.transforms(id) ON DELETE CASCADE,
  version TEXT NOT NULL,
  language TEXT NOT NULL,
  code TEXT NOT NULL,
  input_schema_id UUID,
  output_schema_id UUID,
  change_summary TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by TEXT
);

CREATE INDEX IF NOT EXISTS transform_versions_transform_id_idx
  ON ui_library.transform_versions(transform_id);
