import { Label } from '@/src/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/src/components/ui/select'
import { Button } from '@/src/components/ui/button'
import { Input } from '@/src/components/ui/input'
import { ConnectionConfig, DatabaseAccessTestFn } from '../types'
import { CacheRefreshButton } from './CacheRefreshButton'

interface DatabaseSelectProps {
  availableDatabases: string[]
  selectedDatabase: string
  setSelectedDatabase: (database: string) => void
  testDatabaseAccess: DatabaseAccessTestFn
  isLoading: boolean
  getConnectionConfig: () => Omit<ConnectionConfig, 'connectionType'>
  onRefresh?: () => Promise<void>
  readOnly?: boolean
}

export function DatabaseSelect({
  availableDatabases,
  selectedDatabase,
  setSelectedDatabase,
  // testDatabaseAccess,
  isLoading,
  // getConnectionConfig,
  onRefresh,
  readOnly,
}: DatabaseSelectProps) {
  return (
    <div className="space-y-2 w-full min-w-0">
      <div className="flex items-center justify-between gap-2 min-h-8">
        <Label htmlFor="database" className="text-content shrink-0">
          Database
        </Label>
        {onRefresh && (
          <CacheRefreshButton
            disabled={readOnly}
            type="databases"
            onRefresh={onRefresh}
            size="sm"
            variant="ghost"
            className="shrink-0"
          />
        )}
      </div>
      <div className="w-full min-w-0">
        {availableDatabases.length > 0 || isLoading ? (
          <Select value={selectedDatabase} onValueChange={setSelectedDatabase} disabled={readOnly || isLoading}>
            <SelectTrigger
              id="database"
              className="w-full text-content input-regular input-border-regular h-10"
            >
              <SelectValue placeholder={isLoading ? 'Loading databases...' : 'Select database'} />
            </SelectTrigger>
            <SelectContent className="text-content bg-background-neutral-faded select-content-custom">
              {availableDatabases.map((db) => (
                <SelectItem key={db} value={db} className="text-content select-item-custom">
                  {db}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <Input
            id="database"
            placeholder="Enter database name"
            value={selectedDatabase}
            onChange={(e) => setSelectedDatabase(e.target.value)}
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
//     <Button
//       variant="outline"
//       onClick={() =>
//         testDatabaseAccess({
//           ...getConnectionConfig(),
//           database: selectedDatabase,
//           connectionType: 'direct',
//         })
//       }
//       disabled={isLoading || !selectedDatabase}
//     >
//       Test Access
//     </Button>
//   )
// }
