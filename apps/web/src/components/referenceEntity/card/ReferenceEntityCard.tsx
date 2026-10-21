import type { ReactNode } from 'react'
import { useContext } from 'react'
import type { RefEntity, RefEnumSchemaName, RefMetaEntity } from 'salvageunion-reference'
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
} from 'salvageunion-reference'
import { space } from '../../../design/tokens'
import { useDisclosure } from '../../../lib/useDisclosure'
import { Badge } from '../../atoms/Badge'
import { assetSrcSetFor } from '../../compositions/assetSrcSet'
import type { CardExtent } from '../../containers/displayMode'
import { resolveCardDisplay } from '../../containers/displayMode'
import type { StatItem } from '../../containers/statsBarTypes'
import type { ChipSet } from '../../entity'
import { Chips } from '../../entity'
import { EntitySurfaceProvider } from '../../entity/EntitySurface'
import { useEntityExternalLink, useEntitySurface } from '../../entity/entitySurfaceContext'
import { SelectedSeal } from '../../entity/modes/select'
import { InsidePeekContext } from '../../entity/peekContext'
import { foldControl } from '../foldControl'
import { quotePatternName } from '../pattern/quotePatternName'
import type { ReferenceEntityControl } from '../referenceEntityControlTypes'
import { treeRelationNodes } from './abilityTreeRelations'
import { CardHead } from './CardHead'
import { CardOuter } from './CardOuter'
import { CardPage } from './CardPage'
import { CardTitleLink } from './CardTitleLink'
import type { CardBodyInput } from './cardBodyProse'
import { resolveBodyProse } from './cardBodyProse'
import { buildHeaderStats, resolveSubHeaderCells, resolveTechScaling } from './cardCells'
import type { HeaderFill } from './cardChrome'
import {
  cardDown,
  resolveCardColors,
  resolveCardInteraction,
  resolveFrameWidth,
  resolveHeaderFill,
  resolveHeaderHint,
} from './cardChrome'
import type { CardGrain } from './cardGrain'
import {
  chassisMiniName,
  MAX_DEPTH,
  namesOwnPage,
  resolveHide,
  sectionHeadingLevel,
} from './cardHelpers'
import { CRAWLER_ABILITY_SEAL, resolveCardSections } from './cardSections'
import { cardStripSlots } from './cardStrip'
import { EntityCardIdentityFooter } from './EntityCardIdentityFooter'
import type { AxisMarker } from './entityCardTone'
import {
  resolveAxisMarkers,
  resolveCardTone,
  resolveSeamLabel,
  resolveTierNumeral,
} from './entityCardTone'
import { splitFacets } from './facetSplit'
import { HeadMini } from './HeadMini'
import { labelChips } from './labelChips'
import { isLegalStartingPatternOf, LEGAL_STARTING_PATTERN } from './legalStartingPattern'
import { CardLead, CardStack } from './NestedCards'
import { PatternList } from './PatternListRow'
import { PatternLoadoutRows } from './PatternLoadout'
import { PickSurface } from './PickSurface'
import { resolveFooterProvenance } from './provenance'
import type {
  ActionFields,
  ReferenceCardEntity,
  ReferenceEntityCardProps,
} from './referenceEntityCardTypes'
import { stripHostParenthetical } from './stripHostParenthetical'

