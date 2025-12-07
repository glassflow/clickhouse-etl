import {
  Dialog,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogPortal,
  DialogOverlay,
} from '@/src/components/ui/dialog'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import LoadingSpinner from '@/src/components/shared/LoadingSpinner'
import { cn } from '@/src/utils/common.client'

interface PipelineTransitionOverlayProps {
  visible: boolean
  title: string
  description: string
}

/**
 * A non-dismissible overlay that displays during pipeline state transitions.
 * Similar to create mode modals but prevents user interaction until transition completes.
 */
export function PipelineTransitionOverlay({ visible, title, description }: PipelineTransitionOverlayProps) {
  return (
    <Dialog open={visible} modal={true}>
      <DialogPortal>
        {/* Custom overlay with blur effect - matches create journey styling */}
        <DialogOverlay
          className="!fixed !inset-0 !z-50"
          style={{
            backgroundColor: 'rgba(0, 0, 0, 0)',
            backdropFilter: 'blur(4px)',
            WebkitBackdropFilter: 'blur(4px)',
          }}
          onPointerDown={(e) => e.preventDefault()}
        />

        {/* Dialog content - centered in viewport */}
        <DialogPrimitive.Content
          className={cn(
            'fixed top-[50%] left-[50%] z-50 grid w-full max-w-[500px]',
            'translate-x-[-50%] translate-y-[-50%]',
            'info-modal-container surface-gradient-border border-0',
            'data-[state=open]:animate-in data-[state=closed]:animate-out',
            'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
            'data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95',
          )}
          onEscapeKeyDown={(e) => e.preventDefault()}
          onPointerDownOutside={(e) => e.preventDefault()}
          onInteractOutside={(e) => e.preventDefault()}
        >
          <DialogHeader>
            <DialogTitle className="modal-title flex items-center gap-2 mb-4">{title}</DialogTitle>
            <DialogDescription className="modal-description mb-6">{description}</DialogDescription>
          </DialogHeader>

          <div className="flex flex-col items-center justify-center py-6">
            <LoadingSpinner size="lg" color="gray" className="mb-4" />
            <p className="text-sm text-muted-foreground text-center">Please wait while the pipeline transitions...</p>
          </div>

          {/* Remove the default close button */}
          <style jsx>{`
            :global([data-slot='dialog-close']) {
              display: none !important;
            }
          `}</style>
        </DialogPrimitive.Content>
      </DialogPortal>
    </Dialog>
  )
}
