import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { mechFixture, pilotFixture, softLinkFixture } from '../../../components/__tests__/fixtures'
import { resetStores } from '../../../replica/__tests__/resetStores'
import { withSignedInBackend } from '../../../replica/__tests__/signedInBackend'
import { useUnits } from '../../../replica/units'
import { pairNewMechInGame, soleMechlessPilot } from '../mechlessPilot'

// Assigning is a write: these run signed in.
withSignedInBackend()

const pilot = (id: string, gameId: string | null) => ({ id, gameId })

describe('soleMechlessPilot (LG-07)', () => {
  test('your one pilot in the Game with no mech', () => {
    const pilots = [pilot('razor', 'g1'), pilot('mara', 'g1'), pilot('solo', null)]
    const links = [softLinkFixture('mech-to-pilot', 'thresher', 'razor')]
    expect(soleMechlessPilot(pilots, links, 'g1')?.id).toBe('mara')
  })

  test('none when two could take it, or every pilot there has one', () => {
    const pilots = [pilot('razor', 'g1'), pilot('mara', 'g1')]
    expect(soleMechlessPilot(pilots, [], 'g1')).toBeNull()
    const links = [
      softLinkFixture('mech-to-pilot', 'thresher', 'razor'),
      softLinkFixture('mech-to-pilot', 'disco', 'mara'),
    ]
    expect(soleMechlessPilot(pilots, links, 'g1')).toBeNull()
  })

  test('a pilot in another Game, or in the Training Bay, is not this Game’s', () => {
    expect(soleMechlessPilot([pilot('razor', 'g2'), pilot('solo', null)], [], 'g1')).toBeNull()
  })
})

describe('pairNewMechInGame', () => {
  beforeEach(resetStores)
  afterEach(resetStores)

  const pairs = () =>
    useUnits
      .getState()
      .softLinks.filter((l) => l.type === 'mech-to-pilot')
      .map((l) => [l.from.id, l.to.id])

  test('assigns the new mech to your one mech-less pilot there, and undoes it', async () => {
    const store = useUnits.getState()
    await store.adopt('pilot', pilotFixture({ id: 'mara', name: 'Mara', gameId: 'g1' }))
    await store.adopt('mech', mechFixture({ id: 'disco', name: 'Disco Inferno', gameId: 'g1' }))

    const paired = await pairNewMechInGame('disco', 'g1')
    expect(paired?.pilot.id).toBe('mara')
    expect(pairs()).toEqual([['disco', 'mara']])

    await paired?.undo()
    expect(pairs()).toEqual([])
  })

  test('assigns nothing when two pilots could take it', async () => {
    const store = useUnits.getState()
    await store.adopt('pilot', pilotFixture({ id: 'mara', name: 'Mara', gameId: 'g1' }))
    await store.adopt('pilot', pilotFixture({ id: 'razor', name: 'Razor', gameId: 'g1' }))
    await store.adopt('mech', mechFixture({ id: 'disco', name: 'Disco Inferno', gameId: 'g1' }))
    expect(await pairNewMechInGame('disco', 'g1')).toBeNull()
    expect(pairs()).toEqual([])
  })
})
