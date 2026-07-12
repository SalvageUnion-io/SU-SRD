/**
 * dashboardRules — the Dashboard's thin, PURE driver over the existing rules engine
 * (plan §5). Nothing here touches React or the store: every function takes the
 * live numbers (+ an injectable `Roll`) and returns the `Partial<Mech>` /
 * `Partial<Pilot>` write-through patch the caller hands to
 * `storeState.update(...)`, mirroring `MechSheet.activateItem` / `SheetMech`'s
 * `pushMech`. This keeps the Phase-5 button/action handlers trivially testable
 * (assert the patch) and keeps the ADR-006 pure-math boundary intact — the math
 * lives in `lib/rules/*`, this only assembles patches and readouts.
 *
 * ADR-007 boundary: non-destructive bookkeeping (Heat/EP/uses/SP/HP deltas,
 * Vent, Shutdown toggle) is assembled into an auto-apply patch; the destructive
 * Critical Damage / Critical Injury *rolls* are separate functions the caller
 * only invokes behind an explicit player confirm, and their destructive
 * consequences (mech Destroyed, accepted injury, pilot death) are NEVER folded
 * into the returned patch — they stay explicit player calls at the UI layer.
 */

import { SalvageUnionReference } from 'salvageunion-reference'
import type { SURefMetaAction, SURefMetaEntity } from 'salvageunion-reference'

import { resolveChassisRef } from '../../lib/rules/resolveRefs'
import { clampHeat, heatCheckPatch, performHeatCheck, performPush } from '../../lib/rules/heatCheck'
import type { HeatCheckEffect, Roll } from '../../lib/rules/heatCheck'
import {
  applyMechDamage,
  applyPilotDamage,
  performCriticalDamage,
  performCriticalInjury,
} from '../../lib/rules/takeDamage'
import type {
  CriticalDamageEffect,
  CriticalInjuryEffect,
  MechDamageEffect,
  PilotDamageEffect,
} from '../../lib/rules/takeDamage'
import type { Mech } from '../../lib/schemas/mech'
import type { Pilot } from '../../lib/schemas/pilot'
import { itemEconomy, resolveModule, resolveSystem } from '../sheet/mechItemRules'
import type { MechItem, MechItemEconomy } from '../sheet/mechItemRules'

// ---------------------------------------------------------------------------
// Reactor — Push / Heat Check / Vent / Shutdown (plan §5.1)
// ---------------------------------------------------------------------------

/**
 * Strip the destructive `destroyed` flag out of a shared `heatCheckPatch`
 * result. In the sheet, `heatCheckPatch` auto-sets `destroyed` on a Meltdown
 * (overload roll = 1); the Dashboard holds a STRICTER ADR-007 line — a Meltdown's
 * mech-destruction is a player-confirmed step (like Critical Damage), never
 * silent bookkeeping. All the non-destructive fields (Heat, shutdown,
 * vulnerable, SP) still auto-apply; `meltdown` tells the caller to offer the
 * confirm. The shared `heatCheckPatch` (SheetMech's path) is left untouched.
 */
function autoApplyPatch(patch: Partial<Mech>): { patch: Partial<Mech>; meltdown: boolean } {
  if (!patch.destroyed) return { patch, meltdown: false }
  const rest = { ...patch }
  delete rest.destroyed
  return { patch: rest, meltdown: true }
}

/**
 * Push: +2 Heat then an immediate Heat Check. Non-destructive bookkeeping
 * auto-applies via the shared `heatCheckPatch`; a Meltdown's `destroyed` is
 * held back (`meltdown: true`) for the caller's player-confirm (ADR-007).
 * Destroyed System/Module bands are likewise left for the player to mark.
 */
export function pushPatch(args: { heat: number; heatCap: number; currentSP: number; roll: Roll }): {
  patch: Partial<Mech>
  effect: HeatCheckEffect
  nextHeat: number
  meltdown: boolean
} {
  const { nextHeat, effect } = performPush(args)
  const { patch, meltdown } = autoApplyPatch(heatCheckPatch(effect, nextHeat))
  return { patch, effect, nextHeat, meltdown }
}

/** A standalone Heat Check at current Heat (no +2). Meltdown is player-confirmed. */
export function heatCheckOncePatch(args: { heat: number; currentSP: number; roll: Roll }): {
  patch: Partial<Mech>
  effect: HeatCheckEffect
  meltdown: boolean
} {
  const effect = performHeatCheck(args)
  const { patch, meltdown } = autoApplyPatch(heatCheckPatch(effect, args.heat))
  return { patch, effect, meltdown }
}

/**
 * Emergency Vent: dump Heat to 0 and become Vulnerable (plan §5.1 — Vent and
 * Shutdown are distinct Reactor-bay controls: Vent sets Heat→0 + `vulnerable`,
 * Shutdown toggles the flag). NB the tabletop rule folds a full shutdown into
 * venting; the Dashboard keeps them separate per the plan — hit Shutdown too for
 * the strict-SRD sequence.
 */
