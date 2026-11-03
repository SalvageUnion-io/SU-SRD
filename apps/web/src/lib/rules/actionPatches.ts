/**
 * actionPatches — the thin, PURE driver over the rules engine that Play and
 * the pilot sheet share (docs/architecture/play.md §14). Nothing here touches React or the store: every function takes the
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

import { hasCondition, withCondition } from 'game-domain/mechConditions'
import { mechMaxima, pilotMaxima } from 'game-domain/rules/crewStatus'
import { pushHeatAt, scaleHeat } from 'game-domain/rules/sceneConditions'
import type { Crawler } from 'game-domain/schemas/crawler'
import type { ItemCondition } from 'game-domain/schemas/itemCondition'
import type { Mech } from 'game-domain/schemas/mech'
import type { Pilot } from 'game-domain/schemas/pilot'
import type { RangeBand } from 'game-domain/schemas/seat'
import type {
  ChoiceSelections,
  RefAbility,
  RefMetaAction,
  RefMetaEntity,
  RefObjectChoice,
} from 'salvageunion-reference'
import { resultForTable, SalvageUnionReference } from 'salvageunion-reference'
import type {
  CoreRollBand,
  HeatCheckEffect,
  OverloadTable,
  Roll,
} from 'salvageunion-reference/rules'
import {
  AREA_SALVAGE_TABLE,
  canActivateAction,
  canPush,
  clampHeat,
  describeOverloadOutcome,
  describePushOutcome,
  overloadTableName,
  overloadTableOf,
  performHeatCheck,
  performPush,
  resolveChassisRef,
  resolveGauge,
  resolvePoolStart,
} from 'salvageunion-reference/rules'
import type { MechItemEconomy } from './mechItems'
import { actionEconomy, resolveModule, resolveSystem } from './mechItems'
import { resolveEquipment } from './pilotInventory'

// ---------------------------------------------------------------------------
// Reactor — Push / Heat Check / Vent / Shutdown (play.md §14.1)
// ---------------------------------------------------------------------------

/**
 * A resolved Heat Check as the mech patch Play writes. Heat and the Shutdown band (shutdown, Vulnerable, SP) auto-apply; a Meltdown's
 * destruction is a player-confirmed step (ADR-007, like Critical Damage), so
 * it only raises `meltdown` for the caller to offer the confirm.
 */
function reactorPatch(
  effect: HeatCheckEffect,
  currentHeat: number,
  conditions: readonly string[]
): { patch: Partial<Mech>; meltdown: boolean } {
  const patch: Partial<Mech> = { currentHeat }
  if (effect.shutdown) {
    patch.conditions = withCondition(
      withCondition(conditions, 'Shutdown', true),
      'Vulnerable',
      true
    )
    patch.currentSP = effect.nextSP
  }
  return { patch, meltdown: effect.destroyed }
}

/**
 * Push: +2 Heat then an immediate Heat Check (`reactorPatch`): a Meltdown is
 * held back (`meltdown: true`) for the caller's player-confirm (ADR-007).
 * Destroyed System/Module bands are likewise left for the player to mark.
 */
export function pushPatch(args: {
  heat: number
  heatCap: number
  currentSP: number
  /** The mech's conditions now: an overheat adds Shutdown and Vulnerable to them. */
  conditions: readonly string[]
  roll: Roll
  /** The Push's Heat where a Scene scales it (`pushHeatAt`); 2 by default. */
  gain?: number
  table?: OverloadTable
}): {
  patch: Partial<Mech>
  effect: HeatCheckEffect
  nextHeat: number
  meltdown: boolean
} {
  const { nextHeat, effect } = performPush(args)
  const { patch, meltdown } = reactorPatch(effect, nextHeat, args.conditions)
  return { patch, effect, nextHeat, meltdown }
}

/**
 * A Push on `mech` as it stands (the caller reads it fresh from the store): the
 * patch, what it came to and whether it melted down, or null where +2 Heat
 * would pass the Heat Cap (Core Book p.234). The resolve's Push
 * (`useActionsDeck`) and `PlayReactorRow`'s both run it. Under a Scene's
 * conditions the Push's Heat is scaled (`heatScale`: 4 in a Radiation Storm,
 * 1 Freezing; `pushHeatAt`). The pilot's abilities raise the maxima the
 * mech starts from (Beefcake, `mechMaxima`).
 */
