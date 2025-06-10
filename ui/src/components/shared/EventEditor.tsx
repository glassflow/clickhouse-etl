'use client'

import { useState } from 'react'
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
}

const EDITOR_THEME = 'merbivore'

export const EventEditor = ({
  event,
  topic,
  isLoadingEvent,
  eventError,
  isEmptyTopic = false,
  onManualEventChange,
}: EventEditorProps) => {
  const [manualEvent, setManualEvent] = useState(event)

  const handleEditorChange = (value: string) => {
    setManualEvent(value)

    console.log('EventEditor: handleEditorChange', value)

    // propagate the manual event change to the parent component
    if (onManualEventChange) {
      onManualEventChange(value)
    }
  }

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
                  // value={isEmptyTopic ? emptyEventContent : event || manualEvent}
                  value={event || manualEvent}
                  // handles manual event change - happens only for empty topic
                  onChange={handleEditorChange}
                  readOnly={!isEmptyTopic}
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
                  className="ace-editor ace-editor-custom ace-scroller"
                  style={{ width: '100%', height: '100%' }}
                />
              </>
            )}
          </div>

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
