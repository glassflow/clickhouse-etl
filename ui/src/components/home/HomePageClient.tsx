'use client'

import Image from 'next/image'
import Join from '../../images/join.svg'
import IngestOnly from '../../images/ingest-only.svg'
import { useStore } from '@/src/store'
import { useRouter, useSearchParams } from 'next/navigation'
import { cn } from '@/src/utils/common.client'
import { useState, useEffect } from 'react'
import CreatePipelineModal from '@/src/components/home/CreatePipelineModal'
import { InfoModal, ModalResult } from '@/src/components/common/InfoModal'
import { useJourneyAnalytics } from '@/src/hooks/useJourneyAnalytics'
import { generatePipelineId } from '@/src/utils/common.client'
import { usePlatformDetection } from '@/src/hooks/usePlatformDetection'
import { getPipelines } from '@/src/api/pipeline-api'
import { countPipelinesBlockingCreation } from '@/src/utils/pipeline-actions'

// Client Component for handling searchParams
export default function HomePageClient() {
  const { topicsStore, kafkaStore, joinStore, coreStore, resetForNewPipeline, resetAllPipelineState } = useStore()
  const analytics = useJourneyAnalytics()
  const searchParams = useSearchParams()
  const showWarning = searchParams?.get('showWarning') === 'true'
  const fromPath = searchParams?.get('from')
  const [showWarningModal, setShowWarningModal] = useState(showWarning)
  const router = useRouter()
  const [pendingTopicCount, setPendingTopicCount] = useState<number | null>(null)
  const [isCreatePipelineModalVisible, setIsCreatePipelineModalVisible] = useState(false)
  const [isNavigating, setIsNavigating] = useState(false)
  const [activePipelinesCount, setActivePipelinesCount] = useState(0)
  const [showPipelineLimitModal, setShowPipelineLimitModal] = useState(false)
  const { setPipelineName, setPipelineId, topicCount, enterCreateMode } = coreStore
  const { isDocker, isLocal } = usePlatformDetection()

  // by default enter create mode as soon as the component loads
  useEffect(() => {
    enterCreateMode()
  }, [enterCreateMode])

  // Fetch active pipelines count for platform limitation check
  useEffect(() => {
    const fetchActivePipelines = async () => {
      try {
        const pipelines = await getPipelines()
        // Count pipelines that are active or paused as blocking new pipeline creation
        // Only terminated or deleted pipelines allow new pipeline creation
        const blockingCount = countPipelinesBlockingCreation(pipelines)
        setActivePipelinesCount(blockingCount)
      } catch (error) {
        console.error('Failed to fetch pipelines:', error)
        setActivePipelinesCount(0)
      }
    }

    // Only fetch if we're on a platform that has limitations
    if (isDocker || isLocal) {
      fetchActivePipelines()
    }
  }, [isDocker, isLocal])

  // Track page view when component loads
  useEffect(() => {
    analytics.page.homepage({
      referrer: fromPath || document.referrer,
      timestamp: new Date().toISOString(),
    })
  }, [analytics.page, fromPath])

  const handleTopicCountClick = (count: 1 | 2) => {
    // Check if we're on a platform with limitations and there are active pipelines
    if ((isDocker || isLocal) && activePipelinesCount > 0) {
      setShowPipelineLimitModal(true)
      return
    }

    // Track topic count selection analytics
    analytics.operation.ingestOnly({
      operationType: count === 1 ? 'single-topic' : 'two-topics',
    })

    setPendingTopicCount(count)
    setIsCreatePipelineModalVisible(true)
    setIsNavigating(false) // Reset navigation state when opening modal
  }

  const handleWarningModalComplete = (result: string) => {
    setShowWarningModal(false)

    if (result === ModalResult.YES) {
      // Reset pipeline state and stay on home page
      resetAllPipelineState(0, true)
    } else {
      // Go back to previous page
      router.push(fromPath || '/')
    }
  }

  const handlePipelineLimitModalComplete = (result: string) => {
    setShowPipelineLimitModal(false)

    if (result === ModalResult.YES) {
      // Navigate to pipelines page to manage active pipelines
      router.push('/pipelines')
    }
  }

  const completeTopicCountSelection = async (topicCount: number, configName: string, pipelineId?: string) => {
    setIsNavigating(true)

    try {
      // Use the optimized reset method for new pipeline creation
      resetForNewPipeline(topicCount)
      setPipelineName(configName)

      // Use provided pipeline ID or generate one
      const finalPipelineId = pipelineId || generatePipelineId(configName)
      setPipelineId(finalPipelineId)

      // Use setTimeout to ensure state updates are processed before navigation
      setTimeout(() => {
        router.push('/pipelines/create')
      }, 0)
    } catch (error) {
      setIsNavigating(false)
      console.error('Failed to complete topic count selection:', error)
    }
  }

  const handleCreatePipelineModalComplete = async (result: string, configName?: string, pipelineId?: string) => {
    // Don't close modal immediately if we're proceeding with creation
    if (result !== ModalResult.YES) {
      setIsCreatePipelineModalVisible(false)
      setIsNavigating(false)
      return
    }

    // Save configuration if the user chose to do so and provided a name
    if (result === ModalResult.YES && configName && pendingTopicCount) {
      try {
        // Keep modal open while navigating
        await completeTopicCountSelection(pendingTopicCount, configName, pipelineId)
        // Modal will be closed when component unmounts due to navigation
      } catch (error) {
        console.error('Failed to save configuration:', error)
        setIsCreatePipelineModalVisible(false)
        setIsNavigating(false)
      }
    }
  }

  return (
    <div className="grow flex-col items-start gap-6 sm:gap-8 container mx-auto px-4 sm:px-0 py-20">
      <div className="flex flex-col items-start gap-6 sm:gap-8 w-full px-4 sm:px-0 py-16 sm:py-20">
        <h1 className="title-1 sm:text-3xl lg:text-4xl text-brand-gradient text-start">Create Pipeline</h1>
        <h2 className="w-full text-start subtitle muted-foreground text-xs sm:text-sm">
          Choose a pipeline type based on the number of streams you want to ingest
        </h2>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 mt-8 sm:mt-12 w-full max-w-[640px]">
        <div className={cn('card card-elevated', topicCount === 1 && 'active', 'h-16 sm:h-20 lg:h-24 w-full')}>
          <button
            className="flex items-center justify-center px-4 sm:px-6 w-full h-full"
            onClick={() => handleTopicCountClick(1)}
          >
            <Image src={IngestOnly} alt="Ingest Only" width={24} height={24} className="sm:w-9 sm:h-9" />
            <span className="ml-3 sm:ml-4text-sm sm:text-lg font-medium text-muted-foreground">
              Single-Topic Pipeline
            </span>
          </button>
        </div>
        <div className={cn('card card-elevated', topicCount === 2 && 'active', 'h-16 sm:h-20 lg:h-24 w-full')}>
          <button
            className="flex items-center justify-center px-4 sm:px-6 w-full h-full"
            onClick={() => handleTopicCountClick(2)}
          >
            <Image src={Join} alt="Join" width={24} height={24} className="sm:w-9 sm:h-9" />
            <span className="ml-3 sm:ml-4 text-sm sm:text-lg font-medium text-muted-foreground">
              Multi-Topic Pipeline
            </span>
          </button>
        </div>
      </div>

      <InfoModal
        visible={showWarningModal}
        title="Warning"
        description="Returning to the home page will reset your current pipeline configuration. Are you sure you want to proceed?"
        okButtonText="Yes"
        cancelButtonText="No"
        onComplete={handleWarningModalComplete}
      />

      <InfoModal
        visible={showPipelineLimitModal}
        title="Pipeline Limit Reached"
        description={`Only one active pipeline is allowed on ${isDocker ? 'Docker' : 'Local'} version. To create a new pipeline, you must first terminate or delete any currently active or paused pipelines.`}
        okButtonText="Manage Pipelines"
        cancelButtonText="Cancel"
        onComplete={handlePipelineLimitModalComplete}
      />

      <CreatePipelineModal
        visible={isCreatePipelineModalVisible}
        onComplete={handleCreatePipelineModalComplete}
        isNavigating={isNavigating}
      />
    </div>
  )
}
