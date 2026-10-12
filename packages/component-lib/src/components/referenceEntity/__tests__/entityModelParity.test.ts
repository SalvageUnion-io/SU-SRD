/**
 * PARITY: `toEntityModel` (salvageunion-reference `lib/view/`) against the
 * card's own helpers, for EVERY entity in every entity schema and every
 * chassis pattern — phase 1 of the entity display language
 * (`docs/design-system/entity-display-language.md`).
 *
 * The model is the one place an entity is resolved; these helpers are what
 * `ReferenceEntityCard` computes per render today. Where a helper now reads
 * the model, this test pins the wiring; where it still computes its own
 * answer, it pins agreement. It lives here rather than in the package
 * because the dependency runs one way (component-lib reads the package).
 */

import { describe, expect, test } from 'bun:test'
import type {
  EntityModel,
  SURefEnumSchemaName,
  SURefMetaEntity,
  SURefObjectPattern,
  SURefObjectTable,
} from 'salvageunion-reference'
import {
  EntitySchemaNames,
  extractVisibleActions,
  firstParagraphText,
  getAssetUrl,
  getChoices,
  getModel,
  getPageReference,
  getReferenceEntityName,
  getTechLevel,
  isAbility,
  missingArt,
  plainTraitText,
  resolveGrantedEntities,
  toEntityModel,
  visiblePatterns,
} from 'salvageunion-reference'
import {
  buildHeaderStats,
  formatActionType,
  resolveSubHeaderCells,
  resolveTechScaling,
} from '../card/cardCells'
import { resolveHeaderFill, resolveHeaderHint } from '../card/cardChrome'
import { isTitanicAction } from '../card/cardHelpers'
import { resolveCardTone } from '../card/entityCardTone'
import { resolveEntityPageMeta } from '../card/entityPage'
import { resolveNestedSections } from '../card/nestedSections'
import type { ActionFields } from '../card/referenceEntityCardTypes'
import { resolveCardTable } from '../card/resolveCardTable'
import { resolveFoldedAction } from '../card/resolveFoldedAction'
import {
  resolveDroneOwnLoadout,
  resolveNestedEntities,
  resolvePatternGroups,
} from '../card/resolveNestedEntities'
import { buildBookStats, buildReferenceEntityStats } from '../referenceEntityStatsConfig'

type Schema = SURefEnumSchemaName | 'actions'

const ENTITIES = [...EntitySchemaNames].flatMap((schemaName) =>
  (getModel(schemaName)?.all() ?? []).map((entity) => ({
    schemaName: schemaName as Schema,
    entity: entity as SURefMetaEntity,
  }))
)

const nameOf = (entity: SURefMetaEntity) =>
  getReferenceEntityName(entity) ?? ('name' in entity ? String(entity.name) : '')

const label = ({ schemaName, entity }: { schemaName: Schema; entity: SURefMetaEntity }) =>
  `${schemaName}/${nameOf(entity) || entity.id}`

/** One assertion, labelled with the entity it is about so a failure names it. */
function agree(id: string, actual: unknown, expected: unknown): void {
  expect({ id, value: actual }).toEqual({ id, value: expected })
}

/** The self-action the card folds in, computed as `ReferenceEntityCard` does. */
function cardFoldedAction(schemaName: Schema, entity: SURefMetaEntity) {
  if (schemaName === 'actions') return undefined
  if (isAbility(entity) && resolveGrantedEntities(entity as never).length > 0) return undefined
  const foldable = (extractVisibleActions(entity) ?? []).filter((a) => !isTitanicAction(a))
  return resolveFoldedAction(foldable, nameOf(entity))
}

/** The schemas that keep an art place: any entity in them has artwork. */
const SCHEMAS_WITH_ART = new Set(
  [...EntitySchemaNames].filter((s) => (getModel(s)?.all() ?? []).some((e) => !!getAssetUrl(e)))
)

