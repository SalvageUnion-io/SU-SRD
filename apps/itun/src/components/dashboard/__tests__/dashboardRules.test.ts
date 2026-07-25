/**
 * Tests for dashboardRules — the Dashboard's pure patch builders. Each function is
 * driven with an injected deterministic `Roll` and asserted on the exact
 * `Partial<Mech>` / `Partial<Pilot>` it produces, so the Phase-5 button/action
 * handlers can't drift from the rules engine (ADR-006/ADR-007).
 *
 * buildMechActions touches the reference ORM, so preload('all') runs once.
 */

import { beforeAll, describe, expect, test } from 'bun:test'
import { SalvageUnionReference } from 'salvageunion-reference'

import type { Roll } from '../../../lib/rules/heatCheck'
import {
  VENT_PATCH,
  actionInRange,
  actionMicroMeta,
  actionReachable,
  activationPatch,
  buildMechActions,
  buildPilotActions,
  critDamagePatch,
  critInjuryPatch,
  economyForActivation,
  groupBySource,
  groupByTiming,
  hasCurrencyChoice,
  hasVariableHot,
  heatCheckOncePatch,
  hotHeatFor,
  isDestructiveOutcome,
  mechDamagePatch,
  pilotActivationPatch,
  pilotDamagePatch,
  pushPatch,
  reachSummary,
  shutdownTogglePatch,
  tabMatchesAction,
} from '../dashboardRules'
import type { PlayAction } from '../dashboardRules'
import { mechFixture, pilotFixture } from '../../__tests__/fixtures'

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

  test('pushPatch: Meltdown (overload roll 1) is player-confirmed, NOT auto-destroyed', () => {
    // Heat Check d20 = 1 (overload), overload roll = 1 (meltdown).
    const { patch, meltdown } = pushPatch({
      heat: 18,
      heatCap: 20,
      currentSP: 10,
      roll: seqRoll([1, 1]),
    })
    expect(meltdown).toBe(true)
    // The destructive flag must NOT auto-apply — the Dashboard gates it (ADR-007).
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

  test('VENT_PATCH dumps Heat to 0 + Vulnerable, no auto-shutdown (Vent ≠ Shutdown, plan §5.1)', () => {
    expect(VENT_PATCH).toEqual({ currentHeat: 0, vulnerable: true })
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

/**
 * Every deck now ends with the universal Generic abilities (core book p.248),
 * which are derived rather than stored on the pilot. Tests that assert on what a
 * mech's own loadout contributes drop them first.
 */
const isGenericRow = (pa: { key: string }) => pa.key.startsWith('generic:')
const loadoutRows = <T extends { key: string }>(deck: T[]) => deck.filter((pa) => !isGenericRow(pa))
const genericRows = <T extends { key: string }>(deck: T[]) => deck.filter(isGenericRow)

describe('generic abilities in the decks', () => {
  test('the boarded mech deck carries them on the EP economy', () => {
    const mech = mechFixture({ id: 'gm', name: 'Rig', chassisRef: 'not-a-real-chassis' })
    const rows = genericRows(buildMechActions(mech))

    expect(rows.length).toBeGreaterThan(0)
    expect(rows.every((pa) => pa.currency === 'EP')).toBe(true)
    expect(rows.map((pa) => pa.ownerName)).toContain('Scrap')
  })

  test('the on-foot pilot deck carries them on the AP economy', () => {
    const pilot = pilotFixture({ id: 'gp', name: 'Vex' })
    const rows = genericRows(buildPilotActions(pilot))

    expect(rows.length).toBeGreaterThan(0)
    expect(rows.every((pa) => pa.currency === 'AP')).toBe(true)
    expect(rows.map((pa) => pa.ownerName)).toContain('Scrap')
  })

  test('they need no pick — an empty pilot still has them', () => {
    const pilot = pilotFixture({ id: 'gp2', name: 'Ghost' })
    const rows = genericRows(buildPilotActions(pilot))

    expect(rows.map((pa) => pa.ownerName)).toContain('Area Salvage')
  })

  test('both decks agree on which abilities are universal', () => {
    const mechOwners = new Set(
      genericRows(
        buildMechActions(mechFixture({ id: 'gm2', name: 'R', chassisRef: 'not-a-real-chassis' }))
      ).map((pa) => pa.ownerName)
    )
    const pilotOwners = new Set(
      genericRows(buildPilotActions(pilotFixture({ id: 'gp3', name: 'V' }))).map(
        (pa) => pa.ownerName
      )
    )

    expect([...mechOwners].sort()).toEqual([...pilotOwners].sort())
  })
})

describe('buildMechActions', () => {
  test('surfaces a chassis ability action, stamped CHS', () => {
    // Find a chassis whose resolveActions returns at least one action.
    const chassis = SalvageUnionReference.Chassis.all().find((c) => {
      const acts = SalvageUnionReference.resolveActions(c)
      return acts !== undefined && acts.length > 0
    }) as { id?: string } | undefined
    expect(chassis?.id).toBeTruthy()

    const mech = mechFixture({ id: 'm1', name: 'Rig', chassisRef: chassis?.id ?? '' })
    const deck = loadoutRows(buildMechActions(mech))
    expect(deck.length).toBeGreaterThan(0)
    expect(deck.every((pa) => pa.stamp === 'CHS')).toBe(true)
    expect(deck.every((pa) => pa.currency === 'EP')).toBe(true)
  })

  test('lists EVERY action of a multi-action installed system', () => {
    // A system with more than one resolvable action → more than one deck card.
    const multi = SalvageUnionReference.Systems.all().find((sys) => {
      const acts = SalvageUnionReference.resolveActions(sys)
      return acts !== undefined && acts.filter((a) => !a.hidden).length > 1
    }) as { id?: string } | undefined

    if (!multi?.id) return // dataset has none — nothing to assert
    const mech = mechFixture({
      id: 'm3',
      name: 'Rig',
      chassisRef: 'not-a-real-chassis',
      systems: [multi.id],
    })
    const deck = loadoutRows(buildMechActions(mech))
    expect(deck.length).toBeGreaterThan(1)
    expect(deck.every((pa) => pa.stamp === 'SYS')).toBe(true)
    // Every card shares the same owner (the system) but has a distinct key.
    expect(new Set(deck.map((pa) => pa.ownerName)).size).toBe(1)
    expect(new Set(deck.map((pa) => pa.key)).size).toBe(deck.length)
  })

  test('no loadout rows for an unresolvable chassis with no items', () => {
    const mech = mechFixture({ id: 'm2', name: 'Ghost', chassisRef: 'not-a-real-chassis' })
    expect(loadoutRows(buildMechActions(mech))).toEqual([])
  })
})

describe('buildPilotActions', () => {
  test('surfaces ability + equipment actions on the AP economy', () => {
    const ability = SalvageUnionReference.Abilities.all().find((a) => {
      const acts = SalvageUnionReference.resolveActions(a)
      return acts !== undefined && acts.filter((x) => !x.hidden).length > 0
    }) as { id?: string } | undefined
    expect(ability?.id).toBeTruthy()

    const pilot = pilotFixture({ id: 'p1', name: 'Vex', abilities: [ability?.id ?? ''] })
    const deck = loadoutRows(buildPilotActions(pilot))
    expect(deck.length).toBeGreaterThan(0)
    expect(deck.every((pa) => pa.stamp === 'ABL')).toBe(true)
    expect(deck.every((pa) => pa.currency === 'AP')).toBe(true)
  })

  test('no learned rows for a pilot with no abilities or equipment', () => {
    const pilot = pilotFixture({ id: 'p2', name: 'Ghost' })
    expect(loadoutRows(buildPilotActions(pilot))).toEqual([])
  })
})

describe('deck filtering / grouping / range', () => {
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

  test('tabMatchesAction: All admits all; React maps to Reaction', () => {
    const turn = mkAction({ actionType: 'Turn' })
    const react = mkAction({ actionType: 'Reaction' })
    expect(tabMatchesAction('All', turn.action)).toBe(true)
    expect(tabMatchesAction('Turn', turn.action)).toBe(true)
    expect(tabMatchesAction('Turn', react.action)).toBe(false)
    expect(tabMatchesAction('React', react.action)).toBe(true)
    expect(tabMatchesAction('React', turn.action)).toBe(false)
  })

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

  test('reachSummary counts reachable vs total', () => {
    const a = mkAction({ range: ['Close'] })
    const b = mkAction({ range: ['Far'] })
    const summary = reachSummary([a, b], 'Close', 0, 10)
    expect(summary).toEqual({ inReach: 1, total: 2 })
  })

  test('groupBySource / groupByTiming bucket the flat deck', () => {
    const s1 = { ...mkAction({ actionType: 'Turn' }), ownerName: 'Gun' }
    const s2 = { ...mkAction({ actionType: 'Free' }), ownerName: 'Gun' }
    const s3 = { ...mkAction({ actionType: 'Turn' }), ownerName: 'Shield' }
    const bySource = groupBySource([s1, s2, s3])
    expect(bySource.map((g) => g.label)).toEqual(['Gun', 'Shield'])
    expect(bySource[0]?.items).toHaveLength(2)

    const byTiming = groupByTiming([s1, s2, s3])
    expect(byTiming.map((g) => g.label)).toEqual(['Turn', 'Free'])
    expect(byTiming[0]?.items).toHaveLength(2)
  })

  test('actionMicroMeta renders range initials, damage, and traits', () => {
    const pa = mkAction({
      range: ['Close', 'Medium'],
      damage: { damageType: 'HP', amount: 3 },
      traits: [{ type: 'hot', amount: 2 }],
    })
    const meta = actionMicroMeta(pa)
    expect(meta).toContain('C/M')
    expect(meta).toContain('3 HP')
    expect(meta).toContain('HOT 2')
  })
})

describe('pilotActivationPatch', () => {
  test('spends AP, clamped at 0; no-op for zero cost', () => {
    expect(pilotActivationPatch({ apCost: 2, currentAP: 5 })).toEqual({ currentAP: 3 })
    expect(pilotActivationPatch({ apCost: 9, currentAP: 4 })).toEqual({ currentAP: 0 })
    expect(pilotActivationPatch({ apCost: 0, currentAP: 4 })).toEqual({})
  })
})

describe('resolve flow helpers (D2)', () => {
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
})
