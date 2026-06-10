/**
 * PilotSheet — ability live-play affordances (Slice D)
 *
 * Asserts that:
 *   1. The ability's fixed AP cost is displayed.
 *   2. "Spend AP" decrements the pilot's currentAP by the cost (clamped at 0).
 *   3. "Spend AP" is disabled when the pilot has insufficient AP.
 *   4. The used/recharge toggle persists to usedAbilities and reflects seed state.
 *   5. readOnly suppresses spend + toggle affordances.
 *
 * Uses dep-injected store stubs (no mock.module()). Ability slugs are real
 * salvageunion-reference ability names so resolution exercises the full path.
 */

import { afterEach, beforeAll, describe, expect, mock, test } from 'bun:test'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { SalvageUnionReference } from 'salvageunion-reference'

import { PilotSheet } from '../PilotSheet'
import type { Pilot } from '../../../lib/schemas/pilot'
import type { useEntityStore } from '../../../stores/entityStore'

beforeAll(async () => {
  // PilotSheet resolves abilities + their action AP costs from reference data,
  // and the entity-card foot (footMeta/footActions) renders keyword tooltips —
  // preload everything so resolution works in the test runtime.
  await SalvageUnionReference.preload('all')
})

afterEach(() => {
  cleanup()
})

// "Talk Shop" resolves to a fixed AP cost of 3 in reference data.
const ABILITY_TALK_SHOP = 'Talk Shop'

function makePilot(overrides: Partial<Pilot> = {}): Pilot {
  return {
    id: 'pilot-ab-1',
    schemaVersion: 1,
    name: 'Yara Voss',
    callsign: 'Ghost',
    classRef: 'scavenger',
    abilities: [ABILITY_TALK_SHOP],
    equipment: [],
    rollResults: [],
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

function makeStubStore(pilot: Pilot, updateSpy?: ReturnType<typeof mock>): typeof useEntityStore {
  const updateMock = updateSpy ?? mock(async () => pilot)
  const storeState = {
    pilots: [pilot],
    mechs: [],
    crawlers: [],
    softLinks: [],
    hydrated: { pilots: true, mechs: false, crawlers: false, softLinks: false },
    hydrate: mock(async () => {}),
    list: mock(() => [pilot]),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    get: mock((_type: string, id: string) => (id === pilot.id ? pilot : null)) as any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    create: mock(async () => pilot) as any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    update: updateMock as any,
    delete: mock(async () => {}),
  }
  return (() => storeState) as unknown as typeof useEntityStore
}

describe('PilotSheet — ability AP cost (Slice D)', () => {
  test('displays the ability AP cost in the card foot', () => {
    render(<PilotSheet pilot={makePilot()} store={makeStubStore(makePilot())} />)
    // footMeta renders the label and value as adjacent spans in the card foot
    const label = screen.getByText('AP Cost')
    expect(label).toBeTruthy()
    expect(label.parentElement?.textContent).toContain('3')
  })
})

describe('PilotSheet — spend AP (Slice D)', () => {
  test('spending AP decrements currentAP by the cost', async () => {
    const pilot = makePilot({ currentAP: 5 })
    const updateSpy = mock(async () => pilot)
    render(<PilotSheet pilot={pilot} store={makeStubStore(pilot, updateSpy)} />)

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /spend 3 ap for talk shop/i }))
    })

    // 5 - 3 = 2
    expect(updateSpy).toHaveBeenCalledWith('pilot', pilot.id, { currentAP: 2 })
  })

  test('spend clamps currentAP at 0 (never negative)', async () => {
    // Exactly enough: cost 3, AP 3 → 0
    const pilot = makePilot({ currentAP: 3 })
    const updateSpy = mock(async () => pilot)
    render(<PilotSheet pilot={pilot} store={makeStubStore(pilot, updateSpy)} />)

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /spend 3 ap for talk shop/i }))
    })

    expect(updateSpy).toHaveBeenCalledWith('pilot', pilot.id, { currentAP: 0 })
  })

  test('spend button is disabled when AP is insufficient', async () => {
    const pilot = makePilot({ currentAP: 2 }) // cost is 3
    const updateSpy = mock(async () => pilot)
    render(<PilotSheet pilot={pilot} store={makeStubStore(pilot, updateSpy)} />)

    const spendBtn = screen.getByRole('button', {
      name: /spend 3 ap for talk shop/i,
    }) as HTMLButtonElement
    expect(spendBtn.disabled).toBe(true)

    await act(async () => {
      fireEvent.click(spendBtn)
    })
    expect(updateSpy).not.toHaveBeenCalled()
  })
})

describe('PilotSheet — used/recharge toggle (Slice D)', () => {
  test('marking used persists the ability slug to usedAbilities', async () => {
    const pilot = makePilot()
    const updateSpy = mock(async () => pilot)
    render(<PilotSheet pilot={pilot} store={makeStubStore(pilot, updateSpy)} />)

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /mark talk shop used/i }))
    })

    expect(updateSpy).toHaveBeenCalledWith('pilot', pilot.id, {
      usedAbilities: [ABILITY_TALK_SHOP],
    })
  })

  test('recharging removes the slug from usedAbilities', async () => {
    const pilot = makePilot({ usedAbilities: [ABILITY_TALK_SHOP] })
    const updateSpy = mock(async () => pilot)
    render(<PilotSheet pilot={pilot} store={makeStubStore(pilot, updateSpy)} />)

    // Seeded as used → button recharges
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /recharge talk shop/i }))
    })

    expect(updateSpy).toHaveBeenCalledWith('pilot', pilot.id, {
      usedAbilities: [],
    })
  })
})

describe('PilotSheet — abilities readOnly (Slice D)', () => {
  test('no spend / toggle buttons when readOnly', () => {
    const pilot = makePilot({ usedAbilities: [ABILITY_TALK_SHOP] })
    render(<PilotSheet pilot={pilot} store={makeStubStore(pilot)} readOnly />)

    expect(screen.queryByRole('button', { name: /spend/i })).toBeNull()
    expect(screen.queryByRole('button', { name: /mark .* used/i })).toBeNull()
    expect(screen.queryByRole('button', { name: /recharge/i })).toBeNull()
    // AP cost still shown read-only, plus a static Used stamp
    expect(screen.getByText('AP Cost')).toBeTruthy()
    expect(screen.getByText('Used')).toBeTruthy()
  })
})