/**
 * ReferenceEntityCard — the ONE card that renders ENTITIES, ACTIONS, and
 * NPCs (ruleset §5, boards E1–E4). ONE anatomy across every size × extent ×
 * context:
 *
 *   cut-out head (title, labels, chip group) · body · footer
 *
 * with TWO header fills, chosen by the reader's question and decided by data
 * shape (`isDoEntity`), never a schema prop:
 *
 * - TONE, for things you HAVE: the entity's tone, ink speckle, the title in
 *   ink or paper by contrast.
 * - INK, for things you DO (abilities, actions): the book's ink banner — the
 *   tier numeral at the left, paper flecks. The cost is a chip.
 *
 * The frame and the footer are ink on paper on every card; the
 * tone lives in the header alone. An entity's own roll table sits inline as a
 * flush band; its actions, like nested ENTITIES, stack framed in
 * the frame, one size step per level (full → compact → a Mini), the
 * frame stepping 3 → 2 → 1.5px with them.
 *
 * ## How this file is laid out
 *
 * `ReferenceEntityCardInner` DECIDES — fill, depth, which sections a card
 * carries, what each one is fed — and composes. What each section LOOKS like
 * lives beside it, one module per section: the labels
 * (`labelChips`), the head (`CardHead`), the chip group
 * (`Chips`, E17), the Mini form (`src/entity/`), the prose bands
 * (`CardProse`), the body interleave, choices (`ChoiceRegion`), the roll table
 * (`CardRollTable`), the trays, inline
 * actions and depth rows (`NestedCards`). The pure cell/stat builders are in
 * `cardCells.ts`, the chrome rules in `cardChrome.ts`.
 *
 * Sections that nest cards receive this card as `NestedCard`, never importing
 * it, so no section module imports back into this one.
 */

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
        size="full"
        marks={children}
        align="end"
        className="su-entity-page__tags"
      />
    </>
  )
}

const NO_CHIPS: ChipSet = { durations: [], facts: [], tags: [] }