export const VENT_PATCH: Partial<Mech> = {
  currentHeat: 0,
  vulnerable: true,
}

/** Toggle the reactor Shutdown flag (reversible bookkeeping). */
export function shutdownTogglePatch(shutdown: boolean | undefined): Partial<Mech> {
  return { shutdown: !(shutdown ?? false) }
}

/** One-line readout for a resolved Heat Check (Push wording lives in coreMechanic). */
export function describeHeatCheck(effect: HeatCheckEffect): string {
  const r = effect.result
  const head = `Heat Check ${r.heatCheckRoll} vs Heat ${r.heatAtCheck}`
  if (!r.overloaded) return `${head} — passed (no overload).`
  const outcome =
    r.outcome === 'meltdown'
      ? 'Catastrophic Meltdown — mech DESTROYED.'
      : r.outcome === 'system-destroyed'
        ? 'A System is destroyed — mark one on the sheet.'
        : r.outcome === 'module-destroyed'
          ? 'A Module is destroyed — mark one on the sheet.'
          : r.outcome === 'overheat'
            ? 'Reactor Overheat — shutdown, Vulnerable, SP damage applied.'
            : 'Safe — no effect.'
  return `${head} — OVERLOAD. Reactor Overload ${r.overloadRoll}: ${outcome}`
}

// ---------------------------------------------------------------------------
// Damage → Critical (plan §5.3)
// ---------------------------------------------------------------------------

/**
 * Self-declared SP damage to the boarded mech (SP-listed, 1:1). Auto-applies
 * the clamped SP; `criticalDue` tells the caller to offer the (player-confirmed)
 * Critical Damage roll when this hit left the mech at 0 SP.
 */
export function mechDamagePatch(args: { currentSP: number; amount: number; vulnerable: boolean }): {
  patch: Partial<Mech>
  effect: MechDamageEffect
} {
  const effect = applyMechDamage({ ...args, kind: 'sp' })
  return { patch: { currentSP: effect.nextSP }, effect }
}

/**
 * The Critical Damage roll (player-confirmed step). Only the non-destructive
 * `nextSP` override (Miraculous Survival → 1 SP) crosses into the patch;
 * `destroyed` / `chassisDamaged` / `requiresPlayerChoice` stay explicit player
 * calls (ADR-007) and are surfaced as advisory text by the caller.
 */
export function critDamagePatch(roll: Roll): {
  patch: Partial<Mech>
  effect: CriticalDamageEffect
} {
  const effect = performCriticalDamage({ roll })
  const patch: Partial<Mech> = {}
  if (effect.nextSP !== null) patch.currentSP = effect.nextSP
  return { patch, effect }
}

/** Self-declared HP damage to the on-foot pilot (HP-listed, 1:1). */
export function pilotDamagePatch(args: {
  currentHP: number
  amount: number
  vulnerable: boolean
}): { patch: Partial<Pilot>; effect: PilotDamageEffect } {
  const effect = applyPilotDamage({ ...args, kind: 'hp' })
  return { patch: { currentHP: effect.nextHP }, effect }
}

/**
 * The Critical Injury roll (player-confirmed step). Only the non-destructive
 * `nextHP` override crosses into the patch; the max-HP-reducing injury,
 * Unconscious condition, and death stay explicit player calls (ADR-007).
 */
export function critInjuryPatch(roll: Roll): {
  patch: Partial<Pilot>
  effect: CriticalInjuryEffect
} {
  const effect = performCriticalInjury({ roll })
  const patch: Partial<Pilot> = {}
  if (effect.nextHP !== null) patch.currentHP = effect.nextHP
  return { patch, effect }
}

export function describeCritDamage(effect: CriticalDamageEffect): string {
  const map: Record<CriticalDamageEffect['result']['outcome'], string> = {
    catastrophic: 'Catastrophic — mech destroyed (confirm below).',
    'system-destruction': 'System Destruction — chassis Damaged; mark a System on the sheet.',
    'module-destruction': 'Module Destruction — chassis Damaged; mark a Module on the sheet.',
    'core-damage': 'Core Damage — chassis Damaged & inoperable; pilot to 0 HP unless they escape.',
    'miraculous-survival': 'Miraculous Survival — mech Intact at 1 SP.',
  }
  return `Critical Damage ${effect.result.roll}: ${map[effect.result.outcome]}`
}

export function describeCritInjury(effect: CriticalInjuryEffect): string {
  const map: Record<CriticalInjuryEffect['result']['outcome'], string> = {
    fatal: 'Fatal Injury — the pilot dies (confirm on the sheet).',
    'major-injury': 'Major Injury — −2 max HP until healed + Unconscious.',
    'minor-injury': 'Minor Injury — −1 max HP until healed + Unconscious.',
    unconscious: 'Unconscious — stable at 0 HP until they regain ≥1 HP.',
    'miraculous-survival': 'Miraculous Survival — 1 HP, conscious.',
  }
  return `Critical Injury ${effect.result.roll}: ${map[effect.result.outcome]}`
}

