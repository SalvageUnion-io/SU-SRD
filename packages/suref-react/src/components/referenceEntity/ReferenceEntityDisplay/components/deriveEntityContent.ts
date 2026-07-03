/**
 * Pure derivations for ReferenceEntityDisplayContent (audit item 21).
 *
 * Everything here is plain data-in/data-out — no hooks, no JSX — extracted so
 * the card body reads as composition and these rules are unit-testable. Each
 * function documents the display rule it encodes; the rules themselves are
 * unchanged from the pre-decomposition component.
 */

import type { SURefEntity, SURefEnumSchemaName, SURefMetaAction } from 'salvageunion-reference'
import { SalvageUnionReference, getModel } from 'salvageunion-reference'

type ContentBlock = {
  type?: string
  lead?: boolean
}

/**
 * The entity a footer's source/page/booklet should read from. Actions carry no
 * own source/page — they derive it from the same-named entry in their
 * `actionSource` schema (e.g. the source ability). Returns the entity itself
 * when it already has a source or can't be resolved.
 */
export function resolveFooterEntity(data: SURefEntity): SURefEntity {
  const hasOwnSource = 'source' in data && !!data.source
  const actionSource = 'actionSource' in data ? data.actionSource : undefined
  if (hasOwnSource || typeof actionSource !== 'string' || !('name' in data)) {
    return data
  }
  const model = getModel(actionSource)
  const parent = model?.find((e: SURefEntity) => 'name' in e && e.name === data.name)
  return parent ?? data
}

/**
 * Resolve the content blocks the body renders, applying the display rules in
 * order: hide.content suppression → same-named-action override (skipped for
 * choice-bearing entities, whose action prose is legacy-verbose) → static
 * datavalues suppression when choices render the resolved row instead →
 * `lead` suppression when nested in a grant → compact-list truncation at the
 * first heading.
 */
export function deriveContentBlocks<T extends ContentBlock>(options: {
  data: SURefEntity
  hideContent: boolean
  hideActions: boolean
  compact: boolean
  entityHasChoices: boolean
  matchingAction: SURefMetaAction | undefined
  hideLeadContent: boolean
}): T[] | undefined {
  const { data, hideContent, hideActions, compact, entityHasChoices, matchingAction } = options
  let contentBlocks = hideContent
    ? undefined
    : 'content' in data
      ? (data.content as T[] | undefined)
      : undefined

  if (
    !hideContent &&
    !entityHasChoices &&
    matchingAction &&
    matchingAction.content &&
    matchingAction.content.length > 0
  ) {
    contentBlocks = matchingAction.content as T[]
  }

  if (contentBlocks && entityHasChoices) {
    contentBlocks = contentBlocks.filter((block) => block.type !== 'datavalues')
  }

  if (contentBlocks && options.hideLeadContent) {
    contentBlocks = contentBlocks.filter((block) => block.lead !== true)
  }

  if (contentBlocks && compact && hideActions) {
    const firstHeadingIndex = contentBlocks.findIndex((block) => block.type === 'heading')
    if (firstHeadingIndex > 0) {
      contentBlocks = contentBlocks.slice(0, firstHeadingIndex)
    }
  }

  return contentBlocks
}

type TitanicStatblock = {
  /** Bio-Titans and drone-class bosses with a mech-style statblock. */
  isTitanicStatblock: boolean
  statblockSystems: SURefEntity[] | undefined
  statblockModules: SURefEntity[] | undefined
  hasStatblockEquipment: boolean
}

/**
 * "Titanic" treatment: full-width actions plus equipped systems/modules as
 * inline compact listings; the actions section is suppressed in compact
 * listings. Gated on data shape (actions + equipment arrays) rather than a
 * lone schema name — the mechanic is not Bio-Titan-specific (the Iron Lady
 * lives in `drones`); the explicit bio-titans check remains as the historical
 * belt for entries without equipment arrays.
 */
export function deriveTitanicStatblock(
  data: SURefEntity,
  schemaName: SURefEnumSchemaName
): TitanicStatblock {
  const hasEquippedActions =
    'actions' in data &&
    Array.isArray((data as { actions?: unknown }).actions) &&
    (('systems' in data && Array.isArray(data.systems)) ||
      ('modules' in data && Array.isArray(data.modules)))
  const isTitanicStatblock = schemaName === 'bio-titans' || hasEquippedActions

  const statblockSystemNames =
    isTitanicStatblock && 'systems' in data && Array.isArray(data.systems)
      ? (data.systems as string[])
      : undefined
  const statblockModuleNames =
    isTitanicStatblock && 'modules' in data && Array.isArray(data.modules)
      ? (data.modules as string[])
      : undefined
  const statblockSystems = statblockSystemNames
    ?.map((name) => SalvageUnionReference.findIn('systems', (s) => s.name === name))
    .filter((entity): entity is NonNullable<typeof entity> => !!entity)
  const statblockModules = statblockModuleNames
    ?.map((name) => SalvageUnionReference.findIn('modules', (m) => m.name === name))
    .filter((entity): entity is NonNullable<typeof entity> => !!entity)

  return {
    isTitanicStatblock,
    statblockSystems: statblockSystems as SURefEntity[] | undefined,
    statblockModules: statblockModules as SURefEntity[] | undefined,
    hasStatblockEquipment:
      (!!statblockSystems && statblockSystems.length > 0) ||
      (!!statblockModules && statblockModules.length > 0),
  }
}
