'use client'

import { Badge } from '@/src/components/ui/badge'
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/src/components/ui/card'
import { Avatar, AvatarImage, AvatarFallback } from '@/src/components/ui/avatar'
import { Button } from '@/src/components/ui/button'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/src/components/ui/table'
import { Section, VariantGrid, Preview, PageHeader, CodeBlock } from '../_components/Section'

const tableData = [
  { name: 'kafka-prod-ingest', topic: 'events.raw', status: 'active', events: '1.2M' },
  { name: 'clickhouse-etl', topic: 'events.dedup', status: 'paused', events: '890K' },
  { name: 'data-transform', topic: 'events.clean', status: 'failed', events: '0' },
]

const statusVariant: Record<string, 'success' | 'warning' | 'error'> = {
  active: 'success',
  paused: 'warning',
  failed: 'error',
}

export default function DisplayPage() {
  return (
    <div>
      <PageHeader
        title="Display"
        description="Cards, badges, avatars, and tables for presenting structured data."
      />

      <Section title="Badge Variants" description="Use variant to communicate semantic status">
        <div className="flex flex-wrap gap-3 p-4 rounded-lg bg-[var(--surface-bg-sunken)] border border-[var(--surface-border)]">
          <Badge variant="default">Default</Badge>
          <Badge variant="secondary">Secondary</Badge>
          <Badge variant="success">Success</Badge>
          <Badge variant="warning">Warning</Badge>
          <Badge variant="error">Error</Badge>
          <Badge variant="destructive">Destructive</Badge>
          <Badge variant="outline">Outline</Badge>
        </div>
        <CodeBlock code={`<Badge variant="success">Active</Badge>
<Badge variant="warning">Paused</Badge>
<Badge variant="error">Failed</Badge>`} />
      </Section>

      <Section title="Card Variants" description="Choose variant that matches elevation and intent">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="flex flex-col gap-2">
            <Card variant="dark" className="p-4">
              <CardHeader className="mb-3">
                <CardTitle className="title-6 text-[var(--text-primary)]">Dark Card</CardTitle>
                <CardDescription>variant="dark" — primary card surface</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="body-3 text-[var(--text-secondary)]">Used for main content areas and pipeline configuration cards.</p>
              </CardContent>
            </Card>
            <p className="text-xs text-[var(--text-secondary)] text-center">dark</p>
          </div>

          <div className="flex flex-col gap-2">
            <Card variant="outline" className="p-4">
              <CardHeader className="mb-3">
                <CardTitle className="title-6 text-[var(--text-primary)]">Outline Card</CardTitle>
                <CardDescription>variant="outline" — bordered container</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="body-3 text-[var(--text-secondary)]">Lighter weight container for grouping related UI elements.</p>
              </CardContent>
            </Card>
            <p className="text-xs text-[var(--text-secondary)] text-center">outline</p>
          </div>

          <div className="flex flex-col gap-2">
            <Card variant="elevated" className="p-4">
              <CardHeader className="mb-3">
                <CardTitle className="title-6 text-[var(--text-primary)]">Elevated Card</CardTitle>
                <CardDescription>variant="elevated" — lifted shadow</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="body-3 text-[var(--text-secondary)]">Draws focus to important sections or selected items.</p>
              </CardContent>
            </Card>
            <p className="text-xs text-[var(--text-secondary)] text-center">elevated</p>
          </div>

          <div className="flex flex-col gap-2">
            <Card variant="feedback" className="p-4">
              <CardHeader className="mb-3">
                <CardTitle className="title-6 text-[var(--text-primary)]">Feedback Card</CardTitle>
                <CardDescription>variant="feedback" — slate gradient border</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="body-3 text-[var(--text-secondary)]">Used for notifications, tips, and contextual feedback messages.</p>
              </CardContent>
            </Card>
            <p className="text-xs text-[var(--text-secondary)] text-center">feedback</p>
          </div>

          <div className="flex flex-col gap-2">
            <Card variant="content" className="p-4">
              <CardHeader className="mb-3">
                <CardTitle className="title-6 text-[var(--text-primary)]">Content Card</CardTitle>
                <CardDescription>variant="content" — dark gradient + slate border</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="body-3 text-[var(--text-secondary)]">For structured data display — pipeline steps, transformation blocks.</p>
              </CardContent>
            </Card>
            <p className="text-xs text-[var(--text-secondary)] text-center">content</p>
          </div>

          <div className="flex flex-col gap-2">
            <Card variant="elevatedSubtle" className="p-4">
              <CardHeader className="mb-3">
                <CardTitle className="title-6 text-[var(--text-primary)]">Elevated Subtle</CardTitle>
                <CardDescription>variant="elevatedSubtle" — softer elevation</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="body-3 text-[var(--text-secondary)]">Subtle lift without the full shadow weight of elevated.</p>
              </CardContent>
            </Card>
            <p className="text-xs text-[var(--text-secondary)] text-center">elevatedSubtle</p>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="flex flex-col gap-2">
            <Card variant="dark" className="p-4 card-dark-selected">
              <p className="title-6 text-[var(--text-primary)] mb-1">Selected State</p>
              <p className="body-3 text-[var(--text-secondary)]">Add className="card-dark-selected" for selection highlight.</p>
            </Card>
            <p className="text-xs text-[var(--text-secondary)] text-center">card-dark-selected modifier</p>
          </div>
          <div className="flex flex-col gap-2">
            <Card variant="dark" className="p-4 card-dark-error">
              <p className="title-6 text-[var(--text-primary)] mb-1">Error State</p>
              <p className="body-3 text-[var(--text-secondary)]">Add className="card-dark-error" for error highlight.</p>
            </Card>
            <p className="text-xs text-[var(--text-secondary)] text-center">card-dark-error modifier</p>
          </div>
        </div>

        <CodeBlock code={`<Card variant="dark" className="p-4">
  <CardHeader>
    <CardTitle className="title-6">Title</CardTitle>
    <CardDescription>Description text</CardDescription>
  </CardHeader>
  <CardContent>...</CardContent>
  <CardFooter>
    <Button variant="primary">Action</Button>
  </CardFooter>
</Card>`} />
      </Section>

      <Section title="Avatar">
        <div className="flex flex-wrap items-center gap-6 p-4 rounded-lg bg-[var(--surface-bg-sunken)] border border-[var(--surface-border)]">
          <div className="flex flex-col items-center gap-2">
            <Avatar>
              <AvatarFallback>GF</AvatarFallback>
            </Avatar>
            <span className="text-xs text-[var(--text-secondary)]">fallback</span>
          </div>
          <div className="flex flex-col items-center gap-2">
            <Avatar className="size-10">
              <AvatarFallback>VK</AvatarFallback>
            </Avatar>
            <span className="text-xs text-[var(--text-secondary)]">size-10</span>
          </div>
          <div className="flex flex-col items-center gap-2">
            <Avatar className="size-12">
              <AvatarFallback>AB</AvatarFallback>
            </Avatar>
            <span className="text-xs text-[var(--text-secondary)]">size-12</span>
          </div>
          <div className="flex flex-col items-center gap-2">
            <div className="flex -space-x-2">
              <Avatar className="border-2 border-[var(--surface-bg)]">
                <AvatarFallback>A</AvatarFallback>
              </Avatar>
              <Avatar className="border-2 border-[var(--surface-bg)]">
                <AvatarFallback>B</AvatarFallback>
              </Avatar>
              <Avatar className="border-2 border-[var(--surface-bg)]">
                <AvatarFallback>C</AvatarFallback>
              </Avatar>
            </div>
            <span className="text-xs text-[var(--text-secondary)]">stacked</span>
          </div>
        </div>
      </Section>

      <Section title="Table" description="Use for pipeline lists, event data, and structured records">
        <div className="rounded-lg border border-[var(--surface-border)] overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Pipeline</TableHead>
                <TableHead>Topic</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Events</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tableData.map((row) => (
                <TableRow key={row.name}>
                  <TableCell className="font-medium text-[var(--text-primary)]">{row.name}</TableCell>
                  <TableCell className="font-mono text-[var(--text-secondary)] text-xs">{row.topic}</TableCell>
                  <TableCell>
                    <Badge variant={statusVariant[row.status]}>{row.status}</Badge>
                  </TableCell>
                  <TableCell className="text-right text-[var(--text-secondary)]">{row.events}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        <CodeBlock code={`<Table>
  <TableHeader>
    <TableRow>
      <TableHead>Name</TableHead>
      <TableHead>Status</TableHead>
    </TableRow>
  </TableHeader>
  <TableBody>
    <TableRow>
      <TableCell>pipeline-1</TableCell>
      <TableCell><Badge variant="success">active</Badge></TableCell>
    </TableRow>
  </TableBody>
</Table>`} />
      </Section>
    </div>
  )
}
