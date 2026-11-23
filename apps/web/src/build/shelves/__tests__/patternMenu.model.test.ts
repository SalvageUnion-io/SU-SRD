/** Deleting a pattern says how many Mechs were built from it (r7 G2). */

import { beforeEach, describe, expect, test } from 'bun:test'
import type { MechPattern } from 'game-domain/schemas/pattern'
import { mechFixture } from '../../../components/__tests__/fixtures'
import { resetStores } from '../../../replica/__tests__/resetStores'
import { withSignedInBackend } from '../../../replica/__tests__/signedInBackend'
import { useUnits } from '../../../replica/units'
import { deletedLine } from '../patternMenu.model'

withSignedInBackend()

beforeEach(() => {
  resetStores()
})

const pattern = (id: string, name: string): MechPattern => ({
  id,
  schemaVersion: 1,
  name,
  chassisRef: 'mule',
  systems: [],
  modules: [],
  createdAt: '2026-11-01T10:00:00.000Z',
})

describe('deletedLine', () => {
  test('names what went, and the Mechs built from it', async () => {
    const units = useUnits.getState()
    expect(deletedLine([pattern('p1', 'Longhaul')])).toBe('Deleted Longhaul.')
    await units.adopt('mech', mechFixture({ id: 'm1', sourcePattern: 'p1' }))
    expect(deletedLine([pattern('p1', 'Longhaul')])).toBe(
      'Deleted Longhaul. 1 Mech built from it keeps its loadout.'
    )
    await units.adopt('mech', mechFixture({ id: 'm2', sourcePattern: 'p2' }))
    expect(deletedLine([pattern('p1', 'Longhaul'), pattern('p2', 'Tank')])).toBe(
      'Deleted 2. 2 Mechs built from them keep their loadout.'
    )
  })
})
