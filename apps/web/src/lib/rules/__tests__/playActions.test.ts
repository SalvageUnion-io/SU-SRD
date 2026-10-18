/**
 * Tests for playActions — Play's pure patch builders. Each function is
 * driven with an injected deterministic `Roll` and asserted on the exact
 * `Partial<Mech>` / `Partial<Pilot>` it produces, so the button/action
 * handlers can't drift from the rules engine (ADR-006/ADR-007).
 *
 * buildMechActions touches the reference ORM, so preload('all') runs once.
 */

import { describe, expect, test } from 'bun:test'
import { getEntitySlug, SalvageUnionReference } from 'salvageunion-reference'
import type { Roll } from 'salvageunion-reference/rules'
import { mechFixture, pilotFixture } from '../../../components/__tests__/fixtures'
import type { PlayAction } from '../playActions'
import {
  actionInRange,
  actionReachable,
  activationHeatGate,
  activationPatch,
  buildMechActions,
  buildPilotActions,
  coreMechanicRowText,
  economyForActivation,
  hasCurrencyChoice,
  hasVariableHot,
  heatCheckOncePatch,
  hotHeatFor,
  isDestructiveOutcome,
  pilotActivationPatch,
  pushPatch,
  shutdownTogglePatch,
  VENT_PATCH,
} from '../playActions'

/** A deterministic roller that returns the queued values, then 20. */
function seqRoll(values: number[]): Roll {
  let i = 0
  return () => values[i++] ?? 20
}

describe('reactor patches', () => {
  test('pushPatch: passed Heat Check adds +2 Heat, no shutdown', () => {
    // Heat Check d20 = 20 → always a success (no overload).
    const { patch, nextHeat } = pushPatch({
      heat: 3,
      heatCap: 10,
      currentSP: 8,
      roll: seqRoll([20]),
    })
    expect(nextHeat).toBe(5)
    expect(patch.currentHeat).toBe(5)
    expect(patch.shutdown).toBeUndefined()
  })

  test('pushPatch: overheat overload applies shutdown + Vulnerable + SP damage', () => {
    // Push to Heat 20 (cap), Heat Check d20 = 1 (overload), overload roll = 15 (overheat).
    const { patch, nextHeat } = pushPatch({
      heat: 18,
      heatCap: 20,
      currentSP: 10,
      roll: seqRoll([1, 15]),
    })
    expect(nextHeat).toBe(20)
    expect(patch.currentHeat).toBe(20)
    expect(patch.shutdown).toBe(true)
    expect(patch.vulnerable).toBe(true)
    expect(patch.currentSP).toBe(0) // 10 − 20, clamped
  })

  test('pushPatch: Meltdown (overload roll 1) is player-confirmed, NOT auto-destroyed', () => {
    // Heat Check d20 = 1 (overload), overload roll = 1 (meltdown).
    const { patch, meltdown } = pushPatch({
      heat: 18,
      heatCap: 20,
      currentSP: 10,
      roll: seqRoll([1, 1]),
    })
    expect(meltdown).toBe(true)
    // The destructive flag must NOT auto-apply — Play gates it (ADR-007).
    expect(patch.destroyed).toBeUndefined()
  })

  test('heatCheckOncePatch: no +2, persists current Heat; meltdown gated', () => {
    const passed = heatCheckOncePatch({ heat: 6, currentSP: 5, roll: seqRoll([20]) })
    expect(passed.patch.currentHeat).toBe(6)
    expect(passed.patch.shutdown).toBeUndefined()
    expect(passed.meltdown).toBe(false)
    const melt = heatCheckOncePatch({ heat: 20, currentSP: 5, roll: seqRoll([1, 1]) })
    expect(melt.meltdown).toBe(true)
    expect(melt.patch.destroyed).toBeUndefined()
  })

  test('VENT_PATCH dumps Heat to 0 + Vulnerable, no auto-shutdown (Vent ≠ Shutdown, dashboard.md §5.1)', () => {
    expect(VENT_PATCH).toEqual({ currentHeat: 0, vulnerable: true })
  })

  test('shutdownTogglePatch flips the flag', () => {
    expect(shutdownTogglePatch(false)).toEqual({ shutdown: true })
    expect(shutdownTogglePatch(true)).toEqual({ shutdown: false })
    expect(shutdownTogglePatch(undefined)).toEqual({ shutdown: true })
  })
})

