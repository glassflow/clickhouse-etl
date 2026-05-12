'use client'

import { XIcon, CheckIcon } from 'lucide-react'
import { Badge } from '@/src/components/ui/badge'
import { Button } from '@/src/components/ui/button'
import { Card } from '@/src/components/ui/card'
import { Section, PageHeader } from '../_components/Section'

// ─── Page ──────────────────────────────────────────────────────────────────────

export default function AntiPatternsPage() {
  return (
    <>
      <PageHeader
        title="Anti-patterns"
        description="Patterns the design-system lint rule blocks (Phase 5 enforcement, eslint.config.mjs). Every BAD example below is rejected by CI; the GOOD counterpart is the canonical fix."
      />

      <Section
        title="1. Hardcoded hex in style prop"
        description="Lint: no-restricted-syntax (style prop hex literal). Tokens are the only allowed source of color values."
      >
        <AntiPatternRow
          bad={`<div style={{ color: '#A8ADB8' }}>
  text
</div>`}
          good={`<div style={{ color: 'var(--color-foreground-neutral-faded)' }}>
  text
</div>`}
          live={<div style={{ color: 'var(--color-foreground-neutral-faded)' }}>text</div>}
        />
      </Section>

      <Section
        title="2. Inline rgba() in className arbitrary value"
        description="Lint: no-restricted-syntax (className rgba()). Alpha tokens (--color-red-alpha-10, etc.) cover the common cases."
      >
        <AntiPatternRow
          bad={`<div className="bg-[rgba(226,44,44,0.05)] hover:bg-[rgba(226,44,44,0.07)]">
  critical row
</div>`}
          good={`<div className="bg-[var(--color-red-alpha-5)] hover:bg-[var(--color-red-alpha-7)]">
  critical row
</div>`}
          live={
            <div className="bg-[var(--color-red-alpha-5)] hover:bg-[var(--color-red-alpha-7)] px-3 py-2 rounded">
              critical row
            </div>
          }
        />
      </Section>

      <Section
        title="3. Raw Tailwind semantic-color utility"
        description="Lint: no-restricted-syntax (className Tailwind color). Tailwind is allowed for layout/spacing/typography only — never for semantic color."
      >
        <AntiPatternRow
          bad={`<p className="text-red-500">
  Connection failed
</p>`}
          good={`<p className="text-[var(--color-foreground-critical)]">
  Connection failed
</p>`}
          live={<p className="text-[var(--color-foreground-critical)]">Connection failed</p>}
        />
      </Section>

      <Section
        title="4. Direct use of internal CSS class name"
        description="Lint: no-restricted-syntax (className internal class). Visual state is owned by primitive variant props. Internal classes (card-dark, card-outline, btn-primary, input-regular, modal-input-label…) are consumed by primitives in src/components/ui/** only."
      >
        <AntiPatternRow
          bad={`<div className="card-dark p-4 mt-6">
  content
</div>`}
          good={`<Card variant="dark" className="p-4 mt-6">
  content
</Card>`}
          live={
            <Card variant="dark" className="p-4 mt-6">
              content
            </Card>
          }
        />
        <AntiPatternRow
          bad={`<button className="btn-primary">
  Submit
</button>`}
          good={`<Button variant="primary">Submit</Button>`}
          live={<Button variant="primary">Submit</Button>}
        />
        <AntiPatternRow
          bad={`<label className="modal-input-label">Name</label>`}
          good={`<Label className="body-3 font-medium text-[var(--color-foreground-neutral-faded)]">
  Name
</Label>
{/* — or inside a Form context — */}
<FormItem>
  <FormLabel>Name</FormLabel>
  <FormControl><Input /></FormControl>
</FormItem>`}
        />
      </Section>

      <Section
        title="5. Status conveyed by raw className"
        description="Badge has typed variants for status. Hand-rolling status colors loses the variant contract and bypasses semantic tokens."
      >
        <AntiPatternRow
          bad={`<span className="bg-green-600 text-white px-2 rounded">
  active
</span>`}
          good={`<Badge variant="success">active</Badge>`}
          live={<Badge variant="success">active</Badge>}
        />
      </Section>

      <Section
        title="6. Visual anti-patterns — gradient text, zebra striping"
        description="Banned by craft rules (CLAUDE.md / design audit): gradient text degrades readability; zebra striping competes with row-level state tints used for triage."
      >
        <AntiPatternRow
          bad={`<h1 style={{
  background: 'linear-gradient(90deg, #ff8c00, #ff3050)',
  WebkitBackgroundClip: 'text',
  WebkitTextFillColor: 'transparent',
}}>
  Dashboard
</h1>`}
          good={`<h1 className="title-3 text-[var(--text-primary)]">Dashboard</h1>`}
          live={<h1 className="title-3 text-[var(--text-primary)]">Dashboard</h1>}
        />
        <AntiPatternRow
          bad={`<tr className={index % 2 === 0 ? 'bg-zinc-900' : 'bg-zinc-800'}>
  ...
</tr>`}
          good={`{/* No zebra. Use rowStatus on DataTable for triage tints. */}
<DataTable
  data={data}
  columns={columns}
  getRowId={(p) => p.id}
  rowStatus={(p) => p.health === 'failing' ? 'critical' : undefined}
/>`}
        />
      </Section>

      <Section
        title="7. Direct DialogOverlay style — no modal-overlay class"
        description="Modals must apply the .modal-overlay class so --overlay-bg / --overlay-backdrop-blur / --overlay-border tokens are wired. Never use inline style on DialogOverlay."
      >
        <AntiPatternRow
          bad={`<DialogOverlay style={{
  background: 'rgba(17, 25, 40, 0.25)',
  backdropFilter: 'blur(8px)',
}} />`}
          good={`<DialogOverlay className="!fixed !inset-0 modal-overlay" aria-hidden="true" />
<DialogContent className="info-modal-container surface-gradient-border border-0">
  …
</DialogContent>`}
        />
      </Section>

      <p className="body-3 text-[var(--text-secondary)] mt-12 max-w-2xl">
        See <code className="font-mono text-[var(--text-primary)]">eslint.config.mjs</code> for the exact{' '}
        <code className="font-mono text-[var(--text-primary)]">no-restricted-syntax</code> selectors and{' '}
        <code className="font-mono text-[var(--text-primary)]">CLAUDE.md</code> for the full styling rulebook.
      </p>
    </>
  )
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

interface AntiPatternRowProps {
  bad: string
  good: string
  live?: React.ReactNode
}

function AntiPatternRow({ bad, good, live }: AntiPatternRowProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-5">
      <BadCodeBlock code={bad} />
      <GoodCodeBlock code={good} live={live} />
    </div>
  )
}

