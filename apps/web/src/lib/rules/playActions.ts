/**
 * playActions — Play's thin, PURE driver over the existing rules engine
 * (docs/architecture/play.md §14). Nothing here touches React or the store: every function takes the
 * live numbers (+ an injectable `Roll`) and returns the `Partial<Mech>` /
 * `Partial<Pilot>` write-through patch the caller (`useActionsDeck`, `PlayReactorRow`)
 * hands to `storeState.update(...)`. This keeps the button/action handlers trivially testable
 * (assert the patch) and keeps the ADR-006 pure-math boundary intact — the math
 * lives in `lib/rules/*`, this only assembles patches and readouts.
 *
 * ADR-007 boundary: non-destructive bookkeeping (Heat/EP/uses/SP deltas,
 * Vent, Shutdown toggle) is assembled into an auto-apply patch; a destructive
 * consequence (a Meltdown's mech Destroyed) is NEVER folded into the returned
 * patch — it stays an explicit player call at the UI layer.
 */

import type { ItemCondition } from 'game-domain/schemas/itemCondition'
import type { Mech } from 'game-domain/schemas/mech'
import type { Pilot } from 'game-domain/schemas/pilot'
import type { RangeBand } from 'game-domain/schemas/seat'
import type { RefAbility, RefEquipment, RefMetaAction, RefMetaEntity } from 'salvageunion-reference'
import { resultForTable, SalvageUnionReference } from 'salvageunion-reference'
import type { CoreRollBand, HeatCheckEffect, Roll } from 'salvageunion-reference/rules'
import {
  canActivateAction,
  canPush,
  clampHeat,
  describeOverloadOutcome,
  describePushOutcome,
  mechMaxHeat,
  mechMaxSP,
  performHeatCheck,
  performPush,
  resolveChassisRef,
  resolveGauge,
  resolvePoolStart,
} from 'salvageunion-reference/rules'
import { heatCheckPatch } from './heatCheck'
import type { MechItemEconomy } from './mechItems'
import { resolveModule, resolveSystem } from './mechItems'
import { resolveEquipment } from './pilotInventory'

// ---------------------------------------------------------------------------
// Reactor — Push / Heat Check / Vent / Shutdown (play.md §14.1)
// ---------------------------------------------------------------------------

/**
 * Strip the destructive `destroyed` flag out of a shared `heatCheckPatch`
 * result. In the sheet, `heatCheckPatch` auto-sets `destroyed` on a Meltdown
 * (overload roll = 1); Play holds a STRICTER ADR-007 line — a Meltdown's
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

/**
 * A Push on `mech` as it stands (the caller reads it fresh from the store): the
 * patch, what it came to and whether it melted down, or null where +2 Heat
 * would pass the Heat Cap (Core Book p.234). The resolve's Push
 * (`useActionsDeck`) and `PlayReactorRow`'s both run it.
 */
export function mechPush(
  mech: Mech,
  roll: Roll
): {
  patch: Partial<Mech>
  text: string
  meltdown: boolean
  /** The Reactor Overload die, where the Heat Check overloaded. */
  overloadRoll?: number
} | null {
  const chassis = resolveChassisRef(mech.chassisRef)
  const heatCap = mechMaxHeat(mech, chassis)
  const heat = resolveGauge(mech.currentHeat, heatCap)
  if (!canPush(heat, heatCap)) return null
  const { patch, effect, nextHeat, meltdown } = pushPatch({
    heat,
    heatCap,
    // Unrecorded SP means undamaged. At 0 an Overheat wrote the mech straight
    // to SP 0 — one hit from destroyed — without it ever having taken damage.
    currentSP: resolvePoolStart(mech.currentSP, mechMaxSP(mech, chassis)),
    roll,
  })
  const { overloadRoll } = effect.result
  return {
    patch,
    text: describePushOutcome(nextHeat, effect),
    meltdown,
    ...(overloadRoll === undefined ? {} : { overloadRoll }),
  }
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
 * Emergency Vent: dump Heat to 0 and become Vulnerable (play.md §14.1 — Vent and
 * Shutdown are distinct controls on `PlayReactorRow`: Vent sets Heat→0 + `vulnerable`,
 * Shutdown toggles the flag). NB the tabletop rule folds a full shutdown into
 * venting; Play keeps them separate — hit Shutdown too for
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
 * Play's own.
 */
export function describeHeatCheck(effect: HeatCheckEffect): string {
  const r = effect.result
  const head = `Heat Check ${r.heatCheckRoll} vs Heat ${r.heatAtCheck}`
  return `${head} — ${describeOverloadOutcome(r)}`
}

// ---------------------------------------------------------------------------
// Action activation (play.md §14.2)
// ---------------------------------------------------------------------------

export type PlayActionKind = 'chassis' | 'system' | 'module' | 'ability' | 'equipment'
/** Compact source stamp shown on each action card (mockup `acell`). */
export type PlayActionStamp = 'CHS' | 'SYS' | 'MOD' | 'ABL' | 'EQP'
/** Which resource one activation of this action spends. */
export type PlayActionCurrency = 'EP' | 'AP'

/**
 * A single activatable action. Play's Actions list shows EVERY action of a
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
  action: RefMetaAction
  /** Live condition of the owning item ('intact' for chassis/pilot abilities). */
  condition: ItemCondition
}

function traitAmount(trait: { amount?: unknown }): number {
  return typeof trait.amount === 'number' ? trait.amount : 0
}

