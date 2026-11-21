/**
 * Hard rule R71 — one rule-breaking mark. A stat over the cap its rule sets
 * wears `RuleBreakMark`, the same on every sheet, once; a stat within its cap
 * and a loadout the book prints over its slots wear none; and the edit that
 * breaks the rule saves and says what broke and by how much (SB-21, PT-05).
 */

import { afterEach, beforeAll, describe, expect, mock, spyOn, test } from 'bun:test'
import { render } from '@testing-library/react'
import { makeUnitLot } from 'game-domain/schemas/cargoLot'
import type { Mech } from 'game-domain/schemas/mech'
import type { Pilot } from 'game-domain/schemas/pilot'
import { mechFixture, pilotFixture } from '../../../components/__tests__/fixtures'
import { hydrateStores } from '../../../components/__tests__/hydrateStores'
import { makeSingleUnitStore } from '../../../components/__tests__/mockEntityStore'
import { toast } from '../../../components/index'
import { MechSheet } from '../MechSheet'
import { PilotSheet } from '../PilotSheet'
import { cargoBreakToast, ruleBreakLine, ruleBreakToast } from '../ruleBreakToast.model'

beforeAll(hydrateStores)
afterEach(() => mock.restore())

const MARK = '[data-rule-break]'

function marksOn(mech: Mech): string[] {
  const { container } = render(<MechSheet mech={mech} store={makeSingleUnitStore('mech', mech)} />)
  return figuresMarked(container)
}

/** The labels of the strip figures wearing the mark. */
function figuresMarked(container: HTMLElement): string[] {
  return [...container.querySelectorAll(MARK)].map(
    (mark) =>
      mark.closest('.su-strip__cell')?.querySelector('dt')?.textContent ?? '(outside a figure)'
  )
}

const scrapper = (overrides: Partial<Mech>) =>
  mechFixture({ id: 'mech-rb', name: 'Rule Test', chassisRef: 'scrapper', ...overrides })

describe('R71 — one rule-breaking mark', () => {
  test('a mech within its caps wears none', () => {
    expect(marksOn(scrapper({ systems: ['chainsaw'], modules: [] }))).toEqual([])
  })

  test('System Slots over the chassis wear it, once, on that figure', () => {
    const marked = marksOn(
      scrapper({
        systems: ['mini-mortar', 'mini-mortar', 'mini-mortar', 'mini-mortar'],
        modules: [],
      })
    )
    expect(marked).toHaveLength(1)
    expect(marked[0]).toMatch(/sys/i)
  })

  test('Cargo over its capacity wears the same mark', () => {
    const marked = marksOn(
      scrapper({ systems: [], modules: [], cargoLots: [makeUnitLot('Big Thing', { units: 8 })] })
    )
    expect(marked).toHaveLength(1)
    expect(marked[0]).toMatch(/cargo/i)
  })

  test('a pilot over their Inventory Slots wears the same mark', () => {
    const pilot: Pilot = pilotFixture({
      id: 'pilot-rb',
      genericInventory: [{ id: 'g1', name: 'Scrap', slotCost: 3, qty: 3 }],
    })
    const { container } = render(
      <PilotSheet pilot={pilot} store={makeSingleUnitStore('pilot', pilot)} />
    )
    const marked = figuresMarked(container)
    expect(marked).toHaveLength(1)
    expect(marked[0]).toMatch(/inventory/i)
  })

  test('the save says what broke and by how much', () => {
    const made = { stat: 'systemSlots' as const, used: 16, max: 12 }
    expect(ruleBreakLine(made)).toBe('Saved, rule breaking: System Slots 16/12, 4 over.')
    const warned = spyOn(toast, 'warning').mockImplementation(() => 'id')
    ruleBreakToast('mech-rb', [made])
    expect(warned).toHaveBeenCalledTimes(1)
    expect(warned.mock.calls[0]?.[0]).toBe('Saved, rule breaking: System Slots 16/12, 4 over.')
  })

  test('a load that takes Cargo over its capacity says so as it saves; one within it, and a refusal, say nothing', () => {
    const warned = spyOn(toast, 'warning').mockImplementation(() => 'id')
    const landed = (units: number) => ({
      ok: true as const,
      state: {
        carrierLots: [makeUnitLot('Crate', { units })],
        carrierCargoCap: 6,
        depotLots: [],
        scrapPool: {},
      },
      changed: { carrier: true, depot: false },
    })
    cargoBreakToast('mech-rb', { used: 0, cap: 6 }, landed(6))
    cargoBreakToast('mech-rb', { used: 0, cap: 6 }, { ok: false, reason: 'No.' })
    expect(warned).not.toHaveBeenCalled()
    cargoBreakToast('mech-rb', { used: 0, cap: 6 }, landed(8))
    expect(warned).toHaveBeenCalledTimes(1)
    expect(warned.mock.calls[0]?.[0]).toBe('Saved, rule breaking: Cargo 8/6, 2 over.')
  })
})