function BadCodeBlock({ code }: { code: string }) {
  return (
    <div className="rounded-md border border-[var(--color-border-critical)] bg-[var(--color-red-alpha-5)] overflow-hidden">
      <div className="flex items-center gap-1.5 px-3 py-1.5 border-b border-[var(--color-border-critical)] bg-[var(--color-red-alpha-10)]">
        <XIcon size={12} className="text-[var(--color-foreground-critical)]" aria-hidden="true" />
        <span className="caption-1 font-mono uppercase tracking-wider text-[var(--color-foreground-critical)]">
          Banned
        </span>
      </div>
      <pre className="px-4 py-3 text-xs font-mono text-[var(--text-primary)] overflow-x-auto">
        <code>{code}</code>
      </pre>
    </div>
  )
}

function GoodCodeBlock({ code, live }: { code: string; live?: React.ReactNode }) {
  return (
    <div className="rounded-md border border-[var(--color-border-positive)] bg-[var(--color-background-positive-faded)]/30 overflow-hidden">
      <div className="flex items-center gap-1.5 px-3 py-1.5 border-b border-[var(--color-border-positive)] bg-[var(--color-background-positive-faded)]">
        <CheckIcon size={12} className="text-[var(--color-foreground-positive)]" aria-hidden="true" />
        <span className="caption-1 font-mono uppercase tracking-wider text-[var(--color-foreground-positive)]">
          Canonical
        </span>
      </div>
      <pre className="px-4 py-3 text-xs font-mono text-[var(--text-primary)] overflow-x-auto">
        <code>{code}</code>
      </pre>
      {live && (
        <div className="px-4 py-3 border-t border-[var(--color-border-positive)] bg-[var(--surface-bg-sunken)] flex items-center gap-3">
          <span className="caption-1 font-mono uppercase tracking-wider text-[var(--text-tertiary)] shrink-0">
            Live
          </span>
          <div className="flex items-center">{live}</div>
        </div>
      )}
    </div>
  )
}
