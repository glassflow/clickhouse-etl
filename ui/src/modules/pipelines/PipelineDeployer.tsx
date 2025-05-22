'use client'

import React, { useEffect, useState } from 'react'
import { useStore } from '@/src/store'
import { Clock, Loader2, Trash2 } from 'lucide-react'
import { cn } from '@/src/utils'
import { Button } from '@/src/components/ui/button'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import {
  createPipeline,
  shutdownPipeline,
  getPipelineStatus,
  PipelineResponse,
  PipelineError,
} from '@/src/api/pipeline'
import axios from 'axios'
import { InputModal, ModalResult } from '@/src/components/shared/InputModal'
import { saveConfiguration } from '@/src/utils/storage'
import { isValidApiConfig } from '@/src/modules/pipelines/helpers'
import TrashIcon from '../../images/trash.svg'
import ModifyIcon from '../../images/modify.svg'
import AngryIcon from '../../images/angry.svg'
import FrownIcon from '../../images/frown.svg'
import SmileIcon from '../../images/smile.svg'
import MehIcon from '../../images/meh.svg'
import LaughIcon from '../../images/laugh.svg'
import AngryIconSelected from '../../images/selected/angry.svg'
import FrownIconSelected from '../../images/selected/frown.svg'
import SmileIconSelected from '../../images/selected/smile.svg'
import MehIconSelected from '../../images/selected/meh.svg'
import LaughIconSelected from '../../images/selected/laugh.svg'
import { useJourneyAnalytics } from '@/src/hooks/useJourneyAnalytics'

// NOTE: Set to true to enable saving pipelines
const SAVE_PIPELINE_ENABLED = true

type PipelineStatus = 'deploying' | 'active' | 'deleted' | 'deploy_failed' | 'delete_failed' | 'no_configuration'
type FeedbackType = 'angry' | 'frown' | 'meh' | 'smile' | 'laugh' | null

const FEEDBACK_SUBMITTED_KEY = 'glassflow-feedback-submitted'
const FEEDBACK_DELAY_MS = 1000 // 1 second delay

