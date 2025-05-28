'use client'

import { useState } from 'react'
import { Label } from '@/src/components/ui/label'
import { Button } from '@/src/components/ui/button'
import { ArrowPathIcon } from '@heroicons/react/24/outline'
import dynamic from 'next/dynamic'
import { Checkbox } from '@/src/components/ui/checkbox'
import { cn } from '@/src/utils'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/src/components/ui/select'
import { EDITOR_THEMES } from '@/src/config/constants'

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

type EventPreviewProps = {
  event: string
  topic: string
  isLoadingEvent: boolean
  eventError: string
  handleRefreshEvent: (topic: string, fetchNext: boolean) => void
  hasMoreEvents?: boolean
  handleFetchPreviousEvent: () => void
  handleFetchNewestEvent: () => void
  handleFetchOldestEvent: () => void
  hasOlderEvents: boolean
  eventPosition: number
  showInternalNavigationButtons: boolean
  isAtEarliest?: boolean
  isAtLatest?: boolean
  isEmptyTopic?: boolean
  onEventChange?: (event: string) => void
}

export const EventPreview = ({
  event,
  topic,
  isLoadingEvent,
  eventError,
  handleRefreshEvent,
  hasMoreEvents = true,
  handleFetchPreviousEvent,
  handleFetchNewestEvent,
  handleFetchOldestEvent,
  hasOlderEvents,
  eventPosition,
  showInternalNavigationButtons = false,
  isAtEarliest = false,
  isAtLatest = false,
  isEmptyTopic = false,
  onEventChange,
}: EventPreviewProps) => {
  const [emptyEvent, setEmptyEvent] = useState(false)
  const [isFocused, setIsFocused] = useState(false)
  const [manualEvent, setManualEvent] = useState(event)
  const [editorTheme, setEditorTheme] = useState('merbivore')

  const showThemeSelector = false

  const handleEmptyEvent = () => {
    setEmptyEvent(!emptyEvent)
  }

  const handleEditorChange = (value: string) => {
    setManualEvent(value)
    if (onEventChange) {
      onEventChange(value)
    }
  }

  const NavigationButtons = () => {
    return (
      <div className="flex space-x-2">
        <Button
          variant="outline"
          size="sm"
          onClick={handleFetchOldestEvent}
          disabled={isLoadingEvent || !topic || isAtEarliest}
          title="Fetch oldest event"
        >
          <span className="sr-only">First</span>
          <span>⏮️</span>
        </Button>

        <Button
          variant="outline"
          size="sm"
          onClick={handleFetchPreviousEvent}
          disabled={isLoadingEvent || isAtEarliest || !topic}
          title="Fetch previous event"
        >
          <span className="sr-only">Previous</span>
          <span>⏪</span>
        </Button>

        {eventPosition > 0 && <span className="px-2">Event #{eventPosition}</span>}

        <Button
          variant="outline"
          size="sm"
          onClick={() => handleRefreshEvent(topic, true)}
          disabled={isLoadingEvent || isAtLatest || !topic}
          title="Fetch next event"
        >
          <span className="sr-only">Next</span>
          <span>⏩</span>
        </Button>

        <Button
          variant="outline"
          size="sm"
          onClick={handleFetchNewestEvent}
          disabled={isLoadingEvent || !topic || isAtLatest}
          title="Fetch newest event"
        >
          <span className="sr-only">Latest</span>
          <span>⏭️</span>
        </Button>

        <Button
          variant="outline"
          size="sm"
          onClick={() => handleRefreshEvent(topic, false)}
          disabled={isLoadingEvent || !topic}
          title="Refresh current event"
        >
          <span className="sr-only">Refresh</span>
          <span>🔄</span>
        </Button>
      </div>
    )
  }

  return (
    <div className="rounded-md p-4 h-full flex flex-col overflow-auto">
      {!topic || (isLoadingEvent && !isEmptyTopic) ? (
        <div className="h-full flex items-center justify-center bg-background-neutral rounded-md">
          <p className="text-white"></p>
        </div>
      ) : (
        <>
          {showInternalNavigationButtons && <NavigationButtons />}

          {showThemeSelector && (
            <div className="flex items-center justify-end mb-2">
              <div className="flex items-center">
                <Label htmlFor="theme-select" className="mr-2 text-sm">
                  Editor Theme:
                </Label>
                <Select value={editorTheme} onValueChange={setEditorTheme}>
                  <SelectTrigger className="w-[180px]" id="theme-select">
                    <SelectValue placeholder="Select theme" />
                  </SelectTrigger>
                  <SelectContent>
                    {EDITOR_THEMES.map((theme) => (
                      <SelectItem key={theme.value} value={theme.value}>
                        {theme.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          {/* {isEmptyTopic && (
            <div className="bg-amber-500/20 p-3 mb-3 rounded-md text-amber-500 text-sm">
              This topic has no events. Please select a different topic with events to proceed.
            </div>
          )} */}

          <div className="flex-grow relative w-full h-full code-editor-container">
            {isLoadingEvent ? (
              <div className="absolute inset-0 flex items-center justify-center bg-black-500 bg-opacity-50">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
              </div>
            ) : (
              <>
                <AceEditor
                  mode="json"
                  theme={editorTheme}
                  name="event-editor"
                  value={
                    isEmptyTopic
                      ? `// This topic has no events.\n// Please select a different topic with events to proceed.\n\n{\n  "message": "No events available in this topic"\n}`
                      : event
                  }
                  onChange={handleEditorChange}
                  readOnly={true}
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
                  onFocus={() => setIsFocused(true)}
                  onBlur={() => setIsFocused(false)}
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

          {/* {!hasMoreEvents && <div className="text-amber-500 text-sm mt-2">No more events available in this topic</div>}
          {!hasOlderEvents && eventPosition === 0 && (
            <div className="text-amber-500 text-sm mt-2">This is the first event in the topic</div>
          )}

          {hasOlderEvents && eventPosition > 0 && (
            <div className="text-blue-500 text-sm mt-2">
              Currently at position {eventPosition}. Previous events available.
            </div>
          )} */}
        </>
      )}
    </div>
  )
}

{
  /* <div className="flex flex-row gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => handleRefreshEvent(false)}
          disabled={!topic || isLoadingEvent}
        >
          {isLoadingEvent ? (
            <span className="flex items-center">
              <ArrowPathIcon className="h-4 w-4 mr-2 animate-spin" />
              Loading...
            </span>
          ) : (
            <span className="flex items-center">
              <ArrowPathIcon className="h-4 w-4 mr-2" />
              Previous Event
            </span>
          )}
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => handleRefreshEvent(true)}
          disabled={!topic || isLoadingEvent || !hasMoreEvents}
        >
          {isLoadingEvent ? (
            <span className="flex items-center">
              <ArrowPathIcon className="h-4 w-4 mr-2 animate-spin" />
              Loading...
            </span>
          ) : (
            <span className="flex items-center">
              <ArrowPathIcon className="h-4 w-4 mr-2" />
              Next Event
            </span>
          )}
        </Button>
      </div> */
}
