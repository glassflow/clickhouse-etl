import { describe, it, expect } from 'vitest'
import { folders, kafkaConnections, clickhouseConnections, schemas } from '@/src/lib/db/schema'

describe('Library DB schema exports', () => {
  it('exports folders table', () => {
    expect(folders).toBeTruthy()
  })

  it('exports kafkaConnections table', () => {
    expect(kafkaConnections).toBeTruthy()
  })

  it('exports clickhouseConnections table', () => {
    expect(clickhouseConnections).toBeTruthy()
  })

  it('exports schemas table', () => {
    expect(schemas).toBeTruthy()
  })

  it('folders table has expected column symbols', () => {
    const cols = Object.keys(folders)
    expect(cols).toContain('id')
    expect(cols).toContain('name')
    expect(cols).toContain('parentId')
    expect(cols).toContain('createdAt')
  })

  it('kafkaConnections table has expected column symbols', () => {
    const cols = Object.keys(kafkaConnections)
    expect(cols).toContain('id')
    expect(cols).toContain('name')
    expect(cols).toContain('description')
    expect(cols).toContain('folderId')
    expect(cols).toContain('tags')
    expect(cols).toContain('config')
    expect(cols).toContain('createdAt')
    expect(cols).toContain('updatedAt')
  })

  it('clickhouseConnections table has expected column symbols', () => {
    const cols = Object.keys(clickhouseConnections)
    expect(cols).toContain('id')
    expect(cols).toContain('name')
    expect(cols).toContain('config')
    expect(cols).toContain('createdAt')
    expect(cols).toContain('updatedAt')
  })

  it('schemas table has expected column symbols', () => {
    const cols = Object.keys(schemas)
    expect(cols).toContain('id')
    expect(cols).toContain('name')
    expect(cols).toContain('fields')
    expect(cols).toContain('createdAt')
    expect(cols).toContain('updatedAt')
  })
})
