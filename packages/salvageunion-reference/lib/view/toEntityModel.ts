/**
 * `toEntityModel` — an entity (and a player's instance of it) resolved ONCE
 * into everything a form draws. Pure: no React, no DOM, no CSS. The agreed
 * language is `docs/design-system/entity-display-language.md`.
 */

import {
  extractPatternActions,
  extractVisibleActions,
  getChassisAbilities,
  getChoices,
} from '../actionResolution.js'
import { getAssetUrl } from '../assets.js'
import { getReferenceEntityName, getTechLevel } from '../entityFields.js'
import type { EntitySchemaName } from '../generated/schemaRegistry.generated.js'
import { resolveActivationCurrency } from '../helpers.js'
import { SalvageUnionReference } from '../index.js'
import { nameToSlug } from '../nameToSlug.js'
import type {
  SURefEntity,
  SURefEnumSchemaName,
  SURefMetaEntity,
  SURefObjectAnyPattern,
  SURefObjectContentBlock,
} from '../schemas/index.js'
import { getEntitySlug } from '../slug.js'
import { plainTraitText } from '../traitText.js'
import { entityArt } from './parts/art.js'
import type { NestedGroup } from './parts/children.js'
import {
  droneOwnLoadout,
  entityActions,
  nestedEntityGroups,
  patternGroups,
} from './parts/children.js'
import { entityCite } from './parts/cite.js'
import { bookStats, entityStats, techLevelFact } from './parts/facts.js'
import { entityTone } from './parts/fill.js'
import {
  classKind,
  entityStamp,
  entityTypeLabel,
  isDoEntity,
  schemaDomain,
  tierNumeral,
} from './parts/kind.js'
import { entityLead, firstParagraphText } from './parts/lead.js'
import { entityTable } from './parts/table.js'
import type { ActionFacets, FacetCell } from './parts/traits.js'
import { facetCells, formatCost, perTechLevelByLabel } from './parts/traits.js'
import type {
  EntityChildGroup,
  EntityInstance,
  EntityModel,
  EntityRef,
  Fact,
  TraitMention,
} from './types.js'

function schemaNameOf(entity: SURefMetaEntity): EntitySchemaName | undefined {
  return 'schemaName' in entity && typeof entity.schemaName === 'string'
    ? (entity.schemaName as EntitySchemaName)
    : undefined
}

/** An entity as a ref. A record with no `id` is synthetic, never linked. */
function refOf(entity: SURefMetaEntity, parentId?: string): EntityRef {
  const schemaName = schemaNameOf(entity) ?? 'npcs'
  const name = getReferenceEntityName(entity) ?? ('name' in entity ? String(entity.name) : '')
  const id = typeof entity.id === 'string' ? entity.id : ''
  if (!id) {
    const slug = nameToSlug(name)
    return { schemaName, id: `${parentId ?? ''}/${slug}`, slug, name, synthetic: true }
  }
  return { schemaName, id, slug: getEntitySlug(entity as SURefEntity), name }
}

function groupsOf(groups: NestedGroup[], parentId: string): EntityChildGroup[] {
  return groups.map(({ label, entities }) => ({
    key: label.toLowerCase(),
    label,
    items: entities.map((child) => refOf(child, parentId)),
  }))
}

/** Split the facet line (E17): the action type, the facts, the named rules. */
function splitFacets(cells: FacetCell[]): {
  actionType?: string
  mechActionType?: string
  facts: Fact[]
  traits: TraitMention[]
} {
  const types = cells.filter((c) => c.kind === 'action-type')
  const mech = types.find((c) => c.key === 'action-type-mech')?.actionType
  const own = types.find((c) => c.key === 'action-type')?.actionType
  const facts = cells.flatMap((c): Fact[] =>
    c.kind === 'fact'
      ? [{ key: c.key, label: c.label, short: c.short ?? c.label, value: c.value ?? '' }]
      : []
  )
  const traits = cells.flatMap((c): TraitMention[] =>
    c.kind === 'trait' && c.mention
      ? [
          {
            name: c.label,
            ...(c.value !== undefined ? { param: c.value } : {}),
            schemaName: c.mention.schemaName,
            ...glossaryRef(c.mention.schemaName, c.mention.name),
          },
        ]
      : []
  )
  return {
    ...(own ? { actionType: own } : {}),
    ...(mech ? { mechActionType: mech } : {}),
    facts,
    traits,
  }
}

/** A glossary entry by name: exact, else lower-cased (the glossaries store
 * lower-case names; a datavalue prints its rule capitalised). */
function glossaryRef(schemaName: 'traits' | 'keywords', name: string): { ref?: EntityRef } {
  if (!SalvageUnionReference.isLoaded(schemaName)) return {}
  const entry =
    SalvageUnionReference.getByNameIn(schemaName, name) ??
    SalvageUnionReference.getByNameIn(schemaName, name.toLowerCase())
  return entry ? { ref: refOf(entry) } : {}
}

/**
 * Resolve an entity — or, with `view.pattern`, one of a chassis's patterns —
 * into its model. `instance` changes identity only where a player's copy
 * does: its title and whether it is user-made.
 */
