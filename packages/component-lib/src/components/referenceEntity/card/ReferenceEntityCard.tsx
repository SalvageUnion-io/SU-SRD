import { ChevronDown, ChevronUp } from 'lucide-react'
import type { CSSProperties, ReactNode } from 'react'
import { useContext, useState } from 'react'
import type {
  EntityInstance,
  SURefEntity,
  SURefEnumSchemaName,
  SURefMetaEntity,
  SURefObjectAnyPattern,
  SURefObjectChoice,
  SURefObjectContentBlock,
} from 'salvageunion-reference'
import {
  extractVisibleActions,
  getAssetUrl,
  getChoices,
  getReferenceEntityName,
  getTechLevel,
  isAbility,
  isBioTitanPattern,
  resolveActivationCurrency,
  resolveGrantedEntities,
  toEntityModel,
} from 'salvageunion-reference'
import { isLegalStartingPattern } from 'salvageunion-reference/rules'
import { space } from '../../../design/tokens'
import type { RowSlots } from '../../../entity/forms/Row'
import { Row } from '../../../entity/forms/Row'
import type { TokenFact, TokenSlots } from '../../../entity/forms/Token'
import { Token } from '../../../entity/forms/Token'
import { InsidePeekContext } from '../../../entity/peekContext'
import { Badge } from '../../chrome/Badge'
import { assetSrcSetFor } from '../../shared/assetSrcSet'
import { CardImage } from '../../shared/CardImage'
import type { CardExtent, CardSize } from '../../shared/displayMode'
import { resolveCardDisplay } from '../../shared/displayMode'
import type { StatItem } from '../../shared/statsBarTypes'
import { useEntityExternalLink } from '../entityHrefContext'
import { quotePatternName } from '../pattern/quotePatternName'
import type { ReferenceEntityControl } from '../referenceEntityControlTypes'
import { BonusPerTechLevel } from './BonusPerTechLevel'
import {
  choiceKey,
  hideShownProse,
  proseKey,
  resolveBodyBlocks,
  resolveBodyLayout,
} from './bodyBlocks'
import { interleaveBody } from './bodyInterleave'
import { CardFacets } from './CardFacets'
import { CardOuter } from './CardOuter'
import { CardPage } from './CardPage'
import { CardPennant } from './CardPennant'
import type { CardProseContext } from './CardProse'
import { CardProse, FoldedActionProse, PatternProse } from './CardProse'
import { CardRollTable } from './CardRollTable'
import { CardSeam } from './CardSeam'
import { CardTopRail } from './CardTopRail'
import { ChoiceRegion } from './ChoiceRegion'
import type { BonusCell } from './cardCells'
import {
  bonusCells,
  buildHeaderStats,
  formatCost,
  resolveSubHeaderCells,
  resolveTechScaling,
} from './cardCells'
import type { HeaderFill } from './cardChrome'
import {
  resolveCardColors,
  resolveCardInteraction,
  resolveFrameWidth,
  resolveHeaderFill,
  resolveHeaderHint,
} from './cardChrome'
import type { CardGrain } from './cardGrain'
import {
  blockPlainText,
  choiceRendersNothing,
  isRulesBearing,
  isTitanicAction,
  MAX_DEPTH,
  sectionHeadingLevel,
} from './cardHelpers'
import { CardTextureContext } from './cardTexture'
import { resolveCatalogLeadBlocks } from './catalogLead'
import type { AnchoredContentBlock } from './choiceAnchoring'
import { anchorBonusMarker, anchorChoiceMarkers } from './choiceAnchoring'
import { DamagedEffectCallout } from './DamagedEffectCallout'
import { EntityCardHeader } from './EntityCardHeader'
import { EntityCardIdentityFooter } from './EntityCardIdentityFooter'
import type { AxisMarker } from './entityCardTone'
import {
  resolveAxisMarkers,
  resolveCardTone,
  resolveEyebrow,
  resolveSeamLabel,
  resolveTierNumeral,
  titleSizeClass,
} from './entityCardTone'
import type { SplitFacets } from './facetSplit'
import { splitFacets } from './facetSplit'
import { GuideSteps } from './GuideSteps'
import { MissingHero } from './MissingArt'
import type { NestedCardHost } from './NestedCards'
import { ActionsChip, CardTray, DroneCards, InlineActions, NestedCardGroup } from './NestedCards'
import { resolveNestedSections } from './nestedSections'
import { PatternList } from './PatternListRow'
import { PatternSection } from './PatternSection'
import { resolveFooterProvenance } from './provenance'
import type {
  ActionFields,
  ReferenceCardEntity,
  ReferenceEntityCardHideConfig,
  ReferenceEntityCardProps,
} from './referenceEntityCardTypes'
import { resolveCardTable } from './resolveCardTable'
import { resolveFoldedAction } from './resolveFoldedAction'
import { resolveGuideLead } from './resolveGuideLead'
import { resolveGuideSteps } from './resolveGuideSteps'
import { StatusRail, StatusTriState } from './StatusRail'
import { stripHostParenthetical } from './stripHostParenthetical'