describe('activationPatch', () => {
  test('spends EP + Hot Heat and ticks Uses down', () => {
    const patch = activationPatch({
      slug: 'flak-cannon',
      economy: { epCost: 2, heat: 1, maxUses: 3 },
      currentEP: 5,
      currentHeat: 4,
      heatCap: 10,
      prevUses: undefined,
    })
    expect(patch.currentEP).toBe(3)
    expect(patch.currentHeat).toBe(5)
    expect(patch.itemUses).toEqual({ 'flak-cannon': 2 })
  })

  test('clamps Heat to the cap and EP at 0', () => {
    const patch = activationPatch({
      slug: 'x',
      economy: { epCost: 9, heat: 5, maxUses: 0 },
      currentEP: 2,
      currentHeat: 8,
      heatCap: 10,
      prevUses: undefined,
    })
    expect(patch.currentEP).toBe(0)
    expect(patch.currentHeat).toBe(10)
    expect(patch.itemUses).toBeUndefined()
  })
})

describe('buildMechActions', () => {
  test('surfaces a chassis ability action, stamped CHS', () => {
    // Find a chassis whose resolveActions returns at least one action.
    const chassis = SalvageUnionReference.Chassis.all().find((c) => {
      const acts = SalvageUnionReference.resolveActions(c)
      return acts !== undefined && acts.length > 0
    })
    expect(chassis).toBeTruthy()

    const mech = mechFixture({
      id: 'm1',
      name: 'Rig',
      chassisRef: chassis ? getEntitySlug(chassis) : '',
    })
    const deck = buildMechActions(mech)
    expect(deck.length).toBeGreaterThan(0)
    expect(deck.every((pa) => pa.stamp === 'CHS')).toBe(true)
    expect(deck.every((pa) => pa.currency === 'EP')).toBe(true)
  })

  test('lists EVERY action of a multi-action installed system', () => {
    // A system with more than one resolvable action → more than one deck card.
    const multi = SalvageUnionReference.Systems.all().find((sys) => {
      const acts = SalvageUnionReference.resolveActions(sys)
      return acts !== undefined && acts.filter((a) => !a.hidden).length > 1
    })

    if (!multi) return // dataset has none — nothing to assert
    const mech = mechFixture({
      id: 'm3',
      name: 'Rig',
      chassisRef: 'not-a-real-chassis',
      systems: [getEntitySlug(multi)],
    })
    const deck = buildMechActions(mech)
    expect(deck.length).toBeGreaterThan(1)
    expect(deck.every((pa) => pa.stamp === 'SYS')).toBe(true)
    // Every card shares the same owner (the system) but has a distinct key.
    expect(new Set(deck.map((pa) => pa.ownerName)).size).toBe(1)
    expect(new Set(deck.map((pa) => pa.key)).size).toBe(deck.length)
  })

  test('empty for an unresolvable chassis with no items', () => {
    const mech = mechFixture({ id: 'm2', name: 'Ghost', chassisRef: 'not-a-real-chassis' })
    expect(buildMechActions(mech)).toEqual([])
  })
})

