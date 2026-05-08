'use client'

import { Section, PageHeader } from '../_components/Section'

const typographyItems = [
  { class: 'title-1', label: 'title-1', sample: 'The quick brown fox' },
  { class: 'title-2', label: 'title-2', sample: 'The quick brown fox' },
  { class: 'title-3', label: 'title-3', sample: 'The quick brown fox' },
  { class: 'title-4', label: 'title-4', sample: 'The quick brown fox jumps' },
  { class: 'title-5', label: 'title-5', sample: 'The quick brown fox jumps over' },
  { class: 'title-6', label: 'title-6', sample: 'The quick brown fox jumps over the lazy dog' },
]

const featuredItems = [
  { class: 'featured-1', label: 'featured-1', sample: 'Featured display one' },
  { class: 'featured-2', label: 'featured-2', sample: 'Featured display two' },
  { class: 'featured-3', label: 'featured-3', sample: 'Featured display three — modal titles' },
]

const bodyItems = [
  { class: 'body-1', label: 'body-1', sample: 'The quick brown fox jumps over the lazy dog' },
  { class: 'body-2', label: 'body-2', sample: 'The quick brown fox jumps over the lazy dog' },
  { class: 'body-3', label: 'body-3', sample: 'The quick brown fox jumps over the lazy dog' },
]

const captionItems = [
  { class: 'caption-1', label: 'caption-1', sample: 'Timestamp label · 2026-05-08 14:32' },
  { class: 'caption-2', label: 'caption-2', sample: 'Badge micro-copy · status indicator' },
]

const monoItems = [
  { class: 'mono-1', label: 'mono-1', sample: 'etl-prod-kafka-abc123' },
  { class: 'mono-2', label: 'mono-2', sample: '2026-05-08T14:32:01Z' },
  { class: 'mono-3', label: 'mono-3', sample: 'SELECT * FROM events LIMIT 100' },
]

const utilityItems = [
  { class: 'subtitle', label: 'subtitle', sample: 'Section subtitle' },
  { class: 'subtitle-2', label: 'subtitle-2', sample: 'Section subtitle variant' },
  { class: 'subtitle-3', label: 'subtitle-3', sample: 'Section subtitle muted' },
  { class: 'text-content', label: 'text-content', sample: 'Primary body content text' },
  { class: 'text-content-faded', label: 'text-content-faded', sample: 'Secondary faded content text' },
  { class: 'text-normal-accent', label: 'text-normal-accent', sample: 'Accent highlighted text' },
]

const semanticColors = [
  { token: '--color-foreground-primary', label: 'Primary', bg: '--color-background-primary-faded' },
  { token: '--color-foreground-positive', label: 'Positive', bg: '--color-background-positive-faded' },
  { token: '--color-foreground-critical', label: 'Critical', bg: '--color-background-critical-faded' },
  { token: '--color-foreground-warning', label: 'Warning', bg: '--color-background-warning-faded' },
  { token: '--color-foreground-neutral', label: 'Neutral', bg: '--color-background-neutral' },
  { token: '--color-foreground-neutral-faded', label: 'Neutral Faded', bg: '--color-background-neutral-faded' },
  { token: '--color-foreground-info', label: 'Info', bg: '--color-background-info-faded' },
  { token: '--color-foreground-disabled', label: 'Disabled', bg: '--color-background-disabled' },
]

const surfaceTokens = [
  { token: '--surface-bg', label: 'surface-bg', description: 'Base surface' },
  { token: '--surface-bg-raised', label: 'surface-bg-raised', description: 'Raised surface' },
  { token: '--surface-bg-overlay', label: 'surface-bg-overlay', description: 'Overlay surface' },
  { token: '--surface-bg-sunken', label: 'surface-bg-sunken', description: 'Sunken / inset areas' },
  { token: '--surface-border', label: 'surface-border', description: 'Primary container border' },
  { token: '--surface-border-subtle', label: 'surface-border-subtle', description: 'Lower-contrast nested border' },
  { token: '--surface-fg', label: 'surface-fg', description: 'Surface foreground text' },
  { token: '--surface-fg-muted', label: 'surface-fg-muted', description: 'Muted surface foreground' },
  { token: '--surface-shadow', label: 'surface-shadow', description: 'Standard container shadow' },
  { token: '--surface-shadow-overlay', label: 'surface-shadow-overlay', description: 'Elevated overlay shadow' },
]