/**
 * The censor mark each art-less entity should wear, re-derived: a schema's
 * art-less run, by tech level then book order, takes file / row / removed in
 * turn (the rule `MissingArt.test.tsx` states).
 */
const EXPECTED_MARK = new Map<SURefMetaEntity, string>(
  [...SCHEMAS_WITH_ART].flatMap((schemaName) => {
    const tier = (e: SURefMetaEntity) => {
      const level = getTechLevel(e)
      return typeof level === 'number' ? level : 0
    }
    const run = (getModel(schemaName)?.all() ?? [])
      .filter((e) => !getAssetUrl(e))
      .sort((a, b) => tier(a) - tier(b))
    return run.map((e, i): [SURefMetaEntity, string] => [
      e,
      ['file', 'row', 'removed'][i % 3] ?? '',
    ])
  })
)

/** The theme token a card tone paints, read back out of its class or colour. */
function toneToken(tone: { bg: string | undefined; bgColor: string | undefined }) {
  if (tone.bgColor) return tone.bgColor.match(/^var\(--color-(.+)\)$/)?.[1]
  return tone.bg?.replace(/^bg-/, '')
}

/** How many of the model's facts are the head's: Tech Level and the stats. */
function headFactCount(model: EntityModel): number {
  return model.facts.filter((f) => f.key === 'tech-level' || f.key.startsWith('ref-stat-')).length
}

/** The page meta a model states, in `resolveEntityPageMeta`'s shape. */
function pageMetaOf(model: EntityModel) {
  return {
    typeLabel: model.kind.stamp,
    techLevel: model.techLevel != null ? String(model.techLevel) : undefined,
    numeral: model.tier,
    cost: model.cost,
    page: model.cite.page,
    citation: model.cite.citation,
  }
}