// ---------------------------------------------------------------------------
// Action activation (plan §5.2)
// ---------------------------------------------------------------------------

export type PlayActionKind = 'chassis' | 'system' | 'module'
export type PlayActionSourceLabel = 'Chassis Ability' | 'Systems' | 'Modules'

export type PlayAction = {
  /** Stable list key. */
  key: string
  /** Display name of the ability / item. */
  name: string
  kind: PlayActionKind
  /** The installed item's slug (systems/modules); the chassis ref for chassis. */
  slug: string
  /** What one activation costs / produces. */
  economy: MechItemEconomy
  /** The primary action, for the reference card + damage/roll detection. */
  action: SURefMetaAction
}

export type PlayActionGroup = { source: PlayActionSourceLabel; items: PlayAction[] }

function traitAmount(trait: { amount?: unknown }): number {
  return typeof trait.amount === 'number' ? trait.amount : 0
}

/** Per-action economy for a chassis ability (EP from cost, Heat from Hot). */
function chassisActionEconomy(action: SURefMetaAction): MechItemEconomy {
  const epCost = typeof action.activationCost === 'number' ? action.activationCost : 0
  const heat = (action.traits ?? [])
    .filter((t) => t.type === 'hot')
    .reduce((sum, t) => sum + Math.max(1, traitAmount(t)), 0)
  const maxUses = (action.traits ?? [])
    .filter((t) => t.type === 'uses')
    .reduce((m, t) => Math.max(m, traitAmount(t)), 0)
  return { epCost, heat, maxUses }
}

function itemActions(item: MechItem): SURefMetaAction[] {
  return SalvageUnionReference.resolveActions(item as unknown as SURefMetaEntity) ?? []
}

/** The action that drives an item's Use button (first numeric-cost, else first). */
function primaryAction(actions: SURefMetaAction[]): SURefMetaAction | undefined {
  return actions.find((a) => typeof a.activationCost === 'number') ?? actions[0]
}

/**
 * The boarded mech's available actions, grouped by source (Chassis Ability /
 * Systems / Modules) via `SalvageUnionReference.resolveActions`. Systems/modules
 * contribute one entry each (their primary action), matching the sheet's
 * per-item Use model; the chassis contributes each of its ability actions.
 */
export function buildMechActions(mech: Mech): PlayActionGroup[] {
  const groups: PlayActionGroup[] = []

  const chassis = resolveChassisRef(mech.chassisRef)
  if (chassis) {
    const acts = SalvageUnionReference.resolveActions(chassis) ?? []
    if (acts.length > 0) {
      groups.push({
        source: 'Chassis Ability',
        items: acts.map((action, i) => ({
          key: `chassis:${action.id ?? i}`,
          name: action.name,
          kind: 'chassis',
          slug: mech.chassisRef,
          economy: chassisActionEconomy(action),
          action,
        })),
      })
    }
  }

  const build = (slugs: string[], kind: 'system' | 'module'): PlayAction[] => {
    const out: PlayAction[] = []
    for (const slug of slugs) {
      const item = kind === 'system' ? resolveSystem(slug) : resolveModule(slug)
      if (!item) continue
      const action = primaryAction(itemActions(item))
      if (!action) continue
      out.push({
        key: `${kind}:${slug}`,
        name: item.name,
        kind,
        slug,
        economy: itemEconomy(item),
        action,
      })
    }
    return out
  }

  const systems = build(mech.systems ?? [], 'system')
  if (systems.length > 0) groups.push({ source: 'Systems', items: systems })
  const modules = build(mech.modules ?? [], 'module')
  if (modules.length > 0) groups.push({ source: 'Modules', items: modules })

  return groups
}

/**
 * The write-through patch for one activation — spend EP, add Hot Heat (clamped
 * to cap), tick the Uses counter down. Byte-for-byte the shape
 * `MechSheet.activateItem` writes, so the Dashboard and the sheet can't drift.
 */
export function activationPatch(args: {
  slug: string
  economy: MechItemEconomy
  currentEP: number
  currentHeat: number
  heatCap: number
  prevUses: Record<string, number> | undefined
}): Partial<Mech> {
  const { slug, economy, currentEP, currentHeat, heatCap, prevUses } = args
  const patch: Partial<Mech> = {}
  if (economy.epCost > 0) {
    patch.currentEP = Math.max(0, currentEP - economy.epCost)
  }
  if (economy.heat > 0) {
    patch.currentHeat = clampHeat(currentHeat + economy.heat, heatCap)
  }
  if (economy.maxUses > 0) {
    const prev = prevUses ?? {}
    const remaining = Math.min(prev[slug] ?? economy.maxUses, economy.maxUses)
    patch.itemUses = { ...prev, [slug]: Math.max(0, remaining - 1) }
  }
  return patch
}
