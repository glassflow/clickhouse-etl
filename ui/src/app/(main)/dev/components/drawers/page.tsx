'use client'

import { useState } from 'react'
import { SettingsIcon, BookOpenIcon, AlertTriangleIcon, LayersIcon } from 'lucide-react'
import {
  Sheet, SheetTrigger, SheetContent,
  SheetHeader, SheetTitle, SheetDescription, SheetFooter, SheetClose,
} from '@/src/components/ui/sheet'
import {
  Drawer,
  DrawerTrigger,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
  DrawerBody,
  DrawerFooter,
  DrawerClose,
} from '@/src/components/ui/drawer'
import { Button } from '@/src/components/ui/button'
import { ConfirmationModal, ModalResult } from '@/src/components/common/ConfirmationModal'
import { InfoModal } from '@/src/components/common/InfoModal'
import { Skeleton, SkeletonRow } from '@/src/components/ui/skeleton'
import { Section, Preview, PageHeader, CodeBlock } from '../_components/Section'

export default function DrawersPage() {
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [confirmCriticalOpen, setConfirmCriticalOpen] = useState(false)
  const [infoOpen, setInfoOpen] = useState(false)
  const [lastResult, setLastResult] = useState<string | null>(null)

  function handleConfirmComplete(result: string) {
    setLastResult(result === ModalResult.YES ? 'Confirmed' : 'Cancelled')
    setConfirmOpen(false)
    setConfirmCriticalOpen(false)
  }

  function handleInfoComplete(result: string) {
    setLastResult(result === ModalResult.YES ? 'Acknowledged' : 'Dismissed')
    setInfoOpen(false)
  }

  return (
    <div>
      <PageHeader
        title="Drawers & Modals"
        description="Side-drawer panels and modal dialog patterns used across the application."
      />

      {/* ── Drawer ─────────────────────────────────────────────────── */}
      <Section
        title="Drawer"
        description="Right or left-anchored side panel built on Radix Dialog. Use for node configuration, detail views, and AI assistant."
      >
        <div className="flex flex-wrap gap-3 p-4 rounded-lg bg-[var(--surface-bg-sunken)] border border-[var(--surface-border)]">
          {/* Right drawer — default */}
          <Drawer>
            <DrawerTrigger asChild>
              <Button variant="secondary" size="sm">
                Open right drawer
              </Button>
            </DrawerTrigger>
            <DrawerContent side="right">
              <DrawerHeader>
                <DrawerTitle>Node configuration</DrawerTitle>
                <DrawerDescription>Configure the selected canvas node.</DrawerDescription>
              </DrawerHeader>
              <DrawerBody>
                <div className="flex flex-col gap-4">
                  <p className="body-3 text-[var(--text-secondary)]">
                    Drawer body scrolls independently. Content goes here.
                  </p>
                  <SkeletonRow count={4} rowHeight={36} />
                </div>
              </DrawerBody>
              <DrawerFooter>
                <DrawerClose asChild>
                  <Button variant="tertiary" size="sm">Cancel</Button>
                </DrawerClose>
                <Button variant="primary" size="sm">Apply</Button>
              </DrawerFooter>
            </DrawerContent>
          </Drawer>

          {/* Left drawer */}
          <Drawer>
            <DrawerTrigger asChild>
              <Button variant="secondary" size="sm">
                Open left drawer
              </Button>
            </DrawerTrigger>
            <DrawerContent side="left">
              <DrawerHeader>
                <DrawerTitle>Library</DrawerTitle>
                <DrawerDescription>Browse and attach reusable components.</DrawerDescription>
              </DrawerHeader>
              <DrawerBody>
                <div className="flex flex-col gap-3">
                  {['kafka-prod', 'kafka-staging', 'clickhouse-prod'].map((name) => (
                    <div
                      key={name}
                      className="flex items-center gap-3 p-3 rounded-md border border-[var(--surface-border)] bg-[var(--surface-bg)]"
                    >
                      <BookOpenIcon size={14} className="text-[var(--color-foreground-primary)]" />
                      <span className="body-3 text-[var(--text-primary)]">{name}</span>
                    </div>
                  ))}
                </div>
              </DrawerBody>
              <DrawerFooter>
                <DrawerClose asChild>
                  <Button variant="tertiary" size="sm">Close</Button>
                </DrawerClose>
              </DrawerFooter>
            </DrawerContent>
          </Drawer>

          {/* Header-only drawer (no footer) */}
          <Drawer>
            <DrawerTrigger asChild>
              <Button variant="ghost" size="sm">
                <SettingsIcon size={14} />
                Settings drawer
              </Button>
            </DrawerTrigger>
            <DrawerContent side="right">
              <DrawerHeader>
                <DrawerTitle>Pipeline settings</DrawerTitle>
              </DrawerHeader>
              <DrawerBody>
                <p className="body-3 text-[var(--text-secondary)]">
                  Drawers without a footer are useful for read-only or auto-save contexts.
                </p>
                <div className="mt-4">
                  <SkeletonRow count={6} rowHeight={28} />
                </div>
              </DrawerBody>
            </DrawerContent>
          </Drawer>
        </div>

        <CodeBlock code={`import {
  Drawer, DrawerTrigger, DrawerContent,
  DrawerHeader, DrawerTitle, DrawerDescription,
  DrawerBody, DrawerFooter, DrawerClose,
} from '@/src/components/ui/drawer'

<Drawer>
  <DrawerTrigger asChild>
    <Button variant="secondary">Open</Button>
  </DrawerTrigger>
  <DrawerContent side="right">     {/* 'right' | 'left' */}
    <DrawerHeader>
      <DrawerTitle>Title</DrawerTitle>
      <DrawerDescription>Optional subtitle</DrawerDescription>
    </DrawerHeader>
    <DrawerBody>
      {/* Scrollable content */}
    </DrawerBody>
    <DrawerFooter>
      <DrawerClose asChild>
        <Button variant="tertiary">Cancel</Button>
      </DrawerClose>
      <Button variant="primary">Save</Button>
    </DrawerFooter>
  </DrawerContent>
</Drawer>`} />
      </Section>

      {/* ── ConfirmationModal ───────────────────────────────────────── */}
      <Section
        title="ConfirmationModal"
        description="Two-button dialog for yes/no decisions. Use criticalOperation for destructive actions — switches confirm button to destructive variant."
      >
        {lastResult && (
          <div className="mb-4 px-3 py-2 rounded-md bg-[var(--color-background-primary-faded)] border border-[var(--color-border-primary-faded)]">
            <span className="body-3 text-[var(--color-foreground-primary)]">
              Last result: <strong>{lastResult}</strong>
            </span>
          </div>
        )}

        <div className="flex flex-wrap gap-3 p-4 rounded-lg bg-[var(--surface-bg-sunken)] border border-[var(--surface-border)]">
          <Button variant="secondary" onClick={() => setConfirmOpen(true)}>
            Standard confirm
          </Button>
          <Button variant="destructive" size="sm" onClick={() => setConfirmCriticalOpen(true)}>
            <AlertTriangleIcon size={14} />
            Destructive confirm
          </Button>
        </div>

        <ConfirmationModal
          visible={confirmOpen}
          title="Stop pipeline?"
          description="The pipeline will stop processing events. You can resume it at any time."
          okButtonText="Stop pipeline"
          cancelButtonText="Cancel"
          pendingOperation="stop"
          onComplete={(result) => handleConfirmComplete(result)}
        />

        <ConfirmationModal
          visible={confirmCriticalOpen}
          title="Delete pipeline?"
          description="<strong>This action cannot be undone.</strong> All configuration and revision history will be permanently removed."
          okButtonText="Delete permanently"
          cancelButtonText="Cancel"
          pendingOperation="delete"
          criticalOperation
          onComplete={(result) => handleConfirmComplete(result)}
        />

        <CodeBlock code={`import { ConfirmationModal, ModalResult } from '@/src/components/common/ConfirmationModal'

const [open, setOpen] = useState(false)

function handleComplete(result: string, operation: string) {
  if (result === ModalResult.YES) {
    // user confirmed
  }
  setOpen(false)
}

// Standard
<ConfirmationModal
  visible={open}
  title="Stop pipeline?"
  description="The pipeline will stop processing events."
  okButtonText="Stop pipeline"
  cancelButtonText="Cancel"
  pendingOperation="stop"
  onComplete={handleComplete}
/>

// Destructive — confirm button becomes variant="destructive"
<ConfirmationModal
  visible={open}
  title="Delete pipeline?"
  description="<strong>Cannot be undone.</strong> All data will be removed."
  okButtonText="Delete permanently"
  cancelButtonText="Cancel"
  pendingOperation="delete"
  criticalOperation
  onComplete={handleComplete}
/>`} />
      </Section>

      {/* ── InfoModal ──────────────────────────────────────────────── */}
      <Section
        title="InfoModal"
        description="Two-button dialog for presenting information that requires acknowledgement. Identical shell to ConfirmationModal — use when the action is not destructive but still needs explicit user intent."
      >
        <div className="flex flex-wrap gap-3 p-4 rounded-lg bg-[var(--surface-bg-sunken)] border border-[var(--surface-border)]">
          <Button variant="secondary" onClick={() => setInfoOpen(true)}>
            Open info modal
          </Button>
        </div>

        <InfoModal
          visible={infoOpen}
          title="Schema version published"
          description="Version 2.1.0 of clickhouse-events has been published. Pipelines pinned to v2.0.0 will continue using the old version until you explicitly upgrade them."
          okButtonText="Got it"
          cancelButtonText="View affected pipelines"
          pendingOperation="info"
          onComplete={(result) => handleInfoComplete(result)}
        />

        <CodeBlock code={`import { InfoModal, ModalResult } from '@/src/components/common/InfoModal'

<InfoModal
  visible={open}
  title="Schema version published"
  description="Version 2.1.0 has been published. Pinned pipelines keep the old version until upgraded."
  okButtonText="Got it"
  cancelButtonText="View affected pipelines"
  pendingOperation="info"
  onComplete={(result, operation) => {
    if (result === ModalResult.YES) { /* primary action */ }
    if (result === ModalResult.NO)  { /* secondary action */ }
    setOpen(false)
  }}
/>`} />
      </Section>

      {/* ── Modal shell pattern ────────────────────────────────────── */}
      <Section
        title="Modal shell pattern"
        description="The canonical structure for any custom modal. Always use DialogOverlay + modal-overlay class + info-modal-container. Never use inline style on the overlay."
      >
        <CodeBlock code={`// CLAUDE.md §5 — canonical modal shell
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogDescription, DialogFooter, DialogOverlay,
} from '@/src/components/ui/dialog'

<Dialog open={open} onOpenChange={setOpen}>
  <DialogOverlay className="!fixed !inset-0 modal-overlay" aria-hidden="true" />
  <DialogContent className="info-modal-container surface-gradient-border border-0">
    <DialogHeader>
      <DialogTitle className="modal-title">Title</DialogTitle>
      <DialogDescription className="modal-description">
        Supporting copy
      </DialogDescription>
    </DialogHeader>
    {/* body content */}
    <DialogFooter className="mt-6">
      <Button variant="tertiary" onClick={() => setOpen(false)}>Cancel</Button>
      <Button variant="primary" onClick={handleSubmit}>Confirm</Button>
    </DialogFooter>
  </DialogContent>
</Dialog>

// Rules
// ✅  DialogOverlay always gets modal-overlay class
// ✅  DialogContent always gets info-modal-container + surface-gradient-border border-0
// ❌  Never style={{ ... }} on DialogOverlay
// ❌  Never raw <div> modals — always use the Dialog primitive`} />
      </Section>

      {/* ── Sheet ──────────────────────────────────────────────────── */}
      <Section
        title="Sheet"
        description="Radix Dialog configured as a slide-in panel. Similar to Drawer but uses shadcn defaults — less opinionated styling. Prefer Drawer in product UI; Sheet when you need raw escape hatches."
      >
        <div className="mb-4 px-3 py-2.5 rounded-md border border-[var(--surface-border)] bg-[var(--surface-bg-sunken)]">
          <p className="body-3 text-[var(--text-secondary)]">
            <span className="text-[var(--color-foreground-primary)] font-medium">Drawer vs Sheet:</span>{' '}
            Use <span className="font-mono text-xs">Drawer</span> for all standard side panels — it has GlassFlow token styling, structured slots (DrawerHeader/Body/Footer), and the correct animation tokens.
            Use <span className="font-mono text-xs">Sheet</span> only when you need a side: top or bottom slide, or when integrating a third-party component that expects shadcn Sheet API.
          </p>
        </div>

        <div className="flex flex-wrap gap-3 p-4 rounded-lg bg-[var(--surface-bg-sunken)] border border-[var(--surface-border)]">
          <Sheet>
            <SheetTrigger asChild>
              <button className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md border border-[var(--surface-border)] bg-[var(--surface-bg)] body-3 text-[var(--text-primary)] hover:bg-[var(--surface-bg-raised)] transition-colors">
                <LayersIcon size={14} />
                Open Sheet (right)
              </button>
            </SheetTrigger>
            <SheetContent side="right">
              <SheetHeader>
                <SheetTitle>Sheet panel</SheetTitle>
                <SheetDescription>Raw shadcn Sheet — no GlassFlow token layer.</SheetDescription>
              </SheetHeader>
              <div className="py-4">
                <p className="text-sm text-muted-foreground">
                  This is a Sheet. Notice it uses shadcn muted-foreground and bg-background tokens
                  instead of GlassFlow surface tokens. Prefer Drawer for product UI.
                </p>
              </div>
              <SheetFooter>
                <SheetClose asChild>
                  <button className="inline-flex items-center px-3 py-1.5 rounded-md body-3 text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors">
                    Close
                  </button>
                </SheetClose>
              </SheetFooter>
            </SheetContent>
          </Sheet>

          <Sheet>
            <SheetTrigger asChild>
              <button className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md border border-[var(--surface-border)] bg-[var(--surface-bg)] body-3 text-[var(--text-primary)] hover:bg-[var(--surface-bg-raised)] transition-colors">
                Sheet (bottom)
              </button>
            </SheetTrigger>
            <SheetContent side="bottom">
              <SheetHeader>
                <SheetTitle>Bottom sheet</SheetTitle>
                <SheetDescription>Slides from the bottom — useful for mobile contexts or quick-action menus.</SheetDescription>
              </SheetHeader>
            </SheetContent>
          </Sheet>
        </div>

        <CodeBlock code={`import {
  Sheet, SheetTrigger, SheetContent,
  SheetHeader, SheetTitle, SheetDescription,
  SheetFooter, SheetClose,
} from '@/src/components/ui/sheet'

// side: 'right' | 'left' | 'top' | 'bottom'  (default: 'right')
<Sheet>
  <SheetTrigger asChild>
    <Button variant="secondary">Open</Button>
  </SheetTrigger>
  <SheetContent side="right">
    <SheetHeader>
      <SheetTitle>Title</SheetTitle>
      <SheetDescription>Description</SheetDescription>
    </SheetHeader>
    {/* body content */}
    <SheetFooter>
      <SheetClose asChild>
        <Button variant="tertiary">Close</Button>
      </SheetClose>
    </SheetFooter>
  </SheetContent>
</Sheet>

// ⚠️  Sheet uses shadcn tokens (muted-foreground, bg-background).
//     Wrap content in GlassFlow token classes if visual consistency matters.
//     For product UI panels, use Drawer instead.`} />
      </Section>
    </div>
  )
}
