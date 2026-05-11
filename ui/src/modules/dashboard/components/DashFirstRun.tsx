import type { ReactNode } from 'react'
import { WorkflowIcon, LayoutTemplateIcon, NetworkIcon, SparklesIcon, UploadIcon, FlaskConicalIcon } from 'lucide-react'

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
    <a href={path.href} className="empty-primary-path" aria-label={path.name}>
      <div className="ep-icon" aria-hidden="true">{path.icon}</div>
      <div className="ep-name">{path.name}</div>
      <div className="ep-desc">{path.description}</div>
      {path.cta && <div className="ep-cta">{path.cta}</div>}
    </a>
  )
}

function PathTile({ path }: { path: PathDef }) {
  const cls = `empty-path${path.disabled ? ' disabled' : ''}`
  const inner = (
    <>
      <div className="empty-ic-wrap" aria-hidden="true">{path.icon}</div>
      <div className="empty-path-name">{path.name}</div>
      <div className="empty-path-desc">{path.description}</div>
    </>
  )
  if (path.disabled) {
    return <div className={cls} aria-disabled="true">{inner}</div>
  }
  return (
    <a href={path.href} className={cls} aria-label={path.name}>
      {inner}
    </a>
  )
}

export function DashFirstRun() {
  return (
    <div className="empty-state">
      <div className="empty-mark" aria-hidden="true">
        <svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 12h4l3-8 4 16 3-8h4" />
        </svg>
      </div>
      <h2>Set up your first pipeline</h2>
      <p>
        Pick the path that fits how you work. Every path produces the same
        draft, which you&apos;ll review before deploying.
      </p>

      <div className="empty-primary">
        {PRIMARY_PATHS.map((path) => <PrimaryPathTile key={path.name} path={path} />)}
      </div>

      <p className="empty-secondary-label">More ways to start</p>
      <div className="empty-secondary">
        {SECONDARY_PATHS.map((path) => <PathTile key={path.name} path={path} />)}
      </div>

      <div className="empty-foot">
        New to GlassFlow?{' '}
        <a href="#">Read the 5-minute intro</a>
        {' · '}
        <a href="#">Browse examples</a>
      </div>
    </div>
  )
}
