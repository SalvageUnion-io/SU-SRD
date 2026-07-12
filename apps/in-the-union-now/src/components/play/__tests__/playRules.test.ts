/**
 * Tests for playRules — the cockpit's pure patch builders. Each function is
 * driven with an injected deterministic `Roll` and asserted on the exact
 * `Partial<Mech>` / `Partial<Pilot>` it produces, so the Phase-5 button/action
 * handlers can't drift from the rules engine (ADR-006/ADR-007).
 *
 * buildMechActions touches the reference ORM, so preload('all') runs once.
 */

import { beforeAll, describe, expect, test } from 'bun:test'
import { SalvageUnionReference } from 'salvageunion-reference'

import type { Roll } from '../../../lib/rules/heatCheck'
import type { Mech } from '../../../lib/schemas/mech'
import {
  VENT_PATCH,
  activationPatch,
  buildMechActions,
  critDamagePatch,
  critInjuryPatch,
  heatCheckOncePatch,
  mechDamagePatch,
  pilotDamagePatch,
  pushPatch,
  shutdownTogglePatch,
} from '../playRules'

/** A deterministic roller that returns the queued values, then 20. */
function seqRoll(values: number[]): Roll {
  let i = 0
  return () => values[i++] ?? 20
}

beforeAll(async () => {
  await SalvageUnionReference.preload('all')
})

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

  test('heatCheckOncePatch: no +2, persists current Heat', () => {
    const { patch } = heatCheckOncePatch({ heat: 6, currentSP: 5, roll: seqRoll([20]) })
    expect(patch.currentHeat).toBe(6)
    expect(patch.shutdown).toBeUndefined()
  })

  test('VENT_PATCH dumps Heat to 0 and shuts down', () => {
    expect(VENT_PATCH).toEqual({ currentHeat: 0, shutdown: true, vulnerable: true })
  })

  test('shutdownTogglePatch flips the flag', () => {
    expect(shutdownTogglePatch(false)).toEqual({ shutdown: true })
    expect(shutdownTogglePatch(true)).toEqual({ shutdown: false })
    expect(shutdownTogglePatch(undefined)).toEqual({ shutdown: true })
  })
})

describe('damage patches', () => {
  test('mechDamagePatch: SP reduced, no critical above 0', () => {
    const { patch, effect } = mechDamagePatch({ currentSP: 10, amount: 3, vulnerable: false })
    expect(patch.currentSP).toBe(7)
    expect(effect.criticalDue).toBe(false)
  })

  test('mechDamagePatch: reaching 0 SP flags criticalDue', () => {
    const { patch, effect } = mechDamagePatch({ currentSP: 2, amount: 5, vulnerable: false })
    expect(patch.currentSP).toBe(0)
    expect(effect.criticalDue).toBe(true)
  })

  test('critDamagePatch: miraculous survival auto-sets 1 SP, never Destroyed', () => {
    const { patch, effect } = critDamagePatch(seqRoll([20]))
    expect(patch.currentSP).toBe(1)
    expect(effect.destroyed).toBe(false)
    expect(patch.destroyed).toBeUndefined()
  })

  test('critDamagePatch: catastrophic flags destroyed but never auto-writes it', () => {
    const { patch, effect } = critDamagePatch(seqRoll([1]))
    expect(effect.destroyed).toBe(true)
    expect(patch.destroyed).toBeUndefined() // player-confirmed (ADR-007)
    expect(patch.currentSP).toBeUndefined()
  })

  test('pilotDamagePatch: HP reduced, 0 HP flags criticalDue', () => {
    expect(pilotDamagePatch({ currentHP: 5, amount: 2, vulnerable: false }).patch.currentHP).toBe(3)
    const zero = pilotDamagePatch({ currentHP: 3, amount: 5, vulnerable: false })
    expect(zero.patch.currentHP).toBe(0)
    expect(zero.effect.criticalDue).toBe(true)
  })

  test('critInjuryPatch: miraculous auto-sets 1 HP; fatal writes nothing', () => {
    expect(critInjuryPatch(seqRoll([20])).patch.currentHP).toBe(1)
    const fatal = critInjuryPatch(seqRoll([1]))
    expect(fatal.effect.fatal).toBe(true)
    expect(fatal.patch.currentHP).toBeUndefined()
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
  test('groups a chassis with abilities under "Chassis Ability"', () => {
    // Find a chassis whose resolveActions returns at least one action.
    const chassis = SalvageUnionReference.Chassis.all().find((c) => {
      const acts = SalvageUnionReference.resolveActions(c)
      return acts !== undefined && acts.length > 0
    }) as { id?: string } | undefined
    expect(chassis?.id).toBeTruthy()

    const mech = {
      id: 'm1',
      name: 'Rig',
      chassisRef: chassis?.id ?? '',
      systems: [],
      modules: [],
    } as unknown as Mech
    const groups = buildMechActions(mech)
    expect(groups.some((g) => g.source === 'Chassis Ability')).toBe(true)
  })

  test('empty for an unresolvable chassis with no items', () => {
    const mech = {
      id: 'm2',
      name: 'Ghost',
      chassisRef: 'not-a-real-chassis',
      systems: [],
      modules: [],
    } as unknown as Mech
    expect(buildMechActions(mech)).toEqual([])
  })
})
