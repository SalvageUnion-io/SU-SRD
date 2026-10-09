/**
 * The assignment model in the client store (ADR-037).
 *
 * `create('softLink')` is the one place a link is drawn, so it is where the
 * client mirrors the server's rules: a link across containers is refused
 * before any round trip, and a link REPLACES whatever it conflicts with in one
 * local write. A move drops the links it would leave straddling two
 * containers. `assignLink` is the entry point surfaces call.
 *
 * Signed-in backend with server commits stubbed (see `signedInBackend.ts`), so
 * these assert what lands in IndexedDB, not just in memory.
 */

import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { ConvexError } from 'convex/values'
import { _resetDbSingleton, clearCache, softLinks as dbSoftLinks } from '../../lib/db/index'
import { assignLink } from '../../lib/links/assignLink'
import { LinkRefused } from '../../lib/links/linkRefused'
import { CROSS_CONTAINER_REFUSAL } from '../../lib/links/linkRules'
import type { SoftLink } from '../../lib/schemas/softLink'
import { useEntityStore } from '../entityStore'
import { CONTAINER_MOVE } from '../surfaceProvenance'
import { withSignedInBackend } from './signedInBackend'

withSignedInBackend()

const pilotInput = {
  schemaVersion: 1 as const,
  name: 'Yara Voss',
  callsign: 'Ghost',
  classRef: 'scavenger',
  abilities: [],
  equipment: [],
  motto: '',
  keepsake: '',
  appearance: '',
  background: '',
  conditions: [],
}

const mechInput = {
  schemaVersion: 1 as const,
  name: 'Rust Bucket',
  chassisRef: 'iron-mongrel',
  systems: [],
  modules: [],
  cargoLots: [],
  conditions: [],
}

const crawlerInput = {
  schemaVersion: 1 as const,
  name: 'Iron Tortoise',
  techLevel: 'tech-2',
  systems: [],
}

function reset(): void {
  useEntityStore.setState({
    pilots: [],
    mechs: [],
    crawlers: [],
    softLinks: [],
    hydrated: { pilots: false, mechs: false, crawlers: false, softLinks: false },
  })
}

beforeEach(async () => {
  _resetDbSingleton()
  await clearCache()
  reset()
  const store = useEntityStore.getState()
  await Promise.all([
    store.hydrate('pilot'),
    store.hydrate('mech'),
    store.hydrate('crawler'),
    store.hydrate('softLink'),
  ])
})

afterEach(async () => {
  await clearCache()
  reset()
})

const shape = (l: SoftLink) => `${l.type}:${l.from.id}>${l.to.id}`

async function persisted(): Promise<string[]> {
  return (await dbSoftLinks.list()).map(shape).sort()
}

