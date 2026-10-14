import type { ReactNode } from 'react'
import { useContext, useId, useState } from 'react'
import type {
  EntityInstance,
  SURefEntity,
  SURefEnumSchemaName,
  SURefMetaEntity,
  SURefObjectAnyPattern,
} from 'salvageunion-reference'
import {
  extractVisibleActions,
  foldedActionOf,
  formatCost,
  getAssetUrl,
  getChoices,
  getReferenceEntityName,
  getTechLevel,
  isAbility,
  isBioTitanPattern,
  isTitanicAction,
  resolveActivationCurrency,
  resolveGrantedEntities,
  toEntityModel,
} from 'salvageunion-reference'
import { fontSize, space } from '../../../design/tokens'
import type { RowSlots } from '../../../entity/forms/Row'
import { Row } from '../../../entity/forms/Row'
import type { TokenSlots } from '../../../entity/forms/Token'
import { Token } from '../../../entity/forms/Token'
import { Chips } from '../../../entity/parts/Chips'
import type { ChipSet } from '../../../entity/parts/chipSet'
import { InsidePeekContext } from '../../../entity/peekContext'
import { Badge } from '../../atoms/Badge'
import { assetSrcSetFor } from '../../compositions/assetSrcSet'
import type { CardExtent, CardSize } from '../../containers/displayMode'
import { resolveCardDisplay } from '../../containers/displayMode'
import type { StatItem } from '../../containers/statsBarTypes'
import { useEntityExternalLink } from '../entityHrefContext'
import { foldControl } from '../foldControl'
import { quotePatternName } from '../pattern/quotePatternName'
import type { ReferenceEntityControl } from '../referenceEntityControlTypes'
import { CardHead } from './CardHead'
import { CardLabels } from './CardLabels'
import { CardOuter } from './CardOuter'
import { CardPage } from './CardPage'
import { CardPennant } from './CardPennant'
import { CardTopRail } from './CardTopRail'
import type { CardBodyInput } from './cardBodyProse'
import { resolveBodyProse } from './cardBodyProse'
import { buildHeaderStats, resolveSubHeaderCells, resolveTechScaling } from './cardCells'
import type { HeaderFill } from './cardChrome'
import {
  resolveCardColors,
  resolveCardInteraction,
  resolveFrameWidth,
  resolveHeaderFill,
  resolveHeaderHint,
} from './cardChrome'
import type { CardGrain } from './cardGrain'
import { MAX_DEPTH, sectionHeadingLevel } from './cardHelpers'
import { resolveCardSections } from './cardSections'
import { CardTextureContext } from './cardTexture'
import { EntityCardIdentityFooter } from './EntityCardIdentityFooter'
import type { AxisMarker } from './entityCardTone'
import {
  resolveAxisMarkers,
  resolveCardTone,
  resolveEyebrow,
  resolveSeamLabel,
  resolveTierNumeral,
  titleSizeRung,
} from './entityCardTone'
import { splitFacets } from './facetSplit'
import { isLegalStartingPatternOf } from './legalStartingPattern'
import { CardLead, CardStack } from './NestedCards'
import { PatternList } from './PatternListRow'
import { PatternLoadoutRows } from './PatternLoadout'
import { resolveFooterProvenance } from './provenance'
import type {
  ActionFields,
  ReferenceCardEntity,
  ReferenceEntityCardHideConfig,
  ReferenceEntityCardProps,
} from './referenceEntityCardTypes'
import { StatusRail, StatusTriState } from './StatusRail'
import { stripHostParenthetical } from './stripHostParenthetical'