/** Per-action economy (EP/AP from cost, Heat from Hot, uses from Uses). */
function actionEconomy(action: RefMetaAction): MechItemEconomy {
  const epCost = typeof action.activationCost === 'number' ? action.activationCost : 0
  const heat = (action.traits ?? [])
    .filter((t) => t.type === 'hot')
    .reduce((sum, t) => sum + Math.max(1, traitAmount(t)), 0)
  const maxUses = (action.traits ?? [])
    .filter((t) => t.type === 'uses')
    .reduce((m, t) => Math.max(m, traitAmount(t)), 0)
  return { epCost, heat, maxUses }
}

function entityActions(entity: RefMetaEntity): RefMetaAction[] {
  return SalvageUnionReference.resolveActions(entity) ?? []
}

/** Non-rendering `hidden` actions are book-keeping only — never deck cards. */
function deckActions(entity: RefMetaEntity): RefMetaAction[] {
  return entityActions(entity).filter((a) => !a.hidden)
}

/**
 * The boarded mech's activatable actions, flat — every action of the chassis,
 * each installed System, and each installed Module surfaces as its own
 * `PlayAction`. Filtering is a UI concern (Play's Actions list,
 * `playActions.model.ts`), kept out of this pure builder.
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

/** Resolve a pilot ability slug against the reference ORM. */
function resolveAbilityBySlug(slug: string): RefAbility | null {
  return SalvageUnionReference.Abilities.getBySlug(slug) ?? null
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
    const equip: RefEquipment | null = resolveEquipment(slug)
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
// Range (pure — the UI reads these)
// ---------------------------------------------------------------------------

/**
 * Whether an action's declared range covers the given band. Actions with NO
 * declared range (utility / passive) are treated as always in range.
 */
export function actionInRange(action: RefMetaAction, band: RangeBand): boolean {
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

// ---------------------------------------------------------------------------
// Resolve flow — cost choice, variable Hot, Apply outcome (play.md §14.2)
// ---------------------------------------------------------------------------

/**
 * Whether the action offers a genuine EP-vs-AP currency choice (§4.2). The
 * `activationCurrency` enum is descriptive text no rules helper consumes; a real
 * choice ('EP or AP') is authored in Play's resolve as a radio pair.
 */
export function hasCurrencyChoice(action: RefMetaAction): boolean {
  return action.activationCurrency === 'EP or AP'
}

/**
 * Whether the action's Hot cost is variable — a trait `{type:'hot', amount:'X'}`.
 * These need a player-picked amount (a `− X +` stepper); the stored data only
 * marks heat as variable, never a value/range.
 */
export function hasVariableHot(action: RefMetaAction): boolean {
  return (action.traits ?? []).some((t) => t.type === 'hot' && t.amount === 'X')
}

/**
 * The Hot heat one activation produces given a player-picked `hotX` for the
 * variable Hot trait. Fixed Hot traits keep their printed amount (min 1, matching
 * `actionEconomy`); the variable 'X' Hot uses the picked value (clamped ≥ 0).
 * Non-Hot actions produce 0.
 */
export function hotHeatFor(action: RefMetaAction, hotX: number): number {
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
  action: RefMetaAction,
  hotX: number
): MechItemEconomy {
  if (!hasVariableHot(action)) return base
  return { ...base, heat: hotHeatFor(action, hotX) }
}

/** Whether one activation's Hot Heat applies, and whether it fits under the Heat Cap. */
export type ActivationHeatGate = { applies: boolean; ok: boolean }

/**
 * The Heat gate on one activation. Only an EP activation made from the cockpit
 * makes Heat (a pilot on foot carries none), so only that one `applies`; it is
 * `ok` when it adds no Heat or its Heat would not take the Mech past its Heat
 * Cap (`canActivateAction`).
 */
export function activationHeatGate(args: {
  currency: PlayActionCurrency
  onFoot: boolean
  heat: number
  currentHeat: number
  heatCap: number
}): ActivationHeatGate {
  const applies = args.currency === 'EP' && !args.onFoot
  const ok =
    !applies || args.heat <= 0 || canActivateAction(args.currentHeat, args.heat, args.heatCap)
  return { applies, ok }
}

/**
 * Classify a rolled outcome for the Apply step (ADR-007). A Cascade Failure is
 * the destructive band — its severe consequence must NEVER be auto-written; the
 * resolve hands it to the player in its Token's Callout (`PlayResolveSteps`), who
 * takes the damage on the unit's gauge. Every other band is non-destructive and
 * auto-commits.
 */
export function isDestructiveOutcome(band: CoreRollBand): boolean {
  return band === 'cascade'
}

/**
 * The rolled row's text, verbatim from the Core Mechanic roll table (ruleset
 * §3.6: copy is 1:1 with the SRD). The resolve readout prints this under the
 * band, never the rules module's condensed summary.
 */
export function coreMechanicRowText(roll: number): string {
  const table = SalvageUnionReference.RollTables.getByName('Core Mechanic')?.table
  const row = resultForTable(table, roll)
  return row.success ? row.result.value : ''
}

/** The write-through patch for one on-foot (AP) activation. */
export function pilotActivationPatch(args: { apCost: number; currentAP: number }): Partial<Pilot> {
  if (args.apCost <= 0) return {}
  return { currentAP: Math.max(0, args.currentAP - args.apCost) }
}

/**
 * The write-through patch for one activation — spend EP, add Hot Heat (clamped
 * to cap), tick the Uses counter down. Applied by `useActionsDeck`; the Uses
 * map is the `itemUses` shape the sheet's hand edit (`setItemUses` in
 * `mechSheetActions.model.ts`) writes, so Play and the sheet can't drift.
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
