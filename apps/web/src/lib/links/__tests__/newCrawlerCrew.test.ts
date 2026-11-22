import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import {
  crawlerFixture,
  mechFixture,
  pilotFixture,
  softLinkFixture,
} from '../../../components/__tests__/fixtures'
import { resetStores } from '../../../replica/__tests__/resetStores'
import { withSignedInBackend } from '../../../replica/__tests__/signedInBackend'
import { useUnits } from '../../../replica/units'
import { crewFor, crewNewCrawler } from '../newCrawlerCrew'

// Assigning is a write: these run signed in.
withSignedInBackend()

const MARA = pilotFixture({ id: 'mara', name: 'Mara', gameId: null })
const DISCO = mechFixture({ id: 'disco', name: 'Disco Inferno', gameId: null })
const PAIR = softLinkFixture('mech-to-pilot', 'disco', 'mara')

describe('crewFor (r4 E19)', () => {
  const units = { pilots: [MARA], mechs: [DISCO], softLinks: [PAIR] }

  test('from a pilot: the pilot and the mech they fly', () => {
    expect(crewFor({ type: 'pilot', id: 'mara' }, units)).toEqual([
      { type: 'pilot', id: 'mara' },
      { type: 'mech', id: 'disco' },
    ])
  })

  test('from a mech: the mech and its pilot', () => {
    expect(crewFor({ type: 'mech', id: 'disco' }, units)).toEqual([
      { type: 'mech', id: 'disco' },
      { type: 'pilot', id: 'mara' },
    ])
  })

  test('unpaired, or paired across containers: the unit alone', () => {
    expect(crewFor({ type: 'pilot', id: 'mara' }, { ...units, softLinks: [] })).toEqual([
      { type: 'pilot', id: 'mara' },
    ])
    const away = { ...units, mechs: [{ ...DISCO, gameId: 'g1' }] }
    expect(crewFor({ type: 'pilot', id: 'mara' }, away)).toEqual([{ type: 'pilot', id: 'mara' }])
  })
})

describe('crewNewCrawler', () => {
  beforeEach(resetStores)
  afterEach(resetStores)

  test('the new crawler arrives with the pilot in its crew and their mech assigned', async () => {
    const store = useUnits.getState()
    await store.adopt('pilot', MARA)
    await store.adopt('mech', DISCO)
    await store.adopt('softLink', PAIR)
    await store.adopt('crawler', crawlerFixture({ id: 'hauler', name: 'Hauler', gameId: null }))

    await crewNewCrawler('hauler', { type: 'pilot', id: 'mara' })

    const aboard = useUnits
      .getState()
      .softLinks.filter((l) => l.to.id === 'hauler')
      .map((l) => `${l.type}:${l.from.id}`)
      .sort()
    expect(aboard).toEqual(['mech-to-crawler:disco', 'pilot-to-crawler:mara'])
    // The pair itself stands.
    expect(useUnits.getState().softLinks.some((l) => l.type === 'mech-to-pilot')).toBe(true)
  })
})