/**
 * ReferenceEntityCard — the ONE card that renders ENTITIES, ACTIONS, and
 * NPCs (ruleset §5, boards E1–E4). ONE anatomy across every size × extent ×
 * context:
 *
 *   flush header (title, labels, chip group) · body · footer
 *
 * with TWO header fills, chosen by the reader's question and decided by data
 * shape (`isDoEntity`), never a schema prop:
 *
 * - TONE, for things you HAVE: the entity's tone, ink speckle, the title in
 *   ink or paper by contrast.
 * - INK, for things you DO (abilities, actions): the book's ink banner — the
 *   tier numeral at the left, paper flecks. The cost is a chip; only the
 *   Dashboard's pennant button sits at the right.
 *
 * The frame and the footer are ink on paper on every card; the
 * tone lives in the header alone. An entity's own roll table sits inline as a
 * flush band; its actions, like nested ENTITIES, stack framed in
 * the frame, one size step per depth (large → medium → a one-line head row), the
 * frame stepping 3 → 2 → 1.5px with them.
 *
 * ## How this file is laid out
 *
 * `ReferenceEntityCardInner` DECIDES — fill, depth, which sections a card
 * carries, what each one is fed — and composes. What each section LOOKS like
 * lives beside it, one module per section: the labels
 * (`CardLabels`), the header (`EntityCardHeader`), the chip group
 * (`Chips`, E17), the Row and Token forms (`src/entity/`), the prose bands
 * (`CardProse`), the body interleave, choices (`ChoiceRegion`), the roll table
 * (`CardRollTable`), the pennant button (`CardPennant`), the trays, inline
 * actions and depth rows (`NestedCards`). The pure cell/stat builders are in
 * `cardCells.ts`, the chrome rules in `cardChrome.ts`.
 *
 * Sections that nest cards receive this card as `NestedCard`, never importing
 * it, so no section module imports back into this one.
 */

/**
 * What a card hides. CATALOG — the SRD index tile — keeps artwork and
 * description ONLY, so every nested element is suppressed here, not at each
 * call-site. TERMINAL (ruleset §1, board E3): inside a tooltip popup nothing
 * acts, so the roll-table controls go too (the link, depth-2 rows and the
 * actions chip are handled where they render).
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
 * The title's type step: by size, stepping down with depth (`titleSizeClass`). The ink
 * banner's large title sits a rung under the tone header's (board E1); an inline band its own.
 */
function resolveTitleSize(inline: boolean, fill: HeaderFill, depth: number, size: CardSize) {
  if (inline) return INLINE_TITLE[size]
  const ladderTitle = titleSizeRung(depth, size)
  return fontSize[fill === 'ink' && ladderTitle === 'displayLg' ? 'display' : ladderTitle]
}

/** An inline action's title: one step under its host's (board E1). */
const INLINE_TITLE: Record<CardSize, string> = {
  large: fontSize.readout,
  medium: fontSize.readout,
  small: fontSize.lede,
}

/**
 * What leads a page's prose column: any `subtitleExtra`, then a "Suggested"
 * stamp. The page's chips are its chapter band's (`resolveEntityPageMeta`).
 */
function PageSubLine({
  extra,
  children,
}: {
  extra: ReactNode
  /** The leading stamp ("Suggested"). */
  children: ReactNode
}) {
  return (
    <>
      {extra}
      <Chips
        chips={NO_CHIPS}
        rung="full"
        leading={children}
        align="end"
        className="su-entity-page__tags"
      />
    </>
  )
}

const NO_CHIPS: ChipSet = { durations: [], facts: [], tags: [] }

/**
 * The head extent as the entity forms (the adapter): the SHORTFORM
 * (`size="small" extent="head"`) is the Token, the COMPACT CARD the Row, each
 * given the slots this card resolved from its props.
 */
function HeadForm({
  entity,
  pattern,
  instance,
  shared,
  token,
  row,
}: {
  entity: SURefMetaEntity
  pattern: SURefObjectAnyPattern | undefined
  instance: EntityInstance
  shared: Pick<RowSlots, 'outer' | 'frameStyle' | 'down'>
  token: Pick<TokenSlots, 'kind' | 'pennant' | 'cost'> | false
  row: RowSlots
}) {
  const model = toEntityModel(entity, undefined, { pattern })
  if (token) return <Token model={model} instance={instance} slots={{ ...shared, ...token }} />
  return <Row model={model} instance={instance} slots={{ ...shared, ...row }} />
}