const textTokens = [
  { token: '--text-primary', label: 'text-primary' },
  { token: '--text-secondary', label: 'text-secondary' },
  { token: '--text-heading', label: 'text-heading' },
  { token: '--text-accent', label: 'text-accent' },
  { token: '--text-link', label: 'text-link' },
  { token: '--text-link-hover', label: 'text-link-hover' },
  { token: '--text-error', label: 'text-error' },
  { token: '--text-success', label: 'text-success' },
  { token: '--text-warning', label: 'text-warning' },
  { token: '--text-inverse', label: 'text-inverse' },
  { token: '--text-disabled', label: 'text-disabled' },
]

const optionTokens = [
  { token: '--option-bg', label: 'option-bg', description: 'Default item background' },
  { token: '--option-bg-hover', label: 'option-bg-hover', description: 'Hovered item background' },
  { token: '--option-bg-selected', label: 'option-bg-selected', description: 'Selected item background' },
  { token: '--option-bg-highlighted', label: 'option-bg-highlighted', description: 'Keyboard-focused item' },
  { token: '--option-fg-selected', label: 'option-fg-selected', description: 'Selected item text color' },
  { token: '--option-fg-disabled', label: 'option-fg-disabled', description: 'Disabled item text color' },
]

const shadowTokens = [
  { token: '--shadow-raised', label: 'shadow-raised', description: 'Cards, popovers' },
  { token: '--shadow-overlay', label: 'shadow-overlay', description: 'Dialogs, drawers' },
  { token: '--shadow-pressed', label: 'shadow-pressed', description: 'Pressed / active state' },
  { token: '--shadow-neutral', label: 'shadow-neutral', description: 'Subtle separation' },
]

const zIndexTokens = [
  { token: '--z-index-dropdown', value: '1000', description: 'Dropdown menus' },
  { token: '--z-index-sticky', value: '1020', description: 'Sticky headers' },
  { token: '--z-index-fixed', value: '1030', description: 'Fixed elements' },
  { token: '--z-index-overlay', value: '1040', description: 'Modal backdrops' },
  { token: '--z-index-modal', value: '1050', description: 'Modal dialogs' },
  { token: '--z-index-tooltip', value: '1060', description: 'Tooltips' },
]

function ScaleRow({ cls, label, sample }: { cls: string; label: string; sample: string }) {
  return (
    <div className="flex items-baseline gap-6 rounded-lg border border-[var(--surface-border)] bg-[var(--surface-bg-sunken)] px-4 py-3">
      <span className="shrink-0 w-24 text-xs font-mono text-[var(--color-foreground-primary)] text-right">
        {label}
      </span>
      <span className={cls}>{sample}</span>
    </div>
  )
}

