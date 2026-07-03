/**
 * MechSheet — Take Damage / Critical Damage UI tests (design-review R-1;
 * Core Book p.239-240).
 *
 * The d20 is injected via the `roll` prop (deterministic — no real
 * randomness). Covers: SP intake (1:1, HP-halved, Vulnerable ×2 default from
 * the mech flag), the 0 SP Critical Damage prompt, the per-band patches
 * (miraculous 1 SP / chassis damaged / destroyed / player-choice advisory),
 * and that readOnly renders no damage controls.
 *
 * Conventions: toBeTruthy() not toBeInTheDocument(), dep-injection not
 * mock.module() — same discipline as MechSheet-heatCheck.test.tsx.
 */

import { afterEach, beforeAll, describe, expect, mock, test } from 'bun:test'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { SalvageUnionReference } from 'salvageunion-reference'

import { MechSheet } from '../MechSheet'
import type { Roll } from '../../../lib/rules/heatCheck'
import type { Mech } from '../../../lib/schemas/mech'
import type { useEntityStore } from '../../../stores/entityStore'

beforeAll(async () => {
  await SalvageUnionReference.preload('all')
})

afterEach(() => {
  cleanup()
})

const baseMech: Mech = {
  id: 'mech-dmg-1',
  schemaVersion: 1,
  name: 'Damage Test Mech',
  chassisRef: 'iron-mongrel',
  systems: [],
  modules: [],
  cargoLots: [],
  conditions: [],
  currentSP: 10,
  currentHeat: 2,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
}

const fakeChassis = {
  name: 'Iron Mongrel',
  structurePoints: 12,
  energyPoints: 6,
  heatCapacity: 8,
  systemSlots: 3,
  moduleSlots: 2,
  cargoCapacity: 4,
}

type CapturedUpdate = { id: string; patch: Partial<Mech> }

function makeStore(mech: Mech, captured: CapturedUpdate[]): typeof useEntityStore {
  let current = mech
  const updateMock = mock(async (_type: string, id: string, patch: Partial<Mech>) => {
    captured.push({ id, patch })
    current = { ...current, ...patch }
    return current
  })
  const storeState = {
    pilots: [],
    mechs: [mech],
    crawlers: [],
    softLinks: [],
    hydrated: { pilots: false, mechs: true, crawlers: false, softLinks: false },
    hydrate: mock(async () => {}),
    list: mock(() => [current]),
    get: mock(
      (_type: string, id: string) => (id === current.id ? current : null)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ) as any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    create: mock(async () => mech) as any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    update: updateMock as any,
    delete: mock(async () => {}),
  }
  return (() => storeState) as unknown as typeof useEntityStore
}

/** Returns a Roll yielding the scripted values in order. */
function seqRoll(...values: number[]): Roll {
  let i = 0
  return () => values[i++] ?? values[values.length - 1] ?? 1
}

async function enterAndApply(amount: string) {
  fireEvent.change(screen.getByLabelText('Damage amount'), { target: { value: amount } })
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: 'Apply damage' }))
  })
}

describe('MechSheet — Take Damage intake', () => {
  test('SP-listed damage applies 1:1', async () => {
    const captured: CapturedUpdate[] = []
    render(
      <MechSheet mech={baseMech} chassis={fakeChassis} store={makeStore(baseMech, captured)} />
    )

    await enterAndApply('3')

    expect(captured.length).toBe(1)
    expect(captured[0]!.patch).toEqual({ currentSP: 7 })
  })

  test('HP-listed damage is halved vs the mech', async () => {
    const captured: CapturedUpdate[] = []
    render(
      <MechSheet mech={baseMech} chassis={fakeChassis} store={makeStore(baseMech, captured)} />
    )

    fireEvent.click(screen.getByRole('button', { name: /HP damage/ }))
    await enterAndApply('5')

    // floor(5/2) = 2 → 10 - 2 = 8
    expect(captured[0]!.patch).toEqual({ currentSP: 8 })
  })

  test('Vulnerable ×2 defaults on from the mech flag', async () => {
    const captured: CapturedUpdate[] = []
    const vulnMech: Mech = { ...baseMech, vulnerable: true }
    render(
      <MechSheet mech={vulnMech} chassis={fakeChassis} store={makeStore(vulnMech, captured)} />
    )

    const checkbox = screen.getByRole('checkbox', { name: /vulnerable/i })
    expect((checkbox as HTMLInputElement).checked).toBe(true)

    await enterAndApply('3')

    // 3 × 2 = 6 → 10 - 6 = 4
    expect(captured[0]!.patch).toEqual({ currentSP: 4 })
  })

  test('damage clamps SP at 0 (never negative)', async () => {
    const captured: CapturedUpdate[] = []
    render(
      <MechSheet mech={baseMech} chassis={fakeChassis} store={makeStore(baseMech, captured)} />
    )

    await enterAndApply('99')

    expect(captured[0]!.patch).toEqual({ currentSP: 0 })
  })
})

