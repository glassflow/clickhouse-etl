'use client'

import { useState, useEffect, useRef } from 'react'
import dynamic from 'next/dynamic'

// Dynamically import AceEditor to avoid SSR issues
const AceEditor = dynamic(
  async () => {
    const ace = await import('react-ace')
    await import('ace-builds/src-noconflict/mode-json')
    await import('ace-builds/src-noconflict/theme-merbivore')

    return ace
  },
  { ssr: false },
)

type EventEditorProps = {
  event: string
  topic: string
  isLoadingEvent: boolean
  eventError: string
  isEmptyTopic?: boolean
  onManualEventChange?: (event: string) => void
  isEditingEnabled: boolean
  readOnly?: boolean
}

const EDITOR_THEME = 'merbivore'

export const EventEditor = ({
  event,
  topic,
  isLoadingEvent,
  eventError,
  isEmptyTopic = false,
  onManualEventChange,
  isEditingEnabled,
  readOnly,
}: EventEditorProps) => {
  const [manualEvent, setManualEvent] = useState(event)
  const [isValid, setIsValid] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')

  // Track the original event from Kafka to detect modifications
  const originalEventRef = useRef<string>(event)
  const [isModified, setIsModified] = useState(false)

  // Update original event reference when a new event is fetched from Kafka
  useEffect(() => {
    // Only update the original reference when we receive a new event from Kafka
    // (not when the user modifies it manually)
    if (event && event !== manualEvent) {
      originalEventRef.current = event
      setIsModified(false)
    }
    setManualEvent(event)
  }, [event])

  const handleEditorChange = (value: string) => {
    setManualEvent(value)

    // Validate JSON
    try {
      JSON.parse(value)
      setIsValid(true)
      setErrorMessage('')
    } catch (error) {
      setIsValid(false)
      setErrorMessage('Invalid JSON format')
    }

    // Check if the event has been modified from the original
    setIsModified(value !== originalEventRef.current)

    // Always propagate the change to parent
    if (onManualEventChange) {
      onManualEventChange(value)
    }
  }

  // Editor is read-only only when it's not empty topic and not explicitly enabled for editing
  const isReadOnly = !(isEmptyTopic || isEditingEnabled) || readOnly

  return (
    <div className="rounded-md p-4 h-full flex flex-col overflow-auto">
      {!topic || (isLoadingEvent && !isEmptyTopic) ? (
        <div className="h-full flex items-center justify-center bg-background-neutral rounded-md">
          <p className="text-white"></p>
        </div>
      ) : (
        <>
          {isEmptyTopic && (
            <div className="bg-amber-500/20 p-3 mb-3 rounded-md text-amber-500 text-sm">
              This topic has no events. Please select a different topic with events or enter event schema manually to
              proceed.
            </div>
          )}

          {/* Modified indicator */}
          {isModified && !isEmptyTopic && (
            <div className="flex items-center gap-2 mb-2">
              <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-amber-500/20 text-amber-400 border border-amber-500/30">
                Schema Modified
              </span>
              <span className="text-xs text-[var(--color-foreground-neutral-faded)]">
                Event schema has been edited from the original Kafka event
              </span>
            </div>
          )}

          <div className="flex-grow relative w-full h-full code-editor-container">
            {isLoadingEvent ? (
              <div className="absolute inset-0 flex items-center justify-center bg-black-500 bg-opacity-50">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
              </div>
            ) : (
              <>
                <AceEditor
                  mode="json"
                  theme={EDITOR_THEME}
                  name="event-editor"
                  value={manualEvent}
                  onChange={handleEditorChange}
                  readOnly={isReadOnly}
                  width="100%"
                  height="100%"
                  minLines={10}
                  maxLines={Infinity}
                  fontSize={14}
                  showPrintMargin={false}
                  showGutter={true}
                  highlightActiveLine={true}
                  setOptions={{
                    useWorker: false,
                    showPrintMargin: false,
                    showGutter: true,
                    highlightActiveLine: false,
                    wrap: false,
                    verticalScrollbarAlwaysVisible: true,
                    horizontalScrollbarAlwaysVisible: true,
                    fontSize: 14,
                    tabSize: 2,
                    showLineNumbers: true,
                  }}
                  editorProps={{ $blockScrolling: true }}
                />
              </>
            )}
          </div>
          {!isValid && (
            <div className="bg-red-500/20 p-3 mb-3 mt-3 rounded-md text-red-500 text-sm">{errorMessage}</div>
          )}

          {eventError && !isEmptyTopic && (
            <div className={`mt-2 text-sm ${eventError.includes('Note:') ? 'text-amber-500' : 'text-red-500'}`}>
              {eventError}
            </div>
          )}
        </>
      )}
    </div>
  )
}
