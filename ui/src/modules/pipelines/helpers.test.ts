import { describe, it, expect } from 'vitest'
import { isValidApiConfig } from './helpers'

const validSource = {
  type: 'kafka',
  provider: 'kafka',
  connection_params: { brokers: ['localhost:9092'], protocol: 'PLAINTEXT', mechanism: 'NO_AUTH' },
  topics: [{ name: 't1', consumer_group_initial_offset: 'earliest' }],
}

const validSink = {
  type: 'clickhouse',
  provider: 'clickhouse',
  host: 'localhost',
  httpPort: '8123',
  database: 'db',
  username: '',
  password: '',
  max_batch_size: 1000,
  max_delay_time: '1s',
  table: 't',
  table_mapping: [{ source_id: 's1', field_name: 'f', column_name: 'c', column_type: 'String' }],
}

describe('helpers', () => {
  describe('isValidApiConfig', () => {
    it('returns false when config is undefined', () => {
      expect(isValidApiConfig(undefined)).toBe(false)
    })

    it('returns false when config is null', () => {
      expect(isValidApiConfig(null)).toBe(false)
    })

    it('returns false when config is not an object', () => {
      expect(isValidApiConfig(42)).toBe(false)
      expect(isValidApiConfig('string')).toBe(false)
    })

    it('returns false when source is missing', () => {
      expect(isValidApiConfig({ sink: validSink })).toBe(false)
    })

    it('returns false when source is not an object', () => {
      expect(isValidApiConfig({ source: null, sink: validSink })).toBe(false)
    })

    it('returns false when source type is not kafka', () => {
      expect(
        isValidApiConfig({
          source: { ...validSource, type: 'other' },
          sink: validSink,
        }),
      ).toBe(false)
    })

    it('returns false when connection_params.brokers is missing or empty', () => {
      expect(
        isValidApiConfig({
          source: { ...validSource, connection_params: { ...validSource.connection_params, brokers: [] } },
          sink: validSink,
        }),
      ).toBe(false)
      expect(
        isValidApiConfig({
          source: { ...validSource, connection_params: { ...validSource.connection_params, brokers: undefined } },
          sink: validSink,
        }),
      ).toBe(false)
    })

    it('returns false when source.topics is missing or empty', () => {
      expect(
        isValidApiConfig({
          source: { ...validSource, topics: [] },
          sink: validSink,
        }),
      ).toBe(false)
    })

    it('returns false when sink is missing', () => {
      expect(isValidApiConfig({ source: validSource })).toBe(false)
    })

    it('returns false when sink is not an object', () => {
      expect(isValidApiConfig({ source: validSource, sink: null })).toBe(false)
    })

    it('returns false when sink type is not clickhouse', () => {
      expect(
        isValidApiConfig({
          source: validSource,
          sink: { ...validSink, type: 'other' },
        }),
      ).toBe(false)
    })

    it('returns false when sink host is missing', () => {
      expect(
        isValidApiConfig({
          source: validSource,
          sink: { ...validSink, host: '' },
        }),
      ).toBe(false)
    })

    it('returns false when sink httpPort is missing', () => {
      expect(
        isValidApiConfig({
          source: validSource,
          sink: { ...validSink, httpPort: '' },
        }),
      ).toBe(false)
    })

    it('returns false when sink database is missing', () => {
      expect(
        isValidApiConfig({
          source: validSource,
          sink: { ...validSink, database: '' },
        }),
      ).toBe(false)
    })

    it('returns false when sink table is missing', () => {
      expect(
        isValidApiConfig({
          source: validSource,
          sink: { ...validSink, table: '' },
        }),
      ).toBe(false)
    })

    it('returns false when sink table_mapping is missing or empty', () => {
      expect(
        isValidApiConfig({
          source: validSource,
          sink: { ...validSink, table_mapping: [] },
        }),
      ).toBe(false)
    })

    it('returns true for valid config', () => {
      expect(
        isValidApiConfig({
          source: validSource,
          sink: validSink,
        }),
      ).toBe(true)
    })
  })
})
