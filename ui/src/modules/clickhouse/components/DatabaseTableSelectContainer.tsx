import { DatabaseSelect } from './DatabaseSelect'
import { TableSelect } from './TableSelect'
import { DatabaseAccessTestFn, TableAccessTestFn, ConnectionConfig } from '../types'

interface DatabaseTableSelectContainerProps {
  availableDatabases: string[]
  selectedDatabase: string
  setSelectedDatabase: (database: string) => void
  testDatabaseAccess: DatabaseAccessTestFn
  isLoading: boolean
  getConnectionConfig: () => Omit<ConnectionConfig, 'connectionType'>
  availableTables: string[]
  selectedTable: string
  setSelectedTable: (table: string) => void
  testTableAccess: TableAccessTestFn
  onRefreshDatabases?: () => Promise<void>
  onRefreshTables?: () => Promise<void>
  readOnly?: boolean
}

export function DatabaseTableSelectContainer({
  availableDatabases,
  selectedDatabase,
  setSelectedDatabase,
  testDatabaseAccess,
  isLoading,
  getConnectionConfig,
  availableTables,
  selectedTable,
  setSelectedTable,
  testTableAccess,
  onRefreshDatabases,
  onRefreshTables,
  readOnly,
}: DatabaseTableSelectContainerProps) {
  return (
    <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 lg:gap-8 mb-8">
      {/* Database Selection */}
      <div className="w-full lg:w-1/2">
        <DatabaseSelect
          availableDatabases={availableDatabases}
          selectedDatabase={selectedDatabase}
          setSelectedDatabase={setSelectedDatabase}
          testDatabaseAccess={testDatabaseAccess as DatabaseAccessTestFn}
          isLoading={isLoading}
          getConnectionConfig={getConnectionConfig}
          onRefresh={onRefreshDatabases}
          readOnly={readOnly}
        />
      </div>

      {/* Table Selection */}
      {selectedDatabase && (
        <div className="w-full lg:w-1/2">
          <TableSelect
            selectedDatabase={selectedDatabase}
            availableTables={availableTables}
            selectedTable={selectedTable}
            setSelectedTable={setSelectedTable}
            testTableAccess={testTableAccess as TableAccessTestFn}
            isLoading={isLoading}
            getConnectionConfig={getConnectionConfig}
            onRefresh={onRefreshTables}
            readOnly={readOnly}
          />
        </div>
      )}
    </div>
  )
}
