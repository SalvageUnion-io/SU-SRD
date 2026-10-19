import type {
  EntityModel,
  Fact,
  RefEnumSchemaName,
  RefMetaAction,
  RefMetaEntity,
  RefObjectAnyPattern,
  RefObjectContentBlock,
} from 'salvageunion-reference'
import {
  citeLine,
  extractVisibleActions,
  firstParagraphText,
  foldedActionOf,
  getReferenceEntityName,
  isAbility,
  splitStatLine,
  toEntityModel,
} from 'salvageunion-reference'
import { actionTypeStamps } from '../entity'
import { isDoEntity, resolveDomainTone } from '../referenceEntity/card/entityCardTone'
import type { OgCardProps, OgCardStat } from './ogCardText'

/**
 * A reference entity's link preview: the `thing` or `do` card
 * the SRD renders at build, one PNG per entity.
 *
 * Its chips are the entity model's (`toEntityModel`), the facts the Page and
 * every other form read, in E17's order: the action type as printed ("Turn
 * Action"), the facts (`TL | 1` first, `MODS | 2`, `RNG | Close`), the traits,
 * then the cost's pointy box. The tone (`resolveDomainTone`), have vs do by
 * data shape (`isDoEntity`), the tier numeral and the footer's provenance come
 * from the helpers the entity card uses, so the preview says what the page
 * says. Its foot cites every printing on one line (`citeLine`) and names no
 * kind, as the page's does (ruleset Source 2, E9).
 *
 * A chassis PATTERN is its own thing with its own page, so it takes its own
 * card: the pattern's name, the chassis's chips and tone, and the pattern's
 * own provenance.
 */
export function ogCardForEntity(options: {
  schemaName: RefEnumSchemaName
  entity: RefMetaEntity
  pattern?: RefObjectAnyPattern
  /** The address the foot prints: the page's bare path (`/chassis/scrapper`). */
  address: string
}): OgCardProps {
  const { schemaName, entity, pattern, address } = options
  const name = getReferenceEntityName(entity) ?? ('name' in entity ? String(entity.name) : '')
  const model = toEntityModel(entity, undefined, pattern ? { pattern } : undefined)
  const cite = citeLine(model.cite.printings)
  const stats = chipsOf(model)

  if (!pattern && isDoEntity(entity)) {
    return {
      kind: 'do',
      ...(isAbility(entity) ? { tone: toneOf(schemaName, entity) } : {}),
      kicker: model.kind.stamp,
      title: name,
      ...(model.tier ? { tier: model.tier } : {}),
      stats,
      ...(model.cost ? { cost: model.cost } : {}),
      rules: rulesText(entity, selfAction(entity, name)),
      cite,
      address,
    }
  }

  return {
    kind: 'thing',
    kicker: pattern ? `Pattern · ${name}` : model.kind.stamp,
    title: pattern ? pattern.name : name,
    tone: toneOf(schemaName, entity),
    stats,
    ...(model.cost ? { cost: model.cost } : {}),
    ...(cite ? { cite } : {}),
    address,
  }
}

/**
 * The model's chips in the stat order (E17), label first: the stats (TL
 * first), the action type as printed and the action's facets, by their short
 * labels, then the traits. The cost is the card's own.
 */
function chipsOf(model: EntityModel): OgCardStat[] {
  const { stats, action } = splitStatLine(model.facts)
  const chip = (fact: Fact): OgCardStat => ({ label: fact.short, value: fact.value })
  return [
    ...stats.map(chip),
    ...actionTypeStamps(model.actionType, model.mechActionType).map((label) => ({ label })),
    ...action.map(chip),
    ...model.traits.map((trait) => ({
      label: trait.name,
      ...(trait.param?.trim() ? { value: trait.param } : {}),
    })),
  ]
}

type ActionShape = Pick<
  RefMetaAction,
  'activationCost' | 'actionSource' | 'actionType' | 'range' | 'content' | 'name'
> & { displayName?: string }

/** The action the card folds into itself: the entity, or its self-action. */
function selfAction(entity: RefMetaEntity, name: string): ActionShape | undefined {
  if ('actionSource' in entity) return entity as ActionShape
  const actions = (extractVisibleActions(entity) ?? []) as ActionShape[]
  return foldedActionOf(actions, name) ?? actions[0]
}

/** One line of rules: the action's first paragraph, else the entity's own. */
function rulesText(entity: RefMetaEntity, action: ActionShape | undefined): string | undefined {
  const fromAction = firstParagraphText(action?.content)
  if (fromAction) return fromAction
  const content = 'content' in entity ? (entity.content as RefObjectContentBlock[]) : undefined
  const fromEntity = firstParagraphText(content)
  if (fromEntity) return fromEntity
  const description = 'description' in entity ? entity.description : undefined
  return typeof description === 'string' && description.length > 0 ? description : undefined
}

/** The entity's tone as a CSS colour: a guide's own, else its domain tone. */
function toneOf(schemaName: RefEnumSchemaName, entity: RefMetaEntity): string {
  const { bg, bgColor } = resolveDomainTone(schemaName, entity)
  return bgColor ?? bg ?? 'var(--color-ink-2)'
}
