/**
 * PilotSheet — Take Damage / Critical Injury UI tests (design-review R-1;
 * Core Book p.241).
 *
 * The d20 is injected via the `roll` prop (deterministic). Covers: HP intake
 * (1:1, SP-doubled, Vulnerable ×2), the 0 HP Critical Injury prompt, the
 * per-band patches (miraculous 1 HP / auto Unconscious condition / fatal is
 * advisory-only), the player-accepted injury appending to the injuries
 * schema, and that readOnly renders no damage controls.
 */

import { afterEach, beforeAll, describe, expect, mock, test } from 'bun:test'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { SalvageUnionReference } from 'salvageunion-reference'
import { Toaster, toast } from 'suref-react'

import { PilotSheet } from '../PilotSheet'
import type { Roll } from '../../../lib/rules/heatCheck'
import type { Pilot } from '../../../lib/schemas/pilot'
import type { useEntityStore } from '../../../stores/entityStore'

beforeAll(async () => {
  await SalvageUnionReference.preload('all')
})

afterEach(() => {
  // Toast state + sticky-kind sessionStorage are module-global — clear both so
  // the undo toast and last-used kind never leak into the SP-default tests.
  toast.dismiss()
  sessionStorage.clear()
  cleanup()
})

function makePilot(overrides: Partial<Pilot> = {}): Pilot {
  return {
    id: 'pilot-dmg-1',
    schemaVersion: 1,
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
    currentHP: 10,
    currentAP: 5,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  }
}

type CapturedUpdate = { id: string; patch: Partial<Pilot> }

