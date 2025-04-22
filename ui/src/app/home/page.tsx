'use client'

// import Link from 'next/link'
import Image from 'next/image'
import Join from '../../images/join.svg'
import Deduplicate from '../../images/deduplicate.svg'
import DeduplicateJoin from '../../images/deduplicate-join.svg'
import IngestOnly from '../../images/ingest-only.svg'
// import { ThemeDebug } from '../../components/ThemeDebug'
import { useStore } from '@/src/store'
import { useRouter, useSearchParams } from 'next/navigation'
import { OperationKeys } from '@/src/config/constants'
import { cn } from '@/src/utils'
import { Button } from '@/src/components/ui/button'
import { useState, Suspense } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/src/components/ui/dialog'
import { AlertTriangleIcon } from 'lucide-react'

import { InfoModal, ModalResult } from '@/src/components/Modal'
import { SavedConfigurations } from '@/src/components/home/SavedConfigurations'

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
  const searchParams = useSearchParams()
  const showWarning = searchParams.get('showWarning') === 'true'
  const fromPath = searchParams.get('from')
  const [showWarningModal, setShowWarningModal] = useState(showWarning)
  const router = useRouter()

  const { getIsKafkaConnectionDirty } = kafkaStore
  const { getIsTopicDirty } = topicsStore
  const { getIsJoinDirty } = joinStore
  const { getIsClickhouseConnectionDirty, getClickhouseMappingDirty } = clickhouseStore

  const handleOperationClick = (operation: OperationKeys) => {
    completeOperationChange(operation)
    // const isDirty =
    //   getIsKafkaConnectionDirty() ||
    //   getIsTopicDirty() ||
    //   getIsJoinDirty() ||
    //   getIsClickhouseConnectionDirty() ||
    //   getClickhouseMappingDirty()

    // if (operation !== operationsSelected.operation && isDirty) {
    //   // Show warning modal instead of window.confirm
    //   setShowWarningModal(true)
    // } else {
    //   // No data to lose, just reset
    //   completeOperationChange(operation)
    // }
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

  const completeOperationChange = (operation: OperationKeys) => {
    resetPipelineState(operation, true)
    setOperationsSelected({
      operation,
    })
    router.push('/pipelines/create')
  }

  return (
    <div className="flex flex-col items-center gap-8 max-w-[var(--hero-container-width)] mx-auto px-4 sm:px-6 lg:px-8">
      <h1 className="title-1 text-gradient">Welcome!</h1>
      <p className="w-full text-center subtitle">Create a new pipeline with ready-to-use data operations</p>
      {/* <ThemeDebug /> */}
      <div className="grid grid-cols-2 gap-4 mt-6 w-full max-w-[512px]">
        <div
          className={cn(
            'card-gradient',
            operationsSelected?.operation === OperationKeys.DEDUPLICATION && 'card-gradient-active',
            'btn-home-lg',
          )}
        >
          <button
            className="flex items-center px-6 w-full h-full"
            onClick={() => handleOperationClick(OperationKeys.DEDUPLICATION)}
          >
            <Image src={Deduplicate} alt="Deduplicate" width={36} height={36} />
            <span className="ml-4 text-lg font-medium">Deduplicate</span>
          </button>
        </div>
        <div
          className={cn(
            'card-gradient',
            operationsSelected?.operation === OperationKeys.JOINING && 'card-gradient-active',
            'btn-home-lg',
          )}
        >
          <button
            className="flex items-center px-6 w-full h-full"
            onClick={() => handleOperationClick(OperationKeys.JOINING)}
          >
            <Image src={Join} alt="Join" width={36} height={36} />
            <span className="ml-4 text-lg font-medium">Join</span>
          </button>
        </div>

        <div
          className={cn(
            'card-gradient',
            operationsSelected?.operation === OperationKeys.DEDUPLICATION_JOINING && 'card-gradient-active',
            'btn-home-lg',
          )}
        >
          <button
            className="flex items-center px-6 w-full h-full"
            onClick={() => handleOperationClick(OperationKeys.DEDUPLICATION_JOINING)}
          >
            <Image src={DeduplicateJoin} alt="Deduplicate Join" width={36} height={36} />
            <span className="ml-4 text-lg font-medium">Deduplicate & Join</span>
          </button>
        </div>

        <div
          className={cn(
            'card-gradient',
            operationsSelected?.operation === OperationKeys.INGEST_ONLY && 'card-gradient-active',
            'btn-home-lg',
          )}
        >
          <button
            className="flex items-center px-6 w-full h-full"
            onClick={() => handleOperationClick(OperationKeys.INGEST_ONLY)}
          >
            <Image src={IngestOnly} alt="Ingest Only" width={36} height={36} />
            <span className="ml-4 text-lg font-medium">Ingest Only</span>
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

      <div className="w-full mt-16">
        <SavedConfigurations />
      </div>
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
