import { Label } from '@/src/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/src/components/ui/select'
import { Button } from '@/src/components/ui/button'
import { Input } from '@/src/components/ui/input'
import { ConnectionConfig, DatabaseAccessTestFn } from '../types'

interface DatabaseSelectProps {
  availableDatabases: string[]
  selectedDatabase: string
  setSelectedDatabase: (database: string) => void
  testDatabaseAccess: DatabaseAccessTestFn
  isLoading: boolean
  getConnectionConfig: () => Omit<ConnectionConfig, 'connectionType'>
}

export function DatabaseSelect({
  availableDatabases,
  selectedDatabase,
  setSelectedDatabase,
  // testDatabaseAccess,
  // isLoading,
  // getConnectionConfig,
}: DatabaseSelectProps) {
  return (
    <div className="space-y-2">
      <Label
        htmlFor="database"
        className="text-content transform transition-all duration-300 ease-in-out translate-y-4 opacity-0 animate-[fadeIn_0.3s_ease-in-out_forwards]"
      >
        Database
      </Label>
      {availableDatabases.length > 0 ? (
        <Select value={selectedDatabase} onValueChange={setSelectedDatabase}>
          <SelectTrigger
            id="database"
            className="w-full text-content select-content-custom transform transition-all duration-300 ease-in-out translate-y-4 opacity-0 animate-[fadeIn_0.3s_ease-in-out_forwards]"
          >
            <SelectValue placeholder="Select database" />
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
        <div className="flex gap-4 items-center transform transition-all duration-300 ease-in-out translate-y-4 opacity-0 animate-[fadeIn_0.3s_ease-in-out_forwards]">
          <Input
            id="database"
            placeholder="Enter database name"
            value={selectedDatabase}
            onChange={(e) => setSelectedDatabase(e.target.value)}
            className="flex-1 text-content"
          />
          {/* {renderTestAccessButton()} */}
        </div>
      )}
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
