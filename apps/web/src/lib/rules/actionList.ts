/**
 * actionList — every action a unit has, as the rows Play's board and a Live
 * Sheet's Actions list draw (R65): a mech's chassis ability, systems and
 * modules (`buildMechActions`), a pilot's abilities and equipment
 * (`buildPilotActions`) and each companion's own (`buildCompanionActions`).
 * Pure: it reads the records and the reference, and writes nothing. What an
 * activation spends is `actionPatches.ts`'s; what a row prints is
 * `actionRow.ts`'s.
 *
 * A made choice reads as made (R60): an item's action that carries choices
 * takes the owner's picks (`mech.itemChoices`, `pilot.equipmentChoices`), and
 * a picked variant's own actions follow it as rows of their own.
 */

import type { ItemCondition } from 'game-domain/schemas/itemCondition'
import type { Mech } from 'game-domain/schemas/mech'
import type { PartnerInstance } from 'game-domain/schemas/partner'
import type { Pilot } from 'game-domain/schemas/pilot'
import type {
  ChoiceSelections,
  RefAbility,
  RefMetaAction,
  RefMetaEntity,
  RefObjectChoice,
} from 'salvageunion-reference'
import {
  droneOwnLoadout,
  getEntitySlug,
  SalvageUnionReference,
  toEntityModel,
} from 'salvageunion-reference'
import { AREA_SALVAGE_TABLE, resolveChassisRef } from 'salvageunion-reference/rules'
import type { MechItemEconomy } from './mechItems'
import { actionEconomy, resolveModule, resolveSystem } from './mechItems'
import { isPartnerEquipment } from './partnerGrants'
import { resolvePartnerStatBlock } from './partnerStats'
import { carriedEquipment, resolveEquipment } from './pilotInventory'

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
  /**
   * The companion whose action this is (a pilot's Mecha Companion, a
   * chassis's drone). Its EP, Heat and Uses are the companion's own, on its
   * host's record, and it never Pushes.
   */
  companion?: PlayActionCompanion
  /** The item whose picked option this row is (an Automated Weapon Turret's chosen Turret Model). */
  variantOf?: string
}

/** Whose action a companion's row is. */
export type PlayActionCompanion = {
  id: string
  /** Its own name ("Rivet"), else its stat block's. */
  name: string
  host: { kind: 'pilot' | 'mech'; id: string }
  /** Its Mini's tone in the Units column, which its rows wear. */
  tone: string
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

  out.push(
    ...itemActions({
      choices: mech.itemChoices,
      systems: mech.systems ?? [],
      modules: mech.modules ?? [],
      systemConditions: mech.systemConditions,
      moduleConditions: mech.moduleConditions,
      keyOf: (kind, slug) => `${kind}:${slug}`,
    })
  )

  return out
}

/**
 * Every action of a set of installed Systems and Modules, a mech's or a companion's. An action that carries
 * choices (an Automated Weapon Turret's Turret Model) takes the owner's
 * picks, and a picked variant's own actions follow it as rows of their own
 * (R60: a made choice reads as made).
 */
function itemActions(args: {
  /** The owner's picks on its installed items (`mech.itemChoices`), by item slug. */
  choices: Record<string, ChoiceSelections> | undefined
  systems: readonly string[]
  modules: readonly string[]
  systemConditions: Record<string, ItemCondition> | undefined
  moduleConditions: Record<string, ItemCondition> | undefined
  keyOf: (kind: 'system' | 'module', slug: string) => string
  companion?: PlayActionCompanion
}): PlayAction[] {
  const out: PlayAction[] = []
  const build = (slugs: readonly string[], kind: 'system' | 'module') => {
    const conditions = kind === 'system' ? args.systemConditions : args.moduleConditions
    // An item installed twice lists its actions twice, each row under a key of its own.
    const seen = new Map<string, number>()
    for (const slug of slugs) {
      const copy = seen.get(slug) ?? 0
      seen.set(slug, copy + 1)
      const owner = copy === 0 ? args.keyOf(kind, slug) : `${args.keyOf(kind, slug)}#${copy}`
      const item = kind === 'system' ? resolveSystem(slug) : resolveModule(slug)
      if (!item) continue
      const condition = conditions?.[slug] ?? 'intact'
      const base = {
        kind,
        stamp: kind === 'system' ? 'SYS' : 'MOD',
        currency: 'EP',
        ownerName: item.name,
        slug,
        condition,
        ...(args.companion ? { companion: args.companion } : {}),
      } as const
      deckActions(item).forEach((action, i) => {
        const from = action.choices ?? []
        const selections = from.length > 0 ? args.choices?.[slug] : undefined
        out.push({
          ...base,
          key: `${owner}:${action.id ?? i}`,
          name: action.name,
          economy: actionEconomy(action),
          action,
          ...(from.length > 0 ? { choices: { from, selections: selections ?? {} } } : {}),
        })
        for (const variant of pickedVariantActions(from, selections ?? {})) {
          out.push({
            ...base,
            key: `${owner}:${action.id ?? i}:${variant.id ?? variant.name}`,
            name: variant.name,
            economy: actionEconomy(variant),
            action: variant,
            variantOf: item.name,
          })
        }
      })
    }
  }
  build(args.systems, 'system')
  build(args.modules, 'module')
  return out
}

