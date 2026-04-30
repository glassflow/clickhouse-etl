// Legacy /pipelines/create/ai route — Phase 4 replaces the standalone page
// with the global AI drawer. We redirect any visitor (e.g. from old
// bookmarks) to the home page with a query string that auto-opens the
// drawer. The drawer flow uses scope = 'global' for a brand-new pipeline.

import { redirect } from 'next/navigation'

export default function LegacyAiCreatePage() {
  redirect('/?openAi=1')
}