export function mechPush(
  mech: Mech,
  pilotAbilities: string[] | undefined,
  roll: Roll,
  heatScale = 1
): {
  patch: Partial<Mech>
  text: string
  meltdown: boolean
  /** The overload die, where the Heat Check overloaded. */
  overloadRoll?: number
  /** What the overload does to the Pilot (a Bio-Chassis's), for `pilotOverloadPatch`. */
  effect: HeatCheckEffect
} | null {
  const { chassis, maxSP, maxHeat: heatCap } = mechMaxima(mech, pilotAbilities, [])
  const heat = resolveGauge(mech.currentHeat, heatCap)
  const gain = pushHeatAt(heatScale)
  if (!canPush(heat, heatCap, gain)) return null
  const table = overloadTableOf(chassis)
  const { patch, effect, nextHeat, meltdown } = pushPatch({
    heat,
    heatCap,
    gain,
    // Unrecorded SP means undamaged. At 0 an Overheat wrote the mech straight
    // to SP 0 — one hit from destroyed — without it ever having taken damage.
    currentSP: resolvePoolStart(mech.currentSP, maxSP),
    conditions: mech.conditions,
    roll,
    table,
  })
  const { overloadRoll } = effect.result
  return {
    patch,
    text: describePushOutcome(nextHeat, effect, gain, table),
    meltdown,
    effect,
    ...(overloadRoll === undefined ? {} : { overloadRoll }),
  }
}

/**
 * What a Bio-Chassis overload does to its Pilot (We Were Here First p.79): a
 * Bio-Overload's HP damage equal to the Heat, or a Pilot Overload's Minor or
 * Major Injury. Null when the overload leaves the Pilot alone, as every
 * Reactor Overload row does. The crawler the pilot crews sets their max HP
 * (Stat Training, `pilotMaxima`).
 */
export function pilotOverloadPatch(
  pilot: Pilot,
  crawler: Pick<Crawler, 'techLevel'> | null,
  effect: HeatCheckEffect
): Partial<Pilot> | null {
  const patch: Partial<Pilot> = {}
  if (effect.pilotDamage !== undefined) {
    const hp = resolvePoolStart(pilot.currentHP, pilotMaxima(pilot, crawler).maxHP)
    patch.currentHP = Math.max(0, hp - effect.pilotDamage)
  }
  if (effect.pilotInjury !== undefined) {
    patch.injuries = [
      ...(pilot.injuries ?? []),
      { severity: effect.pilotInjury, note: overloadTableName('bio') },
    ]
  }
  return Object.keys(patch).length === 0 ? null : patch
}

/** A standalone Heat Check at current Heat (no +2). Meltdown is player-confirmed. */
export function heatCheckOncePatch(args: {
  heat: number
  currentSP: number
  conditions: readonly string[]
  roll: Roll
  table?: OverloadTable
}): {
  patch: Partial<Mech>
  effect: HeatCheckEffect
  meltdown: boolean
} {
  const effect = performHeatCheck(args)
  const { patch, meltdown } = reactorPatch(effect, args.heat, args.conditions)
  return { patch, effect, meltdown }
}

/**
 * Emergency Vent: dump Heat to 0 and become Vulnerable (play.md §14.1 — Vent and
 * Shutdown are distinct controls on `PlayReactorRow`: Vent sets Heat→0 + Vulnerable,
 * Shutdown toggles its condition). NB the tabletop rule folds a full shutdown into
 * venting; Play keeps them separate — hit Shutdown too for
 * the strict-SRD sequence.
 */
export function ventPatch(conditions: readonly string[]): Partial<Mech> {
  return { currentHeat: 0, conditions: withCondition(conditions, 'Vulnerable', true) }
}

/** Toggle the Shutdown condition (reversible bookkeeping). */
export function shutdownTogglePatch(conditions: readonly string[]): Partial<Mech> {
  return {
    conditions: withCondition(conditions, 'Shutdown', !hasCondition(conditions, 'Shutdown')),
  }
}

