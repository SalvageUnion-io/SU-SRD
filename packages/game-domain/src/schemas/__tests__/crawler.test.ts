import { describe, expect, test } from 'bun:test'
import { CrawlerSchema } from '../crawler'

const validCrawler = {
  id: 'crawler-001',
  schemaVersion: 1 as const,
  name: 'The Wandering Throne',
  techLevel: 2,
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
    expect(result.techLevel).toBe(2)
    expect(result.schemaVersion).toBe(1)
  })

  test('happy path: crawlerBays is optional', () => {
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

  test('happy path: bayChoices is optional', () => {
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

  test('happy path: type + typeNpc are optional', () => {
    const result = CrawlerSchema.parse(validCrawler)
    expect(result.type).toBeUndefined()
    expect(result.typeNpc).toBeUndefined()
  })

  test('happy path: round-trips a chosen type + its special NPC state', () => {
    const result = CrawlerSchema.parse({
      ...validCrawler,
      type: 'battle-type-id',
      typeNpc: {
        npcName: 'Vex',
        npcCurrentHP: 8,
        npcDescription: 'A scarred veteran.',
        npcFacts: ['Owes a debt'],
        condition: 'damaged',
      },
    })
    expect(result.type).toBe('battle-type-id')
    expect(result.typeNpc).toEqual({
      npcName: 'Vex',
      npcCurrentHP: 8,
      npcDescription: 'A scarred veteran.',
      npcFacts: ['Owes a debt'],
      condition: 'damaged',
    })
  })

  test('happy path: an untyped crawler with a high tech level validates', () => {
    const result = CrawlerSchema.parse({ ...validCrawler, techLevel: 5 })
    expect(result.techLevel).toBe(5)
    expect(result.type).toBeUndefined()
  })

  test('rejects unknown fields inside typeNpc (strict)', () => {
    expect(() =>
      CrawlerSchema.parse({ ...validCrawler, typeNpc: { npcName: 'Vex', bogus: 'nope' } })
    ).toThrow()
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

  test('reads a legacy tech-N slug as its integer Tech Level', () => {
    expect(CrawlerSchema.parse({ ...validCrawler, techLevel: 'tech-3' }).techLevel).toBe(3)
  })

  test('rejects a Tech Level outside 1-6 or an unreadable slug', () => {
    expect(() => CrawlerSchema.parse({ ...validCrawler, techLevel: 7 })).toThrow()
    expect(() => CrawlerSchema.parse({ ...validCrawler, techLevel: 'tech-x' })).toThrow()
  })

  test('rejects invalid schemaVersion', () => {
    expect(() => CrawlerSchema.parse({ ...validCrawler, schemaVersion: 2 })).toThrow()
  })

  test('rejects unknown fields (strict)', () => {
    expect(() => CrawlerSchema.parse({ ...validCrawler, extraField: 'nope' })).toThrow()
  })
})
