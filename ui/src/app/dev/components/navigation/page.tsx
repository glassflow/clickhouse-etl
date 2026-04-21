'use client'

import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/src/components/ui/tabs'
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from '@/src/components/ui/accordion'
import { Badge } from '@/src/components/ui/badge'
import { Section, PageHeader, CodeBlock } from '../_components/Section'

export default function NavigationPage() {
  return (
    <div>
      <PageHeader
        title="Navigation"
        description="Tabs and accordion for organizing content into sections."
      />

      <Section title="Tabs" description="Use for switching between related views at the same level">
        <div className="flex flex-col gap-8">
          <div>
            <p className="text-xs text-[var(--text-secondary)] mb-3">Default</p>
            <Tabs defaultValue="overview">
              <TabsList>
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="events">Events</TabsTrigger>
                <TabsTrigger value="settings">Settings</TabsTrigger>
              </TabsList>
              <TabsContent value="overview" className="mt-4">
                <div className="rounded-lg border border-[var(--surface-border)] bg-[var(--surface-bg-sunken)] p-4">
                  <p className="title-6 text-[var(--text-primary)] mb-2">Pipeline Overview</p>
                  <p className="body-3 text-[var(--text-secondary)]">
                    View the current status, throughput metrics, and configuration summary for this pipeline.
                  </p>
                </div>
              </TabsContent>
              <TabsContent value="events" className="mt-4">
                <div className="rounded-lg border border-[var(--surface-border)] bg-[var(--surface-bg-sunken)] p-4">
                  <p className="title-6 text-[var(--text-primary)] mb-2">Event Stream</p>
                  <p className="body-3 text-[var(--text-secondary)]">
                    Real-time view of events flowing through the pipeline with filtering and search.
                  </p>
                </div>
              </TabsContent>
              <TabsContent value="settings" className="mt-4">
                <div className="rounded-lg border border-[var(--surface-border)] bg-[var(--surface-bg-sunken)] p-4">
                  <p className="title-6 text-[var(--text-primary)] mb-2">Pipeline Settings</p>
                  <p className="body-3 text-[var(--text-secondary)]">
                    Configure connection settings, deduplication rules, and transformation functions.
                  </p>
                </div>
              </TabsContent>
            </Tabs>
          </div>

          <div>
            <p className="text-xs text-[var(--text-secondary)] mb-3">With badges</p>
            <Tabs defaultValue="active">
              <TabsList>
                <TabsTrigger value="active" className="gap-2">
                  Active
                  <Badge variant="success" className="px-1.5 py-0 text-[10px]">3</Badge>
                </TabsTrigger>
                <TabsTrigger value="paused" className="gap-2">
                  Paused
                  <Badge variant="warning" className="px-1.5 py-0 text-[10px]">1</Badge>
                </TabsTrigger>
                <TabsTrigger value="failed" className="gap-2">
                  Failed
                  <Badge variant="error" className="px-1.5 py-0 text-[10px]">2</Badge>
                </TabsTrigger>
              </TabsList>
              <TabsContent value="active" className="mt-4">
                <p className="body-3 text-[var(--text-secondary)] p-4 rounded-lg bg-[var(--surface-bg-sunken)] border border-[var(--surface-border)]">
                  3 active pipelines shown here.
                </p>
              </TabsContent>
              <TabsContent value="paused" className="mt-4">
                <p className="body-3 text-[var(--text-secondary)] p-4 rounded-lg bg-[var(--surface-bg-sunken)] border border-[var(--surface-border)]">
                  1 paused pipeline shown here.
                </p>
              </TabsContent>
              <TabsContent value="failed" className="mt-4">
                <p className="body-3 text-[var(--text-secondary)] p-4 rounded-lg bg-[var(--surface-bg-sunken)] border border-[var(--surface-border)]">
                  2 failed pipelines shown here.
                </p>
              </TabsContent>
            </Tabs>
          </div>
        </div>
        <CodeBlock code={`<Tabs defaultValue="overview">
  <TabsList>
    <TabsTrigger value="overview">Overview</TabsTrigger>
    <TabsTrigger value="events">Events</TabsTrigger>
  </TabsList>
  <TabsContent value="overview">...</TabsContent>
  <TabsContent value="events">...</TabsContent>
</Tabs>`} />
      </Section>

      <Section title="Accordion" description="For progressive disclosure of related configuration groups">
        <div className="rounded-lg border border-[var(--surface-border)] bg-[var(--surface-bg-sunken)] divide-y divide-[var(--surface-border)]">
          <Accordion type="single" collapsible className="w-full px-4">
            <AccordionItem value="kafka">
              <AccordionTrigger className="title-6">
                Kafka Configuration
              </AccordionTrigger>
              <AccordionContent>
                <div className="flex flex-col gap-3 pb-2">
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <span className="text-[var(--text-secondary)]">Bootstrap Servers</span>
                    <span className="font-mono text-[var(--text-primary)]">kafka.prod:9092</span>
                    <span className="text-[var(--text-secondary)]">Consumer Group</span>
                    <span className="font-mono text-[var(--text-primary)]">glassflow-etl</span>
                    <span className="text-[var(--text-secondary)]">Topic</span>
                    <span className="font-mono text-[var(--text-primary)]">events.raw</span>
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="dedup">
              <AccordionTrigger className="title-6">
                Deduplication Settings
              </AccordionTrigger>
              <AccordionContent>
                <div className="flex flex-col gap-3 pb-2">
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <span className="text-[var(--text-secondary)]">Strategy</span>
                    <span className="font-mono text-[var(--text-primary)]">event_id</span>
                    <span className="text-[var(--text-secondary)]">Window</span>
                    <span className="font-mono text-[var(--text-primary)]">24h</span>
                    <span className="text-[var(--text-secondary)]">Storage</span>
                    <span className="font-mono text-[var(--text-primary)]">redis</span>
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="clickhouse">
              <AccordionTrigger className="title-6">
                ClickHouse Destination
              </AccordionTrigger>
              <AccordionContent>
                <div className="flex flex-col gap-3 pb-2">
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <span className="text-[var(--text-secondary)]">Host</span>
                    <span className="font-mono text-[var(--text-primary)]">ch.prod.cluster:8443</span>
                    <span className="text-[var(--text-secondary)]">Database</span>
                    <span className="font-mono text-[var(--text-primary)]">analytics</span>
                    <span className="text-[var(--text-secondary)]">Table</span>
                    <span className="font-mono text-[var(--text-primary)]">events</span>
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>

        <div className="mt-4 rounded-lg border border-[var(--surface-border)] bg-[var(--surface-bg-sunken)] divide-y divide-[var(--surface-border)]">
          <p className="text-xs text-[var(--text-secondary)] px-4 pt-3 pb-2 uppercase tracking-widest">type="multiple"</p>
          <Accordion type="multiple" className="w-full px-4">
            <AccordionItem value="a">
              <AccordionTrigger>Section A</AccordionTrigger>
              <AccordionContent>
                <p className="body-3 text-[var(--text-secondary)]">Multiple sections can be open simultaneously with type="multiple".</p>
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="b">
              <AccordionTrigger>Section B</AccordionTrigger>
              <AccordionContent>
                <p className="body-3 text-[var(--text-secondary)]">Both A and B can be expanded at the same time.</p>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>

        <CodeBlock code={`<Accordion type="single" collapsible>
  <AccordionItem value="kafka">
    <AccordionTrigger className="title-6">
      Kafka Configuration
    </AccordionTrigger>
    <AccordionContent>
      {/* content */}
    </AccordionContent>
  </AccordionItem>
</Accordion>`} />
      </Section>
    </div>
  )
}
