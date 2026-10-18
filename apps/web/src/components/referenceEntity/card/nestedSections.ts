/**
 * Which NESTED sections a card carries, and what goes in each — pure, split out
 * of `ReferenceEntityCard.tsx`. The card renders what this
 * returns; nothing here renders.
 */

import type {
  RefEntity,
  RefEnumSchemaName,
  RefMetaAction,
  RefMetaEntity,
  RefObjectAnyPattern,
} from 'salvageunion-reference'
import {
  extractPatternActions,
  extractVisibleActions,
  getChassisAbilities,
  getPatterns,
  isTitanicAction,
  vehicleSystemNames,
} from 'salvageunion-reference'
import { MAX_DEPTH } from './cardHelpers'
import type { DroneLoadout } from './resolveNestedEntities'
import {
  resolveChassisDrone,
  resolveDroneOwnLoadout,
  resolveNestedEntities,
  resolvePatternDrones,
  resolvePatternGroups,
} from './resolveNestedEntities'

export function resolveNestedSections({
  entity,
  schemaName,
  pattern,
  isCatalog,
  onPage,
  showChassisAbility = false,
  depth,
  isGrantingAbility,
  foldedAction,
  droneLoadout,
}: {
  entity: RefMetaEntity
  schemaName: RefEnumSchemaName | 'actions'
  /** Set on a PATTERN view, whose `entity` is its host (chassis or Bio-Titan). */
  pattern: RefObjectAnyPattern | undefined
  isCatalog: boolean
  /** The card IS the page (`presentation="page"` at the top level). */
  onPage: boolean
  /** A builder pick card shows the chassis ability off the page too. */
  showChassisAbility?: boolean
  depth: number
  /** A granting ability's own actions belong to the granted entity. */
  isGrantingAbility: boolean
  /** The action folded into the body — every OTHER action gets its own card. */
  foldedAction: { name?: string } | undefined
  /** A parent-resolved loadout for THIS card, when it is a drone. */
  droneLoadout: { systems: RefEntity[]; modules: RefEntity[] } | undefined
}) {
  const isAction = schemaName === 'actions'
  const isPattern = !!pattern
  // Only entities expand (actions are leaves, pattern views show their loadout);
  // bounded by MAX_DEPTH. A catalog tile never expands — no nested entities,
  // chassis abilities or actions, whatever the entity carries.
  const canExpand = !isAction && !isCatalog && depth < MAX_DEPTH
  const canExpandEntity = canExpand && !isPattern
  const nestedGroups = canExpandEntity ? resolveNestedEntities(entity) : []
  // Chassis abilities are name refs into the ACTIONS schema (resolved by
  // `getChassisAbilities`), NOT the pilot-abilities schema. They show ONLY on a
  // page: the chassis page and its pattern pages (a pattern's `entity` IS its
  // chassis) — and on the app's builder pick cards (`showChassisAbility`); never on
  // any other card, a modal, a peek, a nested card or a pattern row.
  const chassisAbilityEntities =
    canExpand && (onPage || showChassisAbility) ? (getChassisAbilities(entity) ?? []) : []
  // A pattern view keeps its host's actions: a Bio-Titan pattern INHERITS them
  // (a chassis carries none, so its pattern view is unchanged).
  // A vehicle's items (`vehicleSystemNames`: every one it lists) are its cards,
  // the drone way, never an ACTIONS slab.
  const vehicleSystems = new Set(vehicleSystemNames(entity))
  const allActions =
    canExpand && !isGrantingAbility
      ? (extractVisibleActions(entity) ?? []).filter((a) => !vehicleSystems.has(a.name))
      : []

  // PATTERN view: the chosen pattern's systems/modules loadout (its drones render
  // as drone cards instead), or the actions a Bio-Titan pattern adds. BASIC
  // host: the list of patterns. In the body, a pattern is always the FULL view
  // (a listing row returns before the body).
  const patternGroups = pattern
    ? resolvePatternGroups(pattern).filter((group) => group.label !== 'Drones')
    : []
  const patternActions: RefMetaAction[] = pattern && canExpand ? extractPatternActions(pattern) : []
  const patternList: RefObjectAnyPattern[] =
    !isPattern && !isCatalog ? (getPatterns(entity) ?? []) : []

  // TITANIC actions always get their own full-width row (never the masonry).
  const titanicActions = allActions.filter(isTitanicAction)
  const normalActions = allActions.filter((a) => !isTitanicAction(a))
  // Every action EXCEPT the folded one renders as its own grid card — so a
  // multi-action entity keeps its siblings.
  const gridActions = foldedAction
    ? normalActions.filter((a) => a.name !== foldedAction.name)
    : normalActions

  // DRONE — a chassis controls a drone (named by a chassis ability); a pattern
  // specifies one. Rendered as a compact drone card just below the chassis
  // ability and above patterns/systems/modules. A pattern may field SEVERAL (Big
  // Brother's DronTek fields four); a chassis ability names exactly one. Both
  // collapse to a list so the render is uniform.
  const droneInfos: DroneLoadout[] = canExpand
    ? pattern
      ? resolvePatternDrones(pattern)
      : schemaName === 'chassis'
        ? [resolveChassisDrone(entity)].filter((d): d is DroneLoadout => d !== undefined)
        : []
    : []

  // THIS card's own drone loadout (when it IS a drone, or a vehicle): the
  // parent-provided `droneLoadout`, else its own systems/modules. Rendered as
  // listings INSIDE this card's body — never leaked to the parent (chassis) body.
  const ownDroneLoadout =
    droneLoadout ??
    ((schemaName === 'drones' || schemaName === 'vehicles') && canExpand
      ? resolveDroneOwnLoadout(entity)
      : undefined)

  return {
    canExpand,
    nestedGroups,
    chassisAbilityEntities,
    patternGroups,
    patternActions,
    patternList,
    titanicActions,
    gridActions,
    droneInfos,
    droneSystems: ownDroneLoadout?.systems ?? [],
    droneModules: ownDroneLoadout?.modules ?? [],
  }
}
