import { ChevronDown, ChevronUp } from 'lucide-react'
import type { ReactNode } from 'react'
import { useState } from 'react'
import type {
  SURefEntity,
  SURefEnumSchemaName,
  SURefMetaEntity,
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
  resolveActivationCurrency,
  resolveGrantedEntities,
} from 'salvageunion-reference'
import { isLegalStartingPattern } from 'salvageunion-reference/rules'
import { cn } from '../../../utils/cn'
import { Badge } from '../../chrome/Badge'
import { ActivationCost } from '../../shared/ActivationCost'
import { assetSrcSetFor } from '../../shared/assetSrcSet'
import { CardImage } from '../../shared/CardImage'
import type { CardExtent, CardSize } from '../../shared/displayMode'
import { resolveCardDisplay } from '../../shared/displayMode'
import type { StatItem } from '../../shared/statsBarTypes'
import { useEntityExternalLink } from '../entityHrefContext'
import type { ReferenceEntityControl } from '../referenceEntityControlTypes'
import { accentSurface } from '../referenceEntityHelpers'
import { BonusPerTechLevel } from './BonusPerTechLevel'
import { resolveBodyBlocks, resolveBodyLayout } from './bodyBlocks'
import { interleaveBody } from './bodyInterleave'
import type { CardProseContext } from './CardProse'
import { CardProse, FoldedActionProse, PatternProse } from './CardProse'
import { CardRollTable } from './CardRollTable'
import { CardSeam } from './CardSeam'
import { CardShortform } from './CardShortform'
import { CardTopRail } from './CardTopRail'
import { ChoiceRegion } from './ChoiceRegion'
import type { BonusCell } from './cardCells'
import {
  bonusCells,
  buildHeaderStats,
  resolveSubHeaderCells,
  resolveTechScaling,
} from './cardCells'
import { resolveCardColors, resolveCardInteraction, resolveHeaderHint } from './cardChrome'
import {
  choiceRendersNothing,
  isRulesBearing,
  isTitanicAction,
  MAX_DEPTH,
  sectionHeadingLevel,
} from './cardHelpers'
import { resolveCatalogLeadBlocks } from './catalogLead'
import type { AnchoredContentBlock } from './choiceAnchoring'
import { anchorBonusMarker, anchorChoiceMarkers } from './choiceAnchoring'
import { DamagedEffectCallout } from './DamagedEffectCallout'
import { EntityCardHeader } from './EntityCardHeader'
import { EntityCardIdentityFooter } from './EntityCardIdentityFooter'
import { EntityCardSubHeader } from './EntityCardSubHeader'
import type { AxisMarker } from './entityCardTone'
import {
  resolveAxisMarkers,
  resolveCardTone,
  resolveEyebrow,
  titleSizeClass,
} from './entityCardTone'
import { GuideSteps } from './GuideSteps'
import { HeaderHint } from './HeaderHint'
import type { NestedCardHost } from './NestedCards'
import {
  DroneCards,
  ListingGroup,
  NestedCardGroup,
  NestedCardList,
  NpcAnchor,
  TitanicActionCards,
} from './NestedCards'
import { resolveNestedSections } from './nestedSections'
import { PatternList } from './PatternListRow'
import { PatternLoadout } from './PatternLoadout'
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
import { stripHostParenthetical } from './stripHostParenthetical'

/**
 * ReferenceEntityCard — the ONE card that renders ENTITIES, ACTIONS, and
 * NPCs, driven by two parameters:
 *
 * - **TONE** (what it is): domain hue for entities, tech-level blue for gear,
 *   navy for actors/NPCs, and RUST for actions. Header band = the tone;
 *   sub-header + footer = a darker shade.
 * - **DEPTH** (nesting level): 0 = full/solo (large name-tab, footer, full
 *   body); ≥1 = nested (compact, no footer, header font steps down one rung per
 *   level, body shows nested groups).
 *
 * Every card has the same bands: seam (type stamp + axis pills) · header (black
 * name-tab + stats/AP axis) · sub-header (Stat cells only) · body ·
 * footer (depth 0 only). Nested groups (Grants/Systems/Modules/Drones/NPCs/
 * Actions) each render a `Slab` separator + a 2-up grid of depth+1 cards;
 * actions are rust, always compact, AP via `ActivationCost`.
 *
 * ## How this file is laid out
 *
 * `ReferenceEntityCardInner` DECIDES — tone, depth, which sections a card
 * carries, what each one is fed — and composes. What each section LOOKS like
 * lives beside it, one module per section (audit PK-08: this body was 1,880
 * lines, edited by six workstreams at once): the seam (`CardSeam`), the
 * shortform badge (`CardShortform`), the prose bands (`CardProse`), the body
 * interleave (`bodyInterleave`), choices (`ChoiceRegion`), the Bonus per Tech
 * Level box, the damaged callout, guide steps, nested-card groups
 * (`NestedCards`), a pattern's loadout and a chassis's pattern rows. The pure
 * cell/stat builders are in `cardCells.ts`, the shared helpers in
 * `cardHelpers.tsx`, the prop types in `referenceEntityCardTypes.ts`.
 *
 * The sections that render nested cards receive this card as `NestedCard`
 * rather than importing it, which keeps every section module free of a
 * circular import back to this one.
 */