/**
 * One-line readout for a resolved Heat Check. The outcome sentence ladder is
 * `describeOverloadOutcome` in the rules package (shared with the Push readout,
 * which prefixes the same tail with its `+2 Heat → N.` head) — only the head is
 * Play's own.
 */
export function describeHeatCheck(
  effect: HeatCheckEffect,
  table: OverloadTable = 'reactor'
): string {
  const r = effect.result
  const head = `Heat Check ${r.heatCheckRoll} vs Heat ${r.heatAtCheck}`
  return `${head} — ${describeOverloadOutcome(r, table)}`
}

// ---------------------------------------------------------------------------
// Action activation (play.md §14.2)
// ---------------------------------------------------------------------------

type PlayActionKind = 'chassis' | 'system' | 'module' | 'ability' | 'equipment'
/** Compact source stamp shown on each action card. */
type PlayActionStamp = 'CHS' | 'SYS' | 'MOD' | 'ABL' | 'EQP'
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
  /**
   * A carried item's choices and the player's picks on them (a Custom Sniper
   * Rifle's Weapon Type and Modifications), which change its action's Range,
   * Damage and traits. Absent for an item with no choices.
   */
  choices?: { from: RefObjectChoice[]; selections: ChoiceSelections }
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
 * The Generic abilities Play's deck deals every pilot, stored or not: "All
 * Pilots have the following Abilities" (Core Book p.248), so the record never
 * holds them (`pilotSheet.model`'s Generic tree). Only the ones Play resolves
 * end to end are dealt; the rest stay the sheet's.
 */
const INTRINSIC_ABILITIES = ['area-salvage'] as const

/** Whether an action is an Area Salvage, which rolls its own table (p.248) and pays out Scrap. */
export function isAreaSalvage(action: RefMetaAction): boolean {
  return action.tableName === AREA_SALVAGE_TABLE
}

/**
 * The on-foot pilot's activatable actions, flat — every action of each selected
 * ability, the intrinsic Generic ones, and each carried equipment item. Mirrors
 * `buildMechActions` but on the AP economy (pilots have no Heat/EP):
 * `economy.epCost` carries the AP cost and `currency` is 'AP'.
 */
export function buildPilotActions(pilot: Pilot): PlayAction[] {
  const out: PlayAction[] = []
  const owned = pilot.abilities ?? []
  const carried = (pilot.equipment ?? []).flatMap((slug) => {
    const equip = resolveEquipment(slug)
    return equip ? [{ slug, equip }] : []
  })
  // An action a carried item states is that item's line: an ability that grants
  // the item (Custom Sniper Rifle) does not deal it a second time.
  const carriedActionIds = new Set(
    carried.flatMap(({ equip }) => deckActions(equip).flatMap((a) => (a.id ? [a.id] : [])))
  )

  for (const slug of [...owned, ...INTRINSIC_ABILITIES.filter((s) => !owned.includes(s))]) {
    const ability = resolveAbilityBySlug(slug)
    if (!ability) continue
    deckActions(ability).forEach((action, i) => {
      if (action.id && carriedActionIds.has(action.id)) return
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

  for (const { slug, equip } of carried) {
    const condition = pilot.equipmentConditions?.[slug] ?? 'intact'
    const itemChoices = equip.choices ?? []
    const choices =
      itemChoices.length > 0
        ? { from: itemChoices, selections: pilot.equipmentChoices?.[slug] ?? {} }
        : undefined
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
        // Only its self-action (named as the item) is the item the choices change.
        ...(choices && action.name === equip.name ? { choices } : {}),
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
  return { ...base, heat: actionEconomy(action, hotX).heat }
}

/** The economy with its Hot Heat scaled by a Scene's conditions (`sceneHeatScale`), rounded down. */
export function economyUnderScene(base: MechItemEconomy, heatScale: number): MechItemEconomy {
  return heatScale === 1 ? base : { ...base, heat: scaleHeat(base.heat, heatScale) }
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
 * resolve hands it to the player in its Mini's Callout (`PlayResolveSteps`), who
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