/** The actions of the variants picked on a `systemVariant` choice (a Turret Model). */
function pickedVariantActions(
  choices: readonly RefObjectChoice[],
  selections: ChoiceSelections
): RefMetaAction[] {
  return choices.flatMap((choice) => {
    if (choice.source?.kind !== 'systemVariant') return []
    const picked = selections[choice.id] ?? []
    return choice.source.options
      .filter((option) => option.name !== undefined && picked.includes(option.name))
      .flatMap((option) =>
        (option.actions ?? []).flatMap((name) => {
          const action = SalvageUnionReference.Actions.getByName(name)
          return action && !action.hidden ? [action] : []
        })
      )
  })
}

/**
 * A companion's actions. A companion "uses the same rules as Mechs" and acts
 * on its own turn, so every action of its
 * stat block (a drone's own abilities and loadout) and of each System and
 * Module installed on it is a row, on the companion's own EP, Heat and Uses.
 * The row that only says how the companion is built (the Mecha Companion
 * ability's own text) is not an action and is left out.
 */
function buildPartnerActions(
  partner: PartnerInstance,
  host: { kind: 'pilot' | 'mech'; id: string }
): PlayAction[] {
  const statBlock = resolvePartnerStatBlock(partner)
  if (!statBlock) return []
  const companion: PlayActionCompanion = {
    id: partner.id,
    name: partner.name?.trim() || statBlock.name,
    host,
    tone: toEntityModel(statBlock).tone,
  }
  const own: PlayAction[] = deckActions(statBlock)
    .filter((action) => action.actionType !== undefined && action.name !== statBlock.name)
    .map((action, i) => ({
      key: `partner:${partner.id}:own:${action.id ?? i}`,
      name: action.name,
      kind: 'chassis',
      stamp: 'CHS',
      currency: 'EP',
      ownerName: statBlock.name,
      slug: partner.hostRef,
      economy: actionEconomy(action),
      action,
      condition: 'intact',
      companion,
    }))
  const printed = droneOwnLoadout(statBlock)
  const slugs = (entities: readonly Parameters<typeof getEntitySlug>[0][]) =>
    entities.map((e) => getEntitySlug(e))
  return [
    ...own,
    ...itemActions({
      // A companion's record keeps no picks: its installed items read unpicked.
      choices: undefined,
      systems: [...slugs(printed.systems), ...partner.systems],
      modules: [...slugs(printed.modules), ...partner.modules],
      systemConditions: partner.systemConditions,
      moduleConditions: partner.moduleConditions,
      keyOf: (kind, slug) => `partner:${partner.id}:${kind}:${slug}`,
      companion,
    }),
  ]
}

/** Every companion of a host, each one's actions. */
export function buildCompanionActions(
  host: { kind: 'pilot' | 'mech'; id: string },
  partners: readonly PartnerInstance[] | undefined
): PlayAction[] {
  return (partners ?? []).flatMap((partner) => buildPartnerActions(partner, host))
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
  const carried = carriedEquipment(pilot).flatMap((slug) => {
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
    // An ability that grants a companion prints how the companion is built,
    // not an action; the companion's own rows stand for it.
    const grantsCompanion = (ability.grants ?? []).some(
      (grant) =>
        grant.schema === 'equipment' &&
        isPartnerEquipment(
          getEntitySlug(SalvageUnionReference.Equipment.getByName(grant.name) ?? ability)
        )
    )
    deckActions(ability).forEach((action, i) => {
      if (action.id && carriedActionIds.has(action.id)) return
      if (grantsCompanion && action.actionType === undefined) return
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
