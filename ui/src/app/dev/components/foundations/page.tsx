'use client'

import { Section, PageHeader, Preview } from '../_components/Section'

const typographyItems = [
  { class: 'title-1', label: 'title-1', sample: 'The quick brown fox' },
  { class: 'title-2', label: 'title-2', sample: 'The quick brown fox' },
  { class: 'title-3', label: 'title-3', sample: 'The quick brown fox' },
  { class: 'title-4', label: 'title-4', sample: 'The quick brown fox jumps' },
  { class: 'title-5', label: 'title-5', sample: 'The quick brown fox jumps over' },
  { class: 'title-6', label: 'title-6', sample: 'The quick brown fox jumps over the lazy dog' },
]

const bodyItems = [
  { class: 'body-1', label: 'body-1', sample: 'The quick brown fox jumps over the lazy dog' },
  { class: 'body-2', label: 'body-2', sample: 'The quick brown fox jumps over the lazy dog' },
  { class: 'body-3', label: 'body-3', sample: 'The quick brown fox jumps over the lazy dog' },
]

const utilityItems = [
  { class: 'subtitle', label: 'subtitle', sample: 'Section subtitle' },
  { class: 'subtitle-2', label: 'subtitle-2', sample: 'Section subtitle variant' },
  { class: 'subtitle-3', label: 'subtitle-3', sample: 'Section subtitle muted' },
  { class: 'text-content', label: 'text-content', sample: 'Primary body content text' },
  { class: 'text-content-faded', label: 'text-content-faded', sample: 'Secondary faded content text' },
  { class: 'text-normal-accent', label: 'text-normal-accent', sample: 'Accent highlighted text' },
  { class: 'text-brand-gradient', label: 'text-brand-gradient', sample: 'Brand gradient text effect' },
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
]

const textTokens = [
  { token: '--text-primary', label: 'text-primary' },
  { token: '--text-secondary', label: 'text-secondary' },
  { token: '--text-accent', label: 'text-accent' },
  { token: '--text-link', label: 'text-link' },
  { token: '--text-error', label: 'text-error' },
  { token: '--text-success', label: 'text-success' },
  { token: '--text-warning', label: 'text-warning' },
]

export default function FoundationsPage() {
  return (
    <div>
      <PageHeader
        title="Foundations"
        description="Core design tokens: typography scale, semantic colors, surfaces, and text tokens."
      />

      <Section title="Title Scale" description="Archivo font — headings and card labels">
        <div className="space-y-3">
          {typographyItems.map(({ class: cls, label, sample }) => (
            <div
              key={label}
              className="flex items-baseline gap-6 rounded-lg border border-[var(--surface-border)] bg-[var(--surface-bg-sunken)] px-4 py-3"
            >
              <span
                className="shrink-0 w-20 text-xs font-mono text-[var(--color-foreground-primary)] text-right"
              >
                {label}
              </span>
              <span className={cls}>{sample}</span>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Body Scale" description="Inter font — UI text, form fields, body copy">
        <div className="space-y-3">
          {bodyItems.map(({ class: cls, label, sample }) => (
            <div
              key={label}
              className="flex items-baseline gap-6 rounded-lg border border-[var(--surface-border)] bg-[var(--surface-bg-sunken)] px-4 py-3"
            >
              <span className="shrink-0 w-20 text-xs font-mono text-[var(--color-foreground-primary)] text-right">
                {label}
              </span>
              <span className={cls}>{sample}</span>
            </div>
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

      <Section title="Surface Tokens" description="Container and elevation backgrounds">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {surfaceTokens.map(({ token, label, description }) => (
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
      </Section>

      <Section title="Text Tokens" description="Semantic text color tokens">
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
