'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircle2Icon, AlertCircleIcon, RocketIcon } from 'lucide-react'
import { useStore } from '@/src/store'
import { Button } from '@/src/components/ui/button'
import { Badge } from '@/src/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/src/components/ui/select'
import { notify } from '@/src/notifications'
import { ValidationFooter } from './ValidationFooter'

type DeployBarProps = {
  pipelineId: string | null // null when this is a brand-new draft
  currentRevision: number | null
  onJumpToNode?: (nodeId: string) => void
  serializeAndDeploy: (env: string) => Promise<{ pipelineId: string; revision: number }>
}

export function DeployBar({
  pipelineId,
  currentRevision,
  onJumpToNode,
  serializeAndDeploy,
}: DeployBarProps) {
  const router = useRouter()
  const { canvasStore } = useStore()
  const [env, setEnv] = React.useState<string>('production')
  const [showFooter, setShowFooter] = React.useState(false)

  const validation = React.useMemo(
    () => canvasStore.validate(),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [canvasStore.nodes, canvasStore.edges, canvasStore.nodeConfigs],
  )
  const canDeploy =
    !validation.summary.hasErrors && canvasStore.deployState.status !== 'deploying'

  const handleValidate = () => {
    setShowFooter(true)
    if (validation.summary.hasErrors) {
      notify({
        variant: 'error',
        title: `${validation.summary.errorCount} error${
          validation.summary.errorCount === 1 ? '' : 's'
        }`,
        description: 'Fix errors before deploying.',
      })
    } else if (validation.summary.warningCount > 0) {
      notify({
        variant: 'warning',
        title: `${validation.summary.warningCount} warning${
          validation.summary.warningCount === 1 ? '' : 's'
        }`,
        description: 'Pipeline has warnings but is deployable.',
      })
    } else {
      notify({ variant: 'success', title: 'Pipeline is valid' })
    }
  }

  const handleDeploy = async () => {
    canvasStore.setDeployState({ status: 'validating' })
    const r = canvasStore.validate()
    if (r.summary.hasErrors) {
      canvasStore.setDeployState({ status: 'idle' })
      notify({
        variant: 'error',
        title: 'Cannot deploy',
        description: 'Fix validation errors first.',
      })
      return
    }
    canvasStore.setDeployState({ status: 'deploying' })
    try {
      const { pipelineId: newId, revision } = await serializeAndDeploy(env)
      canvasStore.markClean()
      canvasStore.setDeployState({ status: 'idle' })
      notify({ variant: 'success', title: `Revision ${revision} deployed` })
      router.push(`/pipelines/${newId}/overview`)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown'
      canvasStore.setDeployState({ status: 'error', message })
      notify({ variant: 'error', title: 'Deploy failed', description: message })
    }
  }

  return (
    <div className="border-t border-[var(--surface-border)] bg-[var(--color-background-elevation-raised-faded)]">
      {showFooter && (
        <ValidationFooter
          className="border-b border-[var(--surface-border)]"
          onJumpToNode={onJumpToNode}
        />
      )}
      <div className="flex items-center justify-between gap-3 px-3 py-2">
        <div className="flex items-center gap-3">
          {validation.summary.hasErrors ? (
            <span className="inline-flex items-center gap-1.5 caption-1 text-[var(--color-foreground-critical)]">
              <AlertCircleIcon size={14} aria-hidden="true" />
              {validation.summary.errorCount} error
              {validation.summary.errorCount === 1 ? '' : 's'}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 caption-1 text-[var(--color-foreground-positive)]">
              <CheckCircle2Icon size={14} aria-hidden="true" />
              valid
            </span>
          )}
          {canvasStore.isDirty && <Badge variant="warning">unsaved changes</Badge>}
          {currentRevision != null && (
            <span className="caption-1 text-[var(--text-tertiary)]">
              <span className="mono-2">rev {currentRevision}</span>
            </span>
          )}
          {pipelineId && (
            <span className="caption-1 mono-2 text-[var(--text-tertiary)]">{pipelineId}</span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Select value={env} onValueChange={setEnv}>
            <SelectTrigger className="h-8 w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="production">production</SelectItem>
              <SelectItem value="staging">staging</SelectItem>
              <SelectItem value="dev">dev</SelectItem>
            </SelectContent>
          </Select>

          <Button variant="secondary" size="sm" onClick={handleValidate}>
            Validate
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={() => void handleDeploy()}
            disabled={!canDeploy}
            loading={canvasStore.deployState.status === 'deploying'}
            loadingText="Deploying…"
          >
            <RocketIcon size={14} className="mr-1.5" />
            Deploy
          </Button>
        </div>
      </div>
    </div>
  )
}
