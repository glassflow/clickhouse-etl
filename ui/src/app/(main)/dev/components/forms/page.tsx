'use client'

import { useState } from 'react'
import { Input } from '@/src/components/ui/input'
import { Textarea } from '@/src/components/ui/textarea'
import { Label } from '@/src/components/ui/label'
import { Checkbox } from '@/src/components/ui/checkbox'
import { Switch } from '@/src/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/src/components/ui/select'
import { Button } from '@/src/components/ui/button'
import { SearchableSelect } from '@/src/components/common/SearchableSelect'
import { DualSearchableSelect } from '@/src/components/common/DualSearchableSelect'
import { Section, VariantGrid, Preview, PageHeader, CodeBlock } from '../_components/Section'

const KAFKA_FIELDS = ['user_id', 'event_type', 'timestamp', 'session_id', 'device_id', 'ip_address', 'payload', 'correlation_id', 'tenant_id']
const CH_FIELDS = ['id', 'created_at', 'event_name', 'user_uuid', 'metadata', 'geo_country', 'platform', 'version']

export default function FormsPage() {
  const [checked, setChecked] = useState(false)
  const [switchOn, setSwitchOn] = useState(false)
  const [selected, setSelected] = useState('')
  const [singleSelected, setSingleSelected] = useState<string | undefined>()
  const [singleWithError, setSingleWithError] = useState<string | undefined>()
  const [dualSelected, setDualSelected] = useState<string | undefined>()
  const [dualWithError, setDualWithError] = useState<string | undefined>()

  return (
    <div>
      <PageHeader
        title="Forms"
        description="Form control primitives. Pass error={true} to show error state — never apply internal CSS classes directly."
      />

      <Section title="Input" description="Use error prop for validation; className for layout only">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="default-input">Default</Label>
              <Input id="default-input" placeholder="Enter value..." />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="disabled-input">Disabled</Label>
              <Input id="disabled-input" placeholder="Disabled" disabled />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="readonly-input">Read Only</Label>
              <Input id="readonly-input" value="read-only value" readOnly />
            </div>
          </div>
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="error-input" className="text-[var(--text-error)]">Error</Label>
              <Input id="error-input" placeholder="Invalid value" error />
              <p className="text-xs text-[var(--text-error)]">This field is required</p>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="with-value">With value</Label>
              <Input id="with-value" defaultValue="kafka-prod-cluster.example.com:9092" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="password-input">Password</Label>
              <Input id="password-input" type="password" defaultValue="secret" />
            </div>
          </div>
        </div>
        <CodeBlock code={`<div className="flex flex-col gap-1.5">
  <Label htmlFor="host">Bootstrap Servers</Label>
  <Input id="host" placeholder="host:9092" error={!!errors.host} />
  {errors.host && (
    <p className="text-xs text-[var(--text-error)]">{errors.host.message}</p>
  )}
</div>`} />
      </Section>

      <Section title="Textarea">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="default-ta">Default</Label>
            <Textarea id="default-ta" placeholder="Enter a description..." />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="error-ta" className="text-[var(--text-error)]">Error</Label>
            <Textarea id="error-ta" placeholder="Required field" error />
          </div>
        </div>
      </Section>

      <Section title="Select">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="flex flex-col gap-1.5">
            <Label>Default</Label>
            <Select value={selected} onValueChange={setSelected}>
              <SelectTrigger>
                <SelectValue placeholder="Select topic..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="events.raw">events.raw</SelectItem>
                <SelectItem value="events.dedup">events.dedup</SelectItem>
                <SelectItem value="events.clean">events.clean</SelectItem>
                <SelectItem value="events.enriched">events.enriched</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Small size</Label>
            <Select>
              <SelectTrigger size="sm">
                <SelectValue placeholder="Select..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="a">Option A</SelectItem>
                <SelectItem value="b">Option B</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Disabled</Label>
            <Select disabled>
              <SelectTrigger>
                <SelectValue placeholder="Not available" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="a">Option A</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <CodeBlock code={`<Select value={value} onValueChange={setValue}>
  <SelectTrigger>
    <SelectValue placeholder="Select topic..." />
  </SelectTrigger>
  <SelectContent>
    <SelectItem value="events.raw">events.raw</SelectItem>
  </SelectContent>
</Select>`} />
      </Section>

      <Section
        title="Searchable Select"
        description="Single-list select with real-time filtering. Supports controlled open state, error, label, disabled, and clearable."
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <div className="flex flex-col gap-1.5">
            <Label>Default</Label>
            <SearchableSelect
              availableOptions={KAFKA_FIELDS}
              selectedOption={singleSelected}
              onSelect={(v) => setSingleSelected(v ?? undefined)}
              placeholder="Select event field..."
              reserveErrorSpace={false}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>With label prop</Label>
            <SearchableSelect
              availableOptions={CH_FIELDS}
              selectedOption={undefined}
              onSelect={() => {}}
              label="ClickHouse column"
              placeholder="Select column..."
              reserveErrorSpace={false}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label className="text-[var(--text-error)]">Error state</Label>
            <SearchableSelect
              availableOptions={KAFKA_FIELDS}
              selectedOption={singleWithError}
              onSelect={(v) => setSingleWithError(v ?? undefined)}
              placeholder="Select event field..."
              error="This field is not nullable, enter a value"
              reserveErrorSpace
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label className="opacity-50">Disabled</Label>
            <SearchableSelect
              availableOptions={KAFKA_FIELDS}
              selectedOption={undefined}
              onSelect={() => {}}
              placeholder="Not available"
              disabled
              reserveErrorSpace={false}
            />
          </div>
        </div>
        <CodeBlock code={`// Uncontrolled (manages its own open state)
<SearchableSelect
  availableOptions={eventFields}
  selectedOption={column.eventField}
  onSelect={(option) => mapField(option ?? '')}
  placeholder="Select event field..."
  error={isRequired ? 'This field is not nullable' : ''}
  reserveErrorSpace={false}
/>

// Controlled (parent manages which row is open)
<SearchableSelect
  availableOptions={eventFields}
  selectedOption={column.eventField}
  onSelect={(option) => mapField(option ?? '')}
  open={openIndex === rowIndex}
  onOpenChange={(isOpen) => setOpenIndex(isOpen ? rowIndex : null)}
/>`} />
      </Section>

      <Section
        title="Dual Searchable Select"
        description="Split-panel select for join mappings — lets users pick from two topic field lists simultaneously. Dropdown is min 500px wide and rendered via portal."
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <div className="flex flex-col gap-1.5">
            <Label>Default (primary + secondary topics)</Label>
            <DualSearchableSelect
              primaryOptions={KAFKA_FIELDS}
              secondaryOptions={CH_FIELDS}
              selectedOption={dualSelected}
              onSelect={(v, _source) => setDualSelected(v ?? undefined)}
              placeholder="Select field from either topic..."
              primaryLabel="Left Topic"
              secondaryLabel="Right Topic"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label className="text-[var(--text-error)]">Error state</Label>
            <DualSearchableSelect
              primaryOptions={KAFKA_FIELDS}
              secondaryOptions={CH_FIELDS}
              selectedOption={dualWithError}
              onSelect={(v, _source) => setDualWithError(v ?? undefined)}
              placeholder="Select event field..."
              primaryLabel="orders_topic"
              secondaryLabel="customers_topic"
              error="This field is not nullable, enter a value"
            />
            {dualWithError === undefined && (
              <p className="text-sm text-[var(--text-error)] mt-1">This field is not nullable, enter a value</p>
            )}
          </div>
          <div className="flex flex-col gap-1.5">
            <Label className="opacity-50">Disabled</Label>
            <DualSearchableSelect
              primaryOptions={KAFKA_FIELDS}
              secondaryOptions={CH_FIELDS}
              selectedOption={undefined}
              onSelect={() => {}}
              placeholder="Not available"
              disabled
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Pre-selected value</Label>
            <DualSearchableSelect
              primaryOptions={KAFKA_FIELDS}
              secondaryOptions={CH_FIELDS}
              selectedOption="user_id"
              onSelect={() => {}}
              placeholder="Select field..."
              primaryLabel="orders_topic"
              secondaryLabel="customers_topic"
            />
          </div>
        </div>
        <CodeBlock code={`// Used in FieldColumnMapper when isJoinMapping === true
<DualSearchableSelect
  primaryOptions={primaryEventFields}
  secondaryOptions={secondaryEventFields}
  selectedOption={column.eventField}
  onSelect={(option, source) => mapEventFieldToColumn(index, option ?? '', source)}
  placeholder="Select event field"
  primaryLabel={primaryTopicName}
  secondaryLabel={secondaryTopicName}
  open={openSelectIndex === index}
  onOpenChange={(isOpen) => handleSelectOpen(index, isOpen)}
  error={isRequired ? 'This field is not nullable' : ''}
  disabled={readOnly}
/>`} />
      </Section>

      <Section title="Checkbox">
        <div className="flex flex-col gap-4 p-4 rounded-lg bg-[var(--surface-bg-sunken)] border border-[var(--surface-border)]">
          <div className="flex items-center gap-3">
            <Checkbox id="cb-default" />
            <Label htmlFor="cb-default">Unchecked (default)</Label>
          </div>
          <div className="flex items-center gap-3">
            <Checkbox id="cb-checked" checked={checked} onCheckedChange={(v) => setChecked(!!v)} />
            <Label htmlFor="cb-checked">
              {checked ? 'Checked — click to uncheck' : 'Click to check'}
            </Label>
          </div>
          <div className="flex items-center gap-3">
            <Checkbox id="cb-disabled" disabled />
            <Label htmlFor="cb-disabled" className="opacity-50">Disabled unchecked</Label>
          </div>
          <div className="flex items-center gap-3">
            <Checkbox id="cb-disabled-checked" disabled checked />
            <Label htmlFor="cb-disabled-checked" className="opacity-50">Disabled checked</Label>
          </div>
        </div>
        <CodeBlock code={`<div className="flex items-center gap-3">
  <Checkbox id="dedup" checked={enabled} onCheckedChange={setEnabled} />
  <Label htmlFor="dedup">Enable deduplication</Label>
</div>`} />
      </Section>

      <Section title="Switch">
        <div className="flex flex-col gap-4 p-4 rounded-lg bg-[var(--surface-bg-sunken)] border border-[var(--surface-border)]">
          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="sw-basic">Enable feature</Label>
              <p className="body-3 text-[var(--text-secondary)] mt-0.5">Toggle this setting on or off</p>
            </div>
            <Switch id="sw-basic" checked={switchOn} onCheckedChange={setSwitchOn} />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="sw-disabled" className="opacity-50">Disabled toggle</Label>
              <p className="body-3 text-[var(--text-secondary)] opacity-50 mt-0.5">Not available in this context</p>
            </div>
            <Switch id="sw-disabled" disabled />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="sw-on" className="opacity-50">Disabled (on)</Label>
            </div>
            <Switch id="sw-on" checked disabled />
          </div>
        </div>
        <CodeBlock code={`<div className="flex items-center justify-between">
  <Label htmlFor="dedup">Enable deduplication</Label>
  <Switch id="dedup" checked={enabled} onCheckedChange={setEnabled} />
</div>`} />
      </Section>

      <Section title="Label" description="Always use Label with form controls for accessibility">
        <div className="flex flex-wrap gap-6 p-4 rounded-lg bg-[var(--surface-bg-sunken)] border border-[var(--surface-border)]">
          <div className="flex flex-col gap-1.5">
            <Label>Default label</Label>
            <Input placeholder="Associated input" className="w-48" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label className="text-[var(--text-error)]">Error label</Label>
            <Input error placeholder="Error input" className="w-48" />
          </div>
        </div>
      </Section>

      <Section title="Control Tokens" description="Use these tokens for custom form elements not served by primitives">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {[
            { token: '--control-border', label: 'control-border', desc: 'Default border' },
            { token: '--control-border-hover', label: 'control-border-hover', desc: 'Hover border' },
            { token: '--control-border-focus', label: 'control-border-focus', desc: 'Focus border (orange)' },
            { token: '--control-border-error', label: 'control-border-error', desc: 'Error border (red)' },
            { token: '--control-bg', label: 'control-bg', desc: 'Input background' },
            { token: '--control-fg', label: 'control-fg', desc: 'Input text color' },
            { token: '--control-fg-placeholder', label: 'control-fg-placeholder', desc: 'Placeholder text' },
          ].map(({ token, label, desc }) => (
            <div
              key={token}
              className="flex items-center gap-3 rounded-lg border border-[var(--surface-border)] bg-[var(--surface-bg-sunken)] px-3 py-2.5"
            >
              <div
                className="w-3 h-3 rounded-sm shrink-0 border"
                style={{ backgroundColor: `var(${token})`, borderColor: `var(${token})` }}
              />
              <div>
                <p className="text-xs font-mono text-[var(--color-foreground-primary)]">{label}</p>
                <p className="text-xs text-[var(--text-secondary)]">{desc}</p>
              </div>
            </div>
          ))}
        </div>
        <CodeBlock code={`// Custom form element using control tokens:
className="border border-[var(--control-border)]
  hover:border-[var(--control-border-hover)]
  focus:border-[var(--control-border-focus)]
  focus:shadow-[var(--control-shadow-focus)]
  bg-[var(--control-bg)]
  text-[var(--control-fg)]
  placeholder:text-[var(--control-fg-placeholder)]"`} />
      </Section>
    </div>
  )
}
