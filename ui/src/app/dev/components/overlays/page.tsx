'use client'

import { InfoIcon, AlertTriangleIcon, MoreHorizontalIcon, Settings2Icon, CopyIcon, TrashIcon } from 'lucide-react'
import { Button } from '@/src/components/ui/button'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle, DialogTrigger, DialogOverlay,
} from '@/src/components/ui/dialog'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/src/components/ui/tooltip'
import { Popover, PopoverContent, PopoverTrigger } from '@/src/components/ui/popover'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/src/components/ui/dropdown-menu'
import { Input } from '@/src/components/ui/input'
import { Label } from '@/src/components/ui/label'
import { Section, Preview, VariantGrid, PageHeader, CodeBlock } from '../_components/Section'

export default function OverlaysPage() {
  return (
    <div>
      <PageHeader
        title="Overlays"
        description="Dialog, tooltip, popover, and dropdown menu. All use Radix UI portals for correct stacking."
      />

      <Section title="Dialog" description="All dialogs use info-modal-container + surface-gradient-border + modal-overlay backdrop. Never use bare DialogContent defaults.">
        <VariantGrid columns={2}>
          <Preview label="info dialog">
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="ghostOutline">
                  <InfoIcon />
                  Info Dialog
                </Button>
              </DialogTrigger>
              <DialogOverlay className="!fixed !inset-0 modal-overlay" aria-hidden="true" />
              <DialogContent className="info-modal-container surface-gradient-border border-0">
                <DialogHeader>
                  <DialogTitle className="modal-title">Pipeline Created</DialogTitle>
                  <DialogDescription className="modal-description">
                    Your pipeline has been successfully created and is now running. You can monitor its status
                    from the pipelines list.
                  </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                  <Button variant="primary">Got it</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </Preview>

          <Preview label="confirmation dialog">
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="destructive">
                  <TrashIcon />
                  Delete Pipeline
                </Button>
              </DialogTrigger>
              <DialogOverlay className="!fixed !inset-0 modal-overlay" aria-hidden="true" />
              <DialogContent className="info-modal-container surface-gradient-border border-0">
                <DialogHeader>
                  <DialogTitle className="modal-title">Delete Pipeline</DialogTitle>
                  <DialogDescription className="modal-description">
                    This will permanently delete <strong>kafka-prod-ingest</strong> and all its configuration.
                    This action cannot be undone.
                  </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                  <Button variant="tertiary">Cancel</Button>
                  <Button variant="destructive">Delete Pipeline</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </Preview>

          <Preview label="form dialog">
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="secondary">
                  <Settings2Icon />
                  Edit Settings
                </Button>
              </DialogTrigger>
              <DialogOverlay className="!fixed !inset-0 modal-overlay" aria-hidden="true" />
              <DialogContent className="info-modal-container surface-gradient-border border-0">
                <DialogHeader>
                  <DialogTitle className="modal-title">Pipeline Settings</DialogTitle>
                  <DialogDescription className="modal-description">
                    Update the name and description for this pipeline.
                  </DialogDescription>
                </DialogHeader>
                <div className="flex flex-col gap-4">
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="pipeline-name">Pipeline name</Label>
                    <Input id="pipeline-name" defaultValue="kafka-prod-ingest" />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="pipeline-desc">Description</Label>
                    <Input id="pipeline-desc" placeholder="Optional description..." />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="tertiary">Cancel</Button>
                  <Button variant="primary">Save changes</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </Preview>
        </VariantGrid>

        <CodeBlock code={`<Dialog>
  <DialogTrigger asChild>
    <Button variant="ghostOutline">Open</Button>
  </DialogTrigger>
  {/* Explicit overlay: replaces bg-black/50 with the blur + tint backdrop */}
  <DialogOverlay className="!fixed !inset-0 modal-overlay" aria-hidden="true" />
  <DialogContent className="info-modal-container surface-gradient-border border-0">
    <DialogHeader>
      <DialogTitle className="modal-title">Title</DialogTitle>
      <DialogDescription className="modal-description">Description</DialogDescription>
    </DialogHeader>
    <DialogFooter>
      <Button variant="tertiary">Cancel</Button>
      <Button variant="primary">Confirm</Button>
    </DialogFooter>
  </DialogContent>
</Dialog>

{/* For wider form dialogs use form-modal-container instead */}
<DialogContent className="form-modal-container surface-gradient-border border-0">`} />
      </Section>

      <Section title="Tooltip" description="Dark surface background with subtle border — baked into TooltipContent. Use className only to set side, align, or max-width.">
        <div className="flex flex-wrap gap-6 p-4 rounded-lg bg-[var(--surface-bg-sunken)] border border-[var(--surface-border)]">
          <div className="flex flex-col items-center gap-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghostOutline" size="icon">
                  <InfoIcon />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Hover info tooltip</TooltipContent>
            </Tooltip>
            <span className="text-xs text-[var(--text-secondary)]">default</span>
          </div>

          <div className="flex flex-col items-center gap-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="destructive" size="icon">
                  <TrashIcon />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Delete this pipeline permanently</TooltipContent>
            </Tooltip>
            <span className="text-xs text-[var(--text-secondary)]">on destructive</span>
          </div>

          <div className="flex flex-col items-center gap-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" disabled>
                  <Settings2Icon />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Settings not available</TooltipContent>
            </Tooltip>
            <span className="text-xs text-[var(--text-secondary)]">on disabled</span>
          </div>
        </div>
        <CodeBlock code={`<Tooltip>
  <TooltipTrigger asChild>
    <Button variant="ghostOutline" size="icon">
      <InfoIcon />
    </Button>
  </TooltipTrigger>
  {/* bg, border, radius, shadow are provided by the primitive — no className needed */}
  <TooltipContent>Helpful hint text</TooltipContent>
</Tooltip>

{/* Position or width overrides only */}
<TooltipContent side="right" align="start" className="p-3">
  Longer description that wraps at max-w-[300px]
</TooltipContent>`} />
      </Section>

      <Section title="Popover" description="Use surface-gradient-border border-0 to match the app's overlay border system">
        <div className="flex flex-wrap gap-6 p-4 rounded-lg bg-[var(--surface-bg-sunken)] border border-[var(--surface-border)]">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="secondary">Open Popover</Button>
            </PopoverTrigger>
            <PopoverContent className="surface-gradient-border border-0 bg-[var(--color-background-elevation-raised-faded-2)]">
              <div className="flex flex-col gap-3">
                <div>
                  <p className="title-6 text-[var(--text-primary)]">Filter Options</p>
                  <p className="body-3 text-[var(--text-secondary)] mt-1">Apply filters to the pipeline list.</p>
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="pop-search">Search</Label>
                  <Input id="pop-search" placeholder="Search pipelines..." />
                </div>
                <Button variant="primary" size="sm" className="w-full">Apply</Button>
              </div>
            </PopoverContent>
          </Popover>

          <Popover>
            <PopoverTrigger asChild>
              <Button variant="ghostOutline">
                <AlertTriangleIcon className="text-[var(--color-foreground-warning)]" />
                Warning Details
              </Button>
            </PopoverTrigger>
            <PopoverContent className="surface-gradient-border border-0 bg-[var(--color-background-elevation-raised-faded-2)]">
              <div className="flex gap-3">
                <AlertTriangleIcon className="size-4 text-[var(--color-foreground-warning)] shrink-0 mt-0.5" />
                <div>
                  <p className="title-6 text-[var(--text-primary)]">Connection Warning</p>
                  <p className="body-3 text-[var(--text-secondary)] mt-1">
                    Consumer lag is above the warning threshold. Check your ClickHouse write capacity.
                  </p>
                </div>
              </div>
            </PopoverContent>
          </Popover>
        </div>
        <CodeBlock code={`<Popover>
  <PopoverTrigger asChild>
    <Button variant="secondary">Options</Button>
  </PopoverTrigger>
  {/* Apply surface-gradient-border + correct bg token — never rely on default border */}
  <PopoverContent className="surface-gradient-border border-0 bg-[var(--color-background-elevation-raised-faded-2)]">
    <p className="title-6">Content</p>
    <p className="body-3 text-[var(--text-secondary)]">Description</p>
  </PopoverContent>
</Popover>`} />
      </Section>

      <Section title="Dropdown Menu" description="surface-gradient-border is baked into DropdownMenuContent — no extra className needed">
        <div className="flex flex-wrap gap-6 p-4 rounded-lg bg-[var(--surface-bg-sunken)] border border-[var(--surface-border)]">
          <div className="flex flex-col items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghostOutline" size="icon">
                  <MoreHorizontalIcon />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                <DropdownMenuLabel>Pipeline Actions</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem>
                  <Settings2Icon />
                  Edit settings
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <CopyIcon />
                  Duplicate
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="text-[var(--color-foreground-critical)]">
                  <TrashIcon />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <span className="text-xs text-[var(--text-secondary)]">icon trigger</span>
          </div>

          <div className="flex flex-col items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="secondary">Actions</Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem>View details</DropdownMenuItem>
                <DropdownMenuItem>Export config</DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="text-[var(--color-foreground-critical)]">
                  Delete pipeline
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <span className="text-xs text-[var(--text-secondary)]">button trigger</span>
          </div>
        </div>
        <CodeBlock code={`<DropdownMenu>
  <DropdownMenuTrigger asChild>
    <Button variant="ghostOutline" size="icon">
      <MoreHorizontalIcon />
    </Button>
  </DropdownMenuTrigger>
  {/* surface-gradient-border already applied in DropdownMenuContent primitive */}
  <DropdownMenuContent>
    <DropdownMenuLabel>Actions</DropdownMenuLabel>
    <DropdownMenuSeparator />
    <DropdownMenuItem>Edit</DropdownMenuItem>
    <DropdownMenuItem className="text-[var(--color-foreground-critical)]">
      Delete
    </DropdownMenuItem>
  </DropdownMenuContent>
</DropdownMenu>`} />
      </Section>
    </div>
  )
}