describe('toEntityModel parity, every entity', () => {
  test('covers every entity schema', () => {
    expect(ENTITIES.length).toBeGreaterThan(1000)
  })

  test('kind, tone and fill agree with the card chrome', () => {
    for (const row of ENTITIES) {
      const { schemaName, entity } = row
      const model = toEntityModel(entity)
      // An action has no tone of its own: the model names it `ink`.
      const tone = resolveCardTone(schemaName, entity)
      agree(label(row), model.tone, schemaName === 'actions' ? 'ink' : toneToken(tone))
      const doFill = model.kind.nature === 'do' ? 'ink' : 'tone'
      agree(label(row), resolveHeaderFill(entity, 'full'), doFill)
      agree(label(row), resolveHeaderFill(entity, 'head'), isAbility(entity) ? 'tone' : doFill)
    }
  })

  test('head facts agree with buildHeaderStats and the full-size labels', () => {
    for (const row of ENTITIES) {
      const { schemaName, entity } = row
      const model = toEntityModel(entity)
      const techLevel = getTechLevel(entity)
      const cells = buildHeaderStats({
        entity,
        schemaName,
        asCompact: true,
        none: schemaName === 'actions',
        primaryOnly: false,
        techLevel,
        techLevelDisplay: techLevel,
        techLevelModified: false,
      })
      const head = model.facts.slice(0, headFactCount(model))
      agree(
        label(row),
        head.map((f) => [f.key, f.short, f.value]),
        cells.map((c) => [c.key, c.label, c.value])
      )
      if (schemaName === 'actions') continue
      const full = buildReferenceEntityStats(entity, { compact: false, schemaName, techLevel })
      agree(
        label(row),
        head.filter((f) => f.key !== 'tech-level').map((f) => f.label),
        full.map((s) => `${s.label} ${s.bottomLabel}`)
      )
    }
  })

  test('book stats agree with buildBookStats', () => {
    for (const row of ENTITIES) {
      const { schemaName, entity } = row
      if (schemaName === 'actions') continue
      const expected = buildBookStats(entity, { techLevel: getTechLevel(entity), schemaName })
      agree(
        label(row),
        toEntityModel(entity).bookStats.map((f) => [f.key, f.label, f.value, f.hint]),
        expected.map((s) => [s.key, s.label, s.value, s.hoverText])
      )
    }
  })

  test('action type, facets and traits together are the sub-header cells (E17)', () => {
    for (const row of ENTITIES) {
      const { schemaName, entity } = row
      const model = toEntityModel(entity)
      const choices = getChoices(entity) ?? []
      const { perTechLevelByLabel, effTechLevel } = resolveTechScaling(
        entity,
        getTechLevel(entity),
        choices,
        undefined
      )
      const cells = resolveSubHeaderCells({
        entity,
        entityName: nameOf(entity),
        action: schemaName === 'actions' ? (entity as ActionFields) : undefined,
        foldedAction: cardFoldedAction(schemaName, entity),
        entityChoices: choices,
        selections: undefined,
        perTechLevelByLabel,
        effTechLevel,
      })
      const typeCells = cells.filter((c) => c.key.startsWith('action-type'))
      const ruleCells = cells.filter((c) => c.entityRef)
      const factCells = cells.filter((c) => !c.entityRef && !c.key.startsWith('action-type'))

      const expectedTypes = model.mechActionType
        ? [
            `${formatActionType(model.mechActionType)} (Mech)`,
            `${formatActionType(model.actionType ?? '')} (Pilot)`,
          ]
        : model.actionType
          ? [formatActionType(model.actionType)]
          : []
      agree(
        label(row),
        typeCells.map((c) => c.label),
        expectedTypes
      )
      agree(
        label(row),
        model.facts.slice(headFactCount(model)).map((f) => [f.key, f.label, f.value]),
        factCells.map((c) => [c.key, c.label, c.value ?? ''])
      )
      agree(
        label(row),
        model.traits.map((t) => [t.name, t.param, t.schemaName]),
        ruleCells.map((c) => [c.label, c.value, c.entityRef?.schemaName])
      )
      // A resolved glossary entry is the one the cell names, case aside.
      for (const [index, trait] of model.traits.entries()) {
        if (trait.ref) {
          agree(
            label(row),
            trait.ref.name.toLowerCase(),
            ruleCells[index]?.entityRef?.name.toLowerCase()
          )
        }
      }
    }
  })

  test('lead is the card header hint, else the first paragraph, as plain text', () => {
    // The Row's lead is the model's; this is the formula the compact card used
    // before it did (`resolveHeaderHint`'s hint, else the first paragraph).
    for (const row of ENTITIES) {
      const { schemaName, entity } = row
      const { hintText } = resolveHeaderHint(entity, {
        isTitanicMeta: schemaName === 'actions' && isTitanicAction(entity as { name?: string }),
        patternListingContent: undefined,
      })
      const lead = hintText || firstParagraphText('content' in entity ? entity.content : undefined)
      agree(label(row), toEntityModel(entity).lead, lead ? plainTraitText(lead) : undefined)
    }
  })

  test('page meta agrees with resolveEntityPageMeta', () => {
    for (const row of ENTITIES) {
      const model = toEntityModel(row.entity)
      const meta = resolveEntityPageMeta(row.entity)
      // KNOWN BUG, kept until the Page form (phase 5): a GRANTING ability's
      // self-named action belongs to the item it grants (Camo Suit, Knife
      // Missile, Wingsuit…), so its card folds nothing and shows no pennant,
      // and the model follows the card. Today's page band still prints that
      // action's cost on the ability. Every other field agrees.
      if (isAbility(row.entity) && resolveGrantedEntities(row.entity as never).length > 0) {
        agree(label(row), { ...pageMetaOf(model), cost: meta.cost }, meta)
        continue
      }
      agree(label(row), pageMetaOf(model), meta)
    }
  })

  test('art agrees with getAssetUrl and the missing-art mark', () => {
    for (const row of ENTITIES) {
      const { schemaName, entity } = row
      const { art } = toEntityModel(entity)
      const url = getAssetUrl(entity)
      if (url) {
        agree(label(row), art, { kind: 'image', url })
      } else if (SCHEMAS_WITH_ART.has(schemaName as never)) {
        const page = String(getPageReference(entity) ?? 0).padStart(3, '0')
        agree(label(row), art, {
          kind: 'missing',
          variant: EXPECTED_MARK.get(entity) ?? 'unranked',
          code: `UNION_ARCHIVE._${page}`,
          short: `P.${page}`,
          seed: art.kind === 'missing' ? art.seed : undefined,
        })
        agree(label(row), missingArt(entity), art)
      } else {
        agree(label(row), art, { kind: 'none' })
      }
    }
  })

  test('children, actions, abilities and table agree with the nested sections', () => {
    for (const row of ENTITIES) {
      const { schemaName, entity } = row
      const model = toEntityModel(entity)
      const droneLoadout = schemaName === 'drones' ? resolveDroneOwnLoadout(entity) : undefined
      const expectedGroups = [
        ...resolveNestedEntities(entity).map((g) => [g.label, g.entities.map(nameOf)]),
        ...(droneLoadout && droneLoadout.systems.length > 0
          ? [['Systems', droneLoadout.systems.map(nameOf)]]
          : []),
        ...(droneLoadout && droneLoadout.modules.length > 0
          ? [['Modules', droneLoadout.modules.map(nameOf)]]
          : []),
      ]
      agree(
        label(row),
        model.children.map((g) => [g.label, g.items.map((i) => i.name)]),
        expectedGroups
      )

      const folded = cardFoldedAction(schemaName, entity)
      agree(label(row), model.folded?.id, folded?.id)
      const sections = resolveNestedSections({
        entity,
        schemaName,
        pattern: undefined,
        isCatalog: false,
        depth: 0,
        isGrantingAbility: isAbility(entity) && resolveGrantedEntities(entity as never).length > 0,
        foldedAction: folded,
        droneLoadout: undefined,
      })
      agree(
        label(row),
        model.actions.map((a) => a.id).sort(),
        [...sections.gridActions, ...sections.titanicActions].map((a) => a.id).sort()
      )
      agree(
        label(row),
        model.abilities.map((a) => a.id),
        sections.chassisAbilityEntities.map((a) => a.id)
      )

      // The same table, and drawn as bands unless it is a two-roll table.
      const table = resolveCardTable(entity) ?? resolveCardTable(folded)
      const shape = (t: SURefObjectTable | undefined) =>
        t ? [t.type === 'columns' ? 'columns' : 'bands', t] : undefined
      agree(
        label(row),
        model.table
          ? [model.table.kind, model.table.kind === 'columns' ? model.table.table : table]
          : undefined,
        shape(table)
      )
    }
  })
})

describe('toEntityModel parity, every chassis pattern', () => {
  const PATTERNS = (getModel('chassis')?.all() ?? []).flatMap((chassis) => {
    const patterns: SURefObjectPattern[] =
      'patterns' in chassis && Array.isArray(chassis.patterns)
        ? visiblePatterns(chassis.patterns)
        : []
    return patterns.map((pattern) => ({ chassis: chassis as SURefMetaEntity, pattern }))
  })

  test('names its chassis as parent, with page meta and loadout as the card resolves them', () => {
    expect(PATTERNS.length).toBeGreaterThan(50)
    for (const { chassis, pattern } of PATTERNS) {
      const id = `${nameOf(chassis)}/${pattern.name}`
      const model = toEntityModel(chassis, undefined, { pattern })
      agree(id, [model.parent?.label, model.parent?.ref.id], ['Pattern of', chassis.id])
      agree(id, model.title, pattern.name)
      agree(id, pageMetaOf(model), resolveEntityPageMeta(chassis, pattern))
      agree(
        id,
        model.children.map((g) => [g.label, g.items.map((i) => i.name)]),
        resolvePatternGroups(pattern).map((g) => [g.label, g.entities.map(nameOf)])
      )
    }
  })
})
