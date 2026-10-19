/**
 * PARITY: `toEntityModel` (salvageunion-reference `lib/view/`) against the
 * card's own helpers, for EVERY entity in every entity schema and every
 * chassis pattern — the entity display language's model
 * (`docs/design-system/entity-display-language.md`).
 *
 * The model is the one place an entity is resolved; these helpers are what
 * `ReferenceEntityCard` computes per render today. Where a helper now reads
 * the model, this test pins the wiring; where it still computes its own
 * answer, it pins agreement. It lives here rather than in the package
 * because the dependency runs one way (src/components reads the package).
 */

import { describe, expect, test } from 'bun:test'
import type {
  EntityModel,
  RefEntity,
  RefEnumSchemaName,
  RefMetaEntity,
  RefObjectAnyPattern,
  RefObjectTable,
} from 'salvageunion-reference'
import {
  EntitySchemaNames,
  extractVisibleActions,
  firstParagraphText,
  foldedActionOf,
  formatActionType,
  getAssetUrl,
  getChoices,
  getModel,
  getPatterns,
  getReferenceEntityName,
  getTechLevel,
  isAbility,
  isTitanicAction,
  plainTraitText,
  resolveGrantedEntities,
  resolveTable,
  toEntityModel,
} from 'salvageunion-reference'
import { actionTypeStamps, costCell } from '../../entity'
import type { EntityRelation } from '../card/abilityTreeRelations'
import { abilityTreeRelations } from '../card/abilityTreeRelations'
import { buildHeaderStats, resolveSubHeaderCells, resolveTechScaling } from '../card/cardCells'
import { resolveHeaderFill, resolveHeaderHint } from '../card/cardChrome'
import { resolveCatalogLeadBlocks } from '../card/catalogLead'
import { resolveCardTone } from '../card/entityCardTone'
import { resolveEntityPageMeta } from '../card/entityPage'
import { resolveNestedSections } from '../card/nestedSections'
import type { ActionFields } from '../card/referenceEntityCardTypes'
import { resolveGuideLead } from '../card/resolveGuideLead'
import {
  resolveDroneOwnLoadout,
  resolveNestedEntities,
  resolvePatternGroups,
} from '../card/resolveNestedEntities'
import { buildReferenceEntityStats } from '../referenceEntityStatsConfig'

type Schema = RefEnumSchemaName | 'actions'

const ENTITIES = [...EntitySchemaNames].flatMap((schemaName) =>
  (getModel(schemaName)?.all() ?? []).map((entity) => ({
    schemaName: schemaName as Schema,
    entity: entity as RefMetaEntity,
  }))
)

const nameOf = (entity: RefMetaEntity) =>
  getReferenceEntityName(entity) ?? ('name' in entity ? String(entity.name) : '')

const label = ({ schemaName, entity }: { schemaName: Schema; entity: RefMetaEntity }) =>
  `${schemaName}/${nameOf(entity) || entity.id}`

/** One assertion, labelled with the entity it is about so a failure names it. */
function agree(id: string, actual: unknown, expected: unknown): void {
  expect({ id, value: actual }).toEqual({ id, value: expected })
}

/** The self-action the card folds in, computed as `ReferenceEntityCard` does. */
function cardFoldedAction(schemaName: Schema, entity: RefMetaEntity) {
  if (schemaName === 'actions') return undefined
  if (isAbility(entity) && resolveGrantedEntities(entity as never).length > 0) return undefined
  const foldable = (extractVisibleActions(entity) ?? []).filter((a) => !isTitanicAction(a))
  return foldedActionOf(foldable, nameOf(entity))
}

/** The theme token a card tone paints, read back out of its colour. */
function toneToken(tone: { bg: string | undefined; bgColor: string | undefined }) {
  return (tone.bgColor ?? tone.bg)?.match(/^var\(--color-(.+)\)$/)?.[1]
}

/** How many of the model's facts are the head's: Tech Level and the stats. */
function headFactCount(model: EntityModel): number {
  return model.facts.filter((f) => f.key === 'tech-level' || f.key.startsWith('ref-stat-')).length
}

