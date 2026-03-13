/**
 * Supported ClickHouse table engines for new table creation.
 * Engine list can be made configurable from backend later.
 */
export const CLICKHOUSE_TABLE_ENGINES = [
  'MergeTree',
  'ReplacingMergeTree',
  'SummingMergeTree',
  'AggregatingMergeTree',
  'CollapsingMergeTree',
  'VersionedCollapsingMergeTree',
  'GraphiteMergeTree',
] as const

export type ClickHouseTableEngine = (typeof CLICKHOUSE_TABLE_ENGINES)[number]
