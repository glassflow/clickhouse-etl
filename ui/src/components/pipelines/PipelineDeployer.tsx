'use client'

import React, { useEffect, useState } from 'react'
import { useStore } from '@/src/store'
import { useAnalytics } from '@/src/hooks/useAnalytics'
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
import { InputModal, ModalResult } from '@/src/components/InputModal'
import { saveConfiguration } from '@/src/utils/storage'
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

// NOTE: Set to true to enable saving pipelines
const SAVE_PIPELINE_ENABLED = true

type PipelineStatus = 'deploying' | 'active' | 'deleted' | 'deploy_failed' | 'delete_failed'
type FeedbackType = 'angry' | 'frown' | 'meh' | 'smile' | 'laugh' | null

const FEEDBACK_SUBMITTED_KEY = 'glassflow-feedback-submitted'
const FEEDBACK_DELAY_MS = 1000 // 1 second delay

export function PipelineDeployer() {
  const { apiConfig, resetPipelineState, pipelineId } = useStore()
  const { trackPipelineAction, trackEngagement } = useAnalytics()
  const [status, setStatus] = useState<PipelineStatus>('deploying')
  const [error, setError] = useState<string | null>(null)
  const [isModifyModalVisible, setIsModifyModalVisible] = useState(false)
  const [isDeleteModalVisible, setIsDeleteModalVisible] = useState(false)
  const [selectedFeedback, setSelectedFeedback] = useState<FeedbackType>(null)
  const [feedbackText, setFeedbackText] = useState('')
  const [hasSubmittedFeedback, setHasSubmittedFeedback] = useState(false)
  const [showFeedback, setShowFeedback] = useState(false)
  const router = useRouter()

  // Check if feedback was already submitted
  useEffect(() => {
    const feedbackSubmitted = localStorage.getItem(FEEDBACK_SUBMITTED_KEY)
    if (feedbackSubmitted === 'true') {
      setHasSubmittedFeedback(true)
    }
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

  const isNegativeFeedback = selectedFeedback === 'angry' || selectedFeedback === 'frown' || selectedFeedback === 'meh'

  const handleFeedbackSelect = (feedback: FeedbackType) => {
    setSelectedFeedback(feedback)
    // Track feedback selection
    trackEngagement('feedback_selected', {
      feedback_type: feedback,
      pipeline_id: pipelineId,
    })
  }

  const handleFeedbackSubmit = () => {
    // Track feedback submission
    trackEngagement('feedback_submitted', {
      feedback_type: selectedFeedback,
      feedback_text: feedbackText,
      pipeline_id: pipelineId,
    })

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
          <div className="w-[10px] h-[10px] bg-[#009D3F] rounded-full" />
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
            <Image src={ModifyIcon} alt="Modify & Restart" width={16} height={16} />
            Modify & Restart
          </Button>

          <Button variant="outline" className="btn-tertiary flex items-center gap-2" onClick={handleDeleteClick}>
            {/* Icon placeholder */}
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