describe('MechSheet — Critical Damage roll (0 SP)', () => {
  const zeroSpMech: Mech = { ...baseMech, currentSP: 0 }

  test('prompt renders at 0 SP; roll 20 restores 1 SP', async () => {
    const captured: CapturedUpdate[] = []
    render(
      <MechSheet
        mech={zeroSpMech}
        chassis={fakeChassis}
        store={makeStore(zeroSpMech, captured)}
        roll={seqRoll(20)}
      />
    )

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Roll Critical Damage' }))
    })

    const patch = captured[0]!.patch
    expect(patch.lastCriticalDamage?.roll).toBe(20)
    expect(patch.lastCriticalDamage?.outcome).toBe('miraculous-survival')
    expect(patch.currentSP).toBe(1)
    expect(patch.destroyed).toBeUndefined()
    expect(patch.conditions).toBeUndefined()
  })

  test('roll 2-5 marks chassis damaged and prompts the player for a System', async () => {
    const captured: CapturedUpdate[] = []
    render(
      <MechSheet
        mech={zeroSpMech}
        chassis={fakeChassis}
        store={makeStore(zeroSpMech, captured)}
        roll={seqRoll(3)}
      />
    )

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Roll Critical Damage' }))
    })

    const patch = captured[0]!.patch
    expect(patch.lastCriticalDamage?.outcome).toBe('system-destruction')
    expect(patch.conditions).toEqual(['Chassis Damaged'])
    expect(patch.destroyed).toBeUndefined()
    expect(screen.getByText(/Mark one System as Destroyed/i)).toBeTruthy()
  })

  test('roll 11-19 marks chassis damaged with no player choice', async () => {
    const captured: CapturedUpdate[] = []
    render(
      <MechSheet
        mech={zeroSpMech}
        chassis={fakeChassis}
        store={makeStore(zeroSpMech, captured)}
        roll={seqRoll(14)}
      />
    )

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Roll Critical Damage' }))
    })

    const patch = captured[0]!.patch
    expect(patch.lastCriticalDamage?.outcome).toBe('core-damage')
    expect(patch.conditions).toEqual(['Chassis Damaged'])
    expect(screen.queryByText(/Mark one/i)).toBeNull()
  })

  test('roll 1 sets the destroyed flag (catastrophic)', async () => {
    const captured: CapturedUpdate[] = []
    render(
      <MechSheet
        mech={zeroSpMech}
        chassis={fakeChassis}
        store={makeStore(zeroSpMech, captured)}
        roll={seqRoll(1)}
      />
    )

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Roll Critical Damage' }))
    })

    const patch = captured[0]!.patch
    expect(patch.lastCriticalDamage?.outcome).toBe('catastrophic')
    expect(patch.destroyed).toBe(true)
  })

  test('no duplicate Chassis Damaged condition on a re-roll', async () => {
    const captured: CapturedUpdate[] = []
    const damagedMech: Mech = { ...zeroSpMech, conditions: ['Chassis Damaged'] }
    render(
      <MechSheet
        mech={damagedMech}
        chassis={fakeChassis}
        store={makeStore(damagedMech, captured)}
        roll={seqRoll(14)}
      />
    )

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Roll Critical Damage' }))
    })

    expect(captured[0]!.patch.conditions).toBeUndefined()
  })

  test('no prompt above 0 SP or on a destroyed mech', () => {
    const captured: CapturedUpdate[] = []
    const { unmount } = render(
      <MechSheet mech={baseMech} chassis={fakeChassis} store={makeStore(baseMech, captured)} />
    )
    expect(screen.queryByRole('button', { name: 'Roll Critical Damage' })).toBeNull()
    unmount()

    const deadMech: Mech = { ...zeroSpMech, destroyed: true }
    render(
      <MechSheet mech={deadMech} chassis={fakeChassis} store={makeStore(deadMech, captured)} />
    )
    expect(screen.queryByRole('button', { name: 'Roll Critical Damage' })).toBeNull()
  })
})

describe('MechSheet — Take Damage readOnly / readout', () => {
  test('readOnly renders the last critical result but no controls', () => {
    const captured: CapturedUpdate[] = []
    const mech: Mech = {
      ...baseMech,
      currentSP: 0,
      lastCriticalDamage: {
        roll: 14,
        outcome: 'core-damage',
        rolledAt: new Date().toISOString(),
      },
    }
    render(
      <MechSheet mech={mech} chassis={fakeChassis} store={makeStore(mech, captured)} readOnly />
    )

    expect(screen.getByText(/Critical Damage 14/i)).toBeTruthy()
    expect(screen.queryByRole('button')).toBeNull()
    expect(screen.queryByLabelText('Damage amount')).toBeNull()
  })
})