describe('buildPilotActions', () => {
  test('surfaces ability + equipment actions on the AP economy', () => {
    const ability = SalvageUnionReference.Abilities.all().find((a) => {
      const acts = SalvageUnionReference.resolveActions(a)
      return acts !== undefined && acts.filter((x) => !x.hidden).length > 0
    })
    expect(ability).toBeTruthy()

    const pilot = pilotFixture({
      id: 'p1',
      name: 'Vex',
      abilities: [ability ? getEntitySlug(ability) : ''],
    })
    const deck = buildPilotActions(pilot)
    expect(deck.length).toBeGreaterThan(0)
    expect(deck.every((pa) => pa.stamp === 'ABL')).toBe(true)
    expect(deck.every((pa) => pa.currency === 'AP')).toBe(true)
  })

  test("carried equipment's actions join the deck as EQP on AP, with the item's condition", () => {
    const kit = SalvageUnionReference.Equipment.getByName('First Aid Kit')
    const gun = SalvageUnionReference.Equipment.getByName('Handheld Riveting Gun')
    if (!kit || !gun) throw new Error('reference equipment missing')
    const kitSlug = getEntitySlug(kit)
    const gunSlug = getEntitySlug(gun)
    const pilot = pilotFixture({
      id: 'p3',
      name: 'Medic',
      equipment: [kitSlug, 'not-an-item', gunSlug],
      equipmentConditions: { [gunSlug]: 'damaged' },
    })
    const deck = buildPilotActions(pilot)
    // The unknown slug is skipped, not a crash.
    expect(deck.every((pa) => pa.kind === 'equipment' && pa.stamp === 'EQP')).toBe(true)
    expect(deck.every((pa) => pa.currency === 'AP')).toBe(true)
    const kitActions = deck.filter((pa) => pa.slug === kitSlug)
    const gunActions = deck.filter((pa) => pa.slug === gunSlug)
    expect(kitActions.length).toBeGreaterThan(0)
    expect(gunActions.length).toBeGreaterThan(0)
    expect(kitActions.every((pa) => pa.ownerName === 'First Aid Kit')).toBe(true)
    expect(kitActions.every((pa) => pa.condition === 'intact')).toBe(true)
    expect(gunActions.every((pa) => pa.condition === 'damaged')).toBe(true)
    expect(deck.every((pa) => pa.key.startsWith('equipment:'))).toBe(true)
  })

  test('empty for a pilot with no abilities or equipment', () => {
    const pilot = pilotFixture({ id: 'p2', name: 'Ghost' })
    expect(buildPilotActions(pilot)).toEqual([])
  })
})

describe('range', () => {
  function mkAction(over: Partial<PlayAction['action']>): PlayAction {
    return {
      key: `k:${over.name ?? over.id ?? Math.random()}`,
      name: (over.name as string) ?? 'A',
      kind: 'system',
      stamp: 'SYS',
      currency: 'EP',
      ownerName: 'Owner',
      slug: 'slug',
      economy: { epCost: 0, heat: 0, maxUses: 0 },
      action: { id: 'a', name: 'A', ...over } as PlayAction['action'],
      condition: 'intact',
    }
  }

  test('actionInRange: no declared range = always in range; else exact band', () => {
    const utility = mkAction({})
    const close = mkAction({ range: ['Close'] })
    expect(actionInRange(utility.action, 'Far')).toBe(true)
    expect(actionInRange(close.action, 'Close')).toBe(true)
    expect(actionInRange(close.action, 'Far')).toBe(false)
  })

  test('actionReachable: destroyed, out-of-range, and heat-locked all fail', () => {
    const ok = mkAction({ range: ['Close'] })
    expect(actionReachable(ok, 'Close', 0, 10)).toBe(true)
    expect(actionReachable(ok, 'Far', 0, 10)).toBe(false)

    const destroyed = { ...ok, condition: 'destroyed' as const }
    expect(actionReachable(destroyed, 'Close', 0, 10)).toBe(false)

    const hot = mkAction({ range: ['Close'], traits: [{ type: 'hot', amount: 5 }] })
    hot.economy = { epCost: 0, heat: 5, maxUses: 0 }
    expect(actionReachable(hot, 'Close', 8, 10)).toBe(false) // 8 + 5 > 10
    expect(actionReachable(hot, 'Close', 3, 10)).toBe(true) // 3 + 5 <= 10
  })
})

describe('pilotActivationPatch', () => {
  test('spends AP, clamped at 0; no-op for zero cost', () => {
    expect(pilotActivationPatch({ apCost: 2, currentAP: 5 })).toEqual({ currentAP: 3 })
    expect(pilotActivationPatch({ apCost: 9, currentAP: 4 })).toEqual({ currentAP: 0 })
    expect(pilotActivationPatch({ apCost: 0, currentAP: 4 })).toEqual({})
  })
})