/**
 * ReferenceEntityCard — the ONE card that renders ENTITIES, ACTIONS, and
 * NPCs (ruleset §5, boards E1–E4). ONE anatomy across every size × extent ×
 * context:
 *
 *   seam type stamp · flush header · italic "//" line · body · footer
 *
 * with TWO header fills, chosen by the reader's question and decided by data
 * shape (`isDoEntity`), never a schema prop:
 *
 * - TONE, for things you HAVE: the entity's tone, ink speckle, the title in
 *   ink or paper by contrast, the value cells after it.
 * - INK, for things you DO (abilities, actions): the book's ink banner — the
 *   tier numeral at the left, the cost pennant at the right, paper flecks.
 *
 * The frame, the "//" line and the footer are ink on paper on every card; the
 * tone lives in the header alone. Actions sit INLINE as flush ink bands; an
 * entity's own roll table sits inline the same way; nested ENTITIES sit in a
 * tray, one size step per depth (large → medium → a one-line head row), the
 * frame stepping 3 → 2 → 1.5px with them.
 *
 * ## How this file is laid out
 *
 * `ReferenceEntityCardInner` DECIDES — fill, depth, which sections a card
 * carries, what each one is fed — and composes. What each section LOOKS like
 * lives beside it, one module per section (audit PK-08): the seam
 * (`CardSeam`), the header (`EntityCardHeader`), the facets row
 * (`CardFacets`, E17), the Row and Token forms (`src/entity/`), the prose bands
 * (`CardProse`), the body interleave, choices (`ChoiceRegion`), the roll table
 * (`CardRollTable`), the cost pennant (`CardPennant`), the trays, inline
 * actions and depth rows (`NestedCards`). The pure cell/stat builders are in
 * `cardCells.ts`, the chrome rules in `cardChrome.ts`.
 *
 * The sections that render nested cards receive this card as `NestedCard`
 * rather than importing it, which keeps every section module free of a
 * circular import back to this one.
 */

/** The body box's padding by size (board E1): tight on top under a "//" line. */
const BODY_PAD: Record<CardSize, { ruled: string; open: string }> = {
  large: { ruled: `${space[2]} ${space[14]} ${space[12]}`, open: `${space[12]} ${space[14]}` },
  medium: { ruled: `${space[2]} ${space[10]} ${space[10]}`, open: `${space[10]}` },
  small: { ruled: `${space[2]} ${space[8]} ${space[8]}`, open: `${space[8]}` },
}

/**
 * What a card hides. CATALOG — the SRD index tile — keeps artwork and
 * description ONLY, so every nested element is suppressed here rather than at
 * each call-site. TERMINAL (ruleset §1, board E3): inside a tooltip popup
 * nothing acts, so the roll-table controls go too (the link, depth-2 rows and
 * the actions chip are handled where they render).
 */
function resolveHide(
  hideProp: ReferenceEntityCardHideConfig | undefined,
  isCatalog: boolean,
  insidePeek: boolean
): ReferenceEntityCardHideConfig | undefined {
  const base = isCatalog ? { ...hideProp, actions: true, choices: true, patterns: true } : hideProp
  return insidePeek ? { ...base, rollTable: true } : base
}

/**
 * The title's type step: by size, stepping down with depth (`titleSizeClass`).
 * The ink banner's large title sits one rung under the tone header's, beside
 * its numeral (board E1); an inline action band takes its own rung.
 */
function resolveTitleClass(inline: boolean, fill: HeaderFill, depth: number, size: CardSize) {
  if (inline) return INLINE_TITLE[size]
  const ladderTitle = titleSizeClass(depth, size)
  return fill === 'ink' && ladderTitle === 'text-display-lg' ? 'text-display' : ladderTitle
}

/** An inline action's title: one step under its host's (board E1). */
const INLINE_TITLE: Record<CardSize, string> = {
  large: 'text-readout',
  medium: 'text-readout',
  small: 'text-lede',
}

/**
 * The card body's class: dimmed when down, and with artwork a width container,
 * so the art sits beside the prose only when the CARD is wide and stacks above
 * it when narrow (`.su-ec-art-body`).
 */
function bodyClassName(isDown: boolean, hasArt: boolean): string | undefined {
  return [isDown ? 'opacity-60' : '', hasArt ? 'su-ec-art-body' : ''].join(' ').trim() || undefined
}

/** An NPC's shortform stat: its hit points (or structure points), as `HP 9`. */
function npcHitPointsTail(entity: object): TokenFact | undefined {
  if (!('schemaName' in entity) || entity.schemaName !== 'npcs') return undefined
  if (!('hitPoints' in entity) || typeof entity.hitPoints !== 'number') return undefined
  return {
    label: 'damageType' in entity && entity.damageType === 'SP' ? 'SP' : 'HP',
    value: String(entity.hitPoints),
  }
}

/**
 * The card's frame box: the frame lives on the INNER clipping element; the
 * OUTER div is overflow-visible only so the seam escapes the clip.
 */
function frameBoxStyle(frameStyle: CSSProperties): CSSProperties {
  return {
    ...frameStyle,
    backgroundColor: 'var(--color-paper)',
    borderRadius: 'var(--radius-card)',
    display: 'flex',
    flex: '1 1 auto',
    flexDirection: 'column',
    overflow: 'hidden',
  }
}

/** The shortform's tail: an ability's level, a tech level, an NPC's hit points or a classification. */
function shortformTail(
  numeral: string | undefined,
  techLevel: number | 'B' | 'N' | undefined,
  entity: object,
  axisMarker: TokenFact | undefined
): TokenFact | undefined {
  if (numeral) return { label: 'LVL', value: numeral }
  if (techLevel != null) return { label: 'TL', value: String(techLevel) }
  return npcHitPointsTail(entity) ?? axisMarker
}