export default function FoundationsPage() {
  return (
    <div>
      <PageHeader
        title="Foundations"
        description="Core design tokens: typography scales, semantic colors, surfaces, option system, shadows, and z-index."
      />

      <Section title="Title Scale" description="Archivo font — headings and card labels">
        <div className="space-y-3">
          {typographyItems.map((item) => (
            <ScaleRow key={item.label} cls={item.class} label={item.label} sample={item.sample} />
          ))}
        </div>
      </Section>

      <Section title="Featured Scale" description="Archivo font — modal titles, hero numbers, prominent callout text">
        <div className="space-y-3">
          {featuredItems.map((item) => (
            <ScaleRow key={item.label} cls={item.class} label={item.label} sample={item.sample} />
          ))}
        </div>
      </Section>

      <Section title="Body Scale" description="Inter font — UI text, form fields, body copy">
        <div className="space-y-3">
          {bodyItems.map((item) => (
            <ScaleRow key={item.label} cls={item.class} label={item.label} sample={item.sample} />
          ))}
        </div>
      </Section>

      <Section title="Caption Scale" description="Inter font — labels, timestamps, micro-copy below inputs">
        <div className="space-y-3">
          {captionItems.map((item) => (
            <ScaleRow key={item.label} cls={item.class} label={item.label} sample={item.sample} />
          ))}
        </div>
      </Section>

      <Section title="Mono Scale" description="JetBrains Mono — IDs, timestamps, axis labels, code snippets. Use .mono-* not raw font-mono.">
        <div className="space-y-3">
          {monoItems.map((item) => (
            <ScaleRow key={item.label} cls={item.class} label={item.label} sample={item.sample} />
          ))}
        </div>
      </Section>

      <Section title="Utility Typography" description="Pre-built semantic text styles">
        <div className="space-y-3">
          {utilityItems.map(({ class: cls, label, sample }) => (
            <div
              key={label}
              className="flex items-center gap-6 rounded-lg border border-[var(--surface-border)] bg-[var(--surface-bg-sunken)] px-4 py-3"
            >
              <span className="shrink-0 w-36 text-xs font-mono text-[var(--color-foreground-primary)]">
                .{label}
              </span>
              <span className={cls}>{sample}</span>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Semantic Colors" description="Intent-driven foreground + background token pairs">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {semanticColors.map(({ token, label, bg }) => (
            <div
              key={token}
              className="rounded-lg overflow-hidden border border-[var(--surface-border)]"
            >
              <div
                className="h-10 w-full"
                style={{ backgroundColor: `var(${bg})` }}
              />
              <div className="px-3 py-2 bg-[var(--surface-bg-sunken)]">
                <p className="text-xs font-medium" style={{ color: `var(${token})` }}>
                  {label}
                </p>
                <p className="text-xs text-[var(--text-secondary)] font-mono mt-0.5 truncate">{token}</p>
              </div>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Surface Tokens" description="All 10 surface tokens — container backgrounds, borders, shadows">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {surfaceTokens.slice(0, 4).map(({ token, label, description }) => (
            <div
              key={token}
              className="rounded-lg overflow-hidden border border-[var(--surface-border)]"
            >
              <div
                className="h-14 w-full border-b border-[var(--surface-border)]"
                style={{ backgroundColor: `var(${token})` }}
              />
              <div className="px-3 py-2 bg-[var(--surface-bg-sunken)]">
                <p className="text-xs font-mono text-[var(--color-foreground-primary)]">{label}</p>
                <p className="text-xs text-[var(--text-secondary)] mt-0.5">{description}</p>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
          {surfaceTokens.slice(4).map(({ token, label, description }) => (
            <div
              key={token}
              className="flex items-center gap-3 rounded-lg border border-[var(--surface-border)] bg-[var(--surface-bg-sunken)] px-4 py-2.5"
            >
              <span className="text-xs font-mono text-[var(--color-foreground-primary)] w-44 shrink-0">{token}</span>
              <span className="text-xs text-[var(--text-secondary)]">{description}</span>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Text Tokens" description="11 semantic text color tokens — use these not raw Tailwind text-* colors">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {textTokens.map(({ token, label }) => (
            <div
              key={token}
              className="flex items-center gap-4 rounded-lg border border-[var(--surface-border)] bg-[var(--surface-bg-sunken)] px-4 py-2.5"
            >
              <div
                className="w-3 h-3 rounded-full shrink-0 border border-[var(--surface-border)]"
                style={{ backgroundColor: `var(${token})` }}
              />
              <span
                className="body-3 font-medium"
                style={{ color: `var(${token})` }}
              >
                {label}
              </span>
              <span className="text-xs text-[var(--text-secondary)] font-mono ml-auto">{token}</span>
            </div>
          ))}
        </div>
      </Section>

      <Section
        title="Option Tokens"
        description="Hover, selected, and highlighted states for list items, dropdowns, and comboboxes. Never implement these ad hoc."
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {optionTokens.map(({ token, label, description }) => (
            <div
              key={token}
              className="flex items-center gap-3 rounded-lg border border-[var(--surface-border)] bg-[var(--surface-bg-sunken)] px-4 py-2.5"
            >
              <div
                className="w-8 h-8 rounded shrink-0 border border-[var(--surface-border)]"
                style={{ backgroundColor: `var(${token})` }}
              />
              <div>
                <p className="text-xs font-mono text-[var(--color-foreground-primary)]">{label}</p>
                <p className="text-xs text-[var(--text-secondary)] mt-0.5">{description}</p>
              </div>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Shadow Tokens" description="Four elevation levels — applied via box-shadow">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {shadowTokens.map(({ token, label, description }) => (
            <div key={token} className="flex flex-col items-center gap-3">
              <div
                className="w-full h-16 rounded-lg bg-[var(--surface-bg-raised)]"
                style={{ boxShadow: `var(${token})` }}
              />
              <div className="text-center">
                <p className="text-xs font-mono text-[var(--color-foreground-primary)]">{label}</p>
                <p className="text-xs text-[var(--text-secondary)] mt-0.5">{description}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-4">
          <p className="text-xs text-[var(--text-secondary)] mb-3 uppercase tracking-widest">Z-index tokens (reference)</p>
          <div className="rounded-lg border border-[var(--surface-border)] overflow-hidden">
            {zIndexTokens.map(({ token, value, description }, i) => (
              <div
                key={token}
                className={`flex items-center gap-4 px-4 py-2.5 ${i < zIndexTokens.length - 1 ? 'border-b border-[var(--surface-border)]' : ''}`}
              >
                <span className="text-xs font-mono text-[var(--color-foreground-primary)] w-40 shrink-0">{token}</span>
                <span className="text-xs font-mono text-[var(--text-secondary)] w-12 shrink-0">{value}</span>
                <span className="text-xs text-[var(--text-secondary)]">{description}</span>
              </div>
            ))}
          </div>
        </div>
      </Section>

      <Section title="Border Radius Scale">
        <div className="flex flex-wrap gap-4 items-end">
          {[
            { label: 'xs', value: 'var(--radius-xs)' },
            { label: 'sm', value: 'var(--radius-sm)' },
            { label: 'md', value: 'var(--radius-md)' },
            { label: 'lg', value: 'var(--radius-lg)' },
            { label: 'xl', value: 'var(--radius-xl)' },
            { label: '2xl', value: 'var(--radius-2xl)' },
            { label: '3xl', value: 'var(--radius-3xl)' },
            { label: '4xl', value: 'var(--radius-4xl)' },
            { label: 'full', value: 'var(--radius-full)' },
          ].map(({ label, value }) => (
            <div key={label} className="flex flex-col items-center gap-2">
              <div
                className="w-12 h-12 bg-[var(--color-background-primary-faded)] border border-[var(--color-border-primary-faded)]"
                style={{ borderRadius: value }}
              />
              <span className="text-xs font-mono text-[var(--text-secondary)]">{label}</span>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Spacing Scale" description="4px base unit — x1 through x10">
        <div className="flex flex-wrap gap-4 items-end">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
            <div key={n} className="flex flex-col items-center gap-2">
              <div
                className="bg-[var(--color-background-primary-faded)] border border-[var(--color-border-primary-faded)]"
                style={{
                  width: `var(--unit-x${n})`,
                  height: `var(--unit-x${n})`,
                  minWidth: `var(--unit-x${n})`,
                  minHeight: `var(--unit-x${n})`,
                }}
              />
              <span className="text-xs font-mono text-[var(--text-secondary)]">x{n}</span>
              <span className="text-xs text-[var(--text-secondary)]">{n * 4}px</span>
            </div>
          ))}
        </div>
      </Section>
    </div>
  )
}
