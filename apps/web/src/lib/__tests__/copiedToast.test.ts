/**
 * The copy notice opens the copy and stays as any toast with an action does
 * (chrome K5: 20 seconds with a close of its own; r5 C3, over r4 E19), and it
 * closes at once when its copy is gone (deleted, or the account signed out).
 */

import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { mechFixture, npcFixture, pilotFixture } from '../../components/__tests__/fixtures'
import { ACTION_TOAST_MS, MOST_ACTION_TOASTS, toast } from '../../components/index'
import type { Confirm } from '../../components/shared/useConfirm'
import { resetStores } from '../../replica/__tests__/resetStores'
import { withSignedInBackend } from '../../replica/__tests__/signedInBackend'
import { LIVE_SHEET_MANUAL } from '../../replica/provenance'
import { useUnits } from '../../replica/units'
import { copyAsking, keptMech, madeToast, makeACopy } from '../copiedToast'
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
  test('its notice stays 20 seconds, and carries its own close (r5 C3)', async () => {
    await copied()
    const [line] = open()
    // It says what was copied, by the original's name (MD3-15).
    expect((line as { title?: unknown }).title).toBe('Copied Leaky.')
    expect((line as { duration?: number }).duration).toBe(ACTION_TOAST_MS)
    expect((line as { closeButton?: boolean }).closeButton).toBe(true)
  })

  test('its notice closes at once when the copy is gone', async () => {
    await copied()
    expect(open()).toHaveLength(1)
    await useUnits.getState().forget('mech', 'copy-1')
    expect(open()).toHaveLength(0)
  })
})

describe('madeToast (r5 C3)', () => {
  test('its words follow a rename of what it made', async () => {
    const units = useUnits.getState()
    await units.adopt('mech', mechFixture({ id: 'made-1', name: 'Digger' }))
    const name = () => useUnits.getState().get('mech', 'made-1')?.name ?? ''
    const title = () => (open()[0] as { title?: unknown } | undefined)?.title
    madeToast(
      () => `Saved ${name()}.`,
      'Open',
      { href: '/x' },
      () => {}
    )
    expect(title()).toBe('Saved Digger.')
    await units.update('mech', 'made-1', { name: 'Shovel' }, LIVE_SHEET_MANUAL)
    expect(open()).toHaveLength(1)
    expect(title()).toBe('Saved Shovel.')
  })

  test('one toast stands at a time: the newest replaces the older (r7 A4)', () => {
    for (const n of [1, 2, 3, 4, 5]) madeToast(`Made ${n}.`, 'Open', { href: '/x' }, () => {})
    expect(open().map((t) => (t as { title?: unknown }).title)).toEqual(['Made 5.'])
    expect(open()).toHaveLength(MOST_ACTION_TOASTS)
  })
})

describe('a Mech sheet’s Make a copy opens the copy (r7 G4)', () => {
  test('it lands on the copy, and the notice leads back to the original', async () => {
    const units = useUnits.getState()
    const mech = await units.adopt('mech', mechFixture({ id: 'm-a', name: 'Mule Hauler A' }))
    const went: string[] = []
    const landed: string[] = []
    await copyAsking(
      () => {},
      'mech',
      mech.name,
      mech,
      (href) => went.push(href),
      {
        openCopy: true,
        landed: (id) => landed.push(id),
      }
    )
    const copy = useUnits.getState().mechs.find((m) => m.id !== 'm-a')
    expect(copy?.name).toBe('Mule Hauler A 2')
    expect(landed).toEqual([copy?.id ?? ''])
    // No press on the notice to get there.
    expect(went).toEqual([`/mechs/${copy?.id}`])
    const [line] = open() as { title?: unknown; action?: { label: string; onClick: () => void } }[]
    expect(line?.title).toBe('Copied Mule Hauler A.')
    expect(line?.action?.label).toBe('Back to the original')
    line?.action?.onClick()
    expect(went.at(-1)).toBe('/mechs/m-a')
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
    expect(asked[0]?.title).toBe('Copy the Mech too?')
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
    expect(twin?.name).toBe('Rig 2')
    expect(
      softLinks.some(
        (l) => l.type === 'mech-to-pilot' && l.from.id === twin?.id && l.to.id === copy?.id
      )
    ).toBe(true)
    expect(String((open()[0] as { title?: unknown }).title)).toContain('with Rig.')
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

// MD3-12: a copy of an NPC in a Game was made outside the Game.
describe('copying an NPC', () => {
  const copyOf = async (gameId: string | null) => {
    const npc = await useUnits
      .getState()
      .adopt('npc', npcFixture({ id: 'n-vex', name: 'Warlord Vex', gameId }))
    await copyAsking(
      () => {},
      'npc',
      npc.name,
      npc,
      () => {}
    )
    return useUnits.getState().npcs.find((n) => n.id !== 'n-vex')
  }

  test('the copy stays in the Game its original is in', async () => {
    const copy = await copyOf('g1')
    expect(copy?.name).toBe('Warlord Vex 2')
    expect(copy?.gameId).toBe('g1')
    expect((open()[0] as { title?: unknown }).title).toBe('Copied Warlord Vex.')
  })

  test('one in no Game is copied into none', async () => {
    expect((await copyOf(null))?.gameId ?? null).toBeNull()
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
