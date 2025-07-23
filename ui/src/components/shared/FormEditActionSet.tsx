import { useState, useEffect } from 'react'
import FormActionButton from './FormActionButton'

export const FormEditActionSet = ({
  editModeDefault,
  onEnableEditMode,
  onSaveChanges,
  onDiscardChanges,
}: {
  editModeDefault?: boolean
  onEnableEditMode: () => void
  onSaveChanges: () => void
  onDiscardChanges: () => void
}) => {
  const [editMode, setEditMode] = useState(editModeDefault || false)
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => setIsVisible(true), 100)
    return () => clearTimeout(timer)
  }, [])

  const handleEnableEdit = () => {
    setEditMode(true)
    onEnableEditMode()
  }

  const handleDisableEdit = () => {
    setEditMode(false)
    onDiscardChanges()
  }

  const handleSaveChanges = () => {
    setEditMode(false)
    onSaveChanges()
  }

  return (
    <div className="overflow-hidden pt-2">
      <div
        className={`flex gap-3 transition-all duration-500 ease-out ${
          isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4'
        }`}
      >
        {editMode ? (
          <>
            <div className="animate-in fade-in slide-in-from-top-2 duration-500 delay-100">
              <FormActionButton onClick={handleSaveChanges} regularText="Save changes" />
            </div>
            <div className="animate-in fade-in slide-in-from-top-2 duration-500 delay-100">
              <FormActionButton actionType="secondary" onClick={handleDisableEdit} regularText="Discard" />
            </div>
          </>
        ) : (
          <div className="animate-in fade-in slide-in-from-top-2 duration-500 delay-100">
            <FormActionButton actionType="primary" onClick={handleEnableEdit} regularText="Edit" />
          </div>
        )}
      </div>
    </div>
  )
}
