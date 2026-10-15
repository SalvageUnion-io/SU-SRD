/**
 * The Mech Major's destructive paths (dashboard.md §5.1–5.3, ADR-007): what
 * auto-applies, and what waits for the player to confirm.
 *
 *  - A Heat Check that overloads into a Meltdown applies its bookkeeping but
 *    holds `destroyed` back for **Confirm Meltdown**.
 *  - Damage that reaches 0 SP offers the Critical Damage roll; a Catastrophic
 *    result asks before marking the mech destroyed, and a Miraculous Survival
 *    puts it back at 1 SP with nothing to confirm.
 *  - The deck's armed Take Damage hand-off opens the damage prompt and is
 *    consumed once.
 *  - Eject asks first; Shut Down toggles; Storage jettisons a lot.
 *
 * The dice come from Randsum, which draws on `Math.random`: 0 rolls a 1 on
 * every d20, and 0.999 rolls a 20.
 */

import { afterEach, beforeAll, describe, expect, spyOn, test } from 'bun:test'
import { act, fireEvent, render, screen, within } from '@testing-library/react'
import type { Mech } from 'cantina-domain/schemas/mech'
import { dieForTable } from '../../../../ui/index'
import { mechFixture } from '../../__tests__/fixtures'
import { MechMajor } from '../MechSlot'
import type { DamagePrompt, PlayStore } from '../SlotRow'

type Update = { id: string; patch: Partial<Mech> }

/** A store over one mech: every write is recorded and lands, as the server's would. */
function liveStore(start: Mech) {
  let current = start
  const updates: Update[] = []
  const store = {
    get: (_type: string, id: string) => (id === current.id ? current : null),
    update: async (_type: string, id: string, patch: Partial<Mech>) => {
      updates.push({ id, patch })
      current = { ...current, ...patch }
      return current
    },
    transfer: async () => undefined,
  } as unknown as PlayStore
  return { store, updates }
}

// Mule: 12 SP, 6 Heat Cap.
const mule = mechFixture({
  id: 'm1',
  name: 'Iron Mongrel',
  chassisRef: 'mule',
  currentSP: 2,
  currentHeat: 4,
  cargoLots: [],
})

type Seen = { ejected: number; consumed: number }

async function renderMajor(
  mech: Mech,
  store: PlayStore,
  { damagePrompt = null, seen }: { damagePrompt?: DamagePrompt | null; seen?: Seen } = {}
) {
  await act(async () => {
    render(
      <MechMajor
        mech={mech}
        store={store}
        activeEffects={[]}
        boarded
        onToggleEffect={() => {}}
        onDismount={() => {}}
        onEject={() => {
          if (seen) seen.ejected += 1
        }}
        damagePrompt={damagePrompt}
      />
    )
  })
}

async function click(el: HTMLElement) {
  await act(async () => {
    fireEvent.click(el)
  })
}

const button = (name: string | RegExp) => screen.getByRole('button', { name })

function overlay(title: string) {
  return within(screen.getByRole('dialog', { name: title }))
}

let random: ReturnType<typeof spyOn> | null = null

function dice(value: number) {
  random = spyOn(Math, 'random').mockReturnValue(value)
}

// The table dice load on first use; loaded here, a roll settles inside act().
beforeAll(async () => {
  await Promise.all([dieForTable('Reactor Overload'), dieForTable('Critical Damage')])
})

afterEach(() => {
  random?.mockRestore()
  random = null
})

describe('Heat Check', () => {
  test('a 1 against Heat 4 overloads into a Meltdown: bookkeeping lands, destruction waits', async () => {
    dice(0)
    const { store, updates } = liveStore(mule)
    await renderMajor(mule, store)
    await click(button('Heat Check'))
    expect(updates).toHaveLength(1)
    expect(updates[0]?.patch.destroyed).toBeUndefined()
    const reactor = overlay('Reactor')
    expect(reactor.getByText(/^Heat Check 1 vs Heat 4 — /)).toBeTruthy()

    await click(reactor.getByRole('button', { name: 'Confirm Meltdown — Mark Mech destroyed' }))
    expect(updates.at(-1)?.patch).toEqual({ destroyed: true })
    expect(screen.queryByRole('dialog', { name: 'Reactor' })).toBeNull()
  })

  test('a 20 passes: no Meltdown to confirm', async () => {
    dice(0.999)
    const { store } = liveStore(mule)
    await renderMajor(mule, store)
    await click(button('Heat Check'))
    const reactor = overlay('Reactor')
    expect(reactor.getByText(/^Heat Check 20 vs Heat 4 — /)).toBeTruthy()
    expect(reactor.queryByRole('button', { name: /Confirm Meltdown/ })).toBeNull()
  })
})

