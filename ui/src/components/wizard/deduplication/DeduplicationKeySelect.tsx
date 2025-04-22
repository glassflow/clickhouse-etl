import { MultipleSelect } from '@/src/components/common/MultipleSelect'

export function DeduplicationKeySelect({
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
    <MultipleSelect
      keys={keys}
      setKeys={setKeys}
      getAvailableKeys={getAvailableKeys}
      addKey={addKey}
      removeKey={removeKey}
      title={title}
      description={description}
      selectLabel={selectLabel}
      placeholder={placeholder}
    />
  )
}
