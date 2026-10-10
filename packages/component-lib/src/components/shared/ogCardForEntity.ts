import type {
  SURefEnumSchemaName,
  SURefMetaAction,
  SURefMetaEntity,
  SURefObjectContentBlock,
  SURefObjectPattern,
} from 'salvageunion-reference'
import {
  extractVisibleActions,
  getReferenceEntityName,
  getTechLevel,
  isAbility,
  resolveActivationCurrency,
  visiblePatterns,
} from 'salvageunion-reference'
import { formatCost } from '../referenceEntity/card/cardCells'
import {
  isDoEntity,
  resolveDomainTone,
  resolveSeamLabel,
  resolveTierNumeral,
} from '../referenceEntity/card/entityCardTone'
import { firstParagraphText } from '../referenceEntity/card/firstParagraphText'
import { formatProvenance, resolveFooterProvenance } from '../referenceEntity/card/provenance'
import { resolveFoldedAction } from '../referenceEntity/card/resolveFoldedAction'
import { buildReferenceEntityStats } from '../referenceEntity/referenceEntityStatsConfig'
import type { OgCardProps, OgCardStat } from './ogCardText'

/**
 * A reference entity's link preview (issue 1280): the `thing` or `do` card
 * the SRD renders at build, one PNG per entity.
 *
 * Every field comes from the helper the entity card itself uses, so the
 * preview says what the page says: the tone (`resolveDomainTone`), have vs do
 * by data shape (`isDoEntity`), the seam's type stamp, the header's short stat
 * cells, the tier numeral, the cost pennant and the footer's provenance.
 *
 * A chassis PATTERN is its own thing with its own page, so it takes its own
 * card: "Pattern · [chassis]" over the pattern's quoted name, the chassis's
 * stats and tone, and the pattern's own provenance.
 */
export function ogCardForEntity(options: {
  schemaName: SURefEnumSchemaName
  entity: SURefMetaEntity
  pattern?: SURefObjectPattern
  /** The address the foot prints: the page's host and path. */
  address: string
}): OgCardProps {
  const { schemaName, entity, pattern, address } = options
  const name = getReferenceEntityName(entity) ?? ('name' in entity ? String(entity.name) : '')
  const provenance = resolveFooterProvenance(entity, pattern)
  const cite = formatProvenance(provenance.source, provenance.booklet, provenance.page)

  if (!pattern && isDoEntity(entity)) {
    const action = selfAction(entity, name)
    const cost =
      action?.activationCost != null
        ? formatCost(action.activationCost, resolveActivationCurrency(action.actionSource))
        : undefined
    const tree = isAbility(entity) && entity.tree ? String(entity.tree) : undefined
    const kicker = [
      isAbility(entity) ? 'Ability' : resolveSeamLabel(schemaName, entity),
      tree,
      action?.actionType,
      action?.range?.join(', '),
    ]
    return {
      kind: 'do',
      kicker: joinKicker(kicker),
      title: name,
      tier: resolveTierNumeral(entity),
      cost,
      rules: rulesText(entity, action),
      cite,
      address,
    }
  }

  const techLevel = getTechLevel(entity)
  const patterns = schemaName === 'chassis' && !pattern ? patternCount(entity) : 0
  return {
    kind: 'thing',
    kicker: joinKicker(
      pattern
        ? ['Pattern', name]
        : [resolveSeamLabel(schemaName, entity), techLevelLabel(techLevel)]
    ),
    title: pattern ? pattern.name : name,
    tone: toneOf(schemaName, entity),
    stats: statsOf(schemaName, entity, techLevel),
    cite: joinKicker([cite, patterns > 0 ? `${patterns} patterns` : undefined]) || undefined,
    address,
  }
}

type ActionShape = Pick<
  SURefMetaAction,
  'activationCost' | 'actionSource' | 'actionType' | 'range' | 'content' | 'name'
> & { displayName?: string }

/** The action the card folds into itself: the entity, or its self-action. */
function selfAction(entity: SURefMetaEntity, name: string): ActionShape | undefined {
  if ('actionSource' in entity) return entity as ActionShape
  const actions = (extractVisibleActions(entity) ?? []) as ActionShape[]
  return resolveFoldedAction(actions, name) ?? actions[0]
}

/** One line of rules: the action's first paragraph, else the entity's own. */
function rulesText(entity: SURefMetaEntity, action: ActionShape | undefined): string | undefined {
  const fromAction = firstParagraphText(action?.content)
  if (fromAction) return fromAction
  const content = 'content' in entity ? (entity.content as SURefObjectContentBlock[]) : undefined
  const fromEntity = firstParagraphText(content)
  if (fromEntity) return fromEntity
  const description = 'description' in entity ? entity.description : undefined
  return typeof description === 'string' && description.length > 0 ? description : undefined
}

function techLevelLabel(techLevel: number | 'B' | 'N' | undefined): string | undefined {
  if (techLevel === undefined) return undefined
  if (techLevel === 'B') return 'Bio'
  if (techLevel === 'N') return 'Nanite'
  return `Tech Level ${techLevel}`
}

function patternCount(entity: SURefMetaEntity): number {
  const patterns = (entity as { patterns?: SURefObjectPattern[] }).patterns ?? []
  return visiblePatterns(patterns).length
}

/**
 * The entity's tone as a CSS colour. The tone resolver answers in a Tailwind
 * `bg-*` class for most schemas; each one names a theme token, so it maps
 * onto that token's custom property.
 */
function toneOf(schemaName: SURefEnumSchemaName, entity: SURefMetaEntity): string {
  const { bg, bgColor } = resolveDomainTone(schemaName, entity)
  if (bgColor) return bgColor
  const token = bg?.match(/^bg-([a-z0-9-]+)$/)?.[1]
  return token ? `var(--color-${token})` : 'var(--color-ink-2)'
}

/** The header's short stat cells, the tech level carried by the kicker instead. */
function statsOf(
  schemaName: SURefEnumSchemaName,
  entity: SURefMetaEntity,
  techLevel: number | 'B' | 'N' | undefined
): OgCardStat[] {
  const stats = buildReferenceEntityStats(entity, { compact: true, schemaName, techLevel }).flatMap(
    (stat) =>
      stat.value === undefined
        ? []
        : [
            {
              label: stat.label,
              value:
                stat.outOfMax !== undefined ? `${stat.value}/${stat.outOfMax}` : String(stat.value),
            },
          ]
  )
  return chassisRow(stats)
}

/**
 * The card draws six boxes. A chassis has seven stats and the origin's row is
 * SP / EP / HEAT / SYS / MOD / CARGO: Heat sits after EP in place of the
 * salvage value, and the module box reads "MOD".
 */
function chassisRow(stats: OgCardStat[]): OgCardStat[] {
  const heat = stats.find((stat) => stat.label === 'Heat')
  if (!heat) return stats
  const rest = stats.filter((stat) => stat !== heat && stat.label !== 'SV')
  rest.splice(rest.findIndex((stat) => stat.label === 'EP') + 1, 0, heat)
  return rest.map((stat) => (stat.label === 'MODS' ? { ...stat, label: 'MOD' } : stat))
}

function joinKicker(parts: (string | undefined)[]): string {
  return parts.filter((part): part is string => !!part && part.length > 0).join(' · ')
}