/** Stub store that TRACKS updates so `get` returns the freshest record. */
function makeStore(pilot: Pilot, captured: CapturedUpdate[]): typeof useEntityStore {
  let current = pilot
  const updateMock = mock(async (_type: string, id: string, patch: Partial<Pilot>) => {
    captured.push({ id, patch })
    current = { ...current, ...patch }
    return current
  })
  const storeState = {
    pilots: [pilot],
    mechs: [],
    crawlers: [],
    softLinks: [],
    hydrated: { pilots: true, mechs: false, crawlers: false, softLinks: false },
    hydrate: mock(async () => {}),
    list: mock(() => [current]),
    get: mock(
      (_type: string, id: string) => (id === current.id ? current : null)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ) as any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    create: mock(async () => pilot) as any,
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

describe('PilotSheet — Take Damage intake', () => {
  test('HP-listed damage applies 1:1', async () => {
    const pilot = makePilot()
    const captured: CapturedUpdate[] = []
    render(<PilotSheet pilot={pilot} store={makeStore(pilot, captured)} />)

    await enterAndApply('2')

    expect(captured.length).toBe(1)
    expect(captured[0]!.patch).toEqual({ currentHP: 8 })
  })

  test('SP-listed damage is doubled vs the pilot', async () => {
    const pilot = makePilot()
    const captured: CapturedUpdate[] = []
    render(<PilotSheet pilot={pilot} store={makeStore(pilot, captured)} />)

    fireEvent.click(screen.getByRole('button', { name: /SP damage/ }))
    await enterAndApply('3')

    // 3 × 2 = 6 → 10 - 6 = 4
    expect(captured[0]!.patch).toEqual({ currentHP: 4 })
  })

  test('Vulnerable ×2 defaults on from the conditions list and clamps at 0', async () => {
    const pilot = makePilot({ conditions: ['Vulnerable'] })
    const captured: CapturedUpdate[] = []
    render(<PilotSheet pilot={pilot} store={makeStore(pilot, captured)} />)

    const checkbox = screen.getByRole('checkbox', { name: /vulnerable/i })
    expect((checkbox as HTMLInputElement).checked).toBe(true)

    await enterAndApply('7')

    // 7 × 2 = 14 → clamps to 0
    expect(captured[0]!.patch).toEqual({ currentHP: 0 })
  })
})

describe('PilotSheet — Take Damage friction reducers (audit item 25)', () => {
  test('pressing Enter in the amount input applies the hit', async () => {
    const pilot = makePilot()
    const captured: CapturedUpdate[] = []
    render(<PilotSheet pilot={pilot} store={makeStore(pilot, captured)} />)

    const input = screen.getByLabelText('Damage amount')
    fireEvent.change(input, { target: { value: '2' } })
    await act(async () => {
      fireEvent.keyDown(input, { key: 'Enter' })
    })

    expect(captured.length).toBe(1)
    expect(captured[0]!.patch).toEqual({ currentHP: 8 })
  })

  test('applying damage offers an Undo toast that reverts the HP write', async () => {
    const pilot = makePilot()
    const captured: CapturedUpdate[] = []
    render(
      <>
        <Toaster />
        <PilotSheet pilot={pilot} store={makeStore(pilot, captured)} />
      </>
    )

    await enterAndApply('2')
    expect(captured[0]!.patch).toEqual({ currentHP: 8 })

    const undoBtn = await screen.findByRole('button', { name: /undo/i })
    await act(async () => {
      fireEvent.click(undoBtn)
    })

    expect(captured.length).toBe(2)
    expect(captured[1]!.patch).toEqual({ currentHP: 10 })
  })
})

describe('PilotSheet — Critical Injury roll (0 HP)', () => {
  test('roll 20 restores 1 HP, no Unconscious condition', async () => {
    const pilot = makePilot({ currentHP: 0 })
    const captured: CapturedUpdate[] = []
    render(<PilotSheet pilot={pilot} store={makeStore(pilot, captured)} roll={seqRoll(20)} />)

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Roll Critical Injury' }))
    })

    const patch = captured[0]!.patch
    expect(patch.lastCriticalInjury?.outcome).toBe('miraculous-survival')
    expect(patch.currentHP).toBe(1)
    expect(patch.conditions).toBeUndefined()
  })

  test('roll 11-19 auto-applies the Unconscious condition, HP unchanged', async () => {
    const pilot = makePilot({ currentHP: 0 })
    const captured: CapturedUpdate[] = []
    render(<PilotSheet pilot={pilot} store={makeStore(pilot, captured)} roll={seqRoll(15)} />)

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Roll Critical Injury' }))
    })

    const patch = captured[0]!.patch
    expect(patch.lastCriticalInjury?.outcome).toBe('unconscious')
    expect(patch.conditions).toEqual(['Unconscious'])
    expect(patch.currentHP).toBeUndefined()
    // No injury to accept on 11-19
    expect(screen.queryByRole('button', { name: /accept/i })).toBeNull()
  })

  test('roll 6-10 offers a minor injury the player accepts into injuries[]', async () => {
    const pilot = makePilot({ currentHP: 0 })
    const captured: CapturedUpdate[] = []
    render(<PilotSheet pilot={pilot} store={makeStore(pilot, captured)} roll={seqRoll(7)} />)

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Roll Critical Injury' }))
    })

    expect(captured[0]!.patch.lastCriticalInjury?.outcome).toBe('minor-injury')
    expect(captured[0]!.patch.conditions).toEqual(['Unconscious'])

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Accept minor injury' }))
    })

    expect(captured[1]!.patch.injuries).toEqual([
      { severity: 'minor', note: 'Critical Injury (rolled 7)' },
    ])
  })

  test('roll 2-5 offers a major injury; Dismiss applies nothing', async () => {
    const pilot = makePilot({ currentHP: 0 })
    const captured: CapturedUpdate[] = []
    render(<PilotSheet pilot={pilot} store={makeStore(pilot, captured)} roll={seqRoll(4)} />)

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Roll Critical Injury' }))
    })

    expect(captured[0]!.patch.lastCriticalInjury?.outcome).toBe('major-injury')
    expect(screen.getByRole('button', { name: 'Accept major injury' })).toBeTruthy()

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }))
    })

    // Only the roll's own patch — dismissing never writes an injury.
    expect(captured.length).toBe(1)
    expect(screen.queryByRole('button', { name: /accept/i })).toBeNull()
  })

  test('roll 1 (fatal) records the result but applies nothing automatically', async () => {
    const pilot = makePilot({ currentHP: 0 })
    const captured: CapturedUpdate[] = []
    render(<PilotSheet pilot={pilot} store={makeStore(pilot, captured)} roll={seqRoll(1)} />)

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Roll Critical Injury' }))
    })

    const patch = captured[0]!.patch
    expect(patch.lastCriticalInjury?.outcome).toBe('fatal')
    expect(patch.currentHP).toBeUndefined()
    expect(patch.conditions).toBeUndefined()
    expect(patch.injuries).toBeUndefined()
  })

  test('no prompt above 0 HP', () => {
    const pilot = makePilot()
    render(<PilotSheet pilot={pilot} store={makeStore(pilot, [])} />)
    expect(screen.queryByRole('button', { name: 'Roll Critical Injury' })).toBeNull()
  })
})

describe('PilotSheet — Take Damage readOnly / readout', () => {
  test('readOnly renders the last critical result but no controls', () => {
    const pilot = makePilot({
      currentHP: 0,
      lastCriticalInjury: {
        roll: 15,
        outcome: 'unconscious',
        rolledAt: new Date().toISOString(),
      },
    })
    render(<PilotSheet pilot={pilot} store={makeStore(pilot, [])} readOnly />)

    expect(screen.getByText(/Critical Injury 15/i)).toBeTruthy()
    expect(screen.queryByLabelText('Damage amount')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Apply damage' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Roll Critical Injury' })).toBeNull()
  })
})
