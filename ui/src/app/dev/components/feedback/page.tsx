'use client'

import { useState } from 'react'
import { AlertTriangleIcon, InfoIcon, CheckCircleIcon, XCircleIcon } from 'lucide-react'
import { Alert, AlertTitle, AlertDescription } from '@/src/components/ui/alert'
import { Button } from '@/src/components/ui/button'
import { toast } from 'sonner'
import { Section, Preview, PageHeader, CodeBlock } from '../_components/Section'

export default function FeedbackPage() {
  const [visible, setVisible] = useState<Record<string, boolean>>({})

  function toggle(key: string) {
    setVisible((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  return (
    <div>
      <PageHeader
        title="Feedback"
        description="Alert components, toast notifications, and animation utility classes."
      />

      <Section title="Alert" description="For inline status messages — default uses the page background">
        <div className="flex flex-col gap-3">
          <Alert>
            <InfoIcon />
            <AlertTitle>Default Alert</AlertTitle>
            <AlertDescription>
              Pipeline configuration has been saved. Changes will take effect on the next restart.
            </AlertDescription>
          </Alert>

          <Alert variant="destructive" className="border-[var(--color-border-critical)] bg-[var(--color-background-critical-faded)]">
            <XCircleIcon />
            <AlertTitle>Destructive Alert</AlertTitle>
            <AlertDescription>
              Failed to connect to Kafka broker. Verify the bootstrap servers and try again.
            </AlertDescription>
          </Alert>

          <Alert className="border-[var(--color-border-warning-faded)] bg-[var(--color-background-warning-faded)]">
            <AlertTriangleIcon className="text-[var(--color-foreground-warning)]" />
            <AlertTitle className="text-[var(--color-foreground-warning)]">Warning</AlertTitle>
            <AlertDescription className="text-[var(--color-foreground-warning-faded)]">
              Consumer lag has exceeded 10,000 messages. Check ClickHouse write throughput.
            </AlertDescription>
          </Alert>

          <Alert className="border-[var(--color-border-positive-faded)] bg-[var(--color-background-positive-faded)]">
            <CheckCircleIcon className="text-[var(--color-foreground-positive)]" />
            <AlertTitle className="text-[var(--color-foreground-positive)]">Success</AlertTitle>
            <AlertDescription className="text-[var(--color-foreground-positive-faded)]">
              Pipeline is running and processing events at 12,400 events/sec.
            </AlertDescription>
          </Alert>
        </div>
        <CodeBlock code={`// default
<Alert>
  <InfoIcon />
  <AlertTitle>Title</AlertTitle>
  <AlertDescription>Message</AlertDescription>
</Alert>

// destructive (use destructive variant + token classes)
<Alert
  variant="destructive"
  className="border-[var(--color-border-critical)] bg-[var(--color-background-critical-faded)]"
>
  <XCircleIcon />
  <AlertTitle>Error</AlertTitle>
  <AlertDescription>Details</AlertDescription>
</Alert>`} />
      </Section>

      <Section title="Toast (Sonner)" description="Triggered imperatively — use toast() from 'sonner'">
        <div className="flex flex-wrap gap-3 p-4 rounded-lg bg-[var(--surface-bg-sunken)] border border-[var(--surface-border)]">
          <Button variant="secondary" onClick={() => toast('Pipeline saved successfully')}>
            Default toast
          </Button>
          <Button variant="secondary" onClick={() => toast.success('Pipeline is now active')}>
            Success toast
          </Button>
          <Button variant="secondary" onClick={() => toast.error('Connection failed')}>
            Error toast
          </Button>
          <Button variant="secondary" onClick={() => toast.warning('Consumer lag detected')}>
            Warning toast
          </Button>
          <Button
            variant="secondary"
            onClick={() =>
              toast.info('Processing events', {
                description: 'Your pipeline is ingesting at 12,400 events/sec.',
              })
            }
          >
            Info with description
          </Button>
          <Button
            variant="secondary"
            onClick={() => {
              const id = toast.loading('Connecting to Kafka...')
              setTimeout(() => toast.success('Connected!', { id }), 2000)
            }}
          >
            Loading → success
          </Button>
        </div>
        <CodeBlock code={`import { toast } from 'sonner'

toast('Saved')
toast.success('Pipeline active')
toast.error('Connection failed')
toast.warning('High consumer lag')
toast.info('Processing...', { description: 'Details here' })

// Loading state
const id = toast.loading('Connecting...')
toast.success('Connected!', { id })`} />
      </Section>

      <Section title="Animations" description="CSS animation utility classes from animations.css">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {[
            { cls: 'animate-fadeIn', label: 'animate-fadeIn', desc: 'Fade + translate up' },
            { cls: 'animate-slideDown', label: 'animate-slideDown', desc: 'Slide from top' },
            { cls: 'animate-slideDownFade', label: 'animate-slideDownFade', desc: 'Diagonal entrance' },
            { cls: 'animate-pulse', label: 'animate-pulse', desc: 'Opacity pulse (1.5s)' },
            { cls: 'animate-slideUpFade', label: 'animate-slideUpFade', desc: 'Slide up from bottom' },
            { cls: 'animate-fade-in-up', label: 'animate-fade-in-up', desc: 'Fade in from below' },
            { cls: 'animate-slideInFromRight', label: 'animate-slideInFromRight', desc: 'Slide from right' },
          ].map(({ cls, label, desc }) => (
            <div
              key={cls}
              className="flex flex-col gap-2 rounded-lg border border-[var(--surface-border)] bg-[var(--surface-bg-sunken)] p-3"
            >
              <Button
                variant="ghostOutline"
                size="sm"
                className="w-full"
                onClick={() => toggle(cls)}
              >
                {visible[cls] ? 'Reset' : 'Play'}
              </Button>
              {visible[cls] && (
                <div
                  key={Date.now()}
                  className={`${cls} h-8 rounded bg-[var(--color-background-primary-faded)] border border-[var(--color-border-primary-faded)]`}
                />
              )}
              <div>
                <p className="text-xs font-mono text-[var(--color-foreground-primary)]">.{label}</p>
                <p className="text-xs text-[var(--text-secondary)] mt-0.5">{desc}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-4">
          <p className="text-xs text-[var(--text-secondary)] mb-3 uppercase tracking-widest">Animation delay utilities</p>
          <div className="flex flex-wrap gap-3 p-4 rounded-lg bg-[var(--surface-bg-sunken)] border border-[var(--surface-border)]">
            {[100, 200, 300, 400].map((ms) => (
              <div key={ms} className="flex flex-col items-center gap-2">
                <div
                  className={`animate-fadeIn animate-delay-${ms} w-8 h-8 rounded-md bg-[var(--color-background-primary-faded)] border border-[var(--color-border-primary-faded)]`}
                />
                <span className="text-xs font-mono text-[var(--text-secondary)]">delay-{ms}</span>
              </div>
            ))}
          </div>
        </div>

        <CodeBlock code={`// Single animation
<div className="animate-fadeIn">Content</div>

// With delay for staggered entrance
<div className="animate-fadeIn animate-delay-100">First</div>
<div className="animate-fadeIn animate-delay-200">Second</div>
<div className="animate-fadeIn animate-delay-300">Third</div>

// Smooth expand/collapse (requires JS toggle)
<div className={\`smooth-expand \${isOpen ? 'expanded' : 'collapsed'}\`}>
  Expandable content
</div>`} />
      </Section>

      <Section title="Chip States" description="Pipeline status chip tokens — use className with CSS token classes">
        <div className="flex flex-wrap gap-3 p-4 rounded-lg bg-[var(--surface-bg-sunken)] border border-[var(--surface-border)]">
          {[
            { label: 'Active', className: 'chip-active' },
            { label: 'Paused', className: 'chip-paused' },
            { label: 'Stopped', className: 'chip-stopped' },
            { label: 'Failed', className: 'chip-failed' },
          ].map(({ label, className: cls }) => (
            <div key={label} className="flex flex-col items-center gap-1.5">
              <span className={`chip ${cls}`}>{label}</span>
              <span className="text-xs font-mono text-[var(--text-secondary)]">.{cls}</span>
            </div>
          ))}
        </div>
      </Section>
    </div>
  )
}
