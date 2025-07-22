'use client'

import React, { useEffect, useState } from 'react'
import { useStore } from '@/src/store'
import { Button } from '@/src/components/ui/button'
import { useRouter } from 'next/navigation'
import { createPipeline, shutdownPipeline, getPipelineStatus, PipelineError } from '@/src/api/pipeline'
import { InputModal, ModalResult } from '@/src/components/common/InputModal'
import { saveConfiguration } from '@/src/utils/local-storage-config'
import { isValidApiConfig } from '@/src/modules/pipelines/helpers'
import TrashIcon from '../../images/trash.svg'
import ModifyIcon from '../../images/modify.svg'
import { useJourneyAnalytics } from '@/src/hooks/useJourneyAnalytics'
import { Feedback } from './Feedback'
import { Pipeline } from '@/src/types/pipeline'
import { PipelinesTable, TableColumn } from '@/src/modules/pipelines/PipelinesTable'
import { MobilePipelinesList } from '@/src/modules/pipelines/MobilePipelinesList'
import { Badge } from '@/src/components/ui/badge'
import { TableContextMenu } from './TableContextMenu'
import { CreateIcon } from '@/src/components/icons'
import { InfoModal } from '@/src/components/common/InfoModal'
import { Checkbox } from '@/src/components/ui/checkbox'
import PausePipelineModal from './components/PausePipelineModal'
import DeletePipelineModal from './components/DeletePipelineModal'
import RenamePipelineModal from './components/RenamePipelineModal'
import EditPipelineModal from './components/EditPipelineModal'
import { usePausePipelineModal, useDeletePipelineModal, useRenamePipelineModal, useEditPipelineModal } from './hooks'

type PipelineStatus = 'deploying' | 'active' | 'deleted' | 'deploy_failed' | 'delete_failed' | 'no_configuration'

