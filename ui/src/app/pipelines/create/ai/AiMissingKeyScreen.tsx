import Link from 'next/link'
import { ChevronLeftIcon, KeyIcon } from '@heroicons/react/24/outline'

export function AiMissingKeyScreen() {
  return (
    <div className="-mt-4 sm:-mt-8 -mb-12 sm:-mb-20 h-[calc(100dvh-56px)] flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center px-6 py-3 border-b border-[var(--surface-border)] shrink-0">
        <Link
          href="/"
          className="flex items-center gap-1.5 text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
        >
          <ChevronLeftIcon className="w-3.5 h-3.5" />
          Back
        </Link>
        <div className="w-px h-4 bg-[var(--surface-border)] mx-4" />
        <span className="text-sm font-medium text-[var(--text-primary)]">Create with AI</span>
      </div>

      {/* Content */}
      <div className="flex flex-1 items-center justify-center px-6">
        <div className="flex flex-col items-center gap-6 max-w-md text-center">
          <div className="flex items-center justify-center w-14 h-14 rounded-full bg-[var(--surface-raised)] border border-[var(--surface-border)]">
            <KeyIcon className="w-6 h-6 text-[var(--text-secondary)]" />
          </div>

          <div className="flex flex-col gap-2">
            <h1 className="text-base font-semibold text-[var(--text-primary)]">
              AI Assistant Not Configured
            </h1>
            <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
              To use the AI pipeline assistant, provide an API key for your preferred LLM provider and restart the application.
            </p>
          </div>

          <div className="w-full flex flex-col gap-3 text-left">
            <p className="text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wide">
              Option A — OpenAI (default)
            </p>
            <pre className="w-full rounded-md bg-[var(--surface-raised)] border border-[var(--surface-border)] px-4 py-3 text-xs text-[var(--text-primary)] overflow-x-auto">
              <code>{`LLM_PROVIDER=openai\nOPENAI_API_KEY=sk-...`}</code>
            </pre>

            <p className="text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wide mt-1">
              Option B — Anthropic
            </p>
            <pre className="w-full rounded-md bg-[var(--surface-raised)] border border-[var(--surface-border)] px-4 py-3 text-xs text-[var(--text-primary)] overflow-x-auto">
              <code>{`LLM_PROVIDER=anthropic\nANTHROPIC_API_KEY=sk-ant-...`}</code>
            </pre>
          </div>

          <p className="text-xs text-[var(--text-secondary)]">
            Add the variables to your <code className="text-[var(--text-primary)] bg-[var(--surface-raised)] px-1 py-0.5 rounded">.env.local</code> file and restart, or set them as environment variables and redeploy.
          </p>
        </div>
      </div>
    </div>
  )
}
