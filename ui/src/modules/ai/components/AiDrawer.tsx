// AI assistant drawer — portal-mounted at the app root (D4).
//
// State (open/scope/transcript) lives in the `aiUiStore` slice. The drawer
// reads scope to render the per-pipeline / global header indicator, and the
// chat panel hydrates its transcript from `/ui-api/ai/chats/<scope>`.

'use client'

import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
} from '@/src/components/ui/drawer'
import { Badge } from '@/src/components/ui/badge'
import { useStore } from '@/src/store'
import { AiChatPanel } from './AiChatPanel'
import { ModelPicker } from './ModelPicker'
import { TokenUsageIndicator } from './TokenUsageIndicator'

export function AiDrawer() {
  const { aiUiStore } = useStore()

  return (
    <Drawer
      open={aiUiStore.open}
      onOpenChange={(o) => (o ? aiUiStore.openDrawer() : aiUiStore.closeDrawer())}
    >
      <DrawerContent side="right" className="w-[520px] max-w-[100vw]">
        <DrawerHeader>
          <div className="flex items-center justify-between gap-2">
            <div className="flex flex-col gap-0.5">
              <DrawerTitle>AI assistant</DrawerTitle>
              <DrawerDescription className="caption-1 text-[var(--text-tertiary)]">
                {aiUiStore.scope.kind === 'global' ? (
                  <Badge variant="secondary">new pipeline</Badge>
                ) : (
                  <span>
                    scoped to{' '}
                    <span className="mono-2 ml-1">{aiUiStore.scope.pipelineId}</span>
                  </span>
                )}
              </DrawerDescription>
            </div>
            <div className="flex items-center gap-2 mr-8">
              <ModelPicker />
              <TokenUsageIndicator />
            </div>
          </div>
        </DrawerHeader>
        <AiChatPanel />
      </DrawerContent>
    </Drawer>
  )
}
