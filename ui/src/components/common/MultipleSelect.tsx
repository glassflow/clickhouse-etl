import { Label } from '@/src/components/ui/label'
import { Button } from '@/src/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/src/components/ui/select'
import { PlusIcon, XMarkIcon } from '@heroicons/react/24/outline'
import { SimpleDropdown } from './SimpleDropdown'

export function MultipleSelect({
  keys,
  setKeys,
  getAvailableKeys,
  addKey,
  removeKey,
  title,
  description,
  selectLabel,
  placeholder,
}: {
  keys: string[]
  setKeys: (keys: string[]) => void
  getAvailableKeys: () => string[]
  addKey: (key: string) => void
  removeKey: (key: number) => void
  title: string
  description: string
  selectLabel: string
  placeholder: string
}) {
  return (
    <div className="space-y-4">
      <Label>{title}</Label>
      <p className="text-sm text-muted-foreground">{description}</p>

      {/* Key selection UI */}
      <div className="space-y-3">
        {keys.length === 0 ? (
          // First key selection
          <div className="flex gap-2">
            <div className="min-w-[200px]">
              <SimpleDropdown
                label={selectLabel}
                defaultValue=""
                onSelect={addKey}
                isLoading={false}
                error=""
                optionsList={getAvailableKeys()}
                placeholder={placeholder}
              />
            </div>
          </div>
        ) : (
          // List of selected keys
          <div className="space-y-3">
            {keys.map((key, index) => (
              <div key={index} className="flex items-center gap-2">
                <div className="flex-grow min-w-[200px]">
                  <Select
                    value={key}
                    onValueChange={(newKey) => {
                      const newKeys = [...keys]
                      newKeys[index] = newKey
                      setKeys(newKeys)
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select key" />
                    </SelectTrigger>
                    <SelectContent>
                      {/* Include the current key and available keys */}
                      <SelectItem value={key}>{key}</SelectItem>
                      {getAvailableKeys().map((availableKey) => (
                        <SelectItem key={availableKey} value={availableKey}>
                          {availableKey}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => removeKey(index)}
                  className="h-10 w-10 text-red-500 hover:text-red-700 hover:bg-red-100"
                >
                  <XMarkIcon className="h-5 w-5" />
                </Button>
              </div>
            ))}
          </div>
        )}

        {/* Add more keys button */}
        {keys.length > 0 && getAvailableKeys().length > 0 && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => addKey(getAvailableKeys()[0])}
            className="mt-2"
            disabled={getAvailableKeys().length === 0}
          >
            Add More Keys
          </Button>
        )}

        {keys.length > 0 && getAvailableKeys().length === 0 && (
          <p className="text-sm text-amber-500">All available keys have been added.</p>
        )}
      </div>
    </div>
  )
}