describe('Take Damage → Critical Damage', () => {
  async function takeTwo(store: PlayStore) {
    await renderMajor(mule, store)
    await click(button('Take Damage'))
    const prompt = overlay('Take Structure Damage')
    await click(prompt.getByRole('button', { name: 'Add one damage point' }))
    await click(prompt.getByRole('button', { name: 'Apply −2 SP' }))
  }

  test('damage to 0 SP offers the roll; Catastrophic asks before marking the mech destroyed', async () => {
    const { store, updates } = liveStore(mule)
    await takeTwo(store)
    expect(updates).toEqual([{ id: 'm1', patch: { currentSP: 0 } }])
    const crit = overlay('Critical Damage')
    expect(crit.getByText('−2 SP → 0.')).toBeTruthy()

    dice(0)
    await click(crit.getByRole('button', { name: 'Roll Critical Damage' }))
    // Nothing destructive applied by the roll itself.
    expect(updates).toHaveLength(2)
    expect(updates[1]?.patch).toEqual({})
    const rolled = overlay('Critical Damage')
    expect(
      rolled.getByText('Critical Damage 1: Catastrophic — mech destroyed (confirm below).')
    ).toBeTruthy()
    await click(rolled.getByRole('button', { name: 'Mark Mech destroyed' }))
    expect(updates.at(-1)?.patch).toEqual({ destroyed: true })
  })

  test('a Miraculous Survival puts the mech back at 1 SP with nothing to confirm', async () => {
    const { store, updates } = liveStore(mule)
    await takeTwo(store)
    dice(0.999)
    await click(overlay('Critical Damage').getByRole('button', { name: 'Roll Critical Damage' }))
    expect(updates.at(-1)?.patch).toEqual({ currentSP: 1 })
    const rolled = overlay('Critical Damage')
    expect(
      rolled.getByText('Critical Damage 20: Miraculous Survival — mech Intact at 1 SP.')
    ).toBeTruthy()
    expect(rolled.queryByRole('button', { name: 'Mark Mech destroyed' })).toBeNull()
  })

  test('damage short of 0 just reads the new SP', async () => {
    const sturdy = { ...mule, currentSP: 10 }
    const { store, updates } = liveStore(sturdy)
    await renderMajor(sturdy, store)
    await click(button('Take Damage'))
    await click(overlay('Take Structure Damage').getByRole('button', { name: 'Apply −1 SP' }))
    expect(updates).toEqual([{ id: 'm1', patch: { currentSP: 9 } }])
    expect(overlay('Reactor').getByText('−1 SP → 9.')).toBeTruthy()
  })

  test("the deck's armed hand-off opens the damage prompt and is consumed", async () => {
    const seen: Seen = { ejected: 0, consumed: 0 }
    const { store } = liveStore(mule)
    const damagePrompt: DamagePrompt = { armed: true, consume: () => (seen.consumed += 1) }
    await renderMajor(mule, store, { damagePrompt, seen })
    expect(
      overlay('Take Structure Damage').getByRole('button', { name: 'Apply −1 SP' })
    ).toBeTruthy()
    expect(seen.consumed).toBe(1)
  })
})

describe('the other Reactor and Chassis verbs', () => {
  test('Shut Down toggles the reactor flag', async () => {
    const { store, updates } = liveStore(mule)
    await renderMajor(mule, store)
    await click(button('Shut Down'))
    await click(button('Shut Down'))
    expect(updates.map((u) => u.patch)).toEqual([{ shutdown: true }, { shutdown: false }])
  })

  test('Eject asks first, then sends the exit', async () => {
    const seen: Seen = { ejected: 0, consumed: 0 }
    const { store } = liveStore(mule)
    await renderMajor(mule, store, { seen })
    await click(button('Eject'))
    expect(seen.ejected).toBe(0)
    await click(overlay('Eject').getByRole('button', { name: 'Confirm Eject' }))
    expect(seen.ejected).toBe(1)
    expect(screen.queryByRole('dialog', { name: 'Eject' })).toBeNull()
  })

  test('Storage opens the hold, and Jettison drops that lot', async () => {
    const laden: Mech = {
      ...mule,
      cargoLots: [
        {
          id: 'lot-a',
          kind: 'bulk',
          name: 'T1 Scrap',
          cat: 'SCRAP',
          tl: 1,
          qty: 2,
          units: 2,
          code: 'T1',
        },
        { id: 'lot-b', kind: 'unit', name: 'Sealed Crate', cat: 'SEALED', units: 1, code: 'SEA' },
      ],
    }
    const { store, updates } = liveStore(laden)
    await renderMajor(laden, store)
    await click(button('Storage'))
    const hold = overlay('Cargo Hold')
    expect(document.querySelector('.su-dash-cargo-usage')?.textContent).toBe('Units3/16')
    await click(hold.getByRole('button', { name: 'Jettison T1 Scrap' }))
    expect(updates).toHaveLength(1)
    expect(updates[0]?.patch.cargoLots?.map((l) => l.id)).toEqual(['lot-b'])
  })
})
