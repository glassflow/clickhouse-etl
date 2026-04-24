export type InternalFieldType = 'string' | 'number' | 'boolean' | 'object' | 'array' | 'timestamp';
export type SchemaFieldSource = 'topic' | 'transform' | 'inferred' | 'user';

export interface SchemaField {
  name: string;
  type: InternalFieldType;
  nullable: boolean;
  source?: SchemaFieldSource;
  originalType?: string;
}
