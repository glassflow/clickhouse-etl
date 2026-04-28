'use client'

import { useState } from 'react'
import { PlusIcon, TrashIcon, ArrowRightIcon, SettingsIcon } from 'lucide-react'
import { Button } from '@/src/components/ui/button'
import { Section, VariantGrid, Preview, PageHeader, CodeBlock } from '../_components/Section'

export default function ButtonsPage() {
  const [loading, setLoading] = useState(false)

  function simulateLoad() {
    setLoading(true)
    setTimeout(() => setLoading(false), 2000)
  }

  return (
    <div>
      <PageHeader
        title="Buttons"
        description="All button variants, sizes, and states. Use variant prop for visual intent; className only for layout."
      />

      <Section title="Variants" description="Choose the variant that matches the action's importance">
        <VariantGrid columns={3}>
          <Preview label="primary">
            <Button variant="primary">Primary</Button>
          </Preview>
          <Preview label="secondary">
            <Button variant="secondary">Secondary</Button>
          </Preview>
          <Preview label="tertiary">
            <Button variant="tertiary">Tertiary</Button>
          </Preview>
          <Preview label="ghostOutline">
            <Button variant="ghostOutline">Ghost Outline</Button>
          </Preview>
          <Preview label="ghost">
            <Button variant="ghost">Ghost</Button>
          </Preview>
          <Preview label="destructive">
            <Button variant="destructive">Destructive</Button>
          </Preview>
          <Preview label="default">
            <Button variant="default">Default</Button>
          </Preview>
          <Preview label="link">
            <Button variant="link">Link</Button>
          </Preview>
          <Preview label="gradient">
            <Button variant="gradient">Gradient</Button>
          </Preview>
        </VariantGrid>
        <CodeBlock code={`<Button variant="primary">Primary</Button>
<Button variant="secondary">Secondary</Button>
<Button variant="destructive">Delete</Button>
<Button variant="ghostOutline">Cancel</Button>`} />
      </Section>

      <Section title="Card Buttons" description="Full-width card-style selectors — used in pipeline creation">
        <VariantGrid columns={2}>
          <Preview label="card" center={false}>
            <Button variant="card" className="w-full h-24 flex-col gap-2">
              <PlusIcon className="size-5" />
              <span>Card Button</span>
            </Button>
          </Preview>
          <Preview label="cardSecondary" center={false}>
            <Button variant="cardSecondary" className="w-full h-24 flex-col gap-2">
              <SettingsIcon className="size-5" />
              <span>Card Secondary</span>
            </Button>
          </Preview>
        </VariantGrid>
      </Section>

      <Section title="Sizes" description="Use size prop to match surrounding UI density">
        <div className="flex flex-wrap items-center gap-3">
          <Preview label="sm">
            <Button variant="primary" size="sm">Small</Button>
          </Preview>
          <Preview label="default">
            <Button variant="primary" size="default">Default</Button>
          </Preview>
          <Preview label="lg">
            <Button variant="primary" size="lg">Large</Button>
          </Preview>
          <Preview label="icon">
            <Button variant="ghostOutline" size="icon">
              <PlusIcon />
            </Button>
          </Preview>
          <Preview label="text">
            <Button variant="ghost" size="text">Text size</Button>
          </Preview>
        </div>
        <CodeBlock code={`<Button size="sm">Small</Button>
<Button size="default">Default</Button>
<Button size="lg">Large</Button>
<Button size="icon"><PlusIcon /></Button>`} />
      </Section>

      <Section title="With Icons">
        <VariantGrid columns={3}>
          <Preview label="leading icon">
            <Button variant="primary">
              <PlusIcon />
              Add Pipeline
            </Button>
          </Preview>
          <Preview label="trailing icon">
            <Button variant="secondary">
              Continue
              <ArrowRightIcon />
            </Button>
          </Preview>
          <Preview label="icon only">
            <Button variant="ghostOutline" size="icon">
              <TrashIcon />
            </Button>
          </Preview>
        </VariantGrid>
      </Section>

      <Section title="States" description="disabled and loading states across variants">
        <VariantGrid columns={3}>
          <Preview label="primary disabled">
            <Button variant="primary" disabled>Disabled</Button>
          </Preview>
          <Preview label="secondary disabled">
            <Button variant="secondary" disabled>Disabled</Button>
          </Preview>
          <Preview label="ghostOutline disabled">
            <Button variant="ghostOutline" disabled>Disabled</Button>
          </Preview>
        </VariantGrid>

        <div className="mt-4 flex items-center gap-4">
          <Button variant="primary" loading={loading} loadingText="Processing..." onClick={simulateLoad}>
            {loading ? 'Processing...' : 'Trigger Loading'}
          </Button>
          <p className="body-3 text-[var(--text-secondary)]">Click to simulate 2s load state</p>
        </div>
        <CodeBlock code={`<Button variant="primary" loading={isPending} loadingText="Saving...">
  Save
</Button>

<Button variant="secondary" disabled>
  Disabled
</Button>`} />
      </Section>
    </div>
  )
}
