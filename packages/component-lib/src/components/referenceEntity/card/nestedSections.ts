/**
 * Which NESTED sections a card carries, and what goes in each — pure, split out
 * of `ReferenceEntityCard.tsx` (audit PK-08). The card renders what this
 * returns; nothing here renders.
 */

import type {
  SURefEntity,
  SURefEnumSchemaName,
  SURefMetaEntity,
  SURefObjectPattern,
} from 'salvageunion-reference'
import { extractVisibleActions, getChassisAbilities, visiblePatterns } from 'salvageunion-reference'
import { isTitanicAction, MAX_DEPTH } from './cardHelpers'
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
  depth,
  isGrantingAbility,
  foldedAction,
  droneLoadout,
}: {
  entity: SURefMetaEntity
  schemaName: SURefEnumSchemaName | 'actions'
  /** Set on a PATTERN view, whose `entity` is the chassis. */
  pattern: SURefObjectPattern | undefined
  isCatalog: boolean
  depth: number
  /** A granting ability's own actions belong to the granted entity. */
  isGrantingAbility: boolean
  /** The action folded into the body — every OTHER action gets its own card. */
  foldedAction: { name?: string } | undefined
  /** A parent-resolved loadout for THIS card, when it is a drone. */
  droneLoadout: { systems: SURefEntity[]; modules: SURefEntity[] } | undefined
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
  // `getChassisAbilities`), NOT the pilot-abilities schema — the earlier lookup
  // missed them entirely. They render for both the basic chassis AND the
  // pattern view (a pattern's `entity` IS its chassis), so gate on `canExpand`,
  // not `canExpandEntity` (which excludes patterns).
  const chassisAbilityEntities = canExpand ? (getChassisAbilities(entity) ?? []) : []
  const allActions =
    canExpandEntity && !isGrantingAbility ? (extractVisibleActions(entity) ?? []) : []

  // PATTERN view: the chosen pattern's systems/modules loadout (its drones render
  // as drone cards instead). BASIC chassis: the list of patterns. In the body, a
  // pattern is always the FULL view (a listing row returns before the body).
  const patternGroups = pattern
    ? resolvePatternGroups(pattern).filter((group) => group.label !== 'Drones')
    : []
  const patternList: SURefObjectPattern[] =
    !isPattern && !isCatalog && 'patterns' in entity && Array.isArray(entity.patterns)
      ? visiblePatterns(entity.patterns)
      : []

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

  // THIS card's own drone loadout (when it IS a drone): the parent-provided
  // `droneLoadout`, else the drone's own systems/modules. Rendered as listings
  // INSIDE this card's body — never leaked to the parent (chassis) body.
  const ownDroneLoadout =
    droneLoadout ??
    (schemaName === 'drones' && canExpand ? resolveDroneOwnLoadout(entity) : undefined)

  return {
    canExpand,
    nestedGroups,
    chassisAbilityEntities,
    patternGroups,
    patternList,
    titanicActions,
    gridActions,
    droneInfos,
    droneSystems: ownDroneLoadout?.systems ?? [],
    droneModules: ownDroneLoadout?.modules ?? [],
  }
}