function ReferenceEntityCardInner({
  data,
  size: sizeProp = 'large',
  extent = 'full',
  depth: depthProp = 0,
  parentSeal,
  pattern,
  hostTone,
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
  cardStyle,
  titleAs,
  scalingParent,
  expand,
}: ReferenceEntityCardProps) {
  // Section bands become real headings only when this card IS the page — see
  // `sectionHeadingLevel` above for why, and for what deliberately stays a span.
  const sectionAs = sectionHeadingLevel(titleAs)

  // MULTI-SELECT: a card driven by `onCountChange` reads as selected whenever its
  // chosen quantity is ≥ 1, unless `selected` is set explicitly. Single-select
  // cards keep passing `selected` directly (unchanged).
  const countValue = count ?? 0
  const isMultiSelect = !!onCountChange
  const selected = selectedProp ?? (isMultiSelect ? countValue >= 1 : undefined)

  // `SalvageUnionReference.*.all()` entities carry a runtime `schemaName`
  // discriminant that isn't reflected in the static `SURefEntity` union type —
  // the same cast-at-the-boundary pattern used throughout the display system.
  const entity = data as SURefMetaEntity
  // App-supplied cross-link (ITUN's "View in SRD →"). Must be read here,
  // above the `!schemaName` / extent early-returns below, so the hook runs
  // unconditionally on every render. The app-facing builder contract stays
  // `SURefEntity` — the same boundary cast as `entity` above.
  const externalLinkNode = useEntityExternalLink(data as SURefEntity)
  const schemaName = (
    'schemaName' in entity && typeof entity.schemaName === 'string' ? entity.schemaName : undefined
  ) as SURefEnumSchemaName | 'actions' | undefined

  if (!schemaName) {
    console.warn('ReferenceEntityCard: data does not have a schemaName property', data)
    return null
  }

  const isAction = schemaName === 'actions'
  // Actions are ALWAYS nested (never solo on their own SRD page), so an action
  // can only render compact or compact-listing — never full. Coerce a full-size
  // action to compact (min depth 1) so the full-size path can't be reached.
  const size: CardSize = isAction && sizeProp === 'large' ? 'medium' : sizeProp
  const depth = isAction ? Math.max(depthProp, 1) : depthProp
  // A NESTED NPC (one summoned by a parent that threaded `hostTone` down) is
  // dimmed the same way actions are — it ghosts the PARENT's tone, not its own
  // navy. A standalone/top-level NPC (no host tone) keeps its navy domain tone.
  const isNestedNpc = schemaName === 'npcs' && hostTone != null
  const isGhosted = isAction || isNestedNpc
  const compact = depth > 0 || size !== 'large'
  // CATALOG — the SRD index tile. Compact, artwork + description ONLY. Every
  // nested element is suppressed here rather than at each call-site, so a
  // listing page reads uniformly no matter what the entity happens to carry
  // (a chassis's patterns, an ability's grants, a crawler bay's roll table).
  // Nested ENTITIES/actions are cut via `canExpand` below; these flags cut the
  // in-body sections, layering over whatever the consumer passed.
  const isCatalog = extent === 'catalog'
  const hide: ReferenceEntityCardHideConfig | undefined = isCatalog
    ? { ...hideProp, actions: true, choices: true, patterns: true }
    : hideProp
  const tone = resolveCardTone(schemaName, entity)
  // A damaged/destroyed card — or one nested under a damaged host — greys its
  // whole tone; actions and nested NPCs ghost their host's (see `resolveCardColors`).
  const isDown = status === 'damaged' || status === 'destroyed' || !!hostDown
  const { onBandText, headerBg, headerBgColor, darkTone, frameColor, ownToneBase } =
    resolveCardColors({ tone, isDown, isGhosted, hostTone })
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
  // Title size steps down with depth, offset by size: `large` starts at the full
  // text-5xl name-tab, `medium` one rung down (text-xl), `small` two (text-base)
  // — so "compact" actually compacts the title. Size is an OFFSET, not a floor,
  // so a card at depth N+1 is always strictly smaller than its parent at depth N
  // (until the ladder's legibility floor). See `titleSizeClass`.
  const titleClass = titleSizeClass(depth, size)
  // ARTWORK — `getAssetUrl` yields the entity's `.webp` when `hasArtwork`, and
  // `assetSrcSetFor` derives its width-constrained candidates; the chassis art
  // also stands in for its full PATTERN view (but not the tight pattern-summary
  // list rows).
  //
  // A MINI catalog tile drops the artwork entirely: the catalog extent is
  // artwork + description, and at the small size the image would crowd out the
  // description it exists to caption, leaving a tile that is all picture and no
  // label. Every other size keeps it.
  const isMiniCatalog = isCatalog && size === 'small'
  const assetUrl = isMiniCatalog ? undefined : getAssetUrl(entity)
  const assetSrcSet = assetSrcSetFor(assetUrl)

  // PATTERN view — the pattern is the subject; the chassis (`entity`) supplies
  // stats / tone / source. Patterns carry NO stampseal. A `size="medium" extent="head"`
  // pattern is a LIST ROW: name-tab left, description on the header right.
  const isPattern = !!pattern
  const isPatternListing = isPattern && extent === 'head'
  // A pattern's title is its name in QUOTES — `"SURVEYOR"`. The word "Pattern"
  // is no longer carried in the data (chassis.json), so nothing to strip here.
  // A nested ACTION drops its ` (Host)` disambiguation suffix when the host is
  // this card's own context (display only — `entityName` keeps the full name).
  const name =
    titleOverride ??
    (isPattern
      ? `"${pattern.name}"`
      : isAction
        ? stripHostParenthetical(entityName, hostName)
        : entityName)
  const effectiveSeal = parentSeal
  // `[(CHASSIS)]` content tokens resolve to the owning chassis name — this card's
  // own name when it IS a chassis, else the name threaded down from the parent.
  const resolvedChassisName = chassisName ?? (schemaName === 'chassis' ? entityName : undefined)

  // SEAM — type stamp + axis pills. Actions show their action type; a pattern
  // reads "Pattern"; entities show the schema type + classification pills.
  const action = isAction ? (entity as ActionFields) : undefined
  // The "Titanic Actions" entry is a meta-descriptor for the titanic-action
  // SYSTEM, not a regular action — it suppresses the "Action" seam stamp and
  // shows its rules text as a header hint (not in the body).
  const isTitanicMeta = isAction && isTitanicAction(entity)
  // Actions AND patterns carry NO seam type stamp — an action's classification
  // lives in the sub-header row (see actionCells); patterns just show the name.
  // Entities show their schema type. On FULL cards the type moves to the footer
  // (see below), so the seam only shows it on NESTED cards.
  const seamType = isPattern || isAction ? undefined : resolveEyebrow(schemaName).type
  // The entity TYPE for the depth-0 footer (patterns read "Pattern"; actions
  // never render a depth-0 footer).
  const footerType = isAction ? undefined : isPattern ? 'Pattern' : resolveEyebrow(schemaName).type
  // FOOTER PROVENANCE — the pattern's own on a pattern card that carries a
  // source, else the entity's; never a mix (see `resolveFooterProvenance`).
  const provenance = resolveFooterProvenance(entity, pattern)
  // A PATTERN names its owning chassis as a horizontal stat stampseal in the
  // seam — `[Chassis | Little Sestra]` — rather than a bare stampseal, so it
  // reads as the same `[label | value]` pill vocabulary as every other axis.
  // (On a pattern card the `entity` IS the chassis, so `resolvedChassisName`
  // is that chassis's own name.)
  const axisMarkers: AxisMarker[] = isAction
    ? []
    : isPattern
      ? resolvedChassisName
        ? [{ label: 'Chassis', value: resolvedChassisName }]
        : []
      : resolveAxisMarkers(entity)
  // "Legal Starting Pattern" is a STORED data tag on the pattern, set only where
  // the source book calls it out — never derived from an SV budget (that older
  // computed version wrongly badged every untagged pattern).
  const isLegalStartingPatternCard = isPattern && isLegalStartingPattern(pattern.legalStarting)

  // The lone non-titanic action that FOLDS into this entity's body: its content
  // goes in the body, and its sub-header STATS (type/range/damage/cost) merge
  // into THIS entity's sub-header (so a single-action item like Grenade doesn't
  // lose "Turn Action · Range · Damage" the way inlining content alone would).
  const foldableActions =
    !isAction &&
    !isPattern &&
    depth < MAX_DEPTH &&
    !(isAbility(entity) && resolveGrantedEntities(entity as SURefEntity).length > 0)
      ? (extractVisibleActions(entity) ?? []).filter((a) => !isTitanicAction(a))
      : []
  // Fold the SELF-action (same-named) regardless of the entity's action count;
  // otherwise a lone action still folds its facets. Siblings render as their own
  // cards below (gridActions). See resolveFoldedAction for the full rule.
  const foldedAction = resolveFoldedAction(foldableActions, entityName)
  const foldedActionFields: ActionFields | undefined = foldedAction ?? undefined

  // Type stamp on NESTED cards only — full cards show the type in the footer.
  // Suppressed when a parent seal already brands the card (e.g. a "Grants"
  // nested card): the seal is the contextually-informative stamp, so the
  // redundant schema-type stamp is dropped to keep ONE stamp on the seam.
  const seam = (
    <CardSeam
      seal={effectiveSeal}
      typeStamp={depth > 0 && !effectiveSeal ? seamType : undefined}
      axisMarkers={axisMarkers}
      legalStartingPattern={isLegalStartingPatternCard}
    />
  )

  // HEADER axis — entities/patterns cluster their (chassis) stats; actions put
  // AP in the header; a pattern SUMMARY row shows none. Built twice for a
  // non-compact card: the header falls back to the compact cells when it is too
  // narrow to seat its value boxes (see `buildHeaderStats`).
  const headerStatsFor = (asCompact: boolean): StatItem[] =>
    buildHeaderStats({
      entity,
      schemaName,
      asCompact,
      none: isAction || isPatternListing,
      primaryOnly: !!primaryStatsOnly || extent === 'head',
      techLevel,
      techLevelDisplay,
      techLevelModified,
    })
  const headerStats: StatItem[] = headerStatsFor(compact)
  const narrowHeaderStats: StatItem[] = compact ? headerStats : headerStatsFor(true)

  const costSource = action ?? foldedActionFields
  const costNode: ReactNode =
    costSource?.activationCost != null ? (
      <ActivationCost
        cost={costSource.activationCost}
        currency={resolveActivationCurrency(costSource.actionSource)}
        compact={compact}
      />
    ) : undefined

  // SUGGESTED — a rust stamp that LEADS the sub-header row (before the cost box),
  // marking a recommended pick. Rust ground, paper text (the on-ink stamp's bg
  // overridden to rust via tailwind-merge).
  const suggestedNode: ReactNode = suggested ? (
    <Badge shape="stamp" size="mini" className="bg-rust text-paper">
      Suggested
    </Badge>
  ) : undefined
  // Compose the sub-header leading: the Suggested stamp first, then any cost box.
  const subHeaderLeading: ReactNode = suggestedNode ? (
    <>
      {suggestedNode}
      {costNode}
    </>
  ) : (
    costNode
  )

  // The header's top-right hint: an ability's description, the titanic
  // meta-action's intro, or a pattern row's first paragraph.
  const { hintText, titanicBodyContent } = resolveHeaderHint(entity, {
    isTitanicMeta,
    patternListingContent: isPatternListing ? pattern.content : undefined,
  })
  const flavorNode: ReactNode = hintText ? (
    <HeaderHint text={hintText} onBandText={onBandText} compact={compact} />
  ) : undefined

  // WRITE LAYER header composition (all additive):
  // - statsOverride replaces the built stats (e.g. editable sheet stats); hide
  //   suppresses them.
  // - status chip leads the right cluster; rightContent overrides the flavor.
  const effectiveHeaderStats: StatItem[] = hide?.stats ? [] : (statsOverride ?? headerStats)
  // Override stats are the caller's own labels, so they serve BOTH anatomies —
  // an editable sheet stat (SP / EP / HEAT) is already short-form.
  const effectiveNarrowStats: StatItem[] = hide?.stats ? [] : (statsOverride ?? narrowHeaderStats)
  const effectiveRightContent: ReactNode = rightContentProp ?? flavorNode
  // Consumer-supplied select/alter interactivity lives in the controls bar. The
  // condition toggle (Intact/Damaged/Destroyed) is NOT here — it rides the
  // top-right frame as its own stamp-seal (`statusSealNode` below).
  const overlayControls: ReferenceEntityControl[] | undefined = controls
  const titleTextClass = onBandText
  const header = (
    <EntityCardHeader
      title={name}
      titleSlot={titleSlot}
      titleAs={titleAs}
      bg={headerBg}
      bgColor={headerBgColor}
      titleClass={titleClass}
      titleTextClass={titleTextClass}
      stats={effectiveHeaderStats}
      narrowStats={effectiveNarrowStats}
      rightContent={effectiveRightContent}
      listing={extent === 'head'}
      compact={compact}
    />
  )

  // WRITE LAYER — whole-card affordances (see `resolveCardInteraction`).
  const { outerClassName, outerInteraction, frameStyle } = resolveCardInteraction({
    onCardClick,
    controls,
    cardClickable,
    disabled,
    selectable,
    className,
    cardStyle,
    selectionRole,
    cardClickLabel,
    selected,
    frameColor,
  })
  // The footer band is what CLOSES a card: a full card ends on a solid strip of
  // deep tone. Without one — a collapsed listing, a nested card, `hide.footer` —
  // the frame's 3px bottom is the only thing terminating it, and it reads thin
  // against the weight of the header band above. Doubling it puts comparable
  // visual weight back at the foot.
  const FOOTLESS_BOTTOM = { borderBottomWidth: '6px' }
  // A CATALOG tile carries NO footer band. That band is authorship (source ·
  // booklet · page) plus the entity type, and on an index page every tile in the
  // grid is the same type — so the row is attribution over redundancy, repeated
  // on every card. A tile is artwork + description; provenance belongs on the
  // entity's own page, which the tile links to.
  const rendersFooter = !hide?.footer && !isCatalog && (footerOverride != null || depth === 0)
  const topRightRail = (
    <CardTopRail
      controls={overlayControls}
      status={status}
      onStatusClick={onStatusClick}
      subject={entityName}
      compact={compact}
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

  // BADGE — the SHORTFORM token: a single tone-filled pill (see `CardShortform`).
  // Actions render it too: their type reads "Action" and, carrying no TL/tree,
  // they show no tail.
  if (size === 'small' && extent === 'head') {
    return (
      <CardShortform
        outerClassName={outerClassName}
        outerInteraction={outerInteraction}
        accent={accentSurface(headerBg, headerBgColor)}
        frameStyle={frameStyle}
        onBandText={onBandText}
        name={name}
        action={action}
        costNode={costNode}
        axisMarkers={axisMarkers}
        techLevel={techLevel}
      />
    )
  }

  // Frame lives on the INNER clipping element (3px tone, radius + clip on one
  // element — the mockup `.ec`). The OUTER div is overflow-visible only so the
  // seam escapes the clip.
  if (extent === 'head') {
    return (
      <div className={outerClassName} {...outerInteraction}>
        {seam}
        {topRightRail}
        <div
          className="flex flex-1 flex-col overflow-hidden rounded-card bg-paper"
          style={{ ...frameStyle, ...FOOTLESS_BOTTOM }}
        >
          {header}
        </div>
      </div>
    )
  }

  // SUB-HEADER cells — action range/damage/traits, then entity traits, then the
  // datavalues, with anything a choice or the Tech Level changed bordered rust
  // (see `resolveSubHeaderCells`). `hide.choices` still suppresses choices
  // entirely; none is ever hoisted to this row.
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

  // BODY — content + nested groups. Granting abilities collapse: the ability's
  // own content AND actions are suppressed (they belong to the granted entity);
  // its description shows as header flavor, then the Grants nested cards.
  const grantedCount = resolveGrantedEntities(entity as SURefEntity).length
  // A granting ability normally collapses its own prose in favour of the granted
  // entity cards. A catalog tile suppresses those cards, so it must NOT collapse
  // — otherwise the tile renders with no description at all.
  const isGrantingAbility = !isCatalog && isAbility(entity) && grantedCount > 0
  // (The CATALOG LEAD — the prose a tile borrows when it has none of its own —
  // is resolved after the body walk below, once that prose is known.)
  // CATALOG guide lead — a guide keeps most of its prose in `steps`, which a
  // catalog tile never expands (`canExpand` is false here). That left tiles in
  // two broken states at once: guides with a long preamble dumped all of it,
  // and the three guides with NO top-level content rendered a title and a
  // source line only. Narrow the tile to the guide's own opening paragraph,
  // falling back to its first step's — selected verbatim from the data, never
  // summarised (see `resolveGuideLead`).
  const catalogGuideLead = isCatalog ? resolveGuideLead(entity) : undefined
  const content = catalogGuideLead
    ? [{ type: 'paragraph' as const, value: catalogGuideLead }]
    : 'content' in entity
      ? entity.content
      : undefined
  // The crawler-bay damaged-effect string also appears as the last content
  // paragraph; it renders in the "WHEN DAMAGED" callout, so it's filtered out of
  // the body prose below to avoid duplication.
  const damagedEffect =
    'damagedEffect' in entity && typeof entity.damagedEffect === 'string'
      ? entity.damagedEffect
      : undefined
  // A granted/nested entity's SHORT-FORM lead sentence is already shown by the
  // containing ability, so suppress the `lead` block in the grant context.
  const isGrantContext = parentSeal?.label === 'Grants'

  // The nested sections this card carries — nested entity groups, chassis
  // abilities, actions, a pattern's loadout or a chassis's pattern list, drones.
  const {
    canExpand,
    nestedGroups,
    chassisAbilityEntities,
    patternGroups,
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
  // Artwork is shown on full + nested cards (CardImage handles the compact size).
  const showImage = !!assetUrl
  // Body prose — the entity's own, with duplicates filtered out, and the
  // self-action's merged in (see `resolveBodyBlocks`).
  const rawBodyContent = isTitanicMeta ? titanicBodyContent : content
  // SINGLE-ACTION FOLD (see `foldedAction` above): its content inlines into the
  // body; its stats already merged into the sub-header.
  const foldSingleAction = !!foldedAction
  const foldedActionContent = foldedAction?.content ?? undefined

  // A SELF-action (a single folded action named like the entity) renders ITS
  // content as the body, merged with the entity's own; it is not rendered again.
  const isSelfAction = foldSingleAction && foldedAction?.name === entityName
  const { bodyBlocks, showBody } = resolveBodyBlocks({
    content: rawBodyContent,
    damagedEffect,
    isGrantContext,
    selfActionContent: isSelfAction ? foldedActionContent : undefined,
    alwaysShow: isPattern || isTitanicMeta,
    isGrantingAbility,
  })

  const choiceIsEmpty = (c: SURefObjectChoice) =>
    choiceRendersNothing(c, editableChoices, selections)

  // The card context every prose band renders with.
  const prose: CardProseContext = {
    rulesBearing: isRulesBearing(data),
    compact,
    chassisName: resolvedChassisName,
    headerBg: tone.bg,
    headerBgColor: tone.bgColor,
  }

  // BONUS PER TECH LEVEL — anchored INLINE at the prose that describes it, so
  // it is built here for the interleave walk to place.
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
      hostTone={ownToneBase}
      chassisName={resolvedChassisName}
      NestedCard={ReferenceEntityCardInner}
    />
  )

  // AUTO-ANCHOR unmarked choices to the prose that introduces them, then the
  // bonus-per-tech-level marker to ITS prose — the pure splice walks live in
  // choiceAnchoring.ts; a choice/bonus that matches nothing falls to the
  // trailing position below.
  const anchoredBlocks: AnchoredContentBlock[] = [...bodyBlocks]
  if (!hide?.choices) anchorChoiceMarkers(anchoredBlocks, entityChoices)
  const bonusAnchored = bonusNode ? anchorBonusMarker(anchoredBlocks) : false

  // The interleave walk runs in BOTH modes — read-only renders the same choice
  // cards, static (readable); editable makes them selectable.
  const bodyNodes = interleaveBody({
    blocks: anchoredBlocks,
    choices: entityChoices,
    hideChoices: !!hide?.choices,
    showProse: !hide?.content && showBody,
    choiceIsEmpty,
    renderChoice: renderChoiceRegion,
    bonusNode,
    bonusAnchored,
    prose,
  })

  // CATALOG LEAD — the tile suppresses every nested element, and for a large
  // family of entities that IS everything they carry: a grant-equipment ability
  // (Holo Companion) holds only a description plus what it grants, and a Bio-Maw
  // / Green Laser Turret / Adrenal Glands / Chimerium Mutant Squad holds nothing
  // but its actions. Those tiles rendered as a bare paper strip under the stat
  // band. So a tile with no prose of its own borrows an opening paragraph from
  // what it suppressed — grants first, then actions (`resolveCatalogLeadBlocks`)
  // — rendered through `Content` so it reads as the tile's description.
  //
  // Gated on the tile having produced no prose itself, and de-duplicated against
  // the header's flavour hint, so nothing is ever said twice.
  const catalogLeadBlocks: SURefObjectContentBlock[] =
    isCatalog && bodyNodes.length === 0
      ? resolveCatalogLeadBlocks(entity as SURefEntity, hintText)
      : []

  // What every nested card inherits from this one.
  const nestedHost: NestedCardHost = {
    depth,
    isDown,
    entityName,
    chassisName: resolvedChassisName,
    compact,
    NestedCard: ReferenceEntityCardInner,
  }
  // Grants → NO Slab, a "GRANTS" stampseal on each nested card. NPCs → NO Slab,
  // this card's tone as their host. Everything else keeps its dashed Slab.
  const nestedGroupStyle = (label: string) =>
    label === 'Grants'
      ? { slab: false, seal: { label: 'Grants', tone: darkTone } }
      : label === 'NPCs'
        ? { slab: false, childHostTone: ownToneBase }
        : {}

  // ROLL TABLE — the entity's own, or its folded action's (see `CardRollTable`).
  const entityTable = resolveCardTable(entity) ?? resolveCardTable(foldedAction)
  const rollTableNode =
    entityTable && !hide?.rollTable ? (
      <CardRollTable
        table={entityTable}
        compact={compact}
        collapsible={isCatalog || depth > 0}
        disabled={isDown}
      />
    ) : null

  // PATTERN PROSE — the pattern's own flavour, between the chassis ability and
  // the loadout (see `PatternProse`).
  const patternProse =
    isPattern && pattern.content && pattern.content.length > 0 ? (
      <PatternProse name={pattern.name} content={pattern.content} context={prose} />
    ) : null

  // GUIDE STEPS — the bulk of a guide's prose (see `GuideSteps`).
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
        collapsibleTables={isCatalog || depth > 0}
        chassisName={resolvedChassisName}
        NestedCard={ReferenceEntityCardInner}
      />
    ) : null

  // LEFT ANCHOR — the artwork image if present, else a prominent nested NPC.
  // Content (flavor + nested groups/actions) flows to the RIGHT of / below the
  // anchor, filling the whitespace. Responsive: stacks full-width on narrow.
  const npcGroup =
    !showImage && !isPattern ? nestedGroups.find((group) => group.label === 'NPCs') : undefined
  const anchorNpcEntities = npcGroup?.entities ?? []
  // ASIDE LEAD or FLAT — see `resolveBodyLayout`.
  const { asideLead, flat } = resolveBodyLayout({
    showImage,
    hasNpcAnchor: anchorNpcEntities.length > 0,
    isPattern,
    asideLeadRequested,
    hasTrailingSection: !!afterExtraContent,
  })
  const inFlowGroups = (isPattern ? patternGroups : nestedGroups).filter(
    (group) => group !== npcGroup
  )

  const anchorNode: ReactNode =
    showImage && assetUrl ? (
      <CardImage
        url={assetUrl}
        srcSet={assetSrcSet}
        alt={`${entityName} illustration`}
        compact={compact}
        aside={asideLead}
      />
    ) : anchorNpcEntities.length > 0 ? (
      <NpcAnchor
        npcs={anchorNpcEntities}
        hostTone={ownToneBase}
        selections={selections}
        onSelectionChange={onSelectionChange}
        hide={hide}
        host={nestedHost}
      />
    ) : undefined

  // EMPTY CATALOG BODY — a handful of entities have nothing a tile can show and
  // nothing to borrow: a Steel Billy Club or a Crawler Tech Level is entirely
  // stat block, and the lead resolver deliberately borrows rather than invents.
  // For those the body box is a bare strip of paper hanging under the stat band,
  // so it is dropped and the tile ends at the band it actually filled.
  //
  // Only the sections that CAN still render under `extent="catalog"` are tested
  // here — nested groups, actions, patterns, chassis abilities, drones and guide
  // steps are all already cut by `canExpand` / `hide` above.
  const catalogBodyEmpty =
    isCatalog &&
    !anchorNode &&
    bodyNodes.length === 0 &&
    catalogLeadBlocks.length === 0 &&
    !damagedEffect &&
    !rollTableNode &&
    !abilitiesSection &&
    !afterChoicesContent &&
    !afterExtraContent

  return (
    <div className={outerClassName} {...outerInteraction}>
      {seam}
      {topRightRail}
      <div
        className="flex flex-1 flex-col overflow-hidden rounded-card bg-paper"
        style={rendersFooter ? frameStyle : { ...frameStyle, ...FOOTLESS_BOTTOM }}
      >
        {header}
        {/* SLOT: subtitleExtra — an extra line under the header (absent ⇒ nothing). */}
        {subtitleExtra && (
          <div className={cn(compact ? 'px-2 pt-1' : 'px-3 pt-1.5')}>{subtitleExtra}</div>
        )}
        {/* EP/AP cost leads the action sub-header row; the bonus-per-tech-level
            group (Badge + "+N" cells) wraps together after the trait cells. */}
        <EntityCardSubHeader
          bgColor={darkTone}
          cells={cells}
          leading={subHeaderLeading}
          compact={compact}
          nested={depth > 0}
          onBandText={onBandText}
        />
        <div
          className={cn(
            // Non-flat body: a MIN height with content vertically centered, so a
            // short body (e.g. an action's one-line description) sits centered in
            // the band instead of top-aligned with a gap below; taller content
            // grows normally. (Flat/anchor bodies use flow-root for the float.)
            //
            // BOTH branches take `flex-1`. The body is what absorbs any height
            // the card is given beyond its content — in a grid of stretched
            // cards, a short one is taller than what it holds. Only the non-flat
            // branch grew, so a flat card (a floated artwork body — every class
            // and creature page) left its slack BELOW the footer: the footer
            // band sat across the middle of the card with bare paper under it.
            flat ? 'flow-root flex-1' : 'flex flex-1 flex-col justify-center gap-1.5',
            // An EMPTY catalog body keeps `flex-1` (it still absorbs the slack in
            // a stretched grid) but drops the min-height and padding that would
            // otherwise hang a bare strip of paper under the stat band.
            catalogBodyEmpty
              ? 'min-h-0 p-0'
              : cn(!flat && 'min-h-[2.5rem]', compact ? 'p-2' : 'p-3'),
            // A damaged/destroyed entity dims its body content too (not just the
            // greyed header), so the whole card reads as de-emphasised.
            isDown && 'opacity-60'
          )}
        >
          {/* The interleave walk builds the WHOLE body — content segments (via
              Content) with choice cards dropped in at their
              markers — in both read-only and editable. Content gets a clear gap
              (mb-3) before nested-card sections.
              In ASIDE LEAD the anchor and that prose are a centred row; otherwise
              the anchor floats and the prose flows around it, as before. */}
          {asideLead ? (
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:gap-4">
              {anchorNode}
              {bodyNodes.length > 0 && <div className="min-w-0 flex-1">{bodyNodes}</div>}
            </div>
          ) : (
            <>
              {anchorNode}
              {bodyNodes.length > 0 && <>{bodyNodes}</>}
            </>
          )}
          {/* CATALOG LEAD prose — a tile with no body of its own borrows an
              opening line from what catalog mode suppressed (its grants, else
              its actions), styled through Content so it reads as description. */}
          {catalogLeadBlocks.length > 0 && <CardProse body={catalogLeadBlocks} context={prose} />}
          {/* A SELF-action's content already renders AS the body above; only a
              differently-named folded action renders here (with its name heading). */}
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

          {/* GUIDE STEPS — the bulk of a guide, straight after its intro prose. */}
          {guideStepsNode}

          {/* ROLL TABLE — the entity's own table, after its prose preamble. */}
          {rollTableNode}

          {/* SLOT: afterChoicesContent — appended just below the choices. */}
          {afterChoicesContent}

          {/* CHASSIS ABILITY — a "Chassis Ability" stampseal on each card. The
              `abilitiesSection` slot fully replaces this block when provided. */}
          {abilitiesSection ??
            (chassisAbilityEntities.length > 0 && (
              <NestedCardList
                entities={chassisAbilityEntities}
                seal={{ label: 'Chassis Ability', tone: darkTone }}
                childHostTone={ownToneBase}
                flat={flat}
                host={nestedHost}
              />
            ))}

          {/* DRONE — the compact drone card; its systems + modules render INSIDE
              the drone card (via the `droneLoadout` prop), NOT here. */}
          <DroneCards drones={droneInfos} flat={flat} host={nestedHost} />

          {/* THIS card's OWN drone loadout (when it is a drone) — systems +
              modules as listings, nested inside the drone card's own body. */}
          {droneSystems.length > 0 && (
            <ListingGroup label="Systems" entities={droneSystems} flat={flat} host={nestedHost} />
          )}
          {droneModules.length > 0 && (
            <ListingGroup label="Modules" entities={droneModules} flat={flat} host={nestedHost} />
          )}

          {/* PATTERN prose — after the chassis ability, ahead of the loadout. */}
          {patternProse}

          {/* PATTERN view → the side-by-side loadout of shortform badges.
              BASIC chassis / entities → nested cards, one group per section. */}
          {isPattern
            ? !hide?.patterns && (
                <PatternLoadout
                  groups={inFlowGroups}
                  sectionAs={sectionAs}
                  hostDown={isDown}
                  NestedCard={ReferenceEntityCardInner}
                />
              )
            : inFlowGroups.map((group) => (
                <NestedCardGroup
                  key={group.label}
                  label={group.label}
                  entities={group.entities}
                  flat={flat}
                  sectionAs={sectionAs}
                  host={nestedHost}
                  {...nestedGroupStyle(group.label)}
                />
              ))}

          {!hide?.actions && gridActions.length > 0 && (
            // No "Actions" Slab — the action cards render on their own.
            <NestedCardGroup
              label="Actions"
              entities={gridActions}
              slab={false}
              childHostTone={ownToneBase}
              flat={flat}
              sectionAs={sectionAs}
              host={nestedHost}
            />
          )}

          {/* Titanic actions — a full-width row of their own, never masonry. */}
          {!hide?.actions && (
            <TitanicActionCards
              actions={titanicActions}
              flat={flat}
              hostTone={ownToneBase}
              host={nestedHost}
            />
          )}

          {/* BASIC CHASSIS → a LIST of its patterns as LISTING rows. */}
          {!hide?.patterns && patternList.length > 0 && (
            <PatternList
              chassis={entity}
              chassisName={entityName}
              patterns={patternList}
              depth={depth + 1}
              hostDown={isDown}
              flat={flat}
              sectionAs={sectionAs}
              NestedCard={ReferenceEntityCardInner}
            />
          )}

          {/* SLOT: afterExtraContent — trailing body content (absent ⇒ nothing). */}
          {afterExtraContent}
        </div>
        {/* SLOT: expand — on the accent field after the body box, before the
            footer (legacy `expand`, e.g. a crawler bay's crew inset). */}
        {expand && <div className={compact ? 'px-2 pb-2' : 'px-3 pb-3'}>{expand}</div>}
        {/* FOOTER — `footerOverride` replaces the identity footer; `hide.footer`
            and the catalog extent suppress it entirely (see `rendersFooter`,
            which the frame's bottom edge reads from too, so the band and the
            frame can never disagree). Absent ⇒ the depth-0 identity footer. */}
        {rendersFooter
          ? (footerOverride ?? (
              <EntityCardIdentityFooter
                bgColor={darkTone}
                typeLabel={footerType}
                source={provenance.source}
                booklet={provenance.booklet}
                page={provenance.page}
                // Reprints are the entity's OWN-PAGE fact — the roomy full card
                // where a reader is looking up an entity, not a live-sheet /
                // nested card where the same band is already the tightest strip
                // on the sheet. Gated at the call site for the same reason
                // `externalLink` is: the footer stays a dumb renderer, and the
                // card owns which extents earn which meta. (`head` and `catalog`
                // never reach here at all — `head` returns before the body and
                // `rendersFooter` drops the band on `catalog`.)
                additionalSources={compact ? undefined : provenance.additionalSources}
                footMeta={footMeta}
                externalLink={extent === 'full' ? externalLinkNode : undefined}
                compact={compact}
              />
            ))
          : null}
      </div>
    </div>
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
   * whole card is the expand target, which is what a header-only listing
   * already looks clickable enough to be), expanded adds a ghost chevron.
   */
  collapsible?: boolean
  /** Start folded. Only meaningful with `collapsible`; defaults to true. */
  defaultCollapsed?: boolean
}

