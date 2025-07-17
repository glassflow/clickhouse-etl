'use client'

import { Button } from '@/src/components/ui/button'
import { Badge } from '@/src/components/ui/badge'
import { Card } from '@/src/components/ui/card'
import { StatusBadge } from '@/src/components/common/StatusBadge'
import { StatusType } from '@/src/config/constants'
import ActionButton from '@/src/components/shared/ActionButton'
import DeletePipelineModal from '@/src/modules/pipelines/components/DeletePipelineModal'
import RenamePipelineModal from '@/src/modules/pipelines/components/RenamePipelineModal'
import EditPipelineModal from '@/src/modules/pipelines/components/EditPipelineModal'
import PausePipelineModal from '@/src/modules/pipelines/components/PausePipelineModal'
import {
  useDeletePipelineModal,
  useRenamePipelineModal,
  useEditPipelineModal,
  usePausePipelineModal,
} from '@/src/modules/pipelines/hooks'

function PipelineDetailsHeader({
  title,
  status,
  actions,
}: {
  title: string
  status: StatusType
  actions?: React.ReactNode
}) {
  const { isDeleteModalVisible, openDeleteModal, closeDeleteModal } = useDeletePipelineModal()
  const { isRenameModalVisible, openRenameModal, closeRenameModal } = useRenamePipelineModal()
  const { isEditModalVisible, openEditModal, closeEditModal } = useEditPipelineModal()
  const { isPauseModalVisible, openPauseModal, closePauseModal } = usePausePipelineModal()

  const handleDelete = () => {
    openDeleteModal()
  }
  const handleRename = () => {
    openRenameModal()
  }
  const handleEdit = () => {
    openEditModal()
  }
  const handlePause = () => {
    openPauseModal()
  }

  return (
    <>
      <Card className="border-[var(--color-border-neutral)] rounded-md py-2 px-6 mb-4">
        <div className="flex flex-col gap-4">
          <div className="flex flex-row justify-between gap-2">
            <div className="flex flex-row flex-start gap-2">
              <h2 className="text-2xl font-bold">{title}</h2>
              <StatusBadge status={status} />
            </div>
            <div className="flex flex-row flex-end gap-2">
              {actions || (
                <>
                  <ActionButton action="edit" onClick={handleEdit} />
                  <ActionButton action="rename" onClick={handleRename} />
                  <ActionButton action="delete" onClick={handleDelete} />
                  <ActionButton action="pause" onClick={handlePause} />
                </>
              )}
            </div>
          </div>
        </div>
      </Card>

      <DeletePipelineModal
        visible={isDeleteModalVisible}
        onOk={() => {
          closeDeleteModal()
        }}
        onCancel={() => {
          closeDeleteModal()
        }}
        callback={(result) => {
          console.log(result)
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

      <PausePipelineModal
        visible={isPauseModalVisible}
        onOk={() => {
          closePauseModal()
        }}
        onCancel={() => {
          closePauseModal()
        }}
      />
    </>
  )
}

export default PipelineDetailsHeader
