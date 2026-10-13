/**
 * What a full card's BODY prints, resolved from what `ReferenceEntityCardInner`
 * decided above its head-form return: the prose and its anchored choices, the
 * lead, the inline actions, and what every nested card inherits.
 * `resolveCardSections` (`cardSections.tsx`) turns it into nodes.
 *
 * A plain function, not a component: the card lays the result out three ways
 * (the framed card, an inline action band, a page), so it needs values.
 */

import type { ReactNode } from 'react'
import type {
  SURefEntity,
  SURefEnumSchemaName,
  SURefMetaAction,
  SURefMetaEntity,
  SURefObjectAnyPattern,
  SURefObjectChoice,
  SURefObjectContentBlock,
} from 'salvageunion-reference'
import { getChoices, isAbility, resolveGrantedEntities } from 'salvageunion-reference'
import type { CardSize } from '../../containers/displayMode'
import { BonusPerTechLevel } from './BonusPerTechLevel'
import { choiceKey, hideShownProse, proseKey, resolveBodyBlocks } from './bodyBlocks'
import { interleaveBody } from './bodyInterleave'
import type { CardProseContext } from './CardProse'
import { ChoiceRegion } from './ChoiceRegion'
import type { BonusCell } from './cardCells'
import { bonusCells } from './cardCells'
import { blockPlainText, choiceRendersNothing, isRulesBearing } from './cardHelpers'
import { resolveCatalogLeadBlocks } from './catalogLead'
import type { AnchoredContentBlock } from './choiceAnchoring'
import { anchorBonusMarker, anchorChoiceMarkers } from './choiceAnchoring'
import type { DomainTone } from './entityCardTone'
import type { NestedCardHost } from './NestedCards'
import { resolveNestedSections } from './nestedSections'
import type {
  NestedCard,
  ReferenceCardEntity,
  ReferenceEntityCardHideConfig,
  ReferenceEntityCardProps,
} from './referenceEntityCardTypes'
import { resolveGuideLead } from './resolveGuideLead'

/** What the inner card resolved above its head-form return, as the body needs it. */
export type CardBodyInput = Pick<
  ReferenceEntityCardProps,
  | 'shownProse'
  | 'parentSeal'
  | 'droneLoadout'
  | 'scalingParent'
  | 'selections'
  | 'onSelectionChange'
  | 'foldTables'
  | 'afterExtraContent'
  | 'abilitiesSection'
> & {
  data: ReferenceCardEntity
  entity: SURefMetaEntity
  schemaName: SURefEnumSchemaName | 'actions'
  pattern: SURefObjectAnyPattern | undefined
  entityName: string
  resolvedChassisName: string | undefined
  size: CardSize
  depth: number
  compact: boolean
  inline: boolean
  onPage: boolean
  readable: boolean
  isAction: boolean
  isCatalog: boolean
  isDown: boolean
  isTitanicMeta: boolean
  isLegalStartingPatternCard: boolean
  hasSubLine: boolean
  asideLeadRequested: boolean
  tone: DomainTone
  hide: ReferenceEntityCardHideConfig | undefined
  /** The self-action folded into the body (`foldedActionOf`). */
  foldedAction: SURefMetaAction | undefined
  titanicBodyContent: SURefObjectContentBlock[] | undefined
  hintText: string | undefined
  leadHint: string | undefined
  assetUrl: string | undefined
  assetSrcSet: string | undefined
  effTechLevel: number | undefined
  dataValueBonuses: BonusCell[]
  entityChoices: SURefObjectChoice[]
  sectionAs: 'h2' | undefined
  /** This card, for the sections that nest cards (no circular import). */
  NestedCard: NestedCard
}

