import { afterEach, describe, expect, test } from 'bun:test'
import { homebrewPatternsUrl } from '../endpoint'
import {
  fetchHomebrewPatterns,
  homebrewHref,
  homebrewItem,
  homebrewItems,
  readShowHomebrew,
  SHOW_HOMEBREW_KEY,
  writeShowHomebrew,
} from '../homebrew'

const BODY = {
  id: 'pat-tow-rig',
  schemaVersion: 1,
  name: 'Tow Rig',
  chassisRef: 'mule',
  systems: [],
  modules: [],
  cargoLots: [],
  createdAt: '2026-10-22T00:00:00.000Z',
}
const ROW = { appId: 'pat-tow-rig', body: BODY, madeBy: 'Rosa', sharedAt: 1 }

afterEach(() => {
  localStorage.clear()
})

describe('a homebrew row', () => {
  test('parses with its chassis, and opens its public page in the app', () => {
    const item = homebrewItem(ROW)
    expect(item?.chassis.name).toBe('Mule')
    expect(item?.madeBy).toBe('Rosa')
    expect(item && homebrewHref(item)).toBe('/build/p/pattern/pat-tow-rig')
  })

  test('an unparseable body or an unknown chassis is left out', () => {
    expect(homebrewItem({ ...ROW, body: { name: 7 } })).toBeNull()
    expect(homebrewItem({ ...ROW, body: { ...BODY, chassisRef: 'no-such' } })).toBeNull()
    expect(homebrewItems([ROW, { ...ROW, appId: 'bad', body: null }]).map((i) => i.appId)).toEqual([
      'pat-tow-rig',
    ])
  })
})

describe('reading the Worker', () => {
  test('asks for every pattern, or one chassis’s', async () => {
    const asked: string[] = []
    const fake = (async (url: string) => {
      asked.push(url)
      return new Response(JSON.stringify([ROW]))
    }) as unknown as typeof fetch
    expect(await fetchHomebrewPatterns(undefined, fake)).toEqual([ROW])
    await fetchHomebrewPatterns('mule', fake)
    expect(asked).toEqual([homebrewPatternsUrl(), '/homebrew/patterns.json?chassis=mule'])
  })

  test('a failed read throws', async () => {
    const fake = (async () => new Response('', { status: 503 })) as unknown as typeof fetch
    await expect(fetchHomebrewPatterns(undefined, fake)).rejects.toThrow('homebrew 503')
  })
})

describe('the Show Homebrew setting', () => {
  test('is off until turned on, and remembered', () => {
    expect(readShowHomebrew()).toBe(false)
    writeShowHomebrew(true)
    expect(localStorage.getItem(SHOW_HOMEBREW_KEY)).toBe('on')
    expect(readShowHomebrew()).toBe(true)
    writeShowHomebrew(false)
    expect(readShowHomebrew()).toBe(false)
  })

  test('with storage blocked it reads off and writes nothing', () => {
    const real = Object.getOwnPropertyDescriptor(globalThis, 'localStorage')
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      get() {
        throw new Error('blocked')
      },
    })
    try {
      expect(readShowHomebrew()).toBe(false)
      expect(() => writeShowHomebrew(true)).not.toThrow()
    } finally {
      if (real) Object.defineProperty(globalThis, 'localStorage', real)
    }
  })
})
