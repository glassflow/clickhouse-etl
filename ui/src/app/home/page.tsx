'use client'

// import Link from 'next/link'
import Image from 'next/image'
import Join from '../../images/join.svg'
import Deduplicate from '../../images/deduplicate.svg'
import DeduplicateJoin from '../../images/deduplicate-join.svg'
import IngestOnly from '../../images/ingest-only.svg'
import PlusHome from '../../images/plus-home.svg'
// import { ThemeDebug } from '../../components/ThemeDebug'
import { useStore } from '@/src/store'
import { useRouter, useSearchParams } from 'next/navigation'
import { OperationKeys } from '@/src/config/constants'
import { cn } from '@/src/utils'
import { Button } from '@/src/components/ui/button'
import { useState, Suspense, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/src/components/ui/dialog'
import { AlertTriangleIcon } from 'lucide-react'
import { getPipelineStatus } from '@/src/api/pipeline'
import CreatePipelineModal from '@/src/components/home/CreatePipelineModal'

import { InfoModal, ModalResult } from '@/src/components/common/Modal'
import { SavedConfigurations } from '@/src/components/shared/SavedConfigurations'
import { useJourneyAnalytics } from '@/src/hooks/useJourneyAnalytics'

const ConnectionCard = () => {
  return (
    <div className="mt-12 sm:mt-16">
      <div className="w-full text-center muted-foreground mb-4">
        <p className="text-center subtitle-2">Save Kafka and ClickHouse credentials to setup pipelines quickly</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 w-full max-w-[512px]">
        <div
          className={cn(
            'card card-elevated-subtle',
            'h-16 sm:h-20 lg:h-24 w-full',
            'cursor-pointer',
            'relative',
            'group',
          )}
          onClick={() => {}}
        >
          <div className="flex items-center px-4 sm:px-6 w-full h-full">
            <Image src={PlusHome} alt="Add Kafka Connection" width={24} height={24} className="sm:w-9 sm:h-9" />
            <span className="ml-3 sm:ml-4 text-sm sm:text-lg font-medium text-muted-foreground">
              Add Kafka Connection
            </span>
          </div>
        </div>

        <div
          className={cn(
            'card card-elevated-subtle',
            'h-16 sm:h-20 lg:h-24 w-full',
            'cursor-pointer',
            'relative',
            'group',
          )}
          onClick={() => {}}
        >
          <div className="flex items-center px-4 sm:px-6 w-full h-full">
            <Image src={PlusHome} alt="Add ClickHouse Connection" width={24} height={24} className="sm:w-9 sm:h-9" />
            <span className="ml-3 sm:ml-4 text-sm sm:text-lg font-medium text-muted-foreground">
              Add ClickHouse Connection
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}

// Client Component for handling searchParams
function HomePageClient() {
  const {
    operationsSelected,
    setOperationsSelected,
    analyticsConsent,
    setAnalyticsConsent,
    consentAnswered,
    setConsentAnswered,
    resetPipelineState,
    topicsStore,
    isDirty,
    markAsDirty,
    markAsClean,
    kafkaStore,
    joinStore,
    clickhouseStore,
  } = useStore()
  const analytics = useJourneyAnalytics()
  const searchParams = useSearchParams()
  const showWarning = searchParams.get('showWarning') === 'true'
  const fromPath = searchParams.get('from')
  const [showWarningModal, setShowWarningModal] = useState(showWarning)
  const router = useRouter()
  const [pendingOperation, setPendingOperation] = useState<string | null>(null)
  const [isCreatePipelineModalVisible, setIsCreatePipelineModalVisible] = useState(false)

  const { getIsKafkaConnectionDirty } = kafkaStore
  const { getIsTopicDirty } = topicsStore
  const { getIsJoinDirty } = joinStore
  const { getIsClickhouseConnectionDirty, getClickhouseMappingDirty } = clickhouseStore

  // Check for running pipeline and redirect to pipeline page if one exists
  useEffect(() => {
    const checkRunningPipeline = async () => {
      try {
        const response = await getPipelineStatus()
        if (response.pipeline_id) {
          // There is a running pipeline, redirect to pipeline page
          router.push('/pipelines')
        }
      } catch (err) {
        // No pipeline running, stay on home page
      }
    }

    checkRunningPipeline()
  }, [router])

  // Track page view when component loads
  useEffect(() => {
    analytics.page.homepage({
      referrer: fromPath || document.referrer,
      timestamp: new Date().toISOString(),
    })
  }, [analytics.page, fromPath])

  const handleOperationClick = (operation: OperationKeys) => {
    if (operation === OperationKeys.DEDUPLICATION) {
      analytics.operation.deduplication({
        operationType: operation,
      })
    } else if (operation === OperationKeys.JOINING) {
      analytics.operation.join({
        operationType: operation,
      })
    } else if (operation === OperationKeys.DEDUPLICATION_JOINING) {
      analytics.operation.dedupAndJoin({
        operationType: operation,
      })
    } else if (operation === OperationKeys.INGEST_ONLY) {
      analytics.operation.ingestOnly({
        operationType: operation,
      })
    }

    setPendingOperation(operation)
    setIsCreatePipelineModalVisible(true)
  }

  const handleWarningModalComplete = (result: string) => {
    setShowWarningModal(false)

    if (result === ModalResult.YES) {
      // Reset pipeline state and stay on home page
      resetPipelineState('', true)
    } else {
      // Go back to previous page
      router.push(fromPath || '/')
    }
  }

  const completeOperationSelection = (operation: OperationKeys) => {
    resetPipelineState(operation, true)
    setOperationsSelected({
      operation,
    })
    router.push('/pipelines/create')
  }

  const handleCreatePipelineModalComplete = async (result: string, configName?: string) => {
    setIsCreatePipelineModalVisible(false)

    // Save configuration if the user chose to do so and provided a name
    if (result === ModalResult.YES && configName) {
      try {
        // save pipeline name to local storage
        completeOperationSelection(pendingOperation as OperationKeys)
      } catch (error) {
        console.error('Failed to save configuration:', error)
      }
    }

    // Reset pipeline state and navigate to home regardless of save choice
    if (result === ModalResult.CANCEL || result === ModalResult.NO) {
      setIsCreatePipelineModalVisible(false)
    }
  }

  return (
    <div className="flex flex-col items-center gap-6 sm:gap-8 max-w-[var(--hero-container-width)] mx-auto px-4 sm:px-6 lg:px-8">
      <h1 className="title-1 sm:text-3xl lg:text-4xl text-brand-gradient text-center">Welcome!</h1>
      <p className="w-full text-center subtitle muted-foreground text-sm sm:text-base">
        Create a new pipeline with ready-to-use data operations
      </p>
      {/* <ThemeDebug /> */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 mt-8 sm:mt-12 w-full max-w-[512px]">
        <div
          className={cn(
            'card card-elevated',
            operationsSelected?.operation === OperationKeys.DEDUPLICATION && 'active',
            'h-16 sm:h-20 lg:h-24 w-full',
          )}
        >
          <button
            className="flex items-center px-4 sm:px-6 w-full h-full"
            onClick={() => handleOperationClick(OperationKeys.DEDUPLICATION)}
          >
            <Image src={Deduplicate} alt="Deduplicate" width={24} height={24} className="sm:w-9 sm:h-9" />
            <span className="ml-3 sm:ml-4 text-sm sm:text-lg font-medium text-muted-foreground">Deduplicate</span>
          </button>
        </div>
        <div
          className={cn(
            'card card-elevated',
            operationsSelected?.operation === OperationKeys.JOINING && 'active',
            'h-16 sm:h-20 lg:h-24 w-full',
          )}
        >
          <button
            className="flex items-center px-4 sm:px-6 w-full h-full"
            onClick={() => handleOperationClick(OperationKeys.JOINING)}
          >
            <Image src={Join} alt="Join" width={24} height={24} className="sm:w-9 sm:h-9" />
            <span className="ml-3 sm:ml-4 text-sm sm:text-lg font-medium text-muted-foreground">Join</span>
          </button>
        </div>

        <div
          className={cn(
            'card card-elevated',
            operationsSelected?.operation === OperationKeys.DEDUPLICATION_JOINING && 'active',
            'h-16 sm:h-20 lg:h-24 w-full',
          )}
        >
          <button
            className="flex items-center px-4 sm:px-6 w-full h-full"
            onClick={() => handleOperationClick(OperationKeys.DEDUPLICATION_JOINING)}
          >
            <Image src={DeduplicateJoin} alt="Deduplicate Join" width={24} height={24} className="sm:w-9 sm:h-9" />
            <span className="ml-3 sm:ml-4 text-sm sm:text-lg font-medium text-muted-foreground">
              Deduplicate & Join
            </span>
          </button>
        </div>

        <div
          className={cn(
            'card card-elevated',
            operationsSelected?.operation === OperationKeys.INGEST_ONLY && 'active',
            'h-16 sm:h-20 lg:h-24 w-full',
          )}
        >
          <button
            className="flex items-center px-4 sm:px-6 w-full h-full"
            onClick={() => handleOperationClick(OperationKeys.INGEST_ONLY)}
          >
            <Image src={IngestOnly} alt="Ingest Only" width={24} height={24} className="sm:w-9 sm:h-9" />
            <span className="ml-3 sm:ml-4 text-sm sm:text-lg font-medium text-muted-foreground">Ingest Only</span>
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

      <ConnectionCard />

      <div className="w-full mt-12 sm:mt-16">
        <SavedConfigurations />
      </div>

      <CreatePipelineModal visible={isCreatePipelineModalVisible} onComplete={handleCreatePipelineModalComplete} />
    </div>
  )
}

// Main Page component (can be a Server Component)
export default function HomePage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <HomePageClient />
    </Suspense>
  )
}
