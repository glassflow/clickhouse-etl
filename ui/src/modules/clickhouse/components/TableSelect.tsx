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
    <div className="space-y-2 w-full min-w-0">
      <div className="flex items-center justify-between gap-2 min-h-8">
        <Label htmlFor="table" className="text-content shrink-0">
          Table
        </Label>
        {onRefresh && (
          <CacheRefreshButton
            disabled={readOnly}
            type="tables"
            database={selectedDatabase}
            onRefresh={onRefresh}
            size="sm"
            variant="ghost"
            className="shrink-0"
          />
        )}
      </div>
      <div className="w-full min-w-0">
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
              className="w-full text-content input-regular input-border-regular h-10"
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
          <Input
            id="table"
            placeholder="Enter table name"
            value={selectedTable}
            onChange={(e) => setSelectedTable(e.target.value)}
            className="w-full text-content input-regular input-border-regular h-10"
            disabled={readOnly}
          />
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
