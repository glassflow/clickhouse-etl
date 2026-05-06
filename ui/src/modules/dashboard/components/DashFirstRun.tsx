import type { ReactNode } from 'react'
import { WorkflowIcon, LayoutTemplateIcon, NetworkIcon, SparklesIcon, UploadIcon, FlaskConicalIcon } from 'lucide-react'

type PathDef = {
  icon: ReactNode
  name: string
  description: string
  href?: string
  disabled?: boolean
}

const PATHS: PathDef[] = [
  {
    icon: <WorkflowIcon size={14} />,
    name: 'Guided wizard',
    description: 'Step-by-step · ~3 min',
    href: '/home',
  },
  {
    icon: <LayoutTemplateIcon size={14} />,
    name: 'From template',
    description: 'Kafka → ClickHouse, OTLP logs & more',
    disabled: true,
  },
  {
    icon: <NetworkIcon size={14} />,
    name: 'Visual canvas',
    description: 'Drag-and-connect · advanced',
    href: '/canvas',
  },
  {
    icon: <SparklesIcon size={14} />,
    name: 'Ask AI',
    description: 'Describe it · we draft for you',
    href: '/pipelines/create/ai',
  },
  {
    icon: <UploadIcon size={14} />,
    name: 'Import config',
    description: 'Paste YAML / JSON',
    href: '/home',
  },
  {
    icon: <FlaskConicalIcon size={14} />,
    name: 'Try with sample data',
    description: 'No setup · explore the UI',
    disabled: true,
  },
]

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
      <div className="empty-card">
        <div className="empty-mark" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 12h4l3-8 4 16 3-8h4" />
          </svg>
        </div>
        <h2>Let&apos;s set up your first pipeline</h2>
        <p>
          Pick the path that fits how you work. You can always switch — every path produces the same
          draft, which you&apos;ll review before deploying.
        </p>
        <div className="empty-paths">
          {PATHS.map((path) => <PathTile key={path.name} path={path} />)}
        </div>
        <div className="empty-foot">
          New to GlassFlow?{' '}
          <a href="#">Read the 5-minute intro</a>
          {' · '}
          <a href="#">Browse examples</a>
        </div>
      </div>
    </div>
  )
}