/** A page's facets row (E17): the Tags lead the prose column, after any `subtitleExtra`. */
function PageSubLine({
  extra,
  facets,
  size,
  children,
}: {
  extra: ReactNode
  facets: SplitFacets
  size: CardSize
  /** The row's leading stamp ("Suggested"). */
  children: ReactNode
}) {
  return (
    <>
      {extra}
      <CardFacets facets={facets} leading={children} size={size} flush linkable />
    </>
  )
}

/**
 * The head extent as the entity forms (phase 2 adapter): the SHORTFORM
 * (`size="small" extent="head"`) is the Token, the COMPACT CARD the Row, each
 * given the slots this card resolved from its props.
 */
function HeadForm({
  entity,
  pattern,
  instance,
  lead,
  shared,
  token,
  row,
}: {
  entity: SURefMetaEntity
  pattern: SURefObjectAnyPattern | undefined
  instance: EntityInstance
  lead: boolean
  shared: Pick<RowSlots, 'outer' | 'frameStyle' | 'down'>
  token: Pick<TokenSlots, 'kind' | 'fact' | 'pennant'> | false
  row: RowSlots
}) {
  const model = toEntityModel(entity, undefined, { pattern })
  if (token) return <Token model={model} instance={instance} slots={{ ...shared, ...token }} />
  return <Row model={model} instance={instance} lead={lead} slots={{ ...shared, ...row }} />
}