describe('assignLink', () => {
  test('resolves the type from the ends — a mech to a crawler is mech-to-crawler', async () => {
    const store = useEntityStore.getState()
    const mech = await store.create('mech', { ...mechInput, gameId: null })
    const crawler = await store.create('crawler', { ...crawlerInput, gameId: null })

    const link = await assignLink(
      { type: 'mech', id: mech.id },
      { type: 'crawler', id: crawler.id }
    )

    expect(link.type).toBe('mech-to-crawler')
    expect(await persisted()).toEqual([`mech-to-crawler:${mech.id}>${crawler.id}`])
  })

  test('replaces the conflicting assignment in the same write', async () => {
    const store = useEntityStore.getState()
    const pilot = await store.create('pilot', { ...pilotInput, gameId: 'g1' })
    const c1 = await store.create('crawler', { ...crawlerInput, gameId: 'g1' })
    const c2 = await store.create('crawler', { ...crawlerInput, name: 'Second', gameId: 'g1' })

    await assignLink({ type: 'pilot', id: pilot.id }, { type: 'crawler', id: c1.id })
    await assignLink({ type: 'pilot', id: pilot.id }, { type: 'crawler', id: c2.id })

    const expected = [`pilot-to-crawler:${pilot.id}>${c2.id}`]
    expect(useEntityStore.getState().softLinks.map(shape)).toEqual(expected)
    expect(await persisted()).toEqual(expected)
  })

  test('a pilot flies one mech: a second mech takes the seat', async () => {
    const store = useEntityStore.getState()
    const pilot = await store.create('pilot', { ...pilotInput, gameId: null })
    const m1 = await store.create('mech', { ...mechInput, gameId: null })
    const m2 = await store.create('mech', { ...mechInput, name: 'Spare', gameId: null })

    await assignLink({ type: 'mech', id: m1.id }, { type: 'pilot', id: pilot.id })
    await assignLink({ type: 'mech', id: m2.id }, { type: 'pilot', id: pilot.id })

    expect(await persisted()).toEqual([`mech-to-pilot:${m2.id}>${pilot.id}`])
  })

  test('a crawler takes many: crew and bay accumulate', async () => {
    const store = useEntityStore.getState()
    const crawler = await store.create('crawler', { ...crawlerInput, gameId: null })
    const p1 = await store.create('pilot', { ...pilotInput, gameId: null })
    const p2 = await store.create('pilot', { ...pilotInput, name: 'Second', gameId: null })
    const m1 = await store.create('mech', { ...mechInput, gameId: null })

    await assignLink({ type: 'pilot', id: p1.id }, { type: 'crawler', id: crawler.id })
    await assignLink({ type: 'pilot', id: p2.id }, { type: 'crawler', id: crawler.id })
    await assignLink({ type: 'mech', id: m1.id }, { type: 'crawler', id: crawler.id })

    expect(await persisted()).toHaveLength(3)
  })

  test('drawing an existing link returns it rather than a second record', async () => {
    const store = useEntityStore.getState()
    const mech = await store.create('mech', { ...mechInput, gameId: null })
    const crawler = await store.create('crawler', { ...crawlerInput, gameId: null })

    const first = await assignLink(
      { type: 'mech', id: mech.id },
      { type: 'crawler', id: crawler.id }
    )
    const again = await assignLink(
      { type: 'mech', id: mech.id },
      { type: 'crawler', id: crawler.id }
    )

    expect(again.id).toBe(first.id)
    expect(await persisted()).toHaveLength(1)
  })

  test('refuses across containers, before any write', async () => {
    const store = useEntityStore.getState()
    const pilot = await store.create('pilot', { ...pilotInput, gameId: null })
    const crawler = await store.create('crawler', { ...crawlerInput, gameId: 'g1' })

    const refused = await assignLink(
      { type: 'pilot', id: pilot.id },
      { type: 'crawler', id: crawler.id }
    ).catch((err: unknown) => err)

    expect(refused).toBeInstanceOf(LinkRefused)
    expect((refused as Error).message).toBe(CROSS_CONTAINER_REFUSAL)
    expect(await persisted()).toEqual([])
  })

  test("a server refusal arrives as a LinkRefused carrying the server's copy", async () => {
    const refusing = {
      create: async (): Promise<SoftLink> => {
        throw new ConvexError('That pilot already flies another mech')
      },
    }
    const refused = await assignLink(
      { type: 'mech', id: 'm' },
      { type: 'pilot', id: 'p' },
      refusing
    ).catch((err: unknown) => err)

    expect(refused).toBeInstanceOf(LinkRefused)
    expect((refused as Error).message).toBe('That pilot already flies another mech')
  })
})

describe('a move drops the links it would leave straddling two containers', () => {
  test('moving a pilot into a Game drops its shelf crew link, keeps a link already there', async () => {
    const store = useEntityStore.getState()
    const pilot = await store.create('pilot', { ...pilotInput, gameId: null })
    const shelfCrawler = await store.create('crawler', { ...crawlerInput, gameId: null })
    const shelfMech = await store.create('mech', { ...mechInput, gameId: null })
    await assignLink({ type: 'pilot', id: pilot.id }, { type: 'crawler', id: shelfCrawler.id })
    await assignLink({ type: 'mech', id: shelfMech.id }, { type: 'pilot', id: pilot.id })
    await assignLink({ type: 'mech', id: shelfMech.id }, { type: 'crawler', id: shelfCrawler.id })

    await store.update('pilot', pilot.id, { gameId: 'g1' }, CONTAINER_MOVE)

    // Both of the pilot's links had their other end left on the shelf; the
    // mech's own crawler link does not touch the pilot.
    const expected = [`mech-to-crawler:${shelfMech.id}>${shelfCrawler.id}`]
    expect(useEntityStore.getState().softLinks.map(shape)).toEqual(expected)
    expect(await persisted()).toEqual(expected)
  })

  test('an edit that is not a move prunes nothing', async () => {
    const store = useEntityStore.getState()
    const pilot = await store.create('pilot', { ...pilotInput, gameId: null })
    const crawler = await store.create('crawler', { ...crawlerInput, gameId: null })
    await assignLink({ type: 'pilot', id: pilot.id }, { type: 'crawler', id: crawler.id })

    await store.update('pilot', pilot.id, { name: 'Renamed' }, CONTAINER_MOVE)

    expect(await persisted()).toHaveLength(1)
  })
})

describe('forget on a link', () => {
  test('drops this browser’s copy only', async () => {
    const store = useEntityStore.getState()
    const mech = await store.create('mech', { ...mechInput, gameId: null })
    const crawler = await store.create('crawler', { ...crawlerInput, gameId: null })
    const link = await assignLink(
      { type: 'mech', id: mech.id },
      { type: 'crawler', id: crawler.id }
    )

    await useEntityStore.getState().forget('softLink', link.id)

    expect(useEntityStore.getState().softLinks).toEqual([])
    expect(await persisted()).toEqual([])
    // The endpoints are untouched.
    expect(useEntityStore.getState().get('mech', mech.id)).not.toBeNull()
  })
})
