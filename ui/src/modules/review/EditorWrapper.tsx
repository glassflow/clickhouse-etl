'use client'

import { useState } from 'react'
import { CheckIcon, ClipboardIcon } from '@heroicons/react/24/outline'
import { structuredLogger } from '@/src/observability'
import dynamic from 'next/dynamic'

// const AceEditor = dynamic(() => import('react-ace').then((mod) => mod.default), { ssr: false })

// Update the dynamic import to match EventPreview
const AceEditor = dynamic(
  async () => {
    const ace = await import('react-ace')
    await import('ace-builds/src-noconflict/mode-json')
    await import('ace-builds/src-noconflict/mode-yaml')
    await import('ace-builds/src-noconflict/theme-merbivore')
    await import('ace-builds/src-noconflict/ext-language_tools')
    return ace
  },
  { ssr: false },
)

// Update the EditorWrapper component to be even more similar to EventPreview
export const EditorWrapper = ({ mode, value }: { mode: string; value: string }) => {
  const [isFocused, setIsFocused] = useState(false)
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)

      // Reset the copied state after 2 seconds
      setTimeout(() => {
        setCopied(false)
      }, 2000)
    } catch (err) {
      structuredLogger.error('EditorWrapper failed to copy text', { error: err instanceof Error ? err.message : String(err) })
    }
  }

  return (
    <div
      className="flex-grow relative w-full h-[800px] transition-all duration-200"
      style={{ border: '1px solid #333', borderRadius: '0.375rem', overflow: 'hidden' }}
    >
      {/* Copy button */}
      <button
        onClick={handleCopy}
        className="absolute top-2 right-2 z-10 p-2 bg-gray-800 hover:bg-gray-700 rounded-md text-white transition-all duration-200"
        title="Copy to clipboard"
      >
        {copied ? (
          <CheckIcon className="h-4 w-4 text-green-500 transition-colors duration-200" />
        ) : (
          <ClipboardIcon className="h-4 w-4 transition-colors duration-200" />
        )}
      </button>

      {AceEditor && (
        <AceEditor
          mode={mode}
          theme="merbivore"
          name={`${mode}-editor`}
          value={value}
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
            highlightActiveLine: true,
            wrap: false,
            verticalScrollbarAlwaysVisible: true,
            horizontalScrollbarAlwaysVisible: true,
            fontSize: 14,
            tabSize: 2,
            showLineNumbers: true,
          }}
          editorProps={{ $blockScrolling: true }}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          style={{ width: '100%', height: '100%' }}
        />
      )}
    </div>
  )
}