/** The page meta a model states, in `resolveEntityPageMeta`'s shape. */
function pageMetaOf(model: EntityModel, relations: EntityRelation[] = []) {
  // The band carries every chip: stats, action type, facts, traits and cost.
  const cost = model.cost ? costCell(model.cost) : undefined
  return {
    // The kind: the title's screen-reader text (never on a foot, E9).
    typeLabel: model.kind.stamp,
    techLevel: model.techLevel != null ? String(model.techLevel) : undefined,
    // The band's stats: every book stat but a chassis's, which lead its body
    // (all but its Tech Level, which rides the band).
    stats: (model.ref.schemaName === 'chassis'
      ? model.bookStats.filter((fact) => fact.key === 'tech-level')
      : model.bookStats
    ).map((fact) => ({
      key: fact.key,
      label: fact.label,
      value: fact.value,
      ...(fact.group ? { group: fact.group } : {}),
      ...(fact.hint ? { hoverText: fact.hint } : {}),
    })),
    numeral: model.tier,
    actionTypes: actionTypeStamps(model.actionType, model.mechActionType),
    // The facts past the head's (Tech Level and the stats), label first.
    facts: model.facts
      .filter((f) => f.key !== 'tech-level' && !f.key.startsWith('ref-stat-'))
      .map((f) => ({
        key: f.key,
        label: f.short,
        value: f.value,
        ...(f.group ? { group: f.group } : {}),
        ...(f.hint ? { hoverText: f.hint } : {}),
      })),
    tags: model.traits.map((t) => ({
      key: `${t.schemaName}-${t.name}`,
      name: t.name,
      ...(t.param !== undefined ? { param: t.param } : {}),
      schemaName: t.schemaName,
      ...(t.ref ? { ref: t.ref } : {}),
    })),
    ...(cost
      ? { cost: { value: cost.value ?? cost.label, currency: cost.value ? cost.label : '' } }
      : {}),
    // An ability's tree and its neighbours: the data's, not the model's.
    relations,
    printings: model.cite.printings,
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
      agree(label(row), resolveHeaderFill(entity), doFill)
      // A Peek's card wears the fill of the Token or Row that opened it: an
      // ability's, its tier tone (E12).
      const rowFill = schemaName === 'abilities' ? 'tone' : doFill
      agree(label(row), resolveHeaderFill(entity, true), rowFill)
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
    // before it did (`resolveHeaderHint`'s hint, else the first paragraph),
    // then what the catalog card borrows: a step-only guide's first step
    // (`resolveGuideLead`), then a grant's or an action's opening paragraph
    // (`resolveCatalogLeadBlocks`).
    for (const row of ENTITIES) {
      const { schemaName, entity } = row
      const { hintText } = resolveHeaderHint(entity, {
        isTitanicMeta: schemaName === 'actions' && isTitanicAction(entity as { name?: string }),
      })
      const lead =
        hintText ||
        firstParagraphText('content' in entity ? entity.content : undefined) ||
        resolveGuideLead(entity) ||
        String(resolveCatalogLeadBlocks(entity as RefEntity)[0]?.value ?? '')
      agree(label(row), toEntityModel(entity).lead, lead ? plainTraitText(lead) : undefined)
    }
  })

  test('page meta agrees with resolveEntityPageMeta', () => {
    for (const row of ENTITIES) {
      const model = toEntityModel(row.entity)
      const meta = resolveEntityPageMeta(row.entity)
      agree(label(row), pageMetaOf(model, abilityTreeRelations(row.entity)), meta)
    }
  })

  test('art agrees with getAssetUrl: the image, or none', () => {
    for (const row of ENTITIES) {
      const { art } = toEntityModel(row.entity)
      const url = getAssetUrl(row.entity)
      agree(label(row), art, url ? { kind: 'image', url } : { kind: 'none' })
    }
  })

  test('children, actions, abilities and table agree with the nested sections', () => {
    for (const row of ENTITIES) {
      const { schemaName, entity } = row
      const model = toEntityModel(entity)
      const droneLoadout =
        schemaName === 'drones' || schemaName === 'vehicles'
          ? resolveDroneOwnLoadout(entity)
          : undefined
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
        // The model is the PAGE's: a chassis ability shows only there.
        onPage: true,
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
      const table = resolveTable(entity) ?? resolveTable(folded)
      const shape = (t: RefObjectTable | undefined) =>
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
    const patterns: RefObjectAnyPattern[] = getPatterns(chassis) ?? []
    return patterns.map((pattern) => ({ chassis: chassis as RefMetaEntity, pattern }))
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