describe('resolve flow helpers', () => {
  type Act = PlayAction['action']
  const act = (over: Partial<Act>): Act => ({ id: 'a', name: 'A', ...over }) as Act

  test('hasCurrencyChoice: only for EP-or-AP actions', () => {
    expect(hasCurrencyChoice(act({ activationCurrency: 'EP or AP' }))).toBe(true)
    expect(hasCurrencyChoice(act({ activationCurrency: 'SP or HP' }))).toBe(false)
    expect(hasCurrencyChoice(act({}))).toBe(false)
  })

  test('hasVariableHot: only when a Hot trait carries amount "X"', () => {
    expect(hasVariableHot(act({ traits: [{ type: 'hot', amount: 'X' }] }))).toBe(true)
    expect(hasVariableHot(act({ traits: [{ type: 'hot', amount: 2 }] }))).toBe(false)
    expect(hasVariableHot(act({ traits: [{ type: 'uses', amount: 'X' }] }))).toBe(false)
    expect(hasVariableHot(act({}))).toBe(false)
  })

  test('hotHeatFor: variable Hot uses the picked X; fixed Hot keeps its printed value', () => {
    expect(hotHeatFor(act({ traits: [{ type: 'hot', amount: 'X' }] }), 4)).toBe(4)
    expect(hotHeatFor(act({ traits: [{ type: 'hot', amount: 3 }] }), 4)).toBe(3)
    // A fixed Hot with no numeric amount still costs at least 1 (matches actionEconomy).
    expect(hotHeatFor(act({ traits: [{ type: 'hot' }] }), 4)).toBe(1)
    // Mixed fixed + variable sum together.
    expect(
      hotHeatFor(
        act({
          traits: [
            { type: 'hot', amount: 2 },
            { type: 'hot', amount: 'X' },
          ],
        }),
        5
      )
    ).toBe(7)
    expect(hotHeatFor(act({}), 4)).toBe(0)
  })

  test('economyForActivation: overrides Heat only for variable Hot, else passes through', () => {
    const base = { epCost: 2, heat: 1, maxUses: 0 }
    const variable = act({ traits: [{ type: 'hot', amount: 'X' }] })
    expect(economyForActivation(base, variable, 3)).toEqual({ epCost: 2, heat: 3, maxUses: 0 })
    const fixed = act({ traits: [{ type: 'hot', amount: 2 }] })
    expect(economyForActivation(base, fixed, 3)).toBe(base)
  })

  test('isDestructiveOutcome: only Cascade Failure is destructive', () => {
    expect(isDestructiveOutcome('cascade')).toBe(true)
    expect(isDestructiveOutcome('failure')).toBe(false)
    expect(isDestructiveOutcome('tough')).toBe(false)
    expect(isDestructiveOutcome('success')).toBe(false)
    expect(isDestructiveOutcome('nailed')).toBe(false)
  })

  test('coreMechanicRowText: the rolled row, verbatim from the SRD table', () => {
    expect(coreMechanicRowText(14)).toBe(
      'You have achieved your goal without any compromises. When attacking, you hit the target and deal standard damage.'
    )
    expect(coreMechanicRowText(8)).toStartWith('You succeed in your action, but at a cost.')
    expect(coreMechanicRowText(1)).toStartWith('Something has gone terribly wrong.')
    expect(coreMechanicRowText(20)).toStartWith('You have overcome the odds')
  })
})

describe('activationHeatGate', () => {
  const ctx = { currentHeat: 8, heatCap: 10 }

  test('an EP activation from the cockpit makes Heat, and is refused past the Heat Cap', () => {
    expect(activationHeatGate({ currency: 'EP', onFoot: false, heat: 2, ...ctx })).toEqual({
      applies: true,
      ok: true,
    })
    expect(activationHeatGate({ currency: 'EP', onFoot: false, heat: 3, ...ctx })).toEqual({
      applies: true,
      ok: false,
    })
  })

  test('AP and on-foot activations make no Heat, so they always fit', () => {
    expect(activationHeatGate({ currency: 'AP', onFoot: false, heat: 5, ...ctx })).toEqual({
      applies: false,
      ok: true,
    })
    expect(activationHeatGate({ currency: 'EP', onFoot: true, heat: 5, ...ctx })).toEqual({
      applies: false,
      ok: true,
    })
  })

  test('an activation that adds no Heat fits even at an over-cap reading', () => {
    expect(
      activationHeatGate({ currency: 'EP', onFoot: false, heat: 0, currentHeat: 12, heatCap: 10 })
        .ok
    ).toBe(true)
  })
})
