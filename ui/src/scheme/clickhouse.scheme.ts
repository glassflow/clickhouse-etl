import { z } from 'zod'

// Direct connection schema
const DirectConnectionSchema = z.object({
  host: z.string().min(1, 'Host is required'),
  port: z.string().min(1, 'Port is required'),
  username: z.string().min(1, 'Username is required'),
  password: z.string().min(1, 'Password is required'),
  database: z.string().optional(),
  useSSL: z.boolean().optional(),
  secure: z.boolean().optional(),
  nativePort: z.string().optional(),
})

// Connection form schema
const ClickhouseConnectionFormSchema = z.object({
  connectionType: z.literal('direct'),
  directConnection: DirectConnectionSchema,
  connectionStatus: z.enum(['idle', 'loading', 'success', 'error']).optional(),
  connectionError: z.string().nullable().optional(),
})

// Column mapping schema
const ColumnMappingSchema = z.object({
  name: z.string(),
  type: z.string(),
  jsonType: z.string().optional(),
  isNullable: z.boolean().optional(),
  isKey: z.boolean().optional(),
  eventField: z.string().optional(),
  sourceTopic: z.string().optional(),
})

// Destination schema
const ClickhouseDestinationSchema = z.object({
  scheme: z.string().min(1, 'Scheme is required'),
  database: z.string().min(1, 'Database is required'),
  table: z.string().min(1, 'Table is required'),
  mapping: z.array(ColumnMappingSchema),
  destinationColumns: z.array(ColumnMappingSchema),
  maxBatchSize: z.number().min(1, 'Max Batch Size is required'), // FIXME: add proper constraints
  maxDelayTime: z.number().min(1, 'Max Delay Time is required'), // FIXME: add proper constraints
})

// Extract types
type DirectConnection = z.infer<typeof DirectConnectionSchema>
type ClickhouseConnectionForm = z.infer<typeof ClickhouseConnectionFormSchema>
type ColumnMapping = z.infer<typeof ColumnMappingSchema>
type ClickhouseDestination = z.infer<typeof ClickhouseDestinationSchema>

// Export schemas
export { DirectConnectionSchema, ClickhouseConnectionFormSchema, ColumnMappingSchema, ClickhouseDestinationSchema }

// Export types
export type {
  DirectConnection as DirectConnectionType,
  ClickhouseConnectionForm as ClickhouseConnectionFormType,
  ColumnMapping as ColumnMappingType,
  ClickhouseDestination as ClickhouseDestinationType,
}
