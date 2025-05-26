'use client'

import React, { useEffect, useState } from 'react'
import { useStore } from '@/src/store'
import { Loader2 } from 'lucide-react'
import { cn } from '@/src/utils'
import { Button } from '@/src/components/ui/button'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { createPipeline, shutdownPipeline, getPipelineStatus, PipelineError } from '@/src/api/pipeline'
import { InputModal, ModalResult } from '@/src/components/shared/InputModal'
import { saveConfiguration } from '@/src/utils/storage'
import { isValidApiConfig } from '@/src/modules/pipelines/helpers'
import TrashIcon from '../../images/trash.svg'
import ModifyIcon from '../../images/modify.svg'
import { useJourneyAnalytics } from '@/src/hooks/useJourneyAnalytics'
import { Feedback } from './Feedback'

type PipelineStatus = 'deploying' | 'active' | 'deleted' | 'deploy_failed' | 'delete_failed' | 'no_configuration'

export function PipelineDeployer() {
  const analytics = useJourneyAnalytics()
  const { apiConfig, resetPipelineState, pipelineId } = useStore()
  const [status, setStatus] = useState<PipelineStatus>('deploying')
  const [error, setError] = useState<string | null>(null)
  const [isModifyModalVisible, setIsModifyModalVisible] = useState(false)
  const [isDeleteModalVisible, setIsDeleteModalVisible] = useState(false)

  const router = useRouter()
  const [isRedirecting, setIsRedirecting] = useState(false)

  useEffect(() => {
    const checkPipelineStatus = async () => {
      try {
        const response = await getPipelineStatus()

        if (response.pipeline_id) {
          // There is a running pipeline
          if (isValidApiConfig(apiConfig)) {
            // We have a config, but there's already a running pipeline
            if (response.pipeline_id !== pipelineId) {
              analytics.pipeline.existingPipeline({})
              setStatus('deploy_failed')
              setError('There is already a running pipeline. Please shut it down before deploying a new one.')
            } else {
              // Same pipeline is running
              analytics.pipeline.existingSamePipeline({})
              setStatus('active')
              setError(null)
            }
          } else {
            // No config, but pipeline is running - just show active status
            setStatus('active')
            setError(null)
          }
        } else {
          // No running pipeline
          if (isValidApiConfig(apiConfig)) {
            // We have a valid config and no running pipeline - we can deploy
            deployPipeline()
          } else {
            // No config and no pipeline - redirect to home immediately
            router.push('/home')
          }
        }
      } catch (err: any) {
        if (err.code === 404) {
          // No pipeline exists
          if (isValidApiConfig(apiConfig)) {
            deployPipeline()
          } else {
            // No config and no pipeline - redirect to home immediately
            router.push('/home')
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
        setStatus('active')
        setError(null)

        // Track successful pipeline deployment
        analytics.deploy.success({
          pipelineId: response.pipeline_id,
          status: 'success',
        })
      } catch (err: any) {
        setStatus('deploy_failed')
        setError(err.message)

        // Track failed pipeline deployment
        analytics.deploy.failed({
          status: 'failed',
          error: err.message,
        })
      }
    }

    // Always check pipeline status first
    checkPipelineStatus()
  }, [apiConfig, pipelineId, analytics.deploy, router])

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
        analytics.pipeline.deleteClicked({})

        await shutdownPipeline()
        setStatus('deleted')
        setError(null)
        resetPipelineState('', true)

        // Track successful pipeline deletion
        analytics.pipeline.deleteSuccess({})
      } catch (err) {
        const error = err as PipelineError
        setStatus('delete_failed')
        setError(error.message)

        // Track failed pipeline deletion
        analytics.pipeline.deleteFailed({
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
        // Track successful pipeline modification
        analytics.pipeline.modifyClicked({
          pipelineId,
          configSaved: !!configName,
          status: 'success',
        })

        await shutdownPipeline()
        setStatus('deleted')
        setError(null)
        resetPipelineState('', true)

        // Track successful pipeline modification
        analytics.pipeline.modifySuccess({})

        router.push('/home')
      } catch (err) {
        const error = err as PipelineError
        setStatus('delete_failed')
        setError(error.message)

        // Track failed pipeline modification
        analytics.pipeline.modifyFailed({
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
      case 'no_configuration':
        return 'text-[var(--color-foreground-warning)]'
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
      case 'no_configuration':
        return 'No valid configuration - Deployment not possible'
      default:
        return 'Unknown status'
    }
  }

  // const canShowButtons = status === 'active' || status === 'deploy_failed' || status === 'delete_failed'
  const canShowButtons =
    status === 'active' || (status === 'deploy_failed' && error?.includes('already a running pipeline'))

  return (
    <div className="flex flex-col items-center justify-center gap-4">
      <div className="flex items-center gap-2">
        {status === 'active' && <div className="w-[10px] h-[10px] bg-[#009D3F] rounded-full" />}
        <h1 className={cn('text-2xl font-semibold', getStatusClass(status))}>{getStatusText(status)}</h1>
        {(status === 'deploying' || isRedirecting) && <Loader2 className="h-6 w-6 animate-spin" />}
      </div>

      {error && (
        <div className="text-red-500 text-center">
          <p>{error}</p>
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
            <Image src={ModifyIcon} alt="Modify & Restart" width={16} height={16} />
            Modify & Restart
          </Button>

          <Button variant="outline" className="btn-tertiary flex items-center gap-2" onClick={handleDeleteClick}>
            <Image src={TrashIcon} alt="Delete Pipeline" width={16} height={16} />
            Delete Pipeline
          </Button>
        </div>
      )}

      <Feedback />

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
