import { AiPipelinePageClient } from './AiPipelinePageClient'
import { AiMissingKeyScreen } from './AiMissingKeyScreen'

function isAiConfigured(): boolean {
  const provider = (process.env.LLM_PROVIDER || 'openai').toLowerCase()
  return provider === 'anthropic'
    ? !!process.env.ANTHROPIC_API_KEY
    : !!process.env.OPENAI_API_KEY
}

export default function CreatePipelineWithAiPage() {
  if (!isAiConfigured()) {
    return <AiMissingKeyScreen />
  }
  return <AiPipelinePageClient />
}
