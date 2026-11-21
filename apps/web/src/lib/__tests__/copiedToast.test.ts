/**
 * The copy notice leaves like every other (r2 C3): it has a timer, and it
 * closes at once when its copy is gone (deleted, or the account signed out).
 */

import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { mechFixture, pilotFixture } from '../../components/__tests__/fixtures'
import { toast } from '../../components/index'
import type { Confirm } from '../../components/shared/useConfirm'
import { resetStores } from '../../replica/__tests__/resetStores'
import { withSignedInBackend } from '../../replica/__tests__/signedInBackend'
import { useUnits } from '../../replica/units'
import { copyAsking, keptMech, makeACopy } from '../copiedToast'
import { ROW_ACTION_COPY } from '../games/rowActionCopy'

withSignedInBackend()

const open = () => toast.getToasts().filter((t) => !('dismiss' in t && t.dismiss))

beforeEach(() => {
  resetStores()
  toast.dismiss()
})

afterEach(() => {
  toast.dismiss()
})

async function copied() {
  const units = useUnits.getState()
  await units.adopt('mech', mechFixture({ id: 'copy-1', name: 'COPY OF Leaky' }))
  await makeACopy({
    name: 'Leaky',
    make: async () => ({
      name: 'COPY OF Leaky',
      href: '/mechs/copy-1',
      exists: () => useUnits.getState().get('mech', 'copy-1') !== null,
    }),
    go: () => {},
  })
}

describe('makeACopy', () => {
  test('its notice has a timer, as every action toast has', async () => {
    await copied()
    const [line] = open()
    expect((line as { duration?: number }).duration).toBe(8000)
  })

  test('its notice closes at once when the copy is gone', async () => {
    await copied()
    expect(open()).toHaveLength(1)
    await useUnits.getState().forget('mech', 'copy-1')
    expect(open()).toHaveLength(0)
  })
})

/** A pilot who flies a mech, both on the shelf. */
async function ghostAndRig() {
  const units = useUnits.getState()
  const pilot = await units.adopt(
    'pilot',
    pilotFixture({ id: 'p-ghost', name: 'Mara Voss', callsign: 'Ghost', gameId: null })
  )
  await units.adopt('mech', mechFixture({ id: 'm-rig', name: 'Rig', gameId: null }))
  await units.create('softLink', {
    from: { type: 'mech', id: 'm-rig' },
    to: { type: 'pilot', id: 'p-ghost' },
    type: 'mech-to-pilot',
  })
  return pilot
}

type Asked = Parameters<Confirm>[0]

describe('copying a pilot (r2 G6)', () => {
  test('a pilot with no mech is copied at once, under a callsign of its own', async () => {
    const units = useUnits.getState()
    const pilot = await units.adopt(
      'pilot',
      pilotFixture({ id: 'p-ghost', name: 'Mara Voss', callsign: 'Ghost', gameId: null })
    )
    const asked: Asked[] = []
    const landed: string[] = []
    await copyAsking(
      (request) => asked.push(request),
      'pilot',
      pilot.name,
      pilot,
      () => {},
      {
        landed: (id) => landed.push(id),
      }
    )
    expect(asked).toHaveLength(0)
    const pilots = useUnits.getState().pilots
    expect(pilots.map((p) => p.callsign).sort()).toEqual(['Ghost', 'Ghost 2'])
    expect(landed).toEqual([pilots.find((p) => p.callsign === 'Ghost 2')?.id ?? ''])
    expect(open()).toHaveLength(1)
  })

  test('a pilot who flies a mech is asked whether the mech comes too', async () => {
    const pilot = await ghostAndRig()
    const asked: Asked[] = []
    void copyAsking(
      (request) => asked.push(request),
      'pilot',
      pilot.name,
      pilot,
      () => {}
    )
    expect(asked[0]?.title).toBe('Copy the mech too?')
    expect(asked[0]?.confirmLabel).toBe('Copy both')
    expect(asked[0]?.alternate?.label).toBe('Pilot only')
    // Nothing is made until an answer.
    expect(useUnits.getState().pilots).toHaveLength(1)
  })

  test('Copy both makes the pilot and the mech, paired', async () => {
    const pilot = await ghostAndRig()
    const asked: Asked[] = []
    void copyAsking(
      (request) => asked.push(request),
      'pilot',
      pilot.name,
      pilot,
      () => {}
    )
    await asked[0]?.onConfirm()
    const { pilots, mechs, softLinks } = useUnits.getState()
    const copy = pilots.find((p) => p.id !== 'p-ghost')
    const twin = mechs.find((m) => m.id !== 'm-rig')
    expect(copy?.callsign).toBe('Ghost 2')
    expect(twin?.name).toBe('COPY OF Rig')
    expect(
      softLinks.some(
        (l) => l.type === 'mech-to-pilot' && l.from.id === twin?.id && l.to.id === copy?.id
      )
    ).toBe(true)
    expect(String((open()[0] as { title?: unknown }).title)).toContain('with COPY OF Rig')
  })

  test('Pilot only leaves the mech alone', async () => {
    const pilot = await ghostAndRig()
    const asked: Asked[] = []
    void copyAsking(
      (request) => asked.push(request),
      'pilot',
      pilot.name,
      pilot,
      () => {}
    )
    await asked[0]?.alternate?.onConfirm()
    expect(useUnits.getState().pilots).toHaveLength(2)
    expect(useUnits.getState().mechs).toHaveLength(1)
  })
})

describe('deleting a pilot (r2 G6)', () => {
  test('the confirm says the mech they fly is kept', async () => {
    await ghostAndRig()
    const body = ROW_ACTION_COPY.deleteBuild('Mara Voss', keptMech('pilot', 'p-ghost')).body
    expect(body.join(' ')).toContain('Their Mech, Rig, is kept')
  })

  test('a pilot with no mech, or a mech, says nothing of one', async () => {
    await ghostAndRig()
    expect(keptMech('mech', 'm-rig')).toBeUndefined()
    expect(keptMech('pilot', 'nobody')).toBeUndefined()
    expect(ROW_ACTION_COPY.deleteBuild('Rig').body).toHaveLength(1)
  })
})
