import { describe, expect, test } from 'bun:test'

import { CrawlerSchema } from '../crawler'

const validCrawler = {
  id: 'crawler-001',
  schemaVersion: 1 as const,
  name: 'The Wandering Throne',
  techLevel: 'tech-2',
  crawlerBays: [{ bayRef: 'command-bay', npcName: 'Old Maddox', npcCurrentHP: 4 }],
  systems: ['system-drill'],
  createdAt: '2026-05-18T00:00:00.000Z',
  updatedAt: '2026-05-18T00:00:00.000Z',
}

function omit<T extends object, K extends keyof T>(obj: T, key: K): Omit<T, K> {
  const copy = { ...obj }
  delete copy[key]
  return copy
}

describe('CrawlerSchema', () => {
  test('happy path: parses a complete crawler', () => {
    const result = CrawlerSchema.parse(validCrawler)
    expect(result.id).toBe('crawler-001')
    expect(result.techLevel).toBe('tech-2')
    expect(result.schemaVersion).toBe(1)
  })

  test('happy path: workspaceId is optional', () => {
    const result = CrawlerSchema.parse({ ...validCrawler, workspaceId: 'ws-abc' })
    expect(result.workspaceId).toBe('ws-abc')
  })

  test('happy path: crawlerBays is optional (pre-change records load)', () => {
    const result = CrawlerSchema.parse(omit(validCrawler, 'crawlerBays'))
    expect(result.crawlerBays).toBeUndefined()
  })

  test('happy path: crawlerBays tracks per-bay NPC state', () => {
    const result = CrawlerSchema.parse(validCrawler)
    expect(result.crawlerBays).toEqual([
      { bayRef: 'command-bay', npcName: 'Old Maddox', npcCurrentHP: 4 },
    ])
  })

  test('happy path: crawlerBays entry only requires bayRef', () => {
    const result = CrawlerSchema.parse({
      ...validCrawler,
      crawlerBays: [{ bayRef: 'mech-bay' }],
    })
    expect(result.crawlerBays).toEqual([{ bayRef: 'mech-bay' }])
  })

  test('happy path: bayChoices is optional (pre-change records load)', () => {
    const result = CrawlerSchema.parse(validCrawler)
    expect(result.bayChoices).toBeUndefined()
  })

  test('happy path: bayChoices persists per-bay choice selections', () => {
    const result = CrawlerSchema.parse({
      ...validCrawler,
      bayChoices: {
        'armament-bay': { 'weapon-choice': ['Autocannon'] },
      },
    })
    expect(result.bayChoices).toEqual({
      'armament-bay': { 'weapon-choice': ['Autocannon'] },
    })
  })

  test('rejects missing required field: name', () => {
    expect(() => CrawlerSchema.parse(omit(validCrawler, 'name'))).toThrow()
  })

  test('rejects empty name (min(1) constraint)', () => {
    expect(() => CrawlerSchema.parse({ ...validCrawler, name: '' })).toThrow()
  })

  test('accepts non-empty name', () => {
    const result = CrawlerSchema.parse({ ...validCrawler, name: 'The Wandering Throne' })
    expect(result.name).toBe('The Wandering Throne')
  })

  test('rejects missing required field: techLevel', () => {
    expect(() => CrawlerSchema.parse(omit(validCrawler, 'techLevel'))).toThrow()
  })

  test('rejects invalid schemaVersion', () => {
    expect(() => CrawlerSchema.parse({ ...validCrawler, schemaVersion: 2 })).toThrow()
  })

  test('rejects unknown fields (strict)', () => {
    expect(() => CrawlerSchema.parse({ ...validCrawler, extraField: 'nope' })).toThrow()
  })
})