function ReferenceEntityCardInner({
  data,
  size: sizeProp = 'large',
  extent = 'full',
  depth: depthProp = 0,
  presentation = 'card',
  showChassisAbility,
  inline = false,
  shownProse,
  userMade = false,
  madeBy,
  kicker,
  texture,
  parentSeal,
  readable = false,
  pattern,
  hostName,
  hostDown,
  chassisName,
  droneLoadout,
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
  selections,
  onSelectionChange,
  titleOverride,
  statsOverride,
  primaryStatsOnly,
  subtitleExtra,
  abilitiesSection,
  afterExtraContent,
  asideLead: asideLeadRequested = false,
  footMeta,
  className,
  titleAs,
  scalingParent,
  expand,
}: ReferenceEntityCardProps) {
  // Section bands are h2s (nested titles h3s) only when this card IS the page
  // (`sectionHeadingLevel`), whatever `titleAs` says: a page's title is its h1,
  // in the chapter band. A card the page carries takes only its chips' rung.
  const onPage = presentation === 'page' && !inline && depthProp === 0
  const rung = presentation === 'page' && !onPage ? 'full' : 'compact'
  const sectionAs = sectionHeadingLevel(onPage ? 'h1' : titleAs)

  // MULTI-SELECT: a card driven by `onCountChange` reads as selected whenever its
  // chosen quantity is ≥ 1, unless `selected` is set explicitly.
  const countValue = count ?? 0
  const isMultiSelect = !!onCountChange
  const selected = selectedProp ?? (isMultiSelect ? countValue >= 1 : undefined)

  // `SalvageUnionReference.*.all()` entities carry a runtime `schemaName` the
  // static `SURefEntity` union omits: the display system's boundary cast.
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
  const { onBand, bandColor } = resolveCardColors({ tone, isDown, fill })
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
  const titleSize = resolveTitleSize(inline, fill, depth, size)
  // ARTWORK — a MINI catalog tile drops it: at the small size the image would
  // crowd out the description it exists to caption.
  const isMiniCatalog = isCatalog && size === 'small'
  const assetUrl = isMiniCatalog || inline ? undefined : getAssetUrl(entity)
  const assetSrcSet = assetSrcSetFor(assetUrl)

  // PATTERN view — the pattern is the subject; the chassis (`entity`) supplies
  // stats / tone / source. A `head` pattern is a LIST ROW.
  const isPattern = !!pattern
  const isPatternListing = isPattern && extent === 'head'
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
  // The KIND ("System", "Ability · Forging Tree") is never stamped (E9): the
  // title carries it for screen readers. A caller's `kicker` that says more
  // ("From Veteran") is a label.
  const kind = isPattern ? 'Pattern' : resolveSeamLabel(schemaName, entity)
  const footerType =
    isAction || isPattern || hide?.footKind ? undefined : resolveEyebrow(schemaName).type
  const provenance = resolveFooterProvenance(entity, pattern)
  const chassisMarker = resolvedChassisName
    ? [{ label: 'Chassis', value: resolvedChassisName }]
    : []
  const axisMarkers: AxisMarker[] =
    isAction || hide?.axisMarkers ? [] : isPattern ? chassisMarker : resolveAxisMarkers(entity)
  // "Legal Starting Pattern" is a STORED data tag on the pattern.
  const isLegalStartingPatternCard = isPattern && isLegalStartingPatternOf(pattern)
  const numeral = resolveTierNumeral(entity)

  // The SELF-action — an action named like its entity — folds into the card:
  // its content becomes the body and its facets the "//" line (see
  // `foldedActionOf`). Every other action sits inline below.
  const foldableActions =
    !isAction &&
    !isPattern &&
    depth < MAX_DEPTH &&
    !(isAbility(entity) && resolveGrantedEntities(entity as SURefEntity).length > 0)
      ? (extractVisibleActions(entity) ?? []).filter((a) => !isTitanicAction(a))
      : []
  const foldedAction = foldedActionOf(foldableActions, entityName)
  const foldedActionFields: ActionFields | undefined = foldedAction ?? undefined

  // The LABELS, right of the title: a parent seal (GRANTS) replaces the note.
  const labels = (
    <CardLabels
      seal={parentSeal}
      note={parentSeal ? undefined : kicker}
      axisMarkers={axisMarkers}
      legalStartingPattern={isLegalStartingPatternCard}
      userMade={userMade}
      onInk={fill === 'ink'}
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
  const effectiveHeaderStats: StatItem[] = statsOverride ?? headerStats

  // COST PENNANT — the action's own cost, or its folded self-action's. In the
  // Dashboard a `pennant` control makes it the action button.
  const costSource = action ?? foldedActionFields
  const costLabel =
    costSource?.activationCost != null
      ? formatCost(costSource.activationCost, resolveActivationCurrency(costSource.actionSource))
      : undefined
  // Read, the cost is a chip; the Dashboard's `pennant` control is the button.
  const pennantControl = controls?.find((c) => c.pennant)
  const pennantNode: ReactNode = pennantControl ? (
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
  // E17: every chip in ONE group: the action type, the cost, the facts, the traits.
  const facets = splitFacets(cells)
  const chips: ChipSet = {
    durations: facets.stamps,
    ...(costLabel && !pennantControl ? { cost: costLabel } : {}),
    facts: [...effectiveHeaderStats, ...facets.facts],
    tags: facets.tags,
  }
  // A page's chips ride its band (`resolveEntityPageMeta`); its body keeps "Suggested".
  const hasSubLine = onPage && !!suggestedNode

  // The head extent is the Row (and, small, the Token): see below. Every other
  // card wears the cut-out head; a Page has its chapter band, an inline card its Row.
  const isHead = extent === 'head'
  const header = (
    <CardHead
      cutOut={!inline && !isHead && !onPage}
      title={name}
      kind={kind}
      fill={fill}
      titleAs={titleAs}
      bandColor={bandColor}
      titleSize={titleSize}
      titleColor={onBand === 'ink' ? 'var(--color-ink)' : 'var(--color-paper)'}
      numeral={numeral}
      chips={<Chips chips={chips} rung={rung} onInk={fill === 'ink'} leading={suggestedNode} />}
      pennant={pennantNode}
      labels={inline ? undefined : labels}
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
  const rendersFooter = !inline && !isCatalog && depth === 0
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
  // COMPACT CARD (`extent="head"`) the Row form: this card is their adapter,
  // translating its props into the forms' slots.
  if (isHead) {
    return (
      <HeadForm
        entity={entity}
        pattern={pattern}
        instance={{ title: name, ...(userMade ? { userMade } : {}) }}
        shared={{ outer, frameStyle, down: isDown }}
        token={
          size === 'small' && {
            kind,
            pennant: isAction ? pennantNode : undefined,
            cost: isAction ? chips.cost : undefined,
          }
        }
        row={{
          labels: labels ?? null,
          rail: topRightRail,
          titleAs,
          facts: chips.facts,
          tags: chips.tags,
          durations: chips.durations,
          cost: chips.cost ?? null,
          leading: suggestedNode,
          hint: headerHint,
          pennant: pennantNode,
          art: !(isPattern || inline || hide?.image),
          bodyless: inline || isPatternListing,
        }}
      />
    )
  }

  // BODY — the prose, the inline actions, the table, the guide, the pattern
  // section and the nested groups (`cardBodyProse.tsx`, `cardSections.tsx`).
  const bodyInput: CardBodyInput = {
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
    isAction,
    isCatalog,
    isDown,
    isTitanicMeta,
    isLegalStartingPatternCard,
    hasSubLine,
    asideLeadRequested,
    tone,
    hide,
    foldedAction,
    titanicBodyContent,
    hintText,
    leadHint,
    assetUrl,
    assetSrcSet,
    effTechLevel,
    dataValueBonuses,
    entityChoices,
    sectionAs,
    shownProse,
    parentSeal,
    droneLoadout,
    scalingParent,
    selections,
    onSelectionChange,
    afterExtraContent,
    abilitiesSection,
    showChassisAbility,
    NestedCard: ReferenceEntityCardInner,
  }
  const resolved = resolveBodyProse(bodyInput)
  const { chassisAbilityEntities, gridActions, titanicActions, patternList } = resolved
  const {
    rollTableNode,
    guideStepsNode,
    heroNode,
    bodyHasContent,
    bodyContent,
    body,
    actionsNode,
    patternSection,
    pageLoadout,
    nestedGroupsNode,
  } = resolveCardSections(bodyInput, resolved)

  // A PAGE (boards 07, 08): the card's parts laid out as a page (`CardPage`).
  if (onPage) {
    return (
      <CardPage
        entity={entity}
        hero={heroNode}
        leadActions={hide?.actions ? [] : chassisAbilityEntities}
        otherActions={hide?.actions ? [] : [...gridActions, ...titanicActions]}
        subLine={
          (subtitleExtra || hasSubLine) && (
            <PageSubLine extra={subtitleExtra}>{suggestedNode}</PageSubLine>
          )
        }
        body={bodyHasContent ? bodyContent : null}
        opening={patternSection}
        loadout={<PatternLoadoutRows groups={pageLoadout} as={sectionAs} hostDown={isDown} />}
        bodyLabel={
          isPattern
            ? `${resolvedChassisName ?? entityName} ${isBioTitanPattern(pattern) ? 'Bio-Titan' : 'chassis'}`
            : undefined
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
  // no frame, no labels, no footer (board E1).
  if (inline) {
    return (
      <section className="su-ec-inline">
        {header}
        {body}
        {rollTableNode}
      </section>
    )
  }

  return (
    <CardOuter {...outer}>
      {topRightRail}
      {/* The frame lives on this INNER clip, so the rail escapes it; paper,
        radius and clip are `.su-ec-frame` (ADR-046), weight and dash ours. */}
      <div className="su-ec-frame" style={frameStyle}>
        {header}
        {/* SLOT: subtitleExtra — an extra line under the header (absent ⇒ nothing). */}
        {subtitleExtra && (
          <div style={{ padding: `${space[4]} ${compact ? space[10] : space[14]} 0` }}>
            {subtitleExtra}
          </div>
        )}
        {body}
        <CardLead
          bare={!subtitleExtra && !body}
          nested={!!(actionsNode || nestedGroupsNode || expand)}
          table={rollTableNode}
          size={size}
        />
        {patternSection}
        {actionsNode}
        {nestedGroupsNode}
        {/* BASIC CHASSIS → its patterns as head rows. */}
        {!hide?.patterns && patternList.length > 0 && (
          <CardStack size={size}>
            <PatternList
              chassis={entity}
              chassisName={entityName}
              patterns={patternList}
              depth={depth + 1}
              hostDown={isDown}
              NestedCard={ReferenceEntityCardInner}
            />
          </CardStack>
        )}
        {/* SLOT: afterExtraContent — trailing body content (absent ⇒ nothing). */}
        {afterExtraContent && (
          <div style={{ padding: compact ? space[10] : `${space[12]} ${space[14]}` }}>
            {afterExtraContent}
          </div>
        )}
        {/* SLOT: expand — before the footer (a crawler bay's crew inset). */}
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
        {/* FOOTER — none on a catalog tile; a Peek's wears the header band. */}
        {rendersFooter ? (
          // USER-MADE (ruleset §3.9): the credit is the maker, never a page.
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
            band={insidePeek ? { onBand, bandColor } : undefined}
          />
        ) : null}
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
   * Let the reader fold this card to LISTING (`extent="head"`) and back;
   * folded is the DEFAULT, so a long collection reads as a list of names.
   * The affordance is ONE `controls` entry: a chevron with `aria-expanded` and
   * `aria-controls` (the card wrapper's id, `resolveCardInteraction`), and,
   * folded, a `cardClick` so a click anywhere opens it.
   */
  collapsible?: boolean
  /** `false`: no chevron while folded; the card itself is the disclosure button. */
  foldChevron?: boolean
}

/**
 * `ReferenceEntityCard` — the public entry point for rendering a reference
 * entity. It takes the `size` / `extent` axes (`containers/displayMode.ts`),
 * renders nothing for a null `data`, and greys the header for a damaged or
 * destroyed `status`. The recursive card body is `ReferenceEntityCardInner`.
 */
export function ReferenceEntityCard({
  data,
  size,
  extent,
  collapsible = false,
  foldChevron = true,
  controls,
  texture,
  ...rest
}: ReferenceEntityCardWrapperProps): ReactNode {
  // Hook before the nullable-data guard — a conditional hook would break the
  // rules of hooks the first time a caller passed `undefined`.
  const [collapsed, setCollapsed] = useState(collapsible)
  const surfaceId = useId()
  if (!data) return null

  const folded = collapsible && collapsed
  // Folding only overrides the EXTENT axis, so a collapsed card keeps
  // whatever size it was given.
  const display = resolveCardDisplay({ size, extent: folded ? 'head' : extent })

  const label = getReferenceEntityName(data)
  const foldControls: ReferenceEntityControl[] = !collapsible
    ? []
    : [
        foldControl({
          subject: label ?? '',
          folded,
          surfaceId,
          onToggle: () => setCollapsed((c) => !c),
          cardClick: true,
          hidden: folded && !foldChevron,
        }),
      ]

  const card = (
    <ReferenceEntityCardInner
      data={data}
      size={display.size}
      extent={display.extent}
      controls={foldControls.length > 0 ? [...(controls ?? []), ...foldControls] : controls}
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
