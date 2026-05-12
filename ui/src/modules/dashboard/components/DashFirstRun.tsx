import type { ReactNode } from 'react'
import { WorkflowIcon, LayoutTemplateIcon, NetworkIcon, SparklesIcon, UploadIcon, FlaskConicalIcon } from 'lucide-react'
import { cn } from '@/src/utils/common.client'

type PathDef = {
  icon: ReactNode
  name: string
  description: string
  href?: string
  disabled?: boolean
  cta?: string
}

const PRIMARY_PATHS: PathDef[] = [
  {
    icon: <WorkflowIcon size={20} />,
    name: 'Guided wizard',
    description: 'Step-by-step setup. Takes ~3 min. Most users start here — no prior knowledge needed.',
    href: '/home',
    cta: 'Start wizard →',
  },
  {
    icon: <SparklesIcon size={20} />,
    name: 'Ask AI',
    description: 'Describe your pipeline in plain text — we draft the config for you, then you review before deploying.',
    href: '/home?openAi=1',
    cta: 'Try AI →',
  },
]

const SECONDARY_PATHS: PathDef[] = [
  {
    icon: <NetworkIcon size={14} />,
    name: 'Visual canvas',
    description: 'Drag-and-connect · advanced',
    href: '/canvas',
  },
  {
    icon: <UploadIcon size={14} />,
    name: 'Import config',
    description: 'Paste YAML / JSON',
    href: '/home',
  },
  {
    icon: <LayoutTemplateIcon size={14} />,
    name: 'From template',
    description: 'Kafka → ClickHouse, OTLP logs & more',
    disabled: true,
  },
  {
    icon: <FlaskConicalIcon size={14} />,
    name: 'Try with sample data',
    description: 'No setup · explore the UI',
    disabled: true,
  },
]

function PrimaryPathTile({ path }: { path: PathDef }) {
  return (
    <a
      href={path.href}
      aria-label={path.name}
      data-role="primary-path"
      className="group flex flex-col px-8 py-7 border border-[var(--color-gray-dark-800)] rounded-[14px] bg-[var(--dash-card-bg)] cursor-pointer no-underline transition-all duration-[150ms] hover:border-[var(--color-orange-300)] hover:bg-[var(--color-orange-alpha-10)] focus-ring"
    >
      <div className="w-10 h-10 rounded-[10px] bg-[var(--color-orange-alpha-10)] text-[var(--color-orange-300)] grid place-items-center" aria-hidden="true">
        {path.icon}
      </div>
      <div className="title-6 font-bold text-[var(--color-foreground-neutral)] tracking-[-0.01em] mt-[14px] mb-1.5">
        {path.name}
      </div>
      <div className="text-[13px] text-[var(--color-gray-dark-100)] leading-[1.55] flex-1">
        {path.description}
      </div>
      {path.cta && (
        <div className="font-mono text-[11.5px] text-[var(--color-orange-300)] mt-4">{path.cta}</div>
      )}
    </a>
  )
}

function PathTile({ path }: { path: PathDef }) {
  const inner = (
    <>
      <div
        className={cn(
          'w-8 h-8 rounded-[6px] grid place-items-center mb-3',
          path.disabled
            ? 'bg-transparent border border-dashed border-[var(--color-gray-dark-700)] text-[var(--color-gray-dark-100)]'
            : 'bg-[var(--color-orange-alpha-10)] text-[var(--color-orange-300)]',
        )}
        aria-hidden="true"
      >
        {path.icon}
      </div>
      <div data-role="path-name" className="text-[13px] font-semibold text-[var(--color-foreground-neutral)] mb-0.5" style={{ fontFamily: 'var(--font-family-title)' }}>
        {path.name}
      </div>
      <div className="text-[11px] text-[var(--color-gray-dark-500)] leading-[1.45]">{path.description}</div>
    </>
  )

  if (path.disabled) {
    return (
      <div
        aria-disabled="true"
        data-role="path"
        className="px-4 py-[18px] border border-dashed border-[var(--color-gray-dark-800)] rounded-[8px] bg-[var(--dash-page-bg)] opacity-40 cursor-not-allowed pointer-events-none"
      >
        {inner}
      </div>
    )
  }

  return (
    <a
      href={path.href}
      aria-label={path.name}
      data-role="path"
      className="block px-4 py-[18px] border border-[var(--color-gray-dark-800)] rounded-[8px] bg-[var(--dash-page-bg)] no-underline cursor-pointer transition-all duration-[150ms] hover:border-[var(--color-orange-300)] hover:bg-[var(--color-orange-alpha-10)] focus-ring"
    >
      {inner}
    </a>
  )
}

export function DashFirstRun() {
  return (
    <div className="flex-1 px-10 pt-16 pb-20">
      <div
        className="w-20 h-20 rounded-[20px] grid place-items-center text-black mb-7"
        style={{
          background: 'linear-gradient(135deg, var(--color-orange-200), var(--color-orange-500))',
          boxShadow: '0 8px 32px -4px var(--color-orange-alpha-40)',
        }}
        aria-hidden="true"
      >
        <svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 12h4l3-8 4 16 3-8h4" />
        </svg>
      </div>

      <h2 className="text-[34px] font-bold tracking-[-0.025em] leading-[1.1] text-[var(--color-foreground-neutral)] m-0 mb-3" style={{ fontFamily: 'var(--font-family-title)' }}>
        Set up your first pipeline
      </h2>
      <p className="text-[15px] leading-relaxed text-[var(--color-gray-dark-100)] m-0 max-w-[540px]">
        Pick the path that fits how you work. Every path produces the same
        draft, which you&apos;ll review before deploying.
      </p>

      <div className="grid grid-cols-2 gap-4 mt-9 max-w-[960px]">
        {PRIMARY_PATHS.map((path) => <PrimaryPathTile key={path.name} path={path} />)}
      </div>

      <p className="font-mono text-[10.5px] uppercase tracking-[0.1em] text-[var(--color-gray-dark-500)] mt-7 mb-3">
        More ways to start
      </p>
      <div className="grid grid-cols-4 gap-[10px] max-w-[960px]">
        {SECONDARY_PATHS.map((path) => <PathTile key={path.name} path={path} />)}
      </div>

      <div className="font-mono text-[11px] text-[var(--color-gray-dark-500)] mt-7">
        New to GlassFlow?{' '}
        <a href="#" className="text-[var(--color-orange-300)] cursor-pointer">Read the 5-minute intro</a>
        {' · '}
        <a href="#" className="text-[var(--color-orange-300)] cursor-pointer">Browse examples</a>
      </div>
    </div>
  )
}
