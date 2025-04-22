'use client'

import { useState } from 'react'
import { Label } from '@/src/components/ui/label'
import { Button } from '@/src/components/ui/button'
import { ArrowPathIcon } from '@heroicons/react/24/outline'
import dynamic from 'next/dynamic'
import { Checkbox } from '@/src/components/ui/checkbox'
import { cn } from '@/src/utils'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/src/components/ui/select'

// Dynamically import AceEditor to avoid SSR issues
const AceEditor = dynamic(
  async () => {
    const ace = await import('react-ace')
    await import('ace-builds/src-noconflict/mode-json')
    await import('ace-builds/src-noconflict/theme-ambiance')
    await import('ace-builds/src-noconflict/theme-chaos')
    await import('ace-builds/src-noconflict/theme-chrome')
    await import('ace-builds/src-noconflict/theme-clouds')
    await import('ace-builds/src-noconflict/theme-clouds_midnight')
    await import('ace-builds/src-noconflict/theme-cobalt')
    await import('ace-builds/src-noconflict/theme-crimson_editor')
    await import('ace-builds/src-noconflict/theme-dawn')
    await import('ace-builds/src-noconflict/theme-dracula')
    await import('ace-builds/src-noconflict/theme-dreamweaver')
    await import('ace-builds/src-noconflict/theme-eclipse')
    await import('ace-builds/src-noconflict/theme-github')
    await import('ace-builds/src-noconflict/theme-gruvbox')
    await import('ace-builds/src-noconflict/theme-iplastic')
    await import('ace-builds/src-noconflict/theme-kuroir')
    await import('ace-builds/src-noconflict/theme-merbivore')
    await import('ace-builds/src-noconflict/theme-mono_industrial')
    await import('ace-builds/src-noconflict/theme-monokai')
    await import('ace-builds/src-noconflict/theme-nord_dark')

    await import('ace-builds/src-noconflict/theme-one_dark')

    await import('ace-builds/src-noconflict/theme-pastel_on_dark')

    await import('ace-builds/src-noconflict/theme-solarized_dark')
    await import('ace-builds/src-noconflict/theme-solarized_light')

    await import('ace-builds/src-noconflict/theme-terminal')
    await import('ace-builds/src-noconflict/theme-textmate')

    await import('ace-builds/src-noconflict/theme-tomorrow')
    await import('ace-builds/src-noconflict/theme-tomorrow_night')
    await import('ace-builds/src-noconflict/theme-tomorrow_night_blue')
    await import('ace-builds/src-noconflict/theme-tomorrow_night_eighties')
    await import('ace-builds/src-noconflict/theme-tomorrow_night_bright')

    await import('ace-builds/src-noconflict/theme-twilight')

    await import('ace-builds/src-noconflict/theme-xcode')
    return ace
  },
  { ssr: false },
)

// List of available themes
const EDITOR_THEMES = [
  { value: 'ambiance', label: 'Ambiance' },
  { value: 'chaos', label: 'Chaos' },
  { value: 'chrome', label: 'Chrome' },
  { value: 'clouds', label: 'Clouds' },
  { value: 'clouds_midnight', label: 'Clouds Midnight' },
  { value: 'cobalt', label: 'Cobalt' },
  { value: 'crimson_editor', label: 'Crimson Editor' },
  { value: 'dawn', label: 'Dawn' },
  { value: 'dracula', label: 'Dracula' },
  { value: 'dreamweaver', label: 'Dreamweaver' },
  { value: 'eclipse', label: 'Eclipse' },
  { value: 'github', label: 'GitHub' },
  { value: 'gruvbox', label: 'Gruvbox' },
  { value: 'iplastic', label: 'iPlastic' },
  { value: 'kuroir', label: 'Kuroir' },
  { value: 'merbivore', label: 'Merbivore' },
  { value: 'mono_industrial', label: 'Mono Industrial' },
  { value: 'monokai', label: 'Monokai' },
  { value: 'nord_dark', label: 'Nord Dark' },
  { value: 'one_dark', label: 'One Dark' },
  { value: 'pastel_on_dark', label: 'Pastel on Dark' },
  { value: 'solarized_dark', label: 'Solarized Dark' },
  { value: 'solarized_light', label: 'Solarized Light' },
  { value: 'terminal', label: 'Terminal' },
  { value: 'textmate', label: 'TextMate' },
  { value: 'tomorrow', label: 'Tomorrow' },
  { value: 'tomorrow_night', label: 'Tomorrow Night' },
  { value: 'tomorrow_night_blue', label: 'Tomorrow Night Blue' },
  { value: 'tomorrow_night_bright', label: 'Tomorrow Night Bright' },
  { value: 'tomorrow_night_eighties', label: 'Tomorrow Night Eighties' },
  { value: 'twilight', label: 'Twilight' },
  { value: 'xcode', label: 'XCode' },
]

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
  isFromCache?: boolean
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
  isFromCache = false,
  isEmptyTopic = false,
  onEventChange,
}: EventPreviewProps) => {
  const [emptyEvent, setEmptyEvent] = useState(false)
  const [isFocused, setIsFocused] = useState(false)
  const [manualEvent, setManualEvent] = useState(event)
  const [editorTheme, setEditorTheme] = useState('tomorrow_night')

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
          disabled={isLoadingEvent || !topic || (eventPosition === 0 && hasOlderEvents === false)}
          title="Fetch oldest event"
        >
          <span className="sr-only">First</span>
          <span>⏮️</span>
        </Button>

        <Button
          variant="outline"
          size="sm"
          onClick={handleFetchPreviousEvent}
          disabled={isLoadingEvent || !hasOlderEvents || !topic || eventPosition <= 0}
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
          disabled={isLoadingEvent || !hasMoreEvents || !topic}
          title="Fetch next event"
        >
          <span className="sr-only">Next</span>
          <span>⏩</span>
        </Button>

        <Button
          variant="outline"
          size="sm"
          onClick={handleFetchNewestEvent}
          disabled={isLoadingEvent || !topic || (!hasMoreEvents && eventPosition > 0)}
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
          <p className="text-white">Select a topic to preview events</p>
        </div>
      ) : (
        <>
          <div className="flex justify-between items-center mb-4">
            {isFromCache && <span className="text-xs px-2 py-1 bg-gray-700 text-gray-300 rounded-full">Cached</span>}
            {isEmptyTopic && (
              <div className="text-amber-500 text-sm">
                This topic has no events. Please enter the event schema manually.
              </div>
            )}
          </div>

          {showInternalNavigationButtons && <NavigationButtons />}

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
                  value={isEmptyTopic ? manualEvent : event}
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
