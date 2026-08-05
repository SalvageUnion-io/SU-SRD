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

import type {
  SURefAbility,
  SURefEquipment,
  SURefMetaAction,
  SURefMetaEntity,
} from 'salvageunion-reference'
import { SalvageUnionReference } from 'salvageunion-reference'
import { canActivateAction, resolveChassisRef, resolveRef } from 'salvageunion-reference/rules'
import type { CoreRollBand } from '../../lib/rules/coreMechanic'
import { describeOverloadOutcome } from '../../lib/rules/coreMechanic'
import type { HeatCheckEffect, Roll } from '../../lib/rules/heatCheck'
import { clampHeat, heatCheckPatch, performHeatCheck, performPush } from '../../lib/rules/heatCheck'
import type {
  CriticalDamageEffect,
  CriticalInjuryEffect,
  MechDamageEffect,
  PilotDamageEffect,
} from '../../lib/rules/takeDamage'
import {
  applyMechDamage,
  applyPilotDamage,
  performCriticalDamage,
  performCriticalInjury,
} from '../../lib/rules/takeDamage'
import type { ItemCondition, Mech } from '../../lib/schemas/mech'
import type { Pilot } from '../../lib/schemas/pilot'
import type { MechItemEconomy } from '../sheet/mechItemRules'
import { resolveModule, resolveSystem } from '../sheet/mechItemRules'
import { resolveEquipment } from '../sheet/pilotInventory'

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

/**
 * One-line readout for a resolved Heat Check. The outcome sentence ladder is
 * `describeOverloadOutcome` in the rules package (shared with the Push readout,
 * which prefixes the same tail with its `+2 Heat → N.` head) — only the head is
 * the Dashboard's own.
 */
