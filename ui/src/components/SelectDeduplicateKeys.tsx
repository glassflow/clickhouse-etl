import { useState, useEffect, useCallback } from 'react'
import { Label } from '@/src/components/ui/label'
import { SearchableSelect } from '@/src/components/common/SearchableSelect'
import { JSONDateTypesSelector } from '@/src/components/JSONDateTypesSelector'
import { useStore } from '@/src/store'
import { getEventKeys } from '@/src/utils/common.client'
import { TimeWindowConfigurator } from './wizard/deduplication/TimeWindowConfigurator'

interface SelectDeduplicateKeysProps {
  index: number
  disabled?: boolean
  onChange: (keyConfig: { key: string; keyType: string }, windowConfig: { window: number; unit: string }) => void
  eventData: Record<string, any>
}

function SelectDeduplicateKeys({ index, disabled = false, onChange, eventData }: SelectDeduplicateKeysProps) {
  const [selectedKey, setSelectedKey] = useState('')
  const [selectedKeyType, setSelectedKeyType] = useState('string')
  const [localWindow, setLocalWindow] = useState(1)
  const [localWindowUnit, setLocalWindowUnit] = useState('seconds')
  const [availableKeys, setAvailableKeys] = useState<string[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const { topicsStore } = useStore()
  const { getTopic } = topicsStore

  const topic = getTopic(index)

  // Custom function to extract keys from event data
  const extractKeysFromEvent = (data: any): string[] => {
    if (!data) return []

    // If it's a string, try to parse it
    if (typeof data === 'string') {
      try {
        data = JSON.parse(data)
      } catch (e) {
        // If parsing fails, return empty array
        return []
      }
    }

    // If it's not an object after parsing, return empty array
    if (typeof data !== 'object' || data === null) {
      return []
    }

    // Extract keys from the object
    return Object.keys(data)
  }

  // Consolidated useEffect for initialization and event data processing
  useEffect(() => {
    // Initialize from topic
    if (topic?.deduplication) {
      setSelectedKey(topic.deduplication.key || '')
      setSelectedKeyType(topic.deduplication.keyType || 'string')
      setLocalWindow(topic.deduplication.window || 1)
      setLocalWindowUnit(topic.deduplication.unit || 'seconds')
    }

    // Process event data
    if (eventData) {
      setIsLoading(true)
      setError(null)

      try {
        // Extract the actual event data
        const actualEventData = eventData.event || eventData

        // Use our custom function
        const keys = extractKeysFromEvent(actualEventData)

        if (keys.length > 0) {
          setAvailableKeys(keys)
        } else {
          setError('No keys found in event data')
        }
      } catch (error) {
        console.error('Error processing event data:', error)
        setError('Error processing event data')
      } finally {
        setIsLoading(false)
      }
    }
  }, [topic, eventData])

  // Simplified getAvailableKeys - no need to filter out selected keys
  const getAvailableKeys = useCallback(() => {
    if (availableKeys.length === 0) {
      return []
    }

    return availableKeys
  }, [availableKeys])

  // Simplified key selection handler
  const handleKeySelect = useCallback(
    (key: string | null) => {
      setSelectedKey(key || '')
      onChange({ key: key || '', keyType: selectedKeyType }, { window: localWindow, unit: localWindowUnit })
    },
    [selectedKeyType, localWindow, localWindowUnit, onChange],
  )

  // Simplified key type selection handler
  const handleKeyTypeSelect = useCallback(
    (keyType: string) => {
      setSelectedKeyType(keyType)
      onChange({ key: selectedKey, keyType }, { window: localWindow, unit: localWindowUnit })
    },
    [selectedKey, localWindow, localWindowUnit, onChange],
  )

  // Window change handler
  const handleWindowChange = useCallback(
    (window: number) => {
      setLocalWindow(window)
      onChange({ key: selectedKey, keyType: selectedKeyType }, { window, unit: localWindowUnit })
    },
    [selectedKey, selectedKeyType, localWindowUnit, onChange],
  )

  // Window unit change handler
  const handleWindowUnitChange = useCallback(
    (unit: string) => {
      setLocalWindowUnit(unit)
      onChange({ key: selectedKey, keyType: selectedKeyType }, { window: localWindow, unit })
    },
    [selectedKey, selectedKeyType, localWindow, onChange],
  )

  return (
    <div className={`flex flex-col gap-8 ${disabled ? 'opacity-50 pointer-events-none' : ''}`}>
      <div className="text-sm font-weight-[400] text-content">
        {eventData
          ? 'The deduplicate key will be used to detect and remove duplicate data in your pipeline.'
          : 'Select a topic and wait for event data to load to configure deduplication.'}
      </div>

      <div className="space-y-4">
        <div>
          <Label className="text-lg font-medium text-content">Deduplicate Key</Label>
        </div>

        <div className="flex gap-2 w-full">
          <div className="w-[70%]">
            {isLoading ? (
              <div className="text-sm text-gray-500 p-2 border rounded">Loading available keys...</div>
            ) : availableKeys.length > 0 ? (
              <SearchableSelect
                availableOptions={availableKeys}
                selectedOption={selectedKey}
                onSelect={handleKeySelect}
                placeholder="Enter de-duplicate key"
                clearable={true}
              />
            ) : (
              <div className="text-sm text-gray-500 p-2 border rounded">
                {error || 'Please select a topic with valid event data.'}
              </div>
            )}
          </div>
          <div className="w-[30%]">
            <JSONDateTypesSelector value={selectedKeyType} onChange={handleKeyTypeSelect} />
          </div>
        </div>
      </div>

      <TimeWindowConfigurator
        window={localWindow}
        setWindow={handleWindowChange}
        windowUnit={localWindowUnit}
        setWindowUnit={handleWindowUnitChange}
      />
    </div>
  )
}

export default SelectDeduplicateKeys