/** What the body prints, and what its nested cards inherit. */
export function resolveBodyProse(input: CardBodyInput) {
  const {
    data,
    entity,
    schemaName,
    pattern,
    entityName,
    resolvedChassisName,
    size,
    depth,
    compact,
    inline,
    onPage,
    readable,
    isCatalog,
    isDown,
    isTitanicMeta,
    tone,
    hide,
    foldedAction,
    titanicBodyContent,
    hintText,
    leadHint,
    assetUrl,
    effTechLevel,
    dataValueBonuses,
    entityChoices,
    shownProse,
    parentSeal,
    droneLoadout,
    scalingParent,
    selections,
    onSelectionChange,
    NestedCard,
  } = input
  const editableChoices = !!onSelectionChange
  const isPattern = !!pattern
  // BODY — content + nested groups. A granting ability collapses its own
  // content AND actions (they belong to the granted entity); its description
  // leads, then the granted cards.
  const grantedCount = resolveGrantedEntities(entity as SURefEntity).length
  const isGrantingAbility = !isCatalog && isAbility(entity) && grantedCount > 0
  // CATALOG guide lead — narrow a guide tile to its own opening paragraph,
  // falling back to its first step's (see `resolveGuideLead`).
  const catalogGuideLead = isCatalog ? resolveGuideLead(entity) : undefined
  const content = catalogGuideLead
    ? [{ type: 'paragraph' as const, value: catalogGuideLead }]
    : 'content' in entity
      ? entity.content
      : undefined
  // The crawler-bay damaged-effect string also appears as the last content
  // paragraph; it renders in the "WHEN DAMAGED" callout instead.
  const damagedEffect =
    'damagedEffect' in entity && typeof entity.damagedEffect === 'string'
      ? entity.damagedEffect
      : undefined
  // A granted entity's SHORT-FORM lead sentence is already shown by the
  // containing ability.
  const isGrantContext = parentSeal?.label === 'Grants'

  const sections = resolveNestedSections({
    entity,
    schemaName,
    pattern,
    isCatalog,
    onPage,
    depth,
    isGrantingAbility,
    foldedAction,
    droneLoadout,
  })
  const showImage = !!assetUrl && !hide?.image
  const rawBodyContent = isTitanicMeta ? titanicBodyContent : content
  const foldedActionContent = foldedAction?.content ?? undefined
  // A SELF-action renders ITS content as the body, merged with the entity's own.
  const isSelfAction = !!foldedAction && foldedAction.name === entityName
  const resolvedBody = resolveBodyBlocks({
    content: rawBodyContent,
    damagedEffect,
    isGrantContext,
    selfActionContent: isSelfAction ? foldedActionContent : undefined,
    alwaysShow: isPattern || isTitanicMeta,
    isGrantingAbility,
  })
  // NO REPEATED PROSE: a nested child hides what its parent already prints.
  const bodyBlocks = hideShownProse(resolvedBody.bodyBlocks, shownProse, resolvedChassisName)
  const showBody = resolvedBody.showBody && bodyBlocks.length > 0

  const choiceIsEmpty = (c: SURefObjectChoice) =>
    choiceRendersNothing(c, editableChoices, selections)

  // The card context every prose band renders with.
  const prose: CardProseContext = {
    rulesBearing: isRulesBearing(data),
    // An inline action reads at its host's size, not a nested card's.
    compact: inline ? size !== 'large' : compact,
    chassisName: resolvedChassisName,
    toneColor: tone.bgColor ?? tone.bg,
    ...(onPage ? { fontSize: 'inherit' } : readable ? { fontSize: 'sm' } : {}),
  }

  // BONUS PER TECH LEVEL — anchored INLINE at the prose that describes it.
  const bonusPerTechLevel =
    'bonusPerTechLevel' in entity && entity.bonusPerTechLevel ? entity.bonusPerTechLevel : undefined
  const bonusCellList: BonusCell[] = [
    ...(bonusPerTechLevel ? bonusCells(bonusPerTechLevel) : []),
    ...dataValueBonuses,
  ]
  const bonusNode: ReactNode =
    bonusCellList.length > 0 ? (
      <BonusPerTechLevel key="bonus-per-tech" cells={bonusCellList} compact={compact} />
    ) : null

  const renderChoiceRegion = (choice: SURefObjectChoice): ReactNode => (
    <ChoiceRegion
      key={`choice-region-${choice.id}`}
      choice={choice}
      effTechLevel={effTechLevel}
      scalingParent={scalingParent}
      selections={selections}
      onSelectionChange={onSelectionChange}
      compact={compact}
      toneColor={tone.bgColor}
      depth={depth}
      chassisName={resolvedChassisName}
      NestedCard={NestedCard}
    />
  )

  // AUTO-ANCHOR unmarked choices to the prose that introduces them, then the
  // bonus-per-tech-level marker to ITS prose.
  // NO REPEATED PROSE holds for a choice too: one the parent already offers
  // (a drone's A.I. Personality, under the ability that names it) is not
  // offered again.
  const bodyChoices = entityChoices.filter(
    (choice) => !shownProse?.includes(choiceKey(choice.name, resolvedChassisName))
  )
  const anchoredBlocks: AnchoredContentBlock[] = [...bodyBlocks]
  if (!hide?.choices) anchorChoiceMarkers(anchoredBlocks, bodyChoices)
  const bonusAnchored = bonusNode ? anchorBonusMarker(anchoredBlocks) : false

  const bodyNodes = interleaveBody({
    blocks: anchoredBlocks,
    choices: bodyChoices,
    hideChoices: !!hide?.choices,
    showProse: !hide?.content && showBody,
    choiceIsEmpty,
    renderChoice: renderChoiceRegion,
    bonusNode,
    bonusAnchored,
    prose,
  })

  // The LEAD — the hint as the body's first paragraph (unless the body
  // already opens with it).
  const leadBlocks: SURefObjectContentBlock[] =
    leadHint && !hide?.content && !bodyBlocks.some((b) => blockPlainText(b).startsWith(leadHint))
      ? [{ type: 'paragraph', value: leadHint }]
      : []

  // CATALOG LEAD — a tile with no prose of its own borrows an opening
  // paragraph from what it suppressed (grants, then actions), deduplicated
  // against the hint.
  const catalogLeadBlocks: SURefObjectContentBlock[] =
    isCatalog && bodyNodes.length === 0
      ? resolveCatalogLeadBlocks(entity as SURefEntity, hintText)
      : []

  // What this card prints, for its nested children to not repeat.
  const inlineActionEntities: ReferenceCardEntity[] = !hide?.actions
    ? [...sections.chassisAbilityEntities, ...sections.gridActions, ...sections.titanicActions]
    : []
  const printedProse = [
    ...leadBlocks,
    ...bodyBlocks,
    ...inlineActionEntities.flatMap((a) => ('content' in a && a.content ? a.content : [])),
  ]
    .map((b) => proseKey(blockPlainText(b), resolvedChassisName))
    .filter((key) => key.length > 0)
    .concat(
      [...entityChoices, ...inlineActionEntities.flatMap((a) => getChoices(a) ?? [])].map(
        (choice) => choiceKey(choice.name, resolvedChassisName)
      )
    )

  // What every nested card inherits from this one.
  const nestedHost: NestedCardHost = {
    depth,
    size,
    isDown,
    onPage,
    entityName,
    chassisName: resolvedChassisName,
    shownProse: printedProse,
    NestedCard: NestedCard,
  }
  return {
    ...sections,
    showImage,
    damagedEffect,
    isSelfAction,
    foldedActionContent,
    prose,
    bodyNodes,
    leadBlocks,
    catalogLeadBlocks,
    inlineActionEntities,
    nestedHost,
  }
}

/** What `resolveBodyProse` resolved, as `resolveCardSections` reads it. */
export type BodyProse = ReturnType<typeof resolveBodyProse>
