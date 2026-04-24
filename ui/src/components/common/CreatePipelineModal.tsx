'use client'

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogOverlay,
} from '@/src/components/ui/dialog'
import { Badge } from '@/src/components/ui/badge'
import { Card } from '@/src/components/ui/card'
import { useRouter } from 'next/navigation'
import { WorkflowIcon, LayoutIcon, SparklesIcon } from 'lucide-react'

type LaneOption = {
  id: 'wizard' | 'canvas' | 'ai'
  label: string
  description: string
  icon: React.ReactNode
  disabled?: boolean
  comingSoon?: boolean
  href?: string
}

type CreatePipelineModalProps = {
  open: boolean
  onClose: () => void
  aiEnabled?: boolean
}

export function CreatePipelineModal({ open, onClose, aiEnabled = false }: CreatePipelineModalProps) {
  const router = useRouter()

  const lanes: LaneOption[] = [
    {
      id: 'wizard',
      label: 'Wizard',
      description: 'Step-by-step guided pipeline setup',
      icon: <WorkflowIcon size={24} />,
      href: '/home',
    },
    {
      id: 'canvas',
      label: 'Canvas',
      description: 'Visual drag-and-drop pipeline builder',
      icon: <LayoutIcon size={24} />,
      disabled: true,
      comingSoon: true,
    },
    ...(aiEnabled
      ? [
          {
            id: 'ai' as const,
            label: 'AI Assistant',
            description: 'Describe your pipeline in plain language',
            icon: <SparklesIcon size={24} />,
            href: '/pipelines/create/ai',
          },
        ]
      : []),
  ]

  const handleLaneSelect = (lane: LaneOption) => {
    if (lane.disabled || !lane.href) return
    onClose()
    router.push(lane.href)
  }

  return (
    <Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen) onClose() }}>
      <DialogOverlay className="!fixed !inset-0 modal-overlay" aria-hidden="true" />
      <DialogContent className="info-modal-container surface-gradient-border border-0 sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle className="modal-title mb-2">Create Pipeline</DialogTitle>
          <DialogDescription className="modal-description">
            Choose how you want to build your pipeline
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3 mt-4">
          {lanes.map((lane) => (
            <Card
              key={lane.id}
              variant="selectable"
              className={[
                'p-4 transition-all',
                lane.disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer',
              ].join(' ')}
              onClick={() => handleLaneSelect(lane)}
              role={lane.disabled ? undefined : 'button'}
              aria-disabled={lane.disabled}
              tabIndex={lane.disabled ? -1 : 0}
              onKeyDown={(e) => {
                if (!lane.disabled && (e.key === 'Enter' || e.key === ' ')) {
                  e.preventDefault()
                  handleLaneSelect(lane)
                }
              }}
            >
              <div className="flex items-center gap-4">
                <span className="text-[var(--color-foreground-primary)]" aria-hidden="true">
                  {lane.icon}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="body-2 font-medium text-[var(--text-primary)]">{lane.label}</span>
                    {lane.comingSoon && (
                      <Badge variant="secondary">Coming soon</Badge>
                    )}
                  </div>
                  <p className="caption-1 text-[var(--text-secondary)] mt-0.5">{lane.description}</p>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  )
}
