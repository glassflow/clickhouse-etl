'use client'

import { useCallback } from 'react'
import { Button } from '@/src/components/ui/button'
import { Label } from '@/src/components/ui/label'
import { Switch } from '@/src/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/src/components/ui/select'
import { PlusIcon, TrashIcon } from '@heroicons/react/24/outline'
import { FilterGroup, FilterRule, LogicOperator, MAX_GROUP_DEPTH } from '@/src/store/filter.store'
import { QueryRule } from './QueryRule'
import { RuleValidation } from '../utils'
import { cn } from '@/src/utils/common.client'

interface QueryGroupProps {
  group: FilterGroup
  availableFields: Array<{ name: string; type: string }>
  onAddRule: (parentGroupId: string) => void
  onAddGroup: (parentGroupId: string) => void
  onUpdateRule: (ruleId: string, updates: Partial<Omit<FilterRule, 'id' | 'type'>>) => void
  onUpdateGroup: (groupId: string, updates: Partial<Pick<FilterGroup, 'combinator' | 'not'>>) => void
  onRemoveItem: (itemId: string) => void
  onTouched?: (id: string) => void
  conditionErrors: Record<string, RuleValidation['errors']>
  readOnly?: boolean
  depth?: number
  isRoot?: boolean
}

export function QueryGroup({
  group,
  availableFields,
  onAddRule,
  onAddGroup,
  onUpdateRule,
  onUpdateGroup,
  onRemoveItem,
  onTouched,
  conditionErrors,
  readOnly = false,
  depth = 0,
  isRoot = false,
}: QueryGroupProps) {
  // Handle combinator change
  const handleCombinatorChange = useCallback(
    (value: string) => {
      onUpdateGroup(group.id, { combinator: value as LogicOperator })
    },
    [group.id, onUpdateGroup],
  )

  // Handle NOT toggle
  const handleNotToggle = useCallback(
    (checked: boolean) => {
      onUpdateGroup(group.id, { not: checked })
    },
    [group.id, onUpdateGroup],
  )

  // Can add nested groups?
  const canAddNestedGroup = depth < MAX_GROUP_DEPTH - 1

  return (
    <div
      className={cn(
        'card-outline rounded-[var(--radius-xl)] p-4',
        group.not && 'border-[var(--color-border-primary)]',
        !isRoot && 'ml-4',
      )}
    >
      {/* Group Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-4">
          {/* NOT Toggle */}
          <div className="flex items-center gap-2">
            <Switch
              id={`group-not-${group.id}`}
              checked={group.not || false}
              onCheckedChange={handleNotToggle}
              disabled={readOnly}
              className="data-[state=checked]:bg-[var(--color-background-primary)]"
            />
            <Label htmlFor={`group-not-${group.id}`} className="text-xs text-[var(--text-secondary)] cursor-pointer">
              NOT
            </Label>
          </div>

          {/* Combinator Select */}
          <Select value={group.combinator} onValueChange={handleCombinatorChange} disabled={readOnly}>
            <SelectTrigger className="w-24 h-8 text-xs input-regular input-border-regular">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="select-content-custom">
              <SelectItem value="and" className="select-item-custom">
                AND
              </SelectItem>
              <SelectItem value="or" className="select-item-custom">
                OR
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2">
          {/* Add Rule Button */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => onAddRule(group.id)}
            disabled={readOnly}
            className="h-8 text-xs btn-tertiary"
          >
            <PlusIcon className="h-3 w-3 mr-1" />
            Add Rule
          </Button>

          {/* Add Group Button (only if not at max depth) */}
          {canAddNestedGroup && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => onAddGroup(group.id)}
              disabled={readOnly}
              className="h-8 text-xs btn-tertiary"
            >
              <PlusIcon className="h-3 w-3 mr-1" />
              Add Group
            </Button>
          )}

          {/* Delete Group Button (not for root) */}
          {!isRoot && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onRemoveItem(group.id)}
              disabled={readOnly}
              className="h-8 w-8 text-[var(--text-secondary)] hover:text-[var(--color-foreground-critical)]"
            >
              <TrashIcon className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Group Children */}
      <div className="space-y-3">
        {group.children.length === 0 ? (
          <div className="text-sm text-[var(--text-secondary)] text-center py-4 border border-dashed border-[var(--surface-border)] rounded-[var(--radius-md)]">
            No rules yet. Click &quot;Add Rule&quot; to create one.
          </div>
        ) : (
          group.children.map((child, index) => {
            if (child.type === 'rule') {
              return (
                <div key={child.id} className="relative">
                  {/* Combinator label between items */}
                  {index > 0 && (
                    <div className="absolute -top-2 left-4 px-2 bg-[var(--surface-bg)] text-xs text-[var(--text-secondary)] z-10">
                      {group.combinator.toUpperCase()}
                    </div>
                  )}
                  <QueryRule
                    rule={child}
                    availableFields={availableFields}
                    onChange={onUpdateRule}
                    onRemove={onRemoveItem}
                    onTouched={onTouched}
                    validation={conditionErrors[child.id]}
                    readOnly={readOnly}
                    depth={depth}
                  />
                </div>
              )
            } else {
              // Nested group
              return (
                <div key={child.id} className="relative">
                  {/* Combinator label between items */}
                  {index > 0 && (
                    <div className="absolute -top-2 left-4 px-2 bg-[var(--surface-bg)] text-xs text-[var(--text-secondary)] z-10">
                      {group.combinator.toUpperCase()}
                    </div>
                  )}
                  <QueryGroup
                    group={child}
                    availableFields={availableFields}
                    onAddRule={onAddRule}
                    onAddGroup={onAddGroup}
                    onUpdateRule={onUpdateRule}
                    onUpdateGroup={onUpdateGroup}
                    onRemoveItem={onRemoveItem}
                    onTouched={onTouched}
                    conditionErrors={conditionErrors}
                    readOnly={readOnly}
                    depth={depth + 1}
                    isRoot={false}
                  />
                </div>
              )
            }
          })
        )}
      </div>
    </div>
  )
}
