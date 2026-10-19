/**
 * A Game's crawler as the Game page's Crew & seats card reads it
 * (`crawlerReading.model.ts`): a listing row parsed to its name, SP and Tech
 * Level, and the vitals the card shows of it.
 */
import { describe, expect, test } from 'bun:test'
import { crawlerFixture } from '../../../components/__tests__/fixtures'
import { crawlerVitals, readCrawler } from '../crawlerReading.model'

describe('readCrawler', () => {
  test('a listing row reads as its live id, name, SP and Tech Level', () => {
    const body = crawlerFixture({ id: 'c-1', name: 'Tenacity', techLevel: 'tech-3', currentSP: 7 })
    const reading = readCrawler({ appId: 'app-1', body })
    if (!reading) throw new Error('the fixture is a crawler')
    expect(reading).toMatchObject({ id: 'app-1', name: 'Tenacity', sp: 7, techLevel: 3 })
    expect(reading.maxSP).toBeGreaterThan(7)
    expect(crawlerVitals(reading)).toEqual([
      { label: 'TL', value: '3', chip: 'rank' },
      { label: 'SP', value: `7/${reading.maxSP}`, chip: 'measure' },
    ])
  })

  test('a row with no app id is addressed by the crawler’s own; unspent SP is full', () => {
    const reading = readCrawler({ appId: null, body: crawlerFixture({ id: 'c-2' }) })
    expect(reading?.id).toBe('c-2')
    expect(reading?.sp).toBe(reading?.maxSP)
  })

  test('a body that is no crawler reads as nothing', () => {
    expect(readCrawler({ appId: 'app-3', body: { name: 'Tenacity' } })).toBeNull()
  })
})
