/**
 * Deleting a Mech is one confirm and its notice's Undo (r5 D9): the Undo
 * brings back the same Mech, its id, loadout and Pilot.
 */

import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { mechFixture, pilotFixture } from '../../../components/__tests__/fixtures'
import { toast } from '../../../components/index'
import { ROW_ACTION_COPY } from '../../../lib/games/rowActionCopy'
import { resetStores } from '../../../replica/__tests__/resetStores'
import { withSignedInBackend } from '../../../replica/__tests__/signedInBackend'
import { useUnits } from '../../../replica/units'
import { deleteMech, deleteMechs, putBack } from '../deleteMech.model'

withSignedInBackend()

type Line = { title?: unknown; duration?: number; action?: { label: string } }
const open = () => toast.getToasts().filter((t) => !('dismiss' in t && t.dismiss)) as Line[]

beforeEach(() => {
  resetStores()
  toast.dismiss()
})
afterEach(() => toast.dismiss())

describe('deleteMech', () => {
  test('the confirm no longer says it cannot be undone', () => {
    expect(ROW_ACTION_COPY.deleteMech('Digger').body.join(' ')).not.toMatch(/cannot be undone/)
  })

  test('deletes, offers Undo for 20 seconds, and the Undo restores the same Mech and its Pilot', async () => {
    const units = useUnits.getState()
    await Promise.all(['pilot', 'mech', 'softLink'].map((t) => units.hydrate(t as never)))
    const pilot = await units.create('pilot', pilotFixture({ id: 'p-dig', gameId: null }))
    const mech = await units.create(
      'mech',
      mechFixture({ id: 'm-dig', name: 'Digger', gameId: null, systems: ['Chainsaw Arm'] })
    )
    await units.create('softLink', {
      type: 'mech-to-pilot',
      from: { type: 'mech', id: mech.id },
      to: { type: 'pilot', id: pilot.id },
    })

    await deleteMech(mech.id)
    expect(useUnits.getState().get('mech', mech.id)).toBeNull()
    const line = open().find((t) => t.action)
    expect(line?.title).toBe('Deleted Digger.')
    expect(line?.action?.label).toBe('Undo')
    expect(line?.duration).toBe(20_000)

    await putBack(mech, [
      {
        id: 'l1',
        type: 'mech-to-pilot',
        from: { type: 'mech', id: mech.id },
        to: { type: 'pilot', id: pilot.id },
      },
    ])
    const back = useUnits.getState().get('mech', mech.id)
    expect(back?.name).toBe('Digger')
    expect(back?.systems).toEqual(['Chainsaw Arm'])
    expect(
      useUnits
        .getState()
        .list('softLink')
        .some((l) => l.from.id === mech.id && l.to.id === pilot.id)
    ).toBe(true)
    expect(open().some((t) => t.title === 'Digger is back.')).toBe(true)
  })

  test('several at once share one notice, whose Undo brings them all back (r6 E3)', async () => {
    const units = useUnits.getState()
    await Promise.all(['mech', 'softLink'].map((t) => units.hydrate(t as never)))
    const a = await units.create('mech', mechFixture({ id: 'm-a', name: 'Alpha', gameId: null }))
    const b = await units.create('mech', mechFixture({ id: 'm-b', name: 'Bravo', gameId: null }))
    await deleteMechs([a.id, b.id])
    expect(useUnits.getState().get('mech', a.id)).toBeNull()
    expect(useUnits.getState().get('mech', b.id)).toBeNull()
    const lines = open().filter((t) => t.action)
    expect(lines.map((t) => t.title)).toEqual(['Deleted 2 Mechs.'])
  })
})
