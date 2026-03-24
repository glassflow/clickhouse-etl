export const isRegistrySchema = (s: string | undefined): boolean =>
  s === 'external' || s === 'registry_resolved_from_event'