function ReferenceEntityCardInner({
  data,
  size: sizeProp = 'full',
  extent = 'full',
  depth: depthProp = 0,
  presentation = 'card',
  hero,
  showChassisAbility,
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
  disabled,
  selected,
  selectionSeal,
  suggested,
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
  subtitleExtra,
  afterExtraContent,
  asideLead: asideLeadRequested = false,
  footMeta,
  className,
  titleAs,
  scalingParent,
  expand,
  sectionFold,
}: ReferenceEntityCardProps) {
  // Section bands are h2s (nested titles h3s) only when this card IS the page
  // (`sectionHeadingLevel`), whatever `titleAs` says: its h1 is the chapter band.
  const onPage = presentation === 'page' && depthProp === 0
  const sectionAs = sectionHeadingLevel(onPage ? 'h1' : titleAs)

  // `SalvageUnionReference.*.all()` entities carry a runtime `schemaName` the
  // static `RefEntity` union omits: the display system's boundary cast.
  const entity = data as RefMetaEntity
  // Hooks run above every early return below.
  const externalLinkNode = useEntityExternalLink(data as RefEntity)
  const insidePeek = useContext(InsidePeekContext)
  // Texture comes from the surface (E13); a card's own `texture` wins.
  const surface = useEntitySurface()
  const textured = texture ?? surface.texture
  const schemaName = (
    'schemaName' in entity && typeof entity.schemaName === 'string' ? entity.schemaName : undefined
  ) as RefEnumSchemaName | 'actions' | undefined
  if (!schemaName) {
    console.warn('ReferenceEntityCard: data does not have a schemaName property', data)
    return null
  }

  const isAction = schemaName === 'actions'
  // A FRAMED action (one a list or a resolve draws) is never the
  // dominant solo card: a large one renders medium, at depth ≥ 1.
  const size = isAction && sizeProp === 'full' ? 'compact' : sizeProp
  const depth = isAction ? Math.max(depthProp, 1) : depthProp
  const compact = depth > 0 || size !== 'full'
  const isCatalog = extent === 'catalog'
  const hide = resolveHide(hideProp, isCatalog, insidePeek)
  const tone = resolveCardTone(schemaName, entity)
  // HAVE vs DO, by data shape.
  const fill: HeaderFill = resolveHeaderFill(entity, insidePeek)
  // Damaged dulls the header, destroyed greys it (`cardDown`); the body dims.
  const isDown = cardDown(status, hostDown)
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
  // ARTWORK — a MINI catalog tile drops it: at the small size the image would
  // crowd out the description it exists to caption.
  const isMiniCatalog = isCatalog && size === 'mini'
  const assetUrl = isMiniCatalog ? undefined : getAssetUrl(entity)
  const assetSrcSet = assetSrcSetFor(assetUrl)

  // PATTERN view — the pattern is the subject; the chassis supplies stats / tone / source.
  const isPattern = !!pattern
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
  const resolvedChassisName = chassisName ?? chassisMiniName(schemaName, entityName)

  const action = isAction ? (entity as ActionFields) : undefined
  // The "Titanic Actions" entry is a meta-descriptor for the titanic-action
  // SYSTEM: its intro is its lead, its options the body.
  const isTitanicMeta = isAction && isTitanicAction(entity)
  // The KIND ("System", "Ability · Forging Tree") is never stamped (E9): the
  // title carries it for screen readers. A caller's `kicker` that says more
  // ("From Veteran") is a label. Nor is it on the foot: only a Page's foot
  // stamps the kind (E9; the app's detail dialog draws its own).
  const kind = isPattern ? 'Pattern' : resolveSeamLabel(schemaName, entity)
  const provenance = resolveFooterProvenance(entity, pattern)
  const chassisMarker = resolvedChassisName
    ? [{ label: 'Chassis', value: resolvedChassisName }]
    : []
  const axisMarkers: AxisMarker[] =
    isAction || hide?.axisMarkers ? [] : isPattern ? chassisMarker : resolveAxisMarkers(entity)
  // "Legal Starting Pattern" is a STORED data tag on the pattern.
  const isLegalStartingPatternCard = isPattern && isLegalStartingPatternOf(pattern)
  const numeral = resolveTierNumeral(entity)

  // The SELF-action (named like its entity) folds into the card: its content is
  // the body, its facets the "//" line (`foldedActionOf`). Others sit inline.
  const foldableActions =
    !isAction &&
    !isPattern &&
    depth < MAX_DEPTH &&
    !(isAbility(entity) && resolveGrantedEntities(entity as RefEntity).length > 0)
      ? (extractVisibleActions(entity) ?? []).filter((a) => !isTitanicAction(a))
      : []
  const foldedAction = foldedActionOf(foldableActions, entityName)
  const foldedActionFields: ActionFields | undefined = foldedAction ?? undefined

  // The LABELS: a parent seal (GRANTS) replaces the note. A card's head draws
  // them as its strip's first chips, at its Size (`labelChips`).
  const labelProps = {
    seal: parentSeal,
    note: parentSeal ? undefined : kicker,
    axisMarkers,
    legalStartingPattern: isLegalStartingPatternCard,
    userMade,
  }
  // HEADER value cells — the short `[label | value]` form; compact, the budget (C3); a Peek, every stat.
  const headerStats: StatItem[] = buildHeaderStats({
    entity,
    schemaName,
    budget: compact && !insidePeek && !isCatalog,
    every: insidePeek,
    none: isAction,
    techLevel,
    techLevelDisplay,
    techLevelModified,
  })
  const effectiveHeaderStats: StatItem[] = statsOverride ?? headerStats

  // COST — the action's own cost, or its folded self-action's, as a chip.
  const costSource = action ?? foldedActionFields
  const costLabel =
    costSource?.activationCost != null
      ? formatCost(costSource.activationCost, resolveActivationCurrency(costSource.actionSource))
      : undefined

  const isHead = extent === 'head'
  // WRITE LAYER — whole-card affordances (see `resolveCardInteraction`). A
  // Mini draws no controls, so a head's controls reach it only as a card click:
  // each stands hidden, and the Mini itself takes the click's role, name and
  // state (a folded card's disclosure).
  const { outer, frameStyle } = resolveCardInteraction({
    onCardClick,
    controls: isHead ? controls?.map((c) => ({ ...c, hidden: true })) : controls,
    cardClickable,
    disabled,
    selectable,
    className,
    selectionRole,
    cardClickLabel,
    selected,
    frameWidth: resolveFrameWidth(isHead ? 'mini' : size),
  })

  // HEADER-ONLY is the Mini (N2), at every size: this card is its adapter,
  // translating its props into the Mini's slots. A contentful Compact or Full
  // always has its body; a header-only Compact is `<Entity size="compact">`.
  if (isHead) {
    return (
      <HeadMini
        entity={entity}
        pattern={pattern}
        instance={{ title: name, ...(userMade ? { userMade } : {}) }}
        note={isLegalStartingPatternCard ? LEGAL_STARTING_PATTERN : undefined}
        slots={{
          outer,
          frameStyle,
          down: isDown,
          kind,
          cost: isAction ? costLabel : undefined,
        }}
      />
    )
  }

  // SUGGESTED — an ink stamp leading the "//" line, marking a recommended
  // pick. A recommendation is not an action, so it is never rust (§3.1).
  const suggestedNode: ReactNode = suggested ? (
    <Badge key="suggested" shape="stamp" size="mini">
      Suggested
    </Badge>
  ) : undefined

  // HINT — an ability's description or the titanic meta-action's intro: the
  // body's lead.
  const { hintText, titanicBodyContent } = resolveHeaderHint(entity, { isTitanicMeta })

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
  // E17: every chip in ONE group, in the stat order (`Chips`).
  const facets = splitFacets(cells)
  const chips: ChipSet = {
    durations: facets.stamps,
    ...(costLabel ? { cost: costLabel } : {}),
    facts: [...effectiveHeaderStats, ...facets.facts],
    tags: facets.tags,
  }
  const tree = isAction || isPattern ? undefined : treeRelationNodes(entity) // its tree's chips
  // A page's chips ride its band (`resolveEntityPageMeta`); its body keeps "Suggested".
  const hasSubLine = onPage && !!suggestedNode

  // The head's chip group carries the condition and every control, in its
  // state and last slots (C8, hard rule R6), and the select seal on the
  // band's right (EDL Modes, R15): nothing rides the frame or sits under it.
  const slots = cardStripSlots({ controls, status, subject: entityName })
  // A selected Card always wears the seal, "Selected" unless the caller names
  // its own word. A Mini (level 2) is ring only.
  const seal = selected ? <SelectedSeal word={selectionSeal} /> : undefined

  // A card met inside another names its own Page: its name links (`CardTitleLink`).
  const interactive = !!(onCardClick || cardClickable || selectable || selectionRole)
  const place = { onPage, depth: depthProp, insidePeek, interactive }
  const titleContent = namesOwnPage(place) ? (
    <CardTitleLink entity={entity} title={name} inPeek={insidePeek} pattern={pattern} />
  ) : undefined

  // Every framed card wears the cut-out head (its overflow, C2b); a Page has
  // its chapter band (`CardPage`), so this is never called on a page.
  const header = (overflow: 'body' | 'more') => (
    <CardHead
      title={name}
      titleContent={titleContent}
      kind={kind}
      fill={fill}
      titleAs={titleAs}
      bandColor={bandColor}
      titleColor={onBand === 'ink' ? 'var(--color-ink)' : 'var(--color-paper)'}
      numeral={numeral}
      chips={
        <Chips
          chips={chips}
          size="compact"
          marks={[...labelChips(labelProps, 'compact'), suggestedNode]}
          nodes={tree}
          state={slots.state.length > 0 ? slots.state : undefined}
        />
      }
      controls={slots.controls.length > 0 ? slots.controls : undefined}
      affordance={seal}
      grain={grain}
      overflow={overflow}
    />
  )

  // A CATALOG tile carries NO footer: it is artwork + description, and
  // provenance belongs on the entity's own page, which the tile links to.
  const rendersFooter = !isCatalog && depth === 0

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
    leadHint: hintText,
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
    showChassisAbility,
    sectionFold: insidePeek ? undefined : sectionFold,
    NestedCard: ReferenceEntityCardInner,
  }
  const resolved = resolveBodyProse(bodyInput)
  const { chassisAbilityEntities, gridActions, titanicActions, patternList, nestedHost } = resolved
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
        hero={hero ?? heroNode}
        leadActions={hide?.actions && !showChassisAbility ? [] : chassisAbilityEntities}
        otherActions={hide?.actions ? [] : [...gridActions, ...titanicActions]}
        actionSeal={schemaName === 'crawlers' ? CRAWLER_ABILITY_SEAL : undefined}
        subLine={
          (subtitleExtra || hasSubLine) && (
            <PageSubLine extra={subtitleExtra}>{suggestedNode}</PageSubLine>
          )
        }
        body={bodyHasContent ? bodyContent : null}
        opening={patternSection}
        loadout={<PatternLoadoutRows groups={pageLoadout} as={sectionAs} host={nestedHost} />}
        bodyLabel={
          isPattern
            ? `${resolvedChassisName ?? entityName} ${isBioTitanPattern(pattern) ? 'Bio-Titan' : 'chassis'}`
            : undefined
        }
        table={rollTableNode}
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

  const after = [afterExtraContent, expand, rendersFooter, !hide?.patterns && patternList.length]
  const under = [subtitleExtra, body, rollTableNode, patternSection, actionsNode, nestedGroupsNode]
  const lone = !depth && ![...under, ...after].some(Boolean) // +MORE alone, nested a body (C2b)
  return (
    <CardOuter {...outer}>
      {/* Paper, radius and clip are `.su-ec-frame` (ADR-046), weight and dash ours. */}
      <div className="su-ec-frame" style={frameStyle}>
        {header(lone ? 'more' : 'body')}
        {/* SLOT: subtitleExtra — an extra line under the header (absent ⇒ nothing). */}
        {subtitleExtra && (
          <div style={{ padding: `${space[4]} ${compact ? space[12] : space[14]} 0` }}>
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
        {/* BASIC CHASSIS → its patterns as Minis. */}
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
          <div style={{ padding: compact ? space[12] : `${space[12]} ${space[14]}` }}>
            {afterExtraContent}
          </div>
        )}
        {/* SLOT: expand — before the footer (a crawler bay's crew inset). */}
        {expand && (
          <div style={{ padding: `0 ${compact ? space[12] : space[14]} ${space[12]}` }}>
            {expand}
          </div>
        )}
        {/* FOOTER — none on a catalog tile; a Peek's wears the header band. */}
        {rendersFooter ? (
          // USER-MADE (ruleset §3.9): the credit is the maker, never a page.
          <EntityCardIdentityFooter
            // Every printing on the one line, on every foot (ruleset Source 2).
            provenance={userMade ? undefined : provenance}
            footMeta={footMeta}
            externalLink={
              extent === 'full' && !insidePeek && !userMade ? externalLinkNode : undefined
            }
            size={size}
            credit={userMade ? `Made by ${madeBy ?? 'a player'}` : undefined}
            band={{ onBand, bandColor }}
            grain={grain}
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
  size?: ReferenceEntityCardProps['size']
  extent?: CardExtent
  /**
   * Let the reader fold this card to its Mini (`extent="head"`) and back;
   * folded is the DEFAULT, so a long collection reads as a list of names.
   * The affordance is ONE `controls` entry (`foldControl`): open, a chevron
   * with `aria-expanded` and `aria-controls` (the card wrapper's id,
   * `resolveCardInteraction`); folded, the Mini itself is the disclosure
   * button, since a Mini draws no controls.
   */
  collapsible?: boolean
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
  controls,
  texture,
  ...rest
}: ReferenceEntityCardWrapperProps): ReactNode {
  // Hook before the nullable-data guard — a conditional hook would break the
  // rules of hooks the first time a caller passed `undefined`.
  const fold = useDisclosure(!collapsible)
  if (!data) return null

  const folded = collapsible && !fold.open
  // Folding only overrides the EXTENT axis, so a collapsed card keeps
  // whatever size it was given.
  const display = resolveCardDisplay({ size, extent: folded ? 'head' : extent })

  const label = getReferenceEntityName(data)
  const foldControls: ReferenceEntityControl[] = !collapsible
    ? []
    : [foldControl({ subject: label ?? '', disclosure: fold, cardClick: true })]

  const inner = (
    <ReferenceEntityCardInner
      data={data}
      size={display.size}
      extent={display.extent}
      controls={foldControls.length > 0 ? [...(controls ?? []), ...foldControls] : controls}
      {...rest}
    />
  )
  // A card that is the pick is the one control in its frame (`PickSurface`).
  const card = rest.selectionRole ? <PickSurface>{inner}</PickSurface> : inner
  // `texture={false}` holds for every nested card and form (the surface, E13).
  if (texture === undefined) return card
  return <EntitySurfaceProvider value={{ texture }}>{card}</EntitySurfaceProvider>
}