export function toEntityModel(
  entity: SURefMetaEntity,
  instance?: EntityInstance,
  view?: { pattern?: SURefObjectAnyPattern }
): EntityModel {
  const pattern = view?.pattern
  const schemaName = (schemaNameOf(entity) ?? 'npcs') as SURefEnumSchemaName | 'actions'
  const isAction = schemaName === 'actions'
  const entityName = getReferenceEntityName(entity) ?? ('name' in entity ? String(entity.name) : '')
  const baseRef = refOf(entity)
  const techLevel = getTechLevel(entity)
  const nature = !pattern && isDoEntity(entity) ? 'do' : 'have'

  // The folded self-action supplies the facets, cost and table an entity
  // states as its own; an action states its own.
  // A mech pattern's difference is its loadout (`children`); a Bio-Titan
  // pattern's is the actions it adds, ahead of the ones it inherits.
  const { folded, others } = pattern
    ? {
        folded: undefined,
        others: extractPatternActions(pattern).length
          ? [...extractPatternActions(pattern), ...(extractVisibleActions(entity) ?? [])]
          : [],
      }
    : entityActions(entity, entityName)
  const action = isAction ? (entity as ActionFacets) : undefined
  const costSource = action ?? (folded as ActionFacets | undefined)
  const cost =
    costSource?.activationCost != null
      ? formatCost(
          costSource.activationCost,
          resolveActivationCurrency(costSource.actionSource as SURefEnumSchemaName | undefined)
        )
      : undefined

  const baseTechLevel = typeof techLevel === 'number' ? techLevel : undefined
  const facets = splitFacets(
    pattern
      ? []
      : facetCells({
          entity,
          entityName,
          action,
          foldedAction: folded,
          choices: getChoices(entity) ?? [],
          perTechLevelByLabel: perTechLevelByLabel(entity),
          effTechLevel: baseTechLevel,
        })
  )
  const stats = isAction ? [] : entityStats(entity, { schemaName, techLevel })
  const facts: Fact[] = [
    ...(!isAction && techLevel != null ? [techLevelFact(techLevel)] : []),
    ...stats,
    ...facets.facts,
  ]

  const ownContent: SURefObjectContentBlock[] =
    'content' in entity && Array.isArray(entity.content) ? entity.content : []
  const children: EntityChildGroup[] = pattern
    ? groupsOf(patternGroups(pattern), baseRef.id)
    : [
        ...groupsOf(nestedEntityGroups(entity), baseRef.id),
        ...(schemaName === 'drones'
          ? groupsOf(
              Object.entries(droneOwnLoadout(entity)).flatMap(([key, entities]) =>
                entities.length > 0
                  ? [{ label: key === 'systems' ? 'Systems' : 'Modules', entities }]
                  : []
              ),
              baseRef.id
            )
          : []),
      ]
  const table = pattern ? undefined : entityTable(entity, folded, entityName)
  const patternLead = pattern ? firstParagraphText(pattern.content) : undefined
  const lead = pattern
    ? patternLead
      ? plainTraitText(patternLead)
      : undefined
    : entityLead(entity)
  const art = pattern
    ? (() => {
        const url = getAssetUrl(entity)
        return url ? { kind: 'image' as const, url } : { kind: 'none' as const }
      })()
    : entityArt(entity)
  const tier = tierNumeral(entity)
  const kindMarker = classKind(entity)
  const userMade = instance?.userMade
  const title = instance?.title ?? (pattern ? pattern.name : entityName)

  return {
    ref: pattern ? { ...baseRef, pattern: pattern.name } : baseRef,
    title,
    kind: {
      stamp: pattern ? 'Pattern' : entityStamp(schemaName, entity),
      type: pattern ? 'Pattern' : entityTypeLabel(schemaName),
      domain: isAction ? 'action' : (schemaDomain(schemaName) ?? 'glossary'),
      nature,
      ...(kindMarker ? { classKind: kindMarker } : {}),
    },
    tone: entityTone(schemaName, entity),
    ...(pattern ? { parent: { label: 'Pattern of', ref: baseRef } } : {}),
    ...(tier ? { tier } : {}),
    ...(techLevel != null ? { techLevel } : {}),
    ...(cost ? { cost } : {}),
    ...(facets.actionType ? { actionType: facets.actionType } : {}),
    ...(facets.mechActionType ? { mechActionType: facets.mechActionType } : {}),
    facts,
    bookStats: isAction ? [] : bookStats(entity, { schemaName, techLevel }),
    traits: facets.traits,
    ...(lead ? { lead } : {}),
    prose: pattern ? (pattern.content ?? []) : ownContent,
    ...(folded ? { folded: refOf(folded) } : {}),
    actions: others.map((a) => refOf(a)),
    abilities: (getChassisAbilities(entity) ?? []).map((a) => refOf(a)),
    children,
    ...(table ? { table } : {}),
    art,
    cite: entityCite(entity, pattern),
    ...(userMade ? { userMade } : {}),
  }
}
