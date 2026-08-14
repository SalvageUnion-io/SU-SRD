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

import { afterEach, describe, expect, mock, test } from 'bun:test'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import type { Pilot } from '../../../lib/schemas/pilot'
import type { useEntityStore } from '../../../stores/entityStore'
import { LIVE_SHEET_MANUAL } from '../../../stores/surfaceProvenance'
import { expandCards } from '../../__tests__/expandCards'
import { FIXTURE_NOW } from '../../__tests__/fixtures'
import { makeEntityStoreMock } from '../../__tests__/mockEntityStore'
import { PilotSheet } from '../PilotSheet'

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
    motto: '',
    keepsake: '',
    appearance: '',
    background: '',
    conditions: [],
    currentHP: 10,
    currentAP: 5,
    createdAt: FIXTURE_NOW,
    updatedAt: FIXTURE_NOW,
    ...overrides,
  }
}

function makeStubStore(pilot: Pilot, updateSpy?: ReturnType<typeof mock>): typeof useEntityStore {
  const updateMock = updateSpy ?? mock(async () => pilot)
  return makeEntityStoreMock({
    pilots: [pilot],
    hydrated: { pilots: true, mechs: false, crawlers: false, softLinks: false },
    hydrate: mock(async () => {}),
    list: mock(() => [pilot]),
    get: mock((_type: string, id: string) => (id === pilot.id ? pilot : null)),
    create: mock(async () => pilot),
    update: updateMock,
    delete: mock(async () => {}),
  })
}

describe('PilotSheet — ability AP cost (Slice D)', () => {
  test('displays the ability AP cost on the card', () => {
    render(<PilotSheet pilot={makePilot()} store={makeStubStore(makePilot())} />)
    expandCards()
    // The cost comes from the CARD's own activation-cost box ("3 AP"), not from
    // a sheet-added "AP Cost" footMeta pair — that footer restated what the card
    // already rendered, and printed a bare em-dash for variable-cost abilities
    // where the card says "X AP". Asserting on the card's rendering keeps this
    // test pointed at what the player reads.
    expect(screen.getAllByText('3 AP').length).toBeGreaterThan(0)
    expect(screen.queryByText('AP Cost')).toBeNull()
  })
})

describe('PilotSheet — spend AP (Slice D)', () => {
  test('spending AP decrements currentAP by the cost', async () => {
    const pilot = makePilot({ currentAP: 5 })
    const updateSpy = mock(async () => pilot)
    render(<PilotSheet pilot={pilot} store={makeStubStore(pilot, updateSpy)} />)
    expandCards()

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /spend 3 ap for talk shop/i }))
    })

    // 5 - 3 = 2
    expect(updateSpy).toHaveBeenCalledWith('pilot', pilot.id, { currentAP: 2 }, LIVE_SHEET_MANUAL)
  })

  test('spend clamps currentAP at 0 (never negative)', async () => {
    // Exactly enough: cost 3, AP 3 → 0
    const pilot = makePilot({ currentAP: 3 })
    const updateSpy = mock(async () => pilot)
    render(<PilotSheet pilot={pilot} store={makeStubStore(pilot, updateSpy)} />)
    expandCards()

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /spend 3 ap for talk shop/i }))
    })

    expect(updateSpy).toHaveBeenCalledWith('pilot', pilot.id, { currentAP: 0 }, LIVE_SHEET_MANUAL)
  })

  test('spend button is disabled when AP is insufficient', async () => {
    const pilot = makePilot({ currentAP: 2 }) // cost is 3
    const updateSpy = mock(async () => pilot)
    render(<PilotSheet pilot={pilot} store={makeStubStore(pilot, updateSpy)} />)
    expandCards()

    const spendBtn = screen.getByRole<HTMLButtonElement>('button', {
      name: /spend 3 ap for talk shop/i,
    })
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
    expandCards()

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /mark talk shop used/i }))
    })

    expect(updateSpy).toHaveBeenCalledWith(
      'pilot',
      pilot.id,
      {
        usedAbilities: [ABILITY_TALK_SHOP],
      },
      LIVE_SHEET_MANUAL
    )
  })

  test('recharging removes the slug from usedAbilities', async () => {
    const pilot = makePilot({ usedAbilities: [ABILITY_TALK_SHOP] })
    const updateSpy = mock(async () => pilot)
    render(<PilotSheet pilot={pilot} store={makeStubStore(pilot, updateSpy)} />)
    expandCards()

    // Seeded as used → button recharges
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /recharge talk shop/i }))
    })

    expect(updateSpy).toHaveBeenCalledWith(
      'pilot',
      pilot.id,
      {
        usedAbilities: [],
      },
      LIVE_SHEET_MANUAL
    )
  })
})

describe('PilotSheet — abilities readOnly (Slice D)', () => {
  test('no spend / toggle buttons when readOnly', () => {
    const pilot = makePilot({ usedAbilities: [ABILITY_TALK_SHOP] })
    render(<PilotSheet pilot={pilot} store={makeStubStore(pilot)} readOnly />)
    expandCards()

    expect(screen.queryByRole('button', { name: /spend/i })).toBeNull()
    expect(screen.queryByRole('button', { name: /mark .* used/i })).toBeNull()
    expect(screen.queryByRole('button', { name: /recharge/i })).toBeNull()
    // AP cost still shown read-only (from the card's own cost box), plus a
    // static Used stamp.
    expect(screen.getAllByText('3 AP').length).toBeGreaterThan(0)
    expect(screen.getByText('Used')).toBeTruthy()
  })
})