export function PipelinesList({ pipelines }: { pipelines: Pipeline[] }) {
  const analytics = useJourneyAnalytics()
  const { configStore, resetAllPipelineState } = useStore()
  const { pipelineId, setPipelineId } = configStore
  const [status, setStatus] = useState<PipelineStatus>('deploying')
  const [error, setError] = useState<string | null>(null)
  const { isRenameModalVisible, openRenameModal, closeRenameModal } = useRenamePipelineModal()
  const { isDeleteModalVisible, openDeleteModal, closeDeleteModal } = useDeletePipelineModal()
  const { isPauseModalVisible, openPauseModal, closePauseModal } = usePausePipelineModal()
  const { isEditModalVisible, openEditModal, closeEditModal } = useEditPipelineModal()
  const [processEvents, setProcessEvents] = useState(true)
  const [isMobile, setIsMobile] = useState(false)

  const router = useRouter()
  const [isRedirecting, setIsRedirecting] = useState(false)

  // Check if feedback was already submitted
  useEffect(() => {
    // Track page view when component loads
    analytics.page.pipelines({})
  }, [])

  // Check screen size for responsive behavior
  useEffect(() => {
    const checkScreenSize = () => {
      setIsMobile(window.innerWidth <= 768)
    }

    checkScreenSize()
    window.addEventListener('resize', checkScreenSize)
    return () => window.removeEventListener('resize', checkScreenSize)
  }, [])

  const handleDeleteClick = () => {
    openDeleteModal()
  }

  const handleDeleteModalComplete = async (result: string, configName: string, operation: string) => {
    closeDeleteModal()

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
        // Reset pipeline state and ID
        resetAllPipelineState('', true)
        setPipelineId('')

        // Track successful pipeline deletion
        analytics.pipeline.deleteSuccess({})

        router.push('/home')
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
    openRenameModal()
  }

  const handleModifyModalComplete = async (result: string, configName: string, operation: string) => {
    closeRenameModal()

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
        resetAllPipelineState('', true)

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

  // Define table columns for desktop
  const columns: TableColumn<Pipeline>[] = [
    {
      key: 'name',
      header: 'Name',
      width: '2fr',
      render: (pipeline) => <span className="font-medium">{pipeline.name}</span>,
    },
    {
      key: 'operations',
      header: 'Transformation',
      width: '2fr',
      render: (pipeline) => pipeline?.transformationName || 'None',
    },
    {
      key: 'status',
      header: 'Status',
      width: '1fr',
      render: (pipeline) => {
        const getStatusVariant = (status: string) => {
          switch (status) {
            case 'active':
              return 'success'
            case 'paused':
              return 'warning'
            case 'terminated':
              return 'error'
            case 'deleted':
              return 'secondary'
            default:
              return 'default'
          }
        }

        return <Badge variant={getStatusVariant(pipeline.status)}>{pipeline.status}</Badge>
      },
    },
    {
      key: 'actions',
      header: 'Actions',
      width: '1fr',
      render: (pipeline) => (
        <TableContextMenu
          onPause={() => handlePause(pipeline)}
          onEdit={() => handleEdit(pipeline)}
          onRename={() => handleRename(pipeline)}
          onDelete={() => handleDelete(pipeline)}
        />
      ),
    },
  ]

  // Context menu handlers
  const handlePause = (pipeline: Pipeline) => {
    console.log('Pause pipeline:', pipeline.id)
    openPauseModal()
  }

  const handleEdit = (pipeline: Pipeline) => {
    console.log('Edit pipeline:', pipeline.id)
    openEditModal()
  }

  const handleRename = (pipeline: Pipeline) => {
    console.log('Rename pipeline:', pipeline.id)
    openRenameModal()
  }

  const handleDelete = (pipeline: Pipeline) => {
    console.log('Delete pipeline:', pipeline.id)
    openDeleteModal()
  }

  const handleCreate = () => {
    router.push('/home')
  }

  return (
    <div className="flex flex-col w-full gap-6">
      {/* Header with title and button */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between w-full gap-4">
        <h1 className="text-xl sm:text-2xl font-semibold">Pipelines</h1>
        <Button variant="default" className="btn-primary btn-text" onClick={handleCreate}>
          <CreateIcon className="action-icon" size={16} />
          New Pipeline
        </Button>
      </div>

      {/* Desktop/Tablet Table */}
      <div className="hidden md:block">
        <PipelinesTable
          data={pipelines}
          columns={columns}
          emptyMessage="No pipelines found. Create your first pipeline to get started."
          onRowClick={(pipeline) => router.push(`/pipelines/${pipeline.id}`)}
        />
      </div>

      {/* Mobile List */}
      <div className="md:hidden">
        <MobilePipelinesList
          pipelines={pipelines}
          onPause={handlePause}
          onEdit={handleEdit}
          onRename={handleRename}
          onDelete={handleDelete}
          onRowClick={(pipeline) => router.push(`/pipelines/${pipeline.id}`)}
        />
      </div>

      <PausePipelineModal
        visible={isPauseModalVisible}
        onOk={() => {
          closePauseModal()
        }}
        onCancel={() => {
          closePauseModal()
        }}
      />
      <RenamePipelineModal
        visible={isRenameModalVisible}
        onOk={() => {
          closeRenameModal()
        }}
        onCancel={() => {
          closeRenameModal()
        }}
      />
      <EditPipelineModal
        visible={isEditModalVisible}
        onOk={() => {
          closeEditModal()
        }}
        onCancel={() => {
          closeEditModal()
        }}
      />
      <DeletePipelineModal
        visible={isDeleteModalVisible}
        onOk={(processEvents) => {
          closeDeleteModal()
          console.log(processEvents)
        }}
        onCancel={() => {
          closeDeleteModal()
        }}
        callback={(result) => {
          console.log(result)
          setProcessEvents(result)
        }}
      />
    </div>
  )
}

const ActiveChip = ({ status }: { status: Pipeline['status'] }) => {
  return <span className="chip-positive">{status}</span>
}
