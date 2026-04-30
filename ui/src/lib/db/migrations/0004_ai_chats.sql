CREATE TABLE IF NOT EXISTS ui_library.ai_chats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pipeline_id TEXT,
  scope_key TEXT NOT NULL UNIQUE,
  messages JSONB NOT NULL,
  model_id TEXT,
  tokens_used INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ai_chats_pipeline_id_idx
  ON ui_library.ai_chats(pipeline_id);