export function describeHeatCheck(effect: HeatCheckEffect): string {
  const r = effect.result
  const head = `Heat Check ${r.heatCheckRoll} vs Heat ${r.heatAtCheck}`
  return `${head} — ${describeOverloadOutcome(r)}`
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

export type PlayActionKind = 'chassis' | 'system' | 'module' | 'ability' | 'equipment'
/** Compact source stamp shown on each action card (mockup `acell`). */
export type PlayActionStamp = 'CHS' | 'SYS' | 'MOD' | 'ABL' | 'EQP'
/** Which resource one activation of this action spends. */
export type PlayActionCurrency = 'EP' | 'AP'

/**
 * A single activatable action. The Dashboard deck lists EVERY action of a
 * multi-action system/module/ability as its own card (not just the primary),
 * so `economy` is PER ACTION (not the item-wide `itemEconomy`). For pilot
 * (on-foot) actions the `economy.epCost` holds the AP cost and `currency` is
 * 'AP' — the field name is mech-legacy; read it as "primary activation cost".
 */
export type PlayAction = {
  /** Stable list key (owner + action). */
  key: string
  /** Display name of the action. */
  name: string
  kind: PlayActionKind
  stamp: PlayActionStamp
  currency: PlayActionCurrency
  /** The owning item / ability / chassis display name (the source label). */
  ownerName: string
  /** The installed item / ability / equipment slug; the chassis ref for chassis. */
  slug: string
  /** What one activation costs / produces (per action). */
  economy: MechItemEconomy
  /** The action itself, for the reference card + range/damage/traits meta. */
  action: SURefMetaAction
  /** Live condition of the owning item ('intact' for chassis/pilot abilities). */
  condition: ItemCondition
}

/** A named bucket of actions (grouped by source owner). */
export type PlayActionGroup = { label: string; items: PlayAction[] }

/** Self-declared engagement range band (playStateStore, ephemeral). */
export type RangeBand = 'Close' | 'Medium' | 'Long' | 'Far'
export const RANGE_BANDS: readonly RangeBand[] = ['Close', 'Medium', 'Long', 'Far'] as const

/** The timing-filter tabs (one per actionType; 'React' maps to 'Reaction'). */
export type TimingTab = 'All' | 'Turn' | 'Short' | 'Long' | 'Free' | 'React'
export const TIMING_TABS: readonly TimingTab[] = [
  'All',
  'Turn',
  'Short',
  'Long',
  'Free',
  'React',
] as const

function traitAmount(trait: { amount?: unknown }): number {
  return typeof trait.amount === 'number' ? trait.amount : 0
}

/** Per-action economy (EP/AP from cost, Heat from Hot, uses from Uses). */
function actionEconomy(action: SURefMetaAction): MechItemEconomy {
  const epCost = typeof action.activationCost === 'number' ? action.activationCost : 0
  const heat = (action.traits ?? [])
    .filter((t) => t.type === 'hot')
    .reduce((sum, t) => sum + Math.max(1, traitAmount(t)), 0)
  const maxUses = (action.traits ?? [])
    .filter((t) => t.type === 'uses')
    .reduce((m, t) => Math.max(m, traitAmount(t)), 0)
  return { epCost, heat, maxUses }
}

function entityActions(entity: SURefMetaEntity): SURefMetaAction[] {
  return SalvageUnionReference.resolveActions(entity) ?? []
}

/** Non-rendering `hidden` actions are book-keeping only — never deck cards. */
function deckActions(entity: SURefMetaEntity): SURefMetaAction[] {
  return entityActions(entity).filter((a) => !a.hidden)
}

/**
 * The boarded mech's activatable actions, flat — every action of the chassis,
 * each installed System, and each installed Module surfaces as its own
 * `PlayAction`. Filtering is a UI concern (see `groupBySource` — which now only
 * feeds the source filter chips — and `TIMING_TABS`), kept out of this pure
 * builder.
 */
export function buildMechActions(mech: Mech): PlayAction[] {
  const out: PlayAction[] = []

  const chassis = resolveChassisRef(mech.chassisRef)
  if (chassis) {
    const chassisName = chassis.name ?? mech.chassisRef
    deckActions(chassis).forEach((action, i) => {
      out.push({
        key: `chassis:${action.id ?? i}`,
        name: action.name,
        kind: 'chassis',
        stamp: 'CHS',
        currency: 'EP',
        ownerName: chassisName,
        slug: mech.chassisRef,
        economy: actionEconomy(action),
        action,
        condition: 'intact',
      })
    })
  }

  const build = (slugs: string[], kind: 'system' | 'module') => {
    const conditions = kind === 'system' ? mech.systemConditions : mech.moduleConditions
    for (const slug of slugs) {
      const item = kind === 'system' ? resolveSystem(slug) : resolveModule(slug)
      if (!item) continue
      const condition = conditions?.[slug] ?? 'intact'
      deckActions(item).forEach((action, i) => {
        out.push({
          key: `${kind}:${slug}:${action.id ?? i}`,
          name: action.name,
          kind,
          stamp: kind === 'system' ? 'SYS' : 'MOD',
          currency: 'EP',
          ownerName: item.name,
          slug,
          economy: actionEconomy(action),
          action,
          condition,
        })
      })
    }
  }

  build(mech.systems ?? [], 'system')
  build(mech.modules ?? [], 'module')

  return out
}

/** Resolve a pilot ability slug (id or name) against the reference ORM. */
function resolveAbilityBySlug(slug: string): SURefAbility | null {
  return resolveRef(SalvageUnionReference.Abilities, slug)
}

/**
 * The on-foot pilot's activatable actions, flat — every action of each selected
 * ability and each carried equipment item. Mirrors `buildMechActions` but on the
 * AP economy (pilots have no Heat/EP): `economy.epCost` carries the AP cost and
 * `currency` is 'AP'.
 */
export function buildPilotActions(pilot: Pilot): PlayAction[] {
  const out: PlayAction[] = []

  for (const slug of pilot.abilities ?? []) {
    const ability = resolveAbilityBySlug(slug)
    if (!ability) continue
    deckActions(ability).forEach((action, i) => {
      out.push({
        key: `ability:${slug}:${action.id ?? i}`,
        name: action.name,
        kind: 'ability',
        stamp: 'ABL',
        currency: 'AP',
        ownerName: ability.name,
        slug,
        economy: actionEconomy(action),
        action,
        condition: 'intact',
      })
    })
  }

  for (const slug of pilot.equipment ?? []) {
    const equip: SURefEquipment | null = resolveEquipment(slug)
    if (!equip) continue
    const condition = pilot.equipmentConditions?.[slug] ?? 'intact'
    deckActions(equip).forEach((action, i) => {
      out.push({
        key: `equipment:${slug}:${action.id ?? i}`,
        name: action.name,
        kind: 'equipment',
        stamp: 'EQP',
        currency: 'AP',
        ownerName: equip.name,
        slug,
        economy: actionEconomy(action),
        action,
        condition,
      })
    })
  }

  return out
}

// ---------------------------------------------------------------------------
// Deck filtering / grouping / range (pure — the UI reads these)
// ---------------------------------------------------------------------------

/** Whether a timing tab admits this action (`All` admits everything). */
export function tabMatchesAction(tab: TimingTab, action: SURefMetaAction): boolean {
  if (tab === 'All') return true
  const want = tab === 'React' ? 'Reaction' : tab
  return action.actionType === want
}

/**
 * Whether an action's declared range covers the given band. Actions with NO
 * declared range (utility / passive) are treated as always in range.
 */
export function actionInRange(action: SURefMetaAction, band: RangeBand): boolean {
  const ranges = action.range
  if (!ranges || ranges.length === 0) return true
  return ranges.includes(band)
}

/**
 * Whether an action is currently usable: not destroyed, in range for the band,
 * and its Hot cost would not push heat past the cap (`canActivateAction`). Pilot
 * actions carry no heat, so pass heatCap large / heat 0 for those.
 */
export function actionReachable(
  pa: PlayAction,
  band: RangeBand,
  currentHeat: number,
  heatCap: number
): boolean {
  if (pa.condition === 'destroyed') return false
  if (!actionInRange(pa.action, band)) return false
  return canActivateAction(currentHeat, pa.economy.heat, heatCap)
}

/** Count reachable vs total for the reach readout ("7 / 12 in reach"). */
export function reachSummary(
  actions: PlayAction[],
  band: RangeBand,
  currentHeat: number,
  heatCap: number
): { inReach: number; total: number } {
  let inReach = 0
  for (const pa of actions) {
    if (actionReachable(pa, band, currentHeat, heatCap)) inReach += 1
  }
  return { inReach, total: actions.length }
}

/** Group actions by their source owner (chassis / each item / ability), in order. */
export function groupBySource(actions: PlayAction[]): PlayActionGroup[] {
  const groups: PlayActionGroup[] = []
  const index = new Map<string, PlayActionGroup>()
  for (const a of actions) {
    const key = `${a.stamp}:${a.ownerName}`
    let g = index.get(key)
    if (!g) {
      g = { label: a.ownerName, items: [] }
      index.set(key, g)
      groups.push(g)
    }
    g.items.push(a)
  }
  return groups
}

/** Compact micro-meta tags for a deck card (range / damage / traits). */
export function actionMicroMeta(pa: PlayAction): string[] {
  const bits: string[] = []
  const ranges = pa.action.range
  if (ranges && ranges.length > 0) bits.push(ranges.map((r) => r[0]).join('/'))
  const dmg = pa.action.damage
  if (dmg) bits.push(`${dmg.amount} ${dmg.damageType}`)
  for (const t of pa.action.traits ?? []) {
    const label = t.type.toUpperCase()
    bits.push(t.amount != null ? `${label} ${t.amount}` : label)
  }
  return bits
}

// ---------------------------------------------------------------------------
// Resolve flow — cost choice, variable Hot, Apply outcome (plan §5, D2)
// ---------------------------------------------------------------------------

/**
 * Whether the action offers a genuine EP-vs-AP currency choice (§4.2). The
 * `activationCurrency` enum is descriptive text no rules helper consumes; a real
 * choice ('EP or AP') is authored in the Dashboard resolve flow as a radio pair.
 */
export function hasCurrencyChoice(action: SURefMetaAction): boolean {
  return action.activationCurrency === 'EP or AP'
}

/**
 * Whether the action's Hot cost is variable — a trait `{type:'hot', amount:'X'}`.
 * These need a player-picked amount (a `− X +` stepper); the stored data only
 * marks heat as variable, never a value/range.
 */
export function hasVariableHot(action: SURefMetaAction): boolean {
  return (action.traits ?? []).some((t) => t.type === 'hot' && t.amount === 'X')
}

/**
 * The Hot heat one activation produces given a player-picked `hotX` for the
 * variable Hot trait. Fixed Hot traits keep their printed amount (min 1, matching
 * `actionEconomy`); the variable 'X' Hot uses the picked value (clamped ≥ 0).
 * Non-Hot actions produce 0.
 */
export function hotHeatFor(action: SURefMetaAction, hotX: number): number {
  return (action.traits ?? [])
    .filter((t) => t.type === 'hot')
    .reduce((sum, t) => {
      if (t.amount === 'X') return sum + Math.max(0, hotX)
      return sum + Math.max(1, traitAmount(t))
    }, 0)
}

/**
 * Per-activation economy with a player-picked X folded in. When the action has a
 * variable Hot ('X'), the Heat is recomputed from `hotX`; otherwise the base
 * economy passes through unchanged. EP/uses are untouched (only Hot is variable).
 */
export function economyForActivation(
  base: MechItemEconomy,
  action: SURefMetaAction,
  hotX: number
): MechItemEconomy {
  if (!hasVariableHot(action)) return base
  return { ...base, heat: hotHeatFor(action, hotX) }
}

/**
 * Classify a rolled outcome for the Apply step (ADR-007). A Cascade Failure is
 * the destructive band — its severe consequence must NEVER be auto-written; the
 * caller routes it to the Active Item band's player-confirmed controls (Push /
 * Take Dmg / Critical). Every other band is non-destructive and auto-commits.
 */
export function isDestructiveOutcome(band: CoreRollBand): boolean {
  return band === 'cascade'
}

/** The write-through patch for one on-foot (AP) activation. */
export function pilotActivationPatch(args: { apCost: number; currentAP: number }): Partial<Pilot> {
  if (args.apCost <= 0) return {}
  return { currentAP: Math.max(0, args.currentAP - args.apCost) }
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
