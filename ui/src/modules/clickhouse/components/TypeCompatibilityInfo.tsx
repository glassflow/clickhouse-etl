import React, { useState } from 'react'
import { TYPE_COMPATIBILITY_MAP } from '../utils'
import { Button } from '@/src/components/ui/button'
import { QuestionMarkCircleIcon } from '@heroicons/react/24/outline'

type TypeCategory = 'Kafka' | 'JSON' | 'JavaScript'

// Define which types belong to which category
const typeCategorizations: Record<TypeCategory, string[]> = {
  Kafka: ['string', 'int8', 'int16', 'int32', 'int64', 'float32', 'float64', 'bool', 'bytes'],
  JSON: ['int', 'float', 'uint8', 'uint16', 'uint32', 'uint64', 'uint'],
  JavaScript: ['number', 'boolean', 'object', 'array', 'null', 'undefined'],
}

export const TypeCompatibilityInfo: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <div className="relative">
      <Button variant="outline" size="sm" onClick={() => setIsOpen(!isOpen)} className="gap-1 items-center">
        <QuestionMarkCircleIcon className="h-4 w-4" />
        <span>Type Compatibility</span>
      </Button>

      {isOpen && (
        <div className="absolute z-50 mt-2 p-4 bg-white dark:bg-gray-800 rounded-md shadow-lg border border-gray-200 dark:border-gray-700 w-[600px] max-h-[500px] overflow-y-auto">
          <div className="flex justify-between items-center mb-3">
            <h3 className="text-lg font-medium">Type Compatibility Reference</h3>
            <Button variant="ghost" size="sm" onClick={() => setIsOpen(false)}>
              Close
            </Button>
          </div>

          <div className="text-sm mb-4">
            <p>
              The table below shows compatible types between source (Kafka/JSON) and ClickHouse destination columns.
            </p>
          </div>

          <div className="space-y-4">
            {(Object.keys(typeCategorizations) as TypeCategory[]).map((category) => (
              <div key={category} className="border-t pt-2">
                <h4 className="font-medium mb-2">{category} Types</h4>
                <div className="space-y-2">
                  {typeCategorizations[category].map((sourceType) => {
                    const compatibleTypes = TYPE_COMPATIBILITY_MAP[sourceType] || []
                    return (
                      <div key={sourceType} className="grid grid-cols-12 gap-2">
                        <div className="col-span-2 font-mono bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">
                          {sourceType}
                        </div>
                        <div className="col-span-10">
                          <div className="flex flex-wrap gap-1">
                            {compatibleTypes.map((targetType) => (
                              <span
                                key={targetType}
                                className="inline-block bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 px-2 py-1 rounded font-mono text-xs"
                              >
                                {targetType}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
