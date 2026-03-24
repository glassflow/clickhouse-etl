import Link from 'next/link'
import { ChevronLeftIcon, KeyIcon } from '@heroicons/react/24/outline'

export function AiMissingKeyScreen() {
  return (
    <div className="flex flex-col gap-10">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <h1 className="text-4xl font-semibold tracking-tight text-[var(--text-primary)]">
          Playground
        </h1>
        <Link
          href="/"
          className="flex items-center gap-1.5 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors border border-[var(--surface-border)] rounded-lg px-3 h-8 shadow-sm bg-[var(--surface-bg)]"
        >
          <ChevronLeftIcon className="w-4 h-4" />
          Back to pipelines
        </Link>
      </div>

      {/* Card */}
      <div className="border border-[var(--surface-border)] rounded-xl bg-[var(--surface-bg)]">
        <div className="flex items-center px-8 py-4 border-b border-[var(--surface-border)]">
          <h2 className="text-lg font-semibold text-[var(--text-primary)]">AI Pipeline Builder</h2>
        </div>

        <div className="flex items-center justify-center px-8 py-24">
          <div className="flex flex-col items-center gap-6 max-w-md text-center">
            <div className="flex items-center justify-center w-14 h-14 rounded-full bg-[var(--surface-raised)] border border-[var(--surface-border)]">
              <KeyIcon className="w-6 h-6 text-[var(--text-secondary)]" />
            </div>

            <div className="flex flex-col gap-2">
              <h3 className="text-base font-semibold text-[var(--text-primary)]">
                AI Assistant Not Configured
              </h3>
              <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
                To use the AI pipeline assistant, provide an API key for your preferred LLM provider and restart the application.
              </p>
            </div>

            <div className="w-full flex flex-col gap-3 text-left">
              <p className="text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wide">
                Option A — OpenAI (default)
              </p>
              <pre className="w-full rounded-lg bg-[var(--surface-raised)] border border-[var(--surface-border)] px-4 py-3 text-xs text-[var(--text-primary)] overflow-x-auto">
                <code>{`LLM_PROVIDER=openai\nOPENAI_API_KEY=sk-...`}</code>
              </pre>

              <p className="text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wide mt-1">
                Option B — Anthropic
              </p>
              <pre className="w-full rounded-lg bg-[var(--surface-raised)] border border-[var(--surface-border)] px-4 py-3 text-xs text-[var(--text-primary)] overflow-x-auto">
                <code>{`LLM_PROVIDER=anthropic\nANTHROPIC_API_KEY=sk-ant-...`}</code>
              </pre>
            </div>

            <p className="text-xs text-[var(--text-secondary)]">
              Add the variables to your{' '}
              <code className="text-[var(--text-primary)] bg-[var(--surface-raised)] px-1 py-0.5 rounded">.env.local</code>
              {' '}file and restart, or set them as environment variables and redeploy.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