/**
 * `ReferenceEntityCard` — the public entry point for rendering a reference
 * entity. Accepts the ergonomic display sugar (`compact` / `listing` resolve
 * onto the `size` / `extent` axes; a nullable `data` renders nothing; a
 * damaged/destroyed `status` greys the whole tone) and renders the canonical
 * card. This replaced the former `ReferenceEntityCard` compat shim; the
 * recursive card body is `ReferenceEntityCardInner`.
 */
export function ReferenceEntityCard({
  data,
  size,
  extent,
  collapsible = false,
  defaultCollapsed = true,
  controls,
  ...rest
}: ReferenceEntityCardWrapperProps): ReactNode {
  // Hook before the nullable-data guard — a conditional hook would break the
  // rules of hooks the first time a caller passed `undefined`.
  const [collapsed, setCollapsed] = useState(collapsible && defaultCollapsed)
  if (!data) return null

  const folded = collapsible && collapsed
  // The size / extent / compact / listing reconciliation is the Card
  // layer's rule — inherited, not restated here. Folding only overrides the
  // EXTENT axis, so a collapsed card keeps whatever size it was given.
  const display = resolveCardDisplay({ size, extent: folded ? 'head' : extent })

  const label = getReferenceEntityName(data)
  const foldControls: ReferenceEntityControl[] = !collapsible
    ? []
    : folded
      ? [
          {
            key: '__expand',
            // A VISIBLE chevron: the whole-card click alone left nothing on a
            // folded listing saying it opens. `cardClick` stays on, so the
            // card surface remains a target too — clicking the chevron fires
            // this handler and then bubbles to that one, which is harmless
            // because both fold handlers are idempotent setters (`false` /
            // `true`) rather than toggles.
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

  return (
    <ReferenceEntityCardInner
      data={data}
      size={display.size}
      extent={display.extent}
      controls={foldControls.length > 0 ? [...(controls ?? []), ...foldControls] : controls}
      // A folded card's whole surface is the expand target, so it needs an
      // accessible name saying what activating it does — without this the
      // wrapper is an unnamed role="button" wrapping the card's entire text.
      {...(folded ? { cardClickLabel: `Expand ${label}` } : {})}
      {...rest}
    />
  )
}