function ReferenceEntityCardInner({
  data,
  size: sizeProp = 'large',
  extent = 'full',
  depth: depthProp = 0,
  presentation = 'card',
  inline = false,
  shownProse,
  userMade = false,
  madeBy,
  kicker,
  texture,
  foldTables = false,
  parentSeal,
  readable = false,
  pattern,
  hostName,
  hostDown,
  chassisName,
  droneLoadout,
  artSlot = false,
  leadProse = false,
  hide: hideProp,
  status,
  onStatusClick,
  disabled,
  selected: selectedProp,
  selectionSeal,
  suggested,
  count,
  onCountChange,
  selectable,
  onCardClick,
  cardClickable,
  selectionRole,
  cardClickLabel,
  controls,
  actionControls,
  selections,
  onSelectionChange,
  titleOverride,
  titleSlot,
  statsOverride,
  primaryStatsOnly,
  subtitleExtra,
  abilitiesSection,
  afterExtraContent,
  asideLead: asideLeadRequested = false,
  afterChoicesContent,
  footerOverride,
  footMeta,
  rightContent: rightContentProp,
  className,
  titleAs,
  scalingParent,
  expand,
}: ReferenceEntityCardProps) {
  // Section bands become real headings only when this card IS the page — see
  // `sectionHeadingLevel` for why, and for what deliberately stays a span.
  // A PAGE is the page whatever `titleAs` says: its title is the page's h1, in
  // the chapter band. Only a top-level card takes the page presentation.
  const onPage = presentation === 'page' && !inline && depthProp === 0
  const sectionAs = sectionHeadingLevel(onPage ? 'h1' : titleAs)

  // MULTI-SELECT: a card driven by `onCountChange` reads as selected whenever its
  // chosen quantity is ≥ 1, unless `selected` is set explicitly.
  const countValue = count ?? 0
  const isMultiSelect = !!onCountChange
  const selected = selectedProp ?? (isMultiSelect ? countValue >= 1 : undefined)

  // `SalvageUnionReference.*.all()` entities carry a runtime `schemaName`
  // discriminant that isn't reflected in the static `SURefEntity` union type —
  // the same cast-at-the-boundary pattern used throughout the display system.
  const entity = data as SURefMetaEntity
  // Hooks run above every early return below.
  const externalLinkNode = useEntityExternalLink(data as SURefEntity)
  const insidePeek = useContext(InsidePeekContext)
  const textureFromHost = useContext(CardTextureContext)
  const textured = texture ?? textureFromHost
  const schemaName = (
    'schemaName' in entity && typeof entity.schemaName === 'string' ? entity.schemaName : undefined
  ) as SURefEnumSchemaName | 'actions' | undefined

  if (!schemaName) {
    console.warn('ReferenceEntityCard: data does not have a schemaName property', data)
    return null
  }

  const isAction = schemaName === 'actions'
  // A FRAMED action (the Dashboard's deck and resolve panel) is never the
  // dominant solo card: a large one renders medium, at depth ≥ 1. An inline
  // action keeps its host's size, so its band shares the host's gutter.
  const size: CardSize = isAction && !inline && sizeProp === 'large' ? 'medium' : sizeProp
  const depth = isAction ? Math.max(depthProp, 1) : depthProp
  const compact = depth > 0 || size !== 'large'
  const isCatalog = extent === 'catalog'
  const hide = resolveHide(hideProp, isCatalog, insidePeek)
  const tone = resolveCardTone(schemaName, entity)
  // HAVE vs DO, by data shape.
  const fill: HeaderFill = resolveHeaderFill(entity, extent)
  // A damaged/destroyed card — or one nested under a damaged host — greys its
  // header; its body dims.
  const isDown = status === 'damaged' || status === 'destroyed' || !!hostDown
  const { onBandText, headerBg, headerBgColor } = resolveCardColors({ tone, isDown, fill })
  const grain: CardGrain | undefined =
    textured && !isDown ? (fill === 'ink' ? 'paper' : 'ink') : undefined
  const techLevel = getTechLevel(entity)
  // EFFECTIVE TECH LEVEL — the host's `scalingParent` level wins over the
  // entity's own, floored at its base (see `resolveTechScaling`).
  const entityChoices = getChoices(entity) ?? []
  const {
    effTechLevel,
    techLevelDisplay,
    techLevelModified,
    perTechLevelByLabel,
    dataValueBonuses,
  } = resolveTechScaling(entity, techLevel, entityChoices, scalingParent)
  const entityName = getReferenceEntityName(entity) ?? ('name' in entity ? String(entity.name) : '')
  const titleClass = resolveTitleClass(inline, fill, depth, size)
  // ARTWORK — a MINI catalog tile drops it: at the small size the image would
  // crowd out the description it exists to caption.
  const isMiniCatalog = isCatalog && size === 'small'
  const assetUrl = isMiniCatalog || inline ? undefined : getAssetUrl(entity)
  const assetSrcSet = assetSrcSetFor(assetUrl)

  // PATTERN view — the pattern is the subject; the chassis (`entity`) supplies
  // stats / tone / source. A `head` pattern is a LIST ROW.
  const isPattern = !!pattern
  const isPatternListing = isPattern && extent === 'head'
  const keepsArt = artSlot && !isPattern && !hide?.image // no art: a censor mark (`MissingArt`)
  // A pattern's title is its name in typographic QUOTES. A nested ACTION drops its
  // ` (Host)` disambiguation suffix when the host is this card's own context.
  const name =
    titleOverride ??
    (isPattern
      ? quotePatternName(pattern.name)
      : isAction
        ? stripHostParenthetical(entityName, hostName)
        : entityName)
  // `[(CHASSIS)]` content tokens resolve to the owning chassis name.
  const resolvedChassisName = chassisName ?? (schemaName === 'chassis' ? entityName : undefined)

  const action = isAction ? (entity as ActionFields) : undefined
  // The "Titanic Actions" entry is a meta-descriptor for the titanic-action
  // SYSTEM: its intro is its lead, its options the body.
  const isTitanicMeta = isAction && isTitanicAction(entity)
  // The seam's TYPE stamp — on every card (board E1). A pattern reads
  // "Pattern"; an ability carries its tree.
  const seamType = kicker ?? (isPattern ? 'Pattern' : resolveSeamLabel(schemaName, entity))
  const footerType =
    kicker ?? (isAction ? undefined : isPattern ? 'Pattern' : resolveEyebrow(schemaName).type)
  const provenance = resolveFooterProvenance(entity, pattern)
  const axisMarkers: AxisMarker[] = isAction
    ? []
    : isPattern
      ? resolvedChassisName
        ? [{ label: 'Chassis', value: resolvedChassisName }]
        : []
      : resolveAxisMarkers(entity)
  // "Legal Starting Pattern" is a STORED data tag on the pattern.
  const isLegalStartingPatternCard =
    isPattern && 'legalStarting' in pattern && isLegalStartingPattern(pattern.legalStarting)
  const numeral = resolveTierNumeral(entity)

  // The SELF-action — an action named like its entity — folds into the card:
  // its content becomes the body and its facets the "//" line (see
  // `resolveFoldedAction`). Every other action sits inline below.
  const foldableActions =
    !isAction &&
    !isPattern &&
    depth < MAX_DEPTH &&
    !(isAbility(entity) && resolveGrantedEntities(entity as SURefEntity).length > 0)
      ? (extractVisibleActions(entity) ?? []).filter((a) => !isTitanicAction(a))
      : []
  const foldedAction = resolveFoldedAction(foldableActions, entityName)
  const foldedActionFields: ActionFields | undefined = foldedAction ?? undefined

  // The parent seal (e.g. GRANTS) takes the type stamp's place, so the seam
  // keeps ONE stamp. A listing of one kind (`hide.seam`) drops the type stamp
  // and the classification pills: the page already names them.
  const seamless = !!hide?.seam && !parentSeal && !userMade && !isLegalStartingPatternCard
  const seam = (
    <CardSeam
      seal={parentSeal}
      typeStamp={parentSeal || hide?.seam ? undefined : seamType}
      axisMarkers={hide?.seam ? [] : axisMarkers}
      legalStartingPattern={isLegalStartingPatternCard}
      userMade={userMade}
    />
  )

  // HEADER value cells — the short `[label | value]` form at every size.
  const headerStats: StatItem[] = buildHeaderStats({
    entity,
    schemaName,
    asCompact: true,
    none: isAction || isPatternListing,
    // A head row keeps every cell: the one-line header sheds the ones that do not fit.
    primaryOnly: !!primaryStatsOnly,
    techLevel,
    techLevelDisplay,
    techLevelModified,
  })
  const effectiveHeaderStats: StatItem[] = hide?.stats
    ? []
    : (statsOverride ?? headerStats).filter((stat) => !hide?.statKeys?.includes(stat.key))

  // COST PENNANT — the action's own cost, or its folded self-action's. In the
  // Dashboard a `pennant` control makes it the action button.
  const costSource = action ?? foldedActionFields
  const costLabel =
    costSource?.activationCost != null
      ? formatCost(costSource.activationCost, resolveActivationCurrency(costSource.actionSource))
      : undefined
  const pennantControl = controls?.find((c) => c.pennant)
  const pennantNode: ReactNode =
    costLabel || pennantControl ? (
      <CardPennant cost={costLabel} size={size} control={pennantControl} subject={entityName} />
    ) : undefined
  // The rail carries every other control; the pennant control is the pennant.
  const railControls = pennantControl ? controls?.filter((c) => !c.pennant) : controls

  // SUGGESTED — an ink stamp leading the "//" line, marking a recommended
  // pick. A recommendation is not an action, so it is never rust (§3.1).
  const suggestedNode: ReactNode = suggested ? (
    <Badge shape="stamp" size="mini">
      Suggested
    </Badge>
  ) : undefined

  // HINT — an ability's description, the titanic meta-action's intro, or a
  // pattern row's first paragraph. A pattern ROW prints it on its one line; on
  // every other card it is the body's lead.
  const { hintText, titanicBodyContent } = resolveHeaderHint(entity, {
    isTitanicMeta,
    patternListingContent: isPatternListing ? pattern.content : undefined,
  })
  const headerHint = isPatternListing ? hintText : undefined
  const leadHint = isPatternListing ? undefined : hintText

  // The "//" LINE — an action's facets, then entity traits, then the
  // datavalues, with anything a choice or the Tech Level changed marked
  // modified (see `resolveSubHeaderCells`).
  const editableChoices = !!onSelectionChange
  const cells = resolveSubHeaderCells({
    entity,
    entityName,
    action,
    foldedAction,
    entityChoices,
    selections,
    perTechLevelByLabel,
    effTechLevel,
  })
  // E17: the action type is a head stamp, the facets Stat cells, the traits Tags.
  const facets = splitFacets(cells)
  const hasSubLine = !!suggestedNode || facets.facts.length > 0 || facets.tags.length > 0

  // The head extent is the Row (and, small, the Token): see below.
  const isHead = extent === 'head'
  const header = (
    <EntityCardHeader
      title={name}
      fill={fill}
      titleSlot={titleSlot}
      titleAs={titleAs}
      bg={headerBg}
      bgColor={headerBgColor}
      titleClass={titleClass}
      titleTextClass={onBandText}
      numeral={numeral}
      stats={effectiveHeaderStats}
      rightContent={rightContentProp ?? headerHint}
      stamps={facets.stamps}
      pennant={pennantNode}
      size={size}
      band={inline}
      grain={grain}
      ruled={!inline}
    />
  )

  // WRITE LAYER — whole-card affordances (see `resolveCardInteraction`).
  const { outer, frameStyle } = resolveCardInteraction({
    onCardClick,
    controls,
    cardClickable,
    disabled,
    selectable,
    className,
    selectionRole,
    cardClickLabel,
    selected,
    frameWidth: resolveFrameWidth({ size, extent, depth }),
    dashed: userMade,
  })
  // A CATALOG tile carries NO footer: it is artwork + description, and
  // provenance belongs on the entity's own page, which the tile links to.
  const rendersFooter =
    !inline && !hide?.footer && !isCatalog && (footerOverride != null || depth === 0)
  // LIVE SHEET (board E3): the condition and the destructive Remove live in a
  // dashed body rail, not on the seam as green and red tabs. A head row has no
  // body, so its condition rides the seam as the same neutral tri-state.
  const hasBodyRail = extent !== 'head' && !inline
  const removers = hasBodyRail ? (railControls ?? []).filter((c) => c.variant === 'danger') : []
  const seamControls =
    removers.length > 0 ? railControls?.filter((c) => !removers.includes(c)) : railControls
  // A read card (no handler) prints only a condition worth reporting: Intact
  // is the default, so it draws nothing rather than a stamp on every card.
  const shownStatus = onStatusClick || status !== 'intact' ? status : undefined
  const statusRail =
    hasBodyRail && (shownStatus || removers.length > 0) ? (
      <StatusRail
        status={shownStatus}
        onStatusClick={onStatusClick}
        removers={removers}
        subject={entityName}
        size={size}
      />
    ) : null
  const topRightRail = (
    <CardTopRail
      controls={seamControls}
      status={undefined}
      statusSeal={
        shownStatus && !hasBodyRail ? (
          <StatusTriState status={shownStatus} onClick={onStatusClick} subject={entityName} />
        ) : undefined
      }
      onStatusClick={undefined}
      subject={entityName}
      selected={selected}
      selectionSeal={selectionSeal}
      multiSelect={
        isMultiSelect
          ? {
              count: countValue,
              onChange: (next) => onCountChange?.(next),
              subject: cardClickLabel ?? name,
            }
          : undefined
      }
    />
  )

  // SHORTFORM (`size="small" extent="head"`) is the Token form, and the
  // COMPACT CARD (`extent="head"`) the Row form: this card is their adapter
  // until phase 6, translating its props into the forms' slots.
  if (isHead) {
    return (
      <HeadForm
        entity={entity}
        pattern={pattern}
        instance={{ title: name, ...(userMade ? { userMade } : {}) }}
        lead={leadProse && !hide?.content}
        shared={{ outer, frameStyle, down: isDown }}
        token={
          size === 'small' && {
            kind: kicker ?? resolveEyebrow(schemaName).type,
            fact: shortformTail(numeral, techLevel, entity, axisMarkers[0]) ?? null,
            pennant: isAction ? pennantNode : undefined,
          }
        }
        row={{
          seam: seamless ? null : seam,
          rail: topRightRail,
          titleSlot,
          titleAs,
          facts: [...effectiveHeaderStats, ...facets.facts],
          tags: facets.tags,
          stamps: facets.stamps,
          leading: suggestedNode,
          hint: rightContentProp ?? headerHint,
          pennant: pennantNode,
          chevron: !inline && (!!onCardClick || !!cardClickable),
          art: !(isPattern || inline || hide?.image),
          bodyless: inline || isPatternListing,
        }}
      />
    )
  }

  const frameBox = frameBoxStyle(frameStyle)

  // BODY — content + nested groups. A granting ability collapses its own
  // content AND actions (they belong to the granted entity); its description
  // leads, then the Grants tray.
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

  const {
    canExpand,
    nestedGroups,
    chassisAbilityEntities,
    patternGroups,
    patternActions,
    patternList,
    titanicActions,
    gridActions,
    droneInfos,
    droneSystems,
    droneModules,
  } = resolveNestedSections({
    entity,
    schemaName,
    pattern,
    isCatalog,
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
    headerBg: tone.bg,
    headerBgColor: tone.bgColor,
    ...(onPage ? { fontSize: '' } : readable ? { fontSize: 'text-sm' } : {}),
  }

  // BONUS PER TECH LEVEL — anchored INLINE at the prose that describes it.
  const bonusPerTechLevel =
    'bonusPerTechLevel' in entity && entity.bonusPerTechLevel ? entity.bonusPerTechLevel : undefined
  const bonusCellList: BonusCell[] = [
    ...(bonusPerTechLevel ? bonusCells(bonusPerTechLevel) : []),
    ...dataValueBonuses,
  ]
  const bonusNode: ReactNode =
    bonusCellList.length > 0 && !hide?.stats ? (
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
      NestedCard={ReferenceEntityCardInner}
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
    ? [...chassisAbilityEntities, ...gridActions, ...titanicActions]
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
    actionControls,
    NestedCard: ReferenceEntityCardInner,
  }

  // ROLL TABLE — the entity's own, or its folded action's: inline, flush,
  // under its ROLL THE DIE bar (board E4).
  const ownTable = resolveCardTable(entity)
  const entityTable = ownTable ?? resolveCardTable(foldedAction)
  const tableSource = ownTable ? entity : foldedAction
  const tableName =
    (tableSource && 'tableName' in tableSource && typeof tableSource.tableName === 'string'
      ? tableSource.tableName
      : undefined) ?? entityName
  const rollTableNode =
    entityTable && !hide?.rollTable ? (
      <CardRollTable
        table={entityTable}
        name={tableName}
        size={size}
        collapsible={isCatalog || depth > 0 || foldTables}
        disabled={isDown}
      />
    ) : null

  // PATTERN PROSE — the pattern's own flavour, ahead of the loadout.
  const patternProse =
    isPattern && pattern.content && pattern.content.length > 0 ? (
      <PatternProse name={pattern.name} content={pattern.content} context={prose} onPage={onPage} />
    ) : null

  // GUIDE STEPS — the bulk of a guide's prose.
  const guideSteps = canExpand && !isAction ? resolveGuideSteps(entity) : []
  const guideStepsNode =
    guideSteps.length > 0 ? (
      <GuideSteps
        steps={guideSteps}
        prose={prose}
        sectionAs={sectionAs}
        depth={depth}
        isDown={isDown}
        compact={compact}
        collapsibleTables={isCatalog || depth > 0 || foldTables}
        chassisName={resolvedChassisName}
        NestedCard={ReferenceEntityCardInner}
      />
    ) : null

  // LEFT ANCHOR — the artwork; nested NPCs sit in their tray, not on the parent's paper.
  const { asideLead, flat } = resolveBodyLayout({
    showImage,
    isPattern,
    asideLeadRequested,
    hasTrailingSection: !!afterExtraContent,
  })
  const inFlowGroups = isPattern ? patternGroups : nestedGroups

  const anchorNode: ReactNode =
    showImage && assetUrl ? (
      <CardImage
        url={assetUrl}
        srcSet={assetSrcSet}
        alt={`${entityName} illustration`}
        compact={compact}
        aside={asideLead}
        hero={onPage}
      />
    ) : undefined

  const proseNodes: ReactNode[] = [
    ...(leadBlocks.length > 0 ? [<CardProse key="lead" body={leadBlocks} context={prose} />] : []),
    ...bodyNodes,
  ]

  // On a PAGE the art, or its censor mark, is the hero; an NPC anchor stays in flow.
  const heroNode: ReactNode =
    onPage && (showImage ? anchorNode : keepsArt && !assetUrl && <MissingHero entity={entity} />)
  const bodyAnchor: ReactNode = heroNode ? undefined : anchorNode

  const bodyHasContent =
    !!bodyAnchor ||
    proseNodes.length > 0 ||
    catalogLeadBlocks.length > 0 ||
    (!isSelfAction && !!foldedActionContent?.length && !hide?.content && !hide?.actions) ||
    (!hide?.damagedEffect && !!damagedEffect) ||
    (!onPage && !!guideStepsNode) ||
    !!afterChoicesContent

  // ACTIONS — inline, flush. Below depth 1 they fold behind a chip.
  const actionsNode: ReactNode =
    abilitiesSection ??
    (inlineActionEntities.length > 0 ? (
      depth >= 2 ? (
        <ActionsChip count={inlineActionEntities.length} size={size}>
          <InlineActions actions={inlineActionEntities} host={nestedHost} />
        </ActionsChip>
      ) : (
        <InlineActions actions={inlineActionEntities} host={nestedHost} />
      )
    ) : null)

  const bodyContent: ReactNode = (
    <>
      {/* In ASIDE LEAD the anchor and the prose are a centred row (a stack in
          a narrow card); otherwise the anchor floats and the prose flows
          around it. */}
      {asideLead && bodyAnchor ? (
        <div className="su-ec-lead">
          {bodyAnchor}
          {proseNodes.length > 0 && <div style={{ flex: 1, minWidth: 0 }}>{proseNodes}</div>}
        </div>
      ) : (
        <>
          {bodyAnchor}
          {proseNodes}
        </>
      )}
      {catalogLeadBlocks.length > 0 && <CardProse body={catalogLeadBlocks} context={prose} />}
      {/* A SELF-action's content already renders AS the body; only a
          differently-named folded action renders here (with its name). */}
      {!isSelfAction &&
        !hide?.content &&
        !hide?.actions &&
        foldedAction &&
        foldedActionContent &&
        foldedActionContent.length > 0 && (
          <FoldedActionProse
            action={foldedAction}
            entityName={entityName}
            content={foldedActionContent}
            context={prose}
          />
        )}
      {!hide?.damagedEffect && damagedEffect && <DamagedEffectCallout effect={damagedEffect} />}
      {/* On a page the steps stand as a page section (`CardPage`'s `guide`). */}
      {!onPage && guideStepsNode}
      {/* SLOT: afterChoicesContent — appended just below the choices. */}
      {afterChoicesContent}
    </>
  )

  const body = bodyHasContent ? (
    <div
      className={bodyClassName(isDown, !!bodyAnchor)}
      style={{
        display: flat ? 'flow-root' : 'flex',
        flexDirection: 'column',
        gap: space[6],
        padding: hasSubLine ? BODY_PAD[size].ruled : BODY_PAD[size].open,
      }}
    >
      {bodyContent}
    </div>
  ) : null

  // PATTERN view → the pattern's own prose, then what it changes. On a card
  // it follows the chassis ability (chassis → ability → pattern → loadout) and
  // leads any other action (a Bio-Titan pattern → its added actions → the
  // actions it inherits); on a page it leads (`CardPage`'s `opening`).
  const patternSection = isPattern ? (
    <PatternSection
      prose={patternProse}
      groups={hide?.patterns ? [] : inFlowGroups}
      actions={hide?.actions ? [] : patternActions}
      padding={onPage ? '0' : BODY_PAD[size].open}
      sectionAs={sectionAs}
      host={nestedHost}
    />
  ) : null
  // With no chassis ability to follow, the pattern leads the actions.
  const patternLeads = chassisAbilityEntities.length === 0

  // NESTED ENTITIES — each group in its tray, on a card or a page alike.
  const nestedGroupsNode = (
    <>
      <DroneCards drones={droneInfos} host={nestedHost} />
      {droneSystems.length > 0 && (
        <NestedCardGroup
          label="Systems"
          entities={droneSystems}
          sectionAs={sectionAs}
          host={nestedHost}
        />
      )}
      {droneModules.length > 0 && (
        <NestedCardGroup
          label="Modules"
          entities={droneModules}
          sectionAs={sectionAs}
          host={nestedHost}
        />
      )}
      {!isPattern &&
        inFlowGroups.map((group) => (
          <NestedCardGroup
            key={group.label}
            label={group.label === 'NPCs' && group.entities.length === 1 ? 'NPC' : group.label}
            entities={group.entities}
            sectionAs={sectionAs}
            host={nestedHost}
            write={group.label === 'NPCs' ? { selections, onSelectionChange, hide } : undefined}
            seal={
              group.label === 'Grants' ? { label: 'Grants', tone: 'var(--color-ink)' } : undefined
            }
          />
        ))}
    </>
  )

  // A PAGE (boards 07, 08): the card's parts laid out as a page (`CardPage`).
  if (onPage) {
    return (
      <CardPage
        entity={entity}
        name={name}
        hero={heroNode}
        leadActions={hide?.actions ? [] : chassisAbilityEntities}
        otherActions={hide?.actions ? [] : [...gridActions, ...titanicActions]}
        subLine={
          (subtitleExtra || hasSubLine) && (
            <PageSubLine extra={subtitleExtra} facets={facets} size={size}>
              {suggestedNode}
            </PageSubLine>
          )
        }
        body={bodyHasContent ? bodyContent : null}
        opening={patternSection}
        bodyLabel={
          isPattern
            ? `${resolvedChassisName ?? entityName} ${isBioTitanPattern(pattern) ? 'Bio-Titan' : 'chassis'}`
            : undefined
        }
        stats={
          hide?.stats
            ? null
            : {
                techLevel: techLevelDisplay,
                schemaName: schemaName === 'actions' ? undefined : schemaName,
              }
        }
        table={rollTableNode}
        abilitiesSection={abilitiesSection}
        guide={guideStepsNode}
        sections={nestedGroupsNode}
        patterns={hide?.patterns ? [] : patternList}
        after={
          <>
            {afterExtraContent}
            {expand}
          </>
        }
        sectionAs={sectionAs}
        action={{
          NestedCard: ReferenceEntityCardInner,
          hostDown: isDown,
          hostName: entityName,
          chassisName: resolvedChassisName,
        }}
      />
    )
  }

  // An INLINE action: the flush band, its "//" line, its body and its table —
  // no frame, no seam, no footer (board E1).
  if (inline) {
    return (
      <section style={{ display: 'flex', flexDirection: 'column' }}>
        {header}
        <CardFacets facets={facets} leading={suggestedNode} size={size} />
        {body}
        {rollTableNode}
      </section>
    )
  }

  return (
    <CardOuter {...outer}>
      {seam}
      {topRightRail}
      <div style={frameBox}>
        {header}
        {/* SLOT: subtitleExtra — an extra line under the header (absent ⇒ nothing). */}
        {subtitleExtra && (
          <div style={{ padding: `${space[4]} ${compact ? space[10] : space[14]} 0` }}>
            {subtitleExtra}
          </div>
        )}
        <CardFacets facets={facets} leading={suggestedNode} size={size} />
        {body}
        {rollTableNode}
        {patternLeads && patternSection}
        {actionsNode}
        {!patternLeads && patternSection}
        {nestedGroupsNode}
        {/* BASIC CHASSIS → its patterns as head rows. */}
        {!hide?.patterns && patternList.length > 0 && (
          <CardTray label="Patterns" count={patternList.length} size={size} as={sectionAs}>
            <PatternList
              chassis={entity}
              chassisName={entityName}
              patterns={patternList}
              depth={depth + 1}
              hostDown={isDown}
              NestedCard={ReferenceEntityCardInner}
            />
          </CardTray>
        )}
        {/* SLOT: afterExtraContent — trailing body content (absent ⇒ nothing). */}
        {afterExtraContent && (
          <div style={{ padding: compact ? space[10] : `${space[12]} ${space[14]}` }}>
            {afterExtraContent}
          </div>
        )}
        {/* SLOT: expand — after the body, before the footer (e.g. a crawler
            bay's crew inset). */}
        {expand && (
          <div
            style={{
              padding: `0 ${compact ? space[10] : space[14]} ${compact ? space[10] : space[12]}`,
            }}
          >
            {expand}
          </div>
        )}
        {statusRail}
        {/* FOOTER — `footerOverride` replaces the identity footer; `hide.footer`
            and the catalog extent suppress it entirely. */}
        {rendersFooter
          ? (footerOverride ?? (
              // USER-MADE (ruleset §3.9): the credit is the maker, never a page.
              // A player's pattern rides on a chassis whose provenance would
              // otherwise put "Workshop Manual · p.104" under homebrew.
              <EntityCardIdentityFooter
                typeLabel={footerType}
                source={userMade ? undefined : provenance.source}
                booklet={userMade ? undefined : provenance.booklet}
                page={userMade ? undefined : provenance.page}
                // Reprints are the entity's OWN-PAGE fact — the roomy full card.
                additionalSources={compact || userMade ? undefined : provenance.additionalSources}
                footMeta={footMeta}
                externalLink={
                  extent === 'full' && !insidePeek && !userMade ? externalLinkNode : undefined
                }
                size={size}
                dashed={userMade}
                credit={userMade ? `Made by ${madeBy ?? 'a player'}` : undefined}
              />
            ))
          : null}
      </div>
    </CardOuter>
  )
}

/** Public wrapper props: the canonical card props plus the ergonomic display
 * sugar and a nullable `data`. */
export type ReferenceEntityCardWrapperProps = Omit<
  ReferenceEntityCardProps,
  'data' | 'size' | 'extent'
> & {
  data: ReferenceCardEntity | undefined
  size?: CardSize
  extent?: CardExtent
  /**
   * Let the reader fold this card down to LISTING (`extent="head"` — header
   * only) and back. Collapsed is the DEFAULT: a long collection reads as a
   * scannable list of names and stats, and the reader opens the one they want.
   *
   * Costs nothing when absent — the whole affordance is expressed through
   * existing `controls`: collapsed adds a hidden `cardClick` control (so the
   * whole card is the expand target), expanded adds a ghost chevron.
   */
  collapsible?: boolean
  /** Start folded. Only meaningful with `collapsible`; defaults to true. */
  defaultCollapsed?: boolean
}

/**
 * `ReferenceEntityCard` — the public entry point for rendering a reference
 * entity. It takes the `size` / `extent` axes (`shared/displayMode.ts`),
 * renders nothing for a null `data`, and greys the header for a damaged or
 * destroyed `status`. The recursive card body is `ReferenceEntityCardInner`.
 */
export function ReferenceEntityCard({
  data,
  size,
  extent,
  collapsible = false,
  defaultCollapsed = true,
  controls,
  texture,
  ...rest
}: ReferenceEntityCardWrapperProps): ReactNode {
  // Hook before the nullable-data guard — a conditional hook would break the
  // rules of hooks the first time a caller passed `undefined`.
  const [collapsed, setCollapsed] = useState(collapsible && defaultCollapsed)
  if (!data) return null

  const folded = collapsible && collapsed
  // Folding only overrides the EXTENT axis, so a collapsed card keeps
  // whatever size it was given.
  const display = resolveCardDisplay({ size, extent: folded ? 'head' : extent })

  const label = getReferenceEntityName(data)
  const foldControls: ReferenceEntityControl[] = !collapsible
    ? []
    : folded
      ? [
          {
            key: '__expand',
            // A VISIBLE chevron: the whole-card click alone left nothing on a
            // folded listing saying it opens. Both fold handlers are idempotent
            // setters, so the chevron's click bubbling to the card is harmless.
            icon: ChevronDown,
            variant: 'ghost',
            cardClick: true,
            ariaLabel: `Expand ${label}`,
            onClick: () => setCollapsed(false),
          },
        ]
      : [
          {
            key: '__collapse',
            icon: ChevronUp,
            variant: 'ghost',
            ariaLabel: `Collapse ${label}`,
            onClick: () => setCollapsed(true),
          },
        ]

  const card = (
    <ReferenceEntityCardInner
      data={data}
      size={display.size}
      extent={display.extent}
      controls={foldControls.length > 0 ? [...(controls ?? []), ...foldControls] : controls}
      // A folded card's whole surface is the expand target, so it needs an
      // accessible name saying what activating it does.
      {...(folded ? { cardClickLabel: `Expand ${label}` } : {})}
      {...rest}
    />
  )
  // `texture={false}` (the Dashboard, a tooltip) holds for every nested card.
  return texture === undefined ? (
    card
  ) : (
    <CardTextureContext.Provider value={texture}>{card}</CardTextureContext.Provider>
  )
}