export function PipelineDeployer() {
  const analytics = useJourneyAnalytics()
  const { apiConfig, resetPipelineState, pipelineId } = useStore()
  const [status, setStatus] = useState<PipelineStatus>('deploying')
  const [error, setError] = useState<string | null>(null)
  const [isModifyModalVisible, setIsModifyModalVisible] = useState(false)
  const [isDeleteModalVisible, setIsDeleteModalVisible] = useState(false)
  const [selectedFeedback, setSelectedFeedback] = useState<FeedbackType>(null)
  const [feedbackText, setFeedbackText] = useState('')
  const [hasSubmittedFeedback, setHasSubmittedFeedback] = useState(false)
  const [showFeedback, setShowFeedback] = useState(false)
  const router = useRouter()
  const [isRedirecting, setIsRedirecting] = useState(false)

  // Check if feedback was already submitted
  useEffect(() => {
    const feedbackSubmitted = localStorage.getItem(FEEDBACK_SUBMITTED_KEY)
    if (feedbackSubmitted === 'true') {
      setHasSubmittedFeedback(true)
    }

    // Track page view when component loads
    analytics.page.pipelines({})
  }, [])

  // Handle showing feedback with delay and status check
  useEffect(() => {
    let timeoutId: NodeJS.Timeout

    const shouldShowFeedback = () => {
      return !hasSubmittedFeedback && (status === 'active' || status === 'deploy_failed' || status === 'delete_failed')
    }

    if (shouldShowFeedback()) {
      timeoutId = setTimeout(() => {
        setShowFeedback(true)
      }, FEEDBACK_DELAY_MS)
    } else {
      setShowFeedback(false)
    }

    return () => {
      if (timeoutId) {
        clearTimeout(timeoutId)
      }
    }
  }, [status, hasSubmittedFeedback])

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
            analytics.pipeline.noValidConfig({})
            setStatus('active')
            setError(null)
          }
        } else {
          // No running pipeline
          if (isValidApiConfig(apiConfig)) {
            // We have a valid config and no running pipeline - we can deploy
            analytics.pipeline.noPipeline_Deploying({})
            deployPipeline()
          } else {
            // No config and no pipeline - redirect to home immediately
            analytics.pipeline.noPipeline_NoConfig({})
            router.push('/home')
          }
        }
      } catch (err: any) {
        if (err.code === 404) {
          // No pipeline exists
          if (isValidApiConfig(apiConfig)) {
            analytics.pipeline.noPipeline_Deploying({})
            deployPipeline()
          } else {
            // No config and no pipeline - redirect to home immediately
            analytics.pipeline.noPipeline_NoConfig({})
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

  const isNegativeFeedback = selectedFeedback === 'angry' || selectedFeedback === 'frown' || selectedFeedback === 'meh'

  const handleFeedbackSelect = (feedback: FeedbackType) => {
    setSelectedFeedback(feedback)
  }

  const handleFeedbackSubmit = () => {
    // Store feedback submission in localStorage
    localStorage.setItem(FEEDBACK_SUBMITTED_KEY, 'true')
    setHasSubmittedFeedback(true)

    // Reset form
    setSelectedFeedback(null)
    setFeedbackText('')
  }

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

      {showFeedback && (
        <div
          className={`
            content-card cursor-pointer group min-w-[480px] mt-16 
            transition-all duration-500 ease-out
            transform translate-y-0 opacity-100
            ${isNegativeFeedback ? 'min-h-[400px]' : 'min-h-[120px]'}
            animate-feedback-entrance
          `}
        >
          <div className="flex flex-col items-center justify-center w-full p-8">
            <h1 className="text-lg font-medium">How was your experience?</h1>
            <div className="flex items-center justify-center w-full gap-2 my-4">
              <button
                onClick={() => handleFeedbackSelect('angry')}
                className={`p-2 transition-all ${selectedFeedback === 'angry' ? 'text-[var(--primary)]' : 'text-gray-400'}`}
              >
                <Image
                  src={selectedFeedback === 'angry' ? AngryIconSelected : AngryIcon}
                  alt="Angry"
                  width={32}
                  height={32}
                  className="transition-opacity duration-200"
                />
              </button>
              <button
                onClick={() => handleFeedbackSelect('frown')}
                className={`p-2 transition-all ${selectedFeedback === 'frown' ? 'text-[var(--primary)]' : 'text-gray-400'}`}
              >
                <Image
                  src={selectedFeedback === 'frown' ? FrownIconSelected : FrownIcon}
                  alt="Frown"
                  width={32}
                  height={32}
                  className="transition-opacity duration-200"
                />
              </button>
              <button
                onClick={() => handleFeedbackSelect('meh')}
                className={`p-2 transition-all ${selectedFeedback === 'meh' ? 'text-[var(--primary)]' : 'text-gray-400'}`}
              >
                <Image
                  src={selectedFeedback === 'meh' ? MehIconSelected : MehIcon}
                  alt="Meh"
                  width={32}
                  height={32}
                  className="transition-opacity duration-200"
                />
              </button>
              <button
                onClick={() => handleFeedbackSelect('smile')}
                className={`p-2 transition-all ${selectedFeedback === 'smile' ? 'text-[var(--primary)]' : 'text-gray-400'}`}
              >
                <Image
                  src={selectedFeedback === 'smile' ? SmileIconSelected : SmileIcon}
                  alt="Smile"
                  width={32}
                  height={32}
                  className="transition-opacity duration-200"
                />
              </button>
              <button
                onClick={() => handleFeedbackSelect('laugh')}
                className={`p-2 transition-all ${selectedFeedback === 'laugh' ? 'text-[var(--primary)]' : 'text-gray-400'}`}
              >
                <Image
                  src={selectedFeedback === 'laugh' ? LaughIconSelected : LaughIcon}
                  alt="Laugh"
                  width={32}
                  height={32}
                  className="transition-opacity duration-200"
                />
              </button>
            </div>
            <div
              className={`w-full transition-all duration-300 ease-in-out ${isNegativeFeedback ? 'opacity-100 max-h-[200px]' : 'opacity-0 max-h-0 overflow-hidden'}`}
            >
              <textarea
                value={feedbackText}
                onChange={(e) => setFeedbackText(e.target.value.slice(0, 1000))}
                placeholder="Please tell us what we can improve..."
                maxLength={1000}
                className="w-full p-3 rounded-md border border-[var(--color-border-regular)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)] min-h-[180px] resize-none bg-[var(--color-background)] text-[var(--color-content)]"
              />
              <div className="text-sm text-gray-500 mt-1 text-left">{feedbackText.length}/1000 characters</div>
            </div>
            <div
              className={`flex items-center justify-end w-full mt-4 transition-all duration-300 ease-in-out ${isNegativeFeedback ? 'opacity-100' : 'opacity-0'}`}
            >
              <Button
                className="btn-primary btn-text"
                type="button"
                variant="gradient"
                size="custom"
                onClick={handleFeedbackSubmit}
                disabled={!selectedFeedback || (isNegativeFeedback && !feedbackText.trim())}
              >
                Send
              </Button>
            </div>
          </div>
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
