import { Label } from '@/src/components/ui/label'
import { Input } from '@/src/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/src/components/ui/select'
import { DatabaseSelect } from './DatabaseSelect'
import { CLICKHOUSE_TABLE_ENGINES } from '../constants'
import type { DatabaseAccessTestFn, ConnectionConfig } from '../types'

interface NewTableSettingsProps {
  tableName: string
  onTableNameChange: (value: string) => void
  availableDatabases: string[]
  selectedDatabase: string
  setSelectedDatabase: (database: string) => void
  testDatabaseAccess: DatabaseAccessTestFn
  isLoading: boolean
  getConnectionConfig: () => Omit<ConnectionConfig, 'connectionType'>
  onRefreshDatabases?: () => Promise<void>
  engine: string
  onEngineChange: (value: string) => void
  orderBy: string
  onOrderByChange: (value: string) => void
  orderByOptions: string[]
  readOnly?: boolean
}

export function NewTableSettings({
  tableName,
  onTableNameChange,
  availableDatabases,
  selectedDatabase,
  setSelectedDatabase,
  testDatabaseAccess,
  isLoading,
  getConnectionConfig,
  onRefreshDatabases,
  engine,
  onEngineChange,
  orderBy,
  onOrderByChange,
  orderByOptions,
  readOnly,
}: NewTableSettingsProps) {
  return (
    <div className="flex flex-col gap-6 w-full max-w-4xl">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 w-full">
        <div className="space-y-2 min-w-0 flex flex-col">
          <DatabaseSelect
            availableDatabases={availableDatabases}
            selectedDatabase={selectedDatabase}
            setSelectedDatabase={setSelectedDatabase}
            testDatabaseAccess={testDatabaseAccess}
            isLoading={isLoading}
            getConnectionConfig={getConnectionConfig}
            onRefresh={onRefreshDatabases}
            readOnly={readOnly}
          />
        </div>
        <div className="space-y-2 min-w-0 flex flex-col">
          <div className="min-h-8 flex items-center">
            <Label htmlFor="new-table-name" className="text-content shrink-0">Table name</Label>
          </div>
          <Input
            id="new-table-name"
            placeholder="Enter table name"
            value={tableName}
            onChange={(e) => onTableNameChange(e.target.value)}
            disabled={readOnly}
            className="w-full h-10 min-w-0"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 w-full">
        <div className="space-y-2 min-w-0 flex flex-col">
          <Label htmlFor="engine" className="text-content shrink-0">Table engine</Label>
          <Select value={engine || undefined} onValueChange={onEngineChange} disabled={readOnly || isLoading}>
            <SelectTrigger id="engine" className="w-full h-10 min-w-0">
              <SelectValue placeholder="Select table engine" />
            </SelectTrigger>
            <SelectContent>
              {CLICKHOUSE_TABLE_ENGINES.map((eng) => (
                <SelectItem key={eng} value={eng}>
                  {eng}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2 min-w-0 flex flex-col">
          <Label htmlFor="order-by" className="text-content shrink-0">Order by</Label>
          <Select value={orderBy || undefined} onValueChange={onOrderByChange} disabled={readOnly || isLoading}>
            <SelectTrigger id="order-by" className="w-full h-10 min-w-0">
              <SelectValue placeholder={orderByOptions.length === 0 ? 'No fields available' : 'Select field to order by'} />
            </SelectTrigger>
            <SelectContent>
              {orderByOptions.map((field) => (
                <SelectItem key={field} value={field}>
                  {field}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  )
}
