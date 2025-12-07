import { Label } from '@/src/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/src/components/ui/select'
import { Button } from '@/src/components/ui/button'
import { Input } from '@/src/components/ui/input'
import { ConnectionConfig, TableAccessTestFn } from '../types'
import { CacheRefreshButton } from './CacheRefreshButton'

interface TableSelectProps {
  selectedDatabase: string
  availableTables: string[]
  selectedTable: string
  setSelectedTable: (table: string) => void
  testTableAccess: TableAccessTestFn
  isLoading: boolean
  getConnectionConfig: () => Omit<ConnectionConfig, 'connectionType'>
  onOpenChange?: (isOpen: boolean) => void
  open?: boolean
  onRefresh?: () => Promise<void>
  readOnly?: boolean
}

export function TableSelect({
  selectedDatabase,
  availableTables,
  selectedTable,
  setSelectedTable,
  // testTableAccess,
  isLoading,
  // getConnectionConfig,
  onOpenChange,
  open,
  onRefresh,
  readOnly,
}: TableSelectProps) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label
          htmlFor="table"
          className="text-content transform transition-all duration-300 ease-in-out translate-y-4 opacity-0 animate-[fadeIn_0.3s_ease-in-out_forwards]"
        >
          Table
        </Label>
      </div>
      <div className="flex items-center justify-between">
        {availableTables.length > 0 || isLoading ? (
          <Select
            value={selectedTable}
            onValueChange={setSelectedTable}
            open={open}
            onOpenChange={onOpenChange}
            disabled={readOnly || isLoading}
          >
            <SelectTrigger
              id="table"
              className="w-full text-content input-regular input-border-regular transform transition-all duration-300 ease-in-out translate-y-4 opacity-0 animate-[fadeIn_0.3s_ease-in-out_forwards]"
            >
              <SelectValue placeholder={isLoading ? 'Loading tables...' : 'Select table'} />
            </SelectTrigger>
            <SelectContent className="text-content bg-background-neutral-faded select-content-custom">
              {availableTables.map((table) => (
                <SelectItem key={table} value={table} className="text-content select-item-custom">
                  {table}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <div className="w-full flex gap-4 items-center transform transition-all duration-300 ease-in-out translate-y-4 opacity-0 animate-[fadeIn_0.3s_ease-in-out_forwards]">
            <Input
              id="table"
              placeholder="Enter table name"
              value={selectedTable}
              onChange={(e) => setSelectedTable(e.target.value)}
              className="w-full text-content input-regular input-border-regular"
              disabled={readOnly}
            />
            {/* {renderTestAccessButton()} */}
          </div>
        )}
        {onRefresh && (
          <div className="flex items-center justify-end ml-2">
            <CacheRefreshButton
              disabled={readOnly}
              type="tables"
              database={selectedDatabase}
              onRefresh={onRefresh}
              size="sm"
              variant="ghost"
              className="transform transition-all duration-300 ease-in-out translate-y-4 opacity-0 animate-[fadeIn_0.3s_ease-in-out_forwards]"
            />
          </div>
        )}
      </div>
    </div>
  )
}

// NOTE: not used atm
// const renderTestAccessButton = () => {
//   return (
// <Button
//   variant="outline"
//   onClick={() =>
//     testTableAccess({
//       ...getConnectionConfig(),
//       database: selectedDatabase,
//       // @ts-expect-error - FIXME: fix this later
//       table: selectedTable,
//       connectionType: 'direct',
//     })
//   }
//   disabled={isLoading || !selectedTable}
// >
//   // Test Access //{' '}
// </Button>
//   )
// }
