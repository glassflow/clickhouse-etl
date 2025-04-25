'use client'

import React, { useEffect, useState } from 'react'
import { useStore } from '@/src/store'
import { useAnalytics } from '@/src/hooks/useAnalytics'
import { Loader2 } from 'lucide-react'
import { cn } from '@/src/utils'
import { Button } from '@/src/components/ui/button'
import { useRouter } from 'next/navigation'
import {
  createPipeline,
  shutdownPipeline,
  getPipelineStatus,
  PipelineResponse,
  PipelineError,
} from '@/src/api/pipeline'
import axios from 'axios'
import { InputModal, ModalResult } from '@/src/components/InputModal'
import { saveConfiguration } from '@/src/utils/storage'

// NOTE: Set to true to enable saving pipelines
const SAVE_PIPELINE_ENABLED = true

type PipelineStatus = 'deploying' | 'active' | 'deleted' | 'deploy_failed' | 'delete_failed'

export function PipelineDeployer() {
  const { apiConfig, resetPipelineState, pipelineId } = useStore()
  const { trackPipelineAction } = useAnalytics()
  const [status, setStatus] = useState<PipelineStatus>('deploying')
  const [error, setError] = useState<string | null>(null)
  const [isModifyModalVisible, setIsModifyModalVisible] = useState(false)
  const [isDeleteModalVisible, setIsDeleteModalVisible] = useState(false)
  const router = useRouter()

  useEffect(() => {
    const checkPipelineStatus = async () => {
      try {
        const response = await getPipelineStatus()

        if (response.pipeline_id === pipelineId) {
          console.log('pipelineId matches - pipeline is active with the same id: ', pipelineId)
          setStatus('active')
          setError(null)
        } else if (response.pipeline_id && response.pipeline_id !== pipelineId) {
          console.log('pipelineId does not match - active pipeline has a different id: ', response.pipeline_id)
          setStatus('deploy_failed')
          setError('Pipeline is active with a different id')
        } else {
          console.log('This should not happen, we should always have a pipeline id or we throw an error')
          // No pipeline exists, we can deploy
          // TODO: this should not happen, we should always have a pipeline id or we throw an error
        }
      } catch (err: any) {
        if (err.code === 404) {
          // No pipeline exists, we can deploy
          if (apiConfig) {
            deployPipeline()
          }
        } else {
          setStatus('deploy_failed')
          setError(err.message)
        }
      }
    }

    const deployPipeline = async () => {
      try {
        const response = await createPipeline(apiConfig)
        console.log('response of deployPipeline: ', response)
        setStatus('active')
        setError(null)

        // Track successful pipeline deployment
        trackPipelineAction('deploy', {
          pipelineId: response.pipeline_id,
          status: 'success',
        })
      } catch (err: any) {
        setStatus('deploy_failed')
        setError(err.message)

        // Track failed pipeline deployment
        trackPipelineAction('deploy', {
          status: 'failed',
          error: err.message,
        })
      }
    }

    if (apiConfig) {
      checkPipelineStatus()
    }
  }, [apiConfig, pipelineId, trackPipelineAction])

  const handleDeleteClick = () => {
    setIsDeleteModalVisible(true)
  }

  const handleDeleteModalComplete = async (result: string, configName: string, operation: string) => {
    setIsDeleteModalVisible(false)

    // Save configuration if the user chose to do so and provided a name
    if (result === ModalResult.SUBMIT && configName) {
      try {
        saveConfiguration(configName, `Pipeline configuration saved before deletion on ${new Date().toLocaleString()}`)
      } catch (error) {
        console.error('Failed to save configuration:', error)
      }
    }

    // Proceed with pipeline deletion
    if (result === ModalResult.SUBMIT) {
      try {
        await shutdownPipeline()
        setStatus('deleted')
        setError(null)
        resetPipelineState('', true)

        // Track successful pipeline deletion
        trackPipelineAction('delete', {
          pipelineId,
          configSaved: !!configName,
          status: 'success',
        })
      } catch (err) {
        const error = err as PipelineError
        setStatus('delete_failed')
        setError(error.message)

        // Track failed pipeline deletion
        trackPipelineAction('delete', {
          pipelineId,
          status: 'failed',
          error: error.message,
        })
      }
    }
  }

  const handleModifyAndRestart = () => {
    setIsModifyModalVisible(true)
  }

  const handleModifyModalComplete = async (result: string, configName: string, operation: string) => {
    setIsModifyModalVisible(false)

    // Save configuration if the user chose to do so and provided a name
    if (result === ModalResult.SUBMIT && configName) {
      try {
        saveConfiguration(
          configName,
          `Pipeline configuration saved before modification on ${new Date().toLocaleString()}`,
        )
      } catch (error) {
        console.error('Failed to save configuration:', error)
      }
    }

    // Reset pipeline state and navigate to home regardless of save choice
    if (result === ModalResult.SUBMIT) {
      try {
        await shutdownPipeline()
        setStatus('deleted')
        setError(null)
        resetPipelineState('', true)

        // Track successful pipeline modification
        trackPipelineAction('modify', {
          pipelineId,
          configSaved: !!configName,
          status: 'success',
        })

        router.push('/home')
      } catch (err) {
        const error = err as PipelineError
        setStatus('delete_failed')
        setError(error.message)

        // Track failed pipeline modification
        trackPipelineAction('modify', {
          pipelineId,
          status: 'failed',
          error: error.message,
        })
      }
    }
  }

  const getStatusClass = (status: PipelineStatus) => {
    switch (status) {
      case 'active':
        return 'text-[var(--color-foreground-success)]'
      case 'deploying':
        return 'text-[var(--color-foreground-info)]'
      case 'deleted':
      case 'deploy_failed':
      case 'delete_failed':
        return 'text-[var(--color-foreground-error)]'
      default:
        return ''
    }
  }

  const getStatusText = (status: PipelineStatus) => {
    switch (status) {
      case 'active':
        return 'Pipeline is active'
      case 'deploying':
        return 'Pipeline is deploying'
      case 'deleted':
        return 'Pipeline deleted'
      case 'deploy_failed':
        return 'Pipeline deployment failed'
      case 'delete_failed':
        return 'Pipeline delete failed'
      default:
        return 'Unknown status'
    }
  }

  // const canShowButtons = status === 'active' || status === 'deploy_failed' || status === 'delete_failed'
  const canShowButtons = status === 'active' || status === 'deploy_failed'

  return (
    <div className="flex flex-col items-center justify-center gap-4">
      <div className="flex items-center gap-2">
        <h1 className={cn('text-2xl font-semibold', getStatusClass(status))}>{getStatusText(status)}</h1>
        {status === 'deploying' && <Loader2 className="h-6 w-6 animate-spin" />}
      </div>

      {error && (
        <div className="text-red-500 text-center">
          <p>{error}</p>
          {/* <p className="text-sm mt-1">Please check if the server is running and try again.</p> */}
        </div>
      )}

      {status === 'active' && (
        <div className="mt-4">
          <h3 className="text-lg font-medium mb-2">Pipeline Details</h3>
          {/* <pre className="bg-[var(--color-background-neutral-faded)] p-4 rounded-md overflow-auto">
            {JSON.stringify(apiConfig, null, 2)}
          </pre> */}
        </div>
      )}

      {canShowButtons && (
        <div className="flex gap-4 mt-4">
          {/* <Button
            variant="outline"
            className="btn-tertiary flex items-center gap-2"
            onClick={() => router.push('/pipelines/logs')}
          >
            <div className="w-5 h-5 bg-[var(--color-background-neutral-faded)] rounded-sm" />
            Open Logs
          </Button> */}

          <Button variant="outline" className="btn-tertiary flex items-center gap-2" onClick={handleModifyAndRestart}>
            {/* Icon placeholder */}
            <div className="w-5 h-5 bg-[var(--color-background-neutral-faded)] rounded-sm" />
            Modify & Restart
          </Button>

          <Button variant="outline" className="btn-tertiary flex items-center gap-2" onClick={handleDeleteClick}>
            {/* Icon placeholder */}
            <div className="w-5 h-5 bg-[var(--color-background-error)] rounded-sm" />
            Delete Pipeline
          </Button>
        </div>
      )}

      {/* Modify & Restart Modal */}
      <InputModal
        visible={isModifyModalVisible}
        title="Modify Pipeline Configuration"
        description="Warning: Modifying the pipeline will stop the current pipeline and you may miss events during the transition. Do you want to save the current configuration before proceeding?"
        inputLabel="Configuration Name"
        inputPlaceholder="e.g., Production Pipeline v1"
        submitButtonText="Continue"
        cancelButtonText="Cancel"
        onComplete={handleModifyModalComplete}
        pendingOperation="modify_pipeline"
        initialValue=""
        showSaveOption={true}
        validation={(value) => {
          if (!value.trim()) {
            return 'Configuration name is required'
          }
          if (value.length < 3) {
            return 'Configuration name must be at least 3 characters long'
          }
          return null
        }}
      />

      {/* Delete Pipeline Modal */}
      <InputModal
        visible={isDeleteModalVisible}
        title="Delete Pipeline"
        description="Do you want to save the current pipeline configuration before deleting it?"
        inputLabel="Configuration Name"
        inputPlaceholder="e.g., Production Pipeline v1"
        submitButtonText="Save and Delete"
        cancelButtonText="Cancel"
        onComplete={handleDeleteModalComplete}
        pendingOperation="delete_pipeline"
        initialValue=""
        showSaveOption={true}
        validation={(value) => {
          if (!value.trim()) {
            return 'Configuration name is required'
          }
          if (value.length < 3) {
            return 'Configuration name must be at least 3 characters long'
          }
          return null
        }}
      />
    </div>
  )
}
