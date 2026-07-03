import { useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import {
  getDisplayName,
  getGoals,
  getAssets,
  getWeaknesses,
  getRecommended,
  getChoices,
  getBooklet,
  resolveGrantedEntities,
  isEntityData,
  isAbility,
  isClass,
  SalvageUnionReference,
} from 'salvageunion-reference'
import { RollTable } from '../../../shared/RollTable'
import { CardHeader } from '../../../shared/CardHeader'
import { cardTitleClasses, cardTitleStyle } from '../../../shared/cardTitleStyles'
import { DisplayCard } from '../../../shared/DisplayCard'
import { ReferenceEntitySubTitleElement } from '../ReferenceEntitySubTitleContent'
import { ReferenceEntityRightHeaderContent } from '../ReferenceEntityRightHeaderContent'
import { buildReferenceEntityStats } from '../referenceEntityStatsConfig'
import type { StatItem } from '../../../shared/statsBarTypes'
import { ReferenceEntityChassisAbilitiesContent } from '../ReferenceEntityChassisAbilitiesContent'
import { ReferenceEntityRequirementDisplay } from '../ReferenceEntityRequirementDisplay'
import { ReferenceEntityResolvedChoices } from '../ReferenceEntityResolvedChoices'
import { ReferenceEntityResolvedDataRow } from '../ReferenceEntityResolvedDataRow'
import type { ChoiceSelections } from '../../choiceCard/choiceSelectionHelpers'
import { ReferenceEntityGrants } from '../ReferenceEntityGrants'
import { ReferenceEntityBonusPerTechLevel } from '../ReferenceEntityBonusPerTechLevel'
import { ReferenceEntityIntegratedSystems } from '../ReferenceEntityIntegratedSystems'
import { ConditionalSheetInfo } from '../ConditionalSheetInfo'
import { ReferenceEntityActions } from '../ReferenceEntityActions'
import { ReferenceEntityFormation } from '../ReferenceEntityFormation'
import type { GuideStepsInteractiveConfig } from '../../GuideStepsDisplay'
import { cn } from '../../../../utils/cn'
import {
  CALLOUT_META_LABELS,
  getClassTypeLabel,
} from '../../../../lib/referenceEntityDataExtraction'
import { Text } from '../../../base/Text'
import {
  accentSurface,
  accentTextColor,
  accentDeepColor,
  borderColorFromHeaderBg,
  getSourceBorderColor,
} from '../../referenceEntityHelpers'
import { useEntityExternalLink } from '../entityHrefContext'
import { useReferenceEntityDisplayState } from '../useReferenceEntityDisplayState'
import type { ReferenceEntityDisplayStateInput } from '../useReferenceEntityDisplayState'
import type { ReferenceEntityControl } from '../referenceEntityControlTypes'
import type { NpcConfig } from '../referenceEntityDisplayTypes'
import { ReferenceEntityDisplayStateProvider } from '../displayStateContext'
import { ReferenceEntityFooter } from './ReferenceEntityFooter'
import { Tag } from '../../../chrome/Tag'
import type { EntityStatus } from '../../../chrome/StatusBadge'
import type { CardFootMeta } from '../../../shared/DisplayCard'
import { CalloutMetaStamp } from './CalloutMetaStamp'
import {
  EntityBodyTopMatter,
  EntityExtraSections,
  EntityNpcSection,
  EntityStatblockEquipment,
} from './EntityBodySections'
import type { ContentBlocks } from './EntityBodySections'
import {
  deriveContentBlocks,
  deriveTitanicStatblock,
  resolveFooterEntity,
} from './deriveEntityContent'

export type ReferenceEntityDisplayContentProps = ReferenceEntityDisplayStateInput & {
  children?: ReactNode
  controls?: ReferenceEntityControl[]
  interactive?: GuideStepsInteractiveConfig
  npcConfig?: NpcConfig
  /** Content to render in a right column alongside the NPC section (creates a 2-column grid) */
  rightContent?: ReactNode
  /** Which side the NPC floats when rightContent is provided. Default 'left'. */
  npcPosition?: 'left' | 'right'
  /** When set, renders a semi-translucent overlay over the body with this text in a danger box */
  damageOverlayText?: string
  /** When true, header renders only title and controls — no subtitle, stats, or tech level */
  lightweight?: boolean
  /** Click handler for the entire card (adds hover enlarge effect) */
  onCardClick?: () => void
  /** Enable hover enlarge effect without a click handler (e.g., when wrapped in an <a>) */
  cardClickable?: boolean
  /** Override stats in the card header (passed to DisplayCard.stats) */
  stats?: StatItem[]
  /**
   * Hide content blocks marked `lead: true`. Set by the Grants view so a granted
   * entity's intro sentence shows on its own page but not when nested in a grant
   * (where it would be redundant with the granting ability's own description).
   */
  hideLeadContent?: boolean
  /**
   * Controlled choice selections for the granted-equipment choice cards
   * (`ChoiceSelections`, keyed by choice id). When provided, selection state is
   * owned by the consumer (e.g. ITUN, backed by persistence) rather than the
   * internal ephemeral `useState`. Omit it (the SRD default) to stay uncontrolled.
   * Passing `selections` without `onSelectionChange` yields a read-only controlled
   * view (e.g. a published snapshot) — toggles render but don't mutate.
   */
  selections?: ChoiceSelections
  /** Next-state callback fired when a choice card toggles, in controlled mode. */
  onSelectionChange?: (selections: ChoiceSelections) => void
  /**
   * Optional scaling parent for `constraints.scalesWithField` choice caps (e.g.
   * Modification "at each Tech Level"). A consumer with a play/build context
   * (ITUN) passes e.g. `{ techLevel: effectiveCrawlerLevel }` so caps resolve.
   * Omit it (the SRD default) for unbounded caps — unchanged behaviour. Additive
   * optional prop.
   */
  scalingParent?: Record<string, unknown>
  /**
   * Intact/Damaged/Destroyed badge (design-spec §2.1 `.ec__status`), top-right.
   * Supersets `damaged`: 'damaged'/'destroyed' also apply the grey-header
   * treatment (resolved by ReferenceEntityDisplay). Opt-in.
   */
  status?: EntityStatus
  /** Cycle handler for the status badge (Intact → Damaged → Destroyed) */
  onStatusClick?: () => void
  /**
   * Expansion slot (design-spec §2.1 `.ec__expand`): arbitrary content
   * rendered on the accent field after the white body box, before the footer
   * — class ability trees, chassis integrated systems, bay crew insets.
   */
  expand?: ReactNode
  /**
   * Action buttons folded into the footer band (design-spec §2.1 `.ec__acts`).
   * Named `footActions` to avoid the game-rules Actions section / `hide.actions`.
   */
  footActions?: ReactNode
  /** Inline label/value foot meta (`.ec__metafoot`), e.g. AP COST · 1 */
  footMeta?: CardFootMeta[]
  /**
   * Append a trailing type-label tag to the header data row (design-spec §2.1:
   * "a type-label tag is ALWAYS appended last"). Opt-in: pass `showTypeLabel`
   * to derive the label from the schema display name, or `typeLabel` to
   * override the text (implies show).
   */
  showTypeLabel?: boolean
  typeLabel?: string
}

// Bottom padding of the content float-zone, as a ratio of the default content
// padding. The last content block already carries its own bottom margin, so this
// stays small to avoid doubling whitespace above the footer. Empirically tuned
// (~1/3 of the default content padding), not derived.
const CONTENT_PADDING_BOTTOM_RATIO = 0.34

export function ReferenceEntityDisplayContent({
  children,
  controls,
  interactive,
  npcConfig,
  rightContent,
  npcPosition = 'left',
  damageOverlayText,
  lightweight = false,
  onCardClick,
  cardClickable,
  stats: statsProp,
  hideLeadContent = false,
  selections: controlledSelections,
  onSelectionChange,
  scalingParent,
  status,
  onStatusClick,
  expand,
  footActions,
  footMeta,
  showTypeLabel = false,
  typeLabel,
  ...inputProps
}: ReferenceEntityDisplayContentProps) {
  const state = useReferenceEntityDisplayState(inputProps)
  const {
    data,
    schemaName,
    compact,
    title,
    headerBg,
    headerBgColor,
    spacing,
    opacity,
    shouldShowExtraContent,
    listing,
    hide,
    damaged,
    disabled,
    fontSize,
    assetUrl,
    chassisAbilities,
    effects,
    table,
    actionsToDisplay,
    matchingAction,
    source,
    label,
    techLevel,
    subtitleExtra,
    statsOverride,
    primaryStatsOnly: primaryStatsOnlyProp,
    abilitiesSection,
    afterExtraContent,
    afterChoicesContent,
    footerOverride,
    titleSlot,
    titleAs,
  } = state

  // Display-state context (audit item 20): provided once here; nested section
  // components consume it instead of having every value hand-threaded.
  const displayState = useMemo(
    () => ({ compact, spacing, fontSize, damaged, disabled }),
    [compact, spacing, fontSize, damaged, disabled]
  )

  // Resolved unconditionally (hook rules); gated to full displays below.
  const externalLinkNode = useEntityExternalLink(data)

  // Entities with choices render a live, resolved dataview row (base datavalues +
  // applied choice effects) via ReferenceEntityResolvedChoices.
  const entityHasChoices = (getChoices(data)?.length ?? 0) > 0 && !hide.choices

  // Choice-bearing equipment carries its stats in the resolved dataview row, so
  // its redundant same-named action (the "pilot equipment" card) is suppressed
  // here to avoid duplicating Damage/Range. The action stays in data — kept on
  // the granting ability.
  const entityName = 'name' in data ? data.name : undefined
  const visibleActions =
    entityHasChoices && actionsToDisplay
      ? actionsToDisplay.filter((action) => action.name !== entityName)
      : actionsToDisplay

  // Choice-bearing entities share one source of truth between the header data row
  // (ReferenceEntityResolvedDataRow) and the body choice cards
  // (ReferenceEntityResolvedChoices) — toggling a card recomputes the header live.
  //
  // Uncontrolled by default: ephemeral `useState`, owned here (the SRD). A consumer
  // can control + persist by passing `selections` (+ `onSelectionChange`); ITUN does
  // this against its store. Controlled `selections` without `onSelectionChange` is a
  // read-only view (e.g. a published snapshot) — cards render but toggles no-op. The
  // uncontrolled path keeps the original stable `useState` setter unchanged.
  const [internalSelections, setInternalSelections] = useState<ChoiceSelections>({})
  const isChoiceControlled = controlledSelections !== undefined
  const choiceSelections = isChoiceControlled ? controlledSelections : internalSelections
  const setChoiceSelections = isChoiceControlled
    ? (next: ChoiceSelections) => onSelectionChange?.(next)
    : setInternalSelections
  const resolvedDataRow = entityHasChoices ? (
    <ReferenceEntityResolvedDataRow data={data} selections={choiceSelections} compact={compact} />
  ) : null

  // Content-block munging (override/suppression/truncation rules) lives in
  // deriveEntityContent.ts — pure and unit-testable.
  const contentBlocks = deriveContentBlocks<ContentBlocks[number]>({
    data,
    hideContent: !!hide.content,
    hideActions: !!hide.actions,
    compact,
    entityHasChoices,
    matchingAction,
    hideLeadContent,
  })

  // An ability that grants equipment (e.g. Custom Sniper Rifle) re-skins its body:
  // it suppresses its own description/content + Actions and instead surfaces the
  // granted equipment's intro (lead) line + a `Grants` block (the nested compact
  // equipment with its resolved row + choice cards).
  const grantedEntities = resolveGrantedEntities(data)
  const isGrantingAbility = isAbility(data) && grantedEntities.length > 0
  // A granting ability ALWAYS shows its Grants (the block only renders when the
  // card has a body — i.e. not a header-only `listing`).
  const showGrants = isGrantingAbility

  // Show content if entity has content blocks. A granting ability suppresses its
  // own content entirely — its body is the lead line + Grants block instead.
  const showContent = !isGrantingAbility && !!contentBlocks && contentBlocks.length > 0

  // The level/tech-level moves out of the header into the label as a badge
  // stamp ([LABEL] [N]):
  //  - basic/advanced abilities (numeric level 1-3) show their level beside the
  //    tree label; legendary ('L') and generic ('G') omit it entirely;
  //  - tech-level entities show their tech level beside a "Tech Level" label.
  // Gate on data shape, not schemaName, per .claude/rules/display-system.md.
  const isAbilityEntity = isAbility(data)
  const isTechLevelEntity = !isAbilityEntity && techLevel != null
  const abilityLevel = 'level' in data ? data.level : undefined
  const isAbilityWithNumericLevel =
    isAbilityEntity &&
    abilityLevel != null &&
    !['L', 'G'].includes(String(abilityLevel).toUpperCase())
  const labelBadge = isAbilityWithNumericLevel
    ? String(abilityLevel)
    : isTechLevelEntity
      ? String(techLevel)
      : undefined
  // Classes surface their type ("Base Class" / "Hybrid Class") as the label;
  // tech-level entities surface "Tech Level". (Both move out of the data row.)
  const classTypeLabel = isClass(data) ? getClassTypeLabel(data) : undefined
  const effectiveLabel = label ?? classTypeLabel ?? (isTechLevelEntity ? 'Tech Level' : undefined)

  // "Recommended" moves from the data row into the label callout row, ordered
  // first, in the same rust as its data value.
  const isRecommended = isEntityData(data) && getRecommended(data) === true
  const labelLead = isRecommended ? (
    <CalloutMetaStamp rust compact={compact}>
      {CALLOUT_META_LABELS.recommended}
    </CalloutMetaStamp>
  ) : undefined

  // Whether the right header column will actually render flavor — mirrors
  // ReferenceEntityRightHeaderContent's own early-return guard.
  const hasHeaderFlavor = isAbilityEntity && !!data.description

  // Consolidate chassis abilities logic — data-shape driven
  const chassisName = 'name' in data ? data.name : undefined
  const hasChassisAbilities = !!chassisAbilities && chassisAbilities.length > 0

  // Titanic statblocks (Bio-Titans + statblock-equipped bosses) — see
  // deriveTitanicStatblock for the data-shape gating rationale.
  const { isTitanicStatblock, statblockSystems, statblockModules, hasStatblockEquipment } =
    deriveTitanicStatblock(data, schemaName)

  // Check if entity has actions that will be displayed (after filtering).
  const hasDisplayableActions =
    !isGrantingAbility &&
    !!visibleActions &&
    visibleActions.length > 0 &&
    (!hide.actions || compact) &&
    !(compact && isTitanicStatblock)

  const hasTopMatterContent =
    !!showContent || hasChassisAbilities || !!assetUrl || hasDisplayableActions || showGrants

  // See EntityBodyTopMatter for the float-vs-grid rationale.
  const imageFloats =
    !!assetUrl && !(!compact && ((hasChassisAbilities && !hide.actions) || !!afterExtraContent))

  // Resolve drone entity from chassis abilities (rendered below the fold)
  const droneAbility = chassisAbilities?.find((a) => a.drone)
  const droneEntity = droneAbility?.drone
    ? SalvageUnionReference.findIn('drones', (d) => d.name === droneAbility.drone)
    : undefined

  // Pre-built block for chassis abilities (reused at multiple render positions)
  // When abilitiesSection is provided by the caller, it replaces the built-in block
  const chassisAbilitiesBlock = abilitiesSection ? (
    abilitiesSection
  ) : hasChassisAbilities ? (
    <ReferenceEntityChassisAbilitiesContent
      chassisName={chassisName}
      compact={compact}
      chassisAbilities={chassisAbilities}
      hideDrone={!!droneEntity}
    />
  ) : null

  // Cache border color derivation (used in faction data and elsewhere)
  const borderColor = borderColorFromHeaderBg(headerBg, headerBgColor)
  // Accent tints derived from the base/header colour: a lighter variant for the
  // flavour ("accent") text on the coloured field, and a deeper variant for the
  // white body box's left accent border.
  const accentText = accentTextColor(headerBg, headerBgColor)
  const accentDeep = accentDeepColor(headerBg, headerBgColor)

  // Determine if there is any body content to render (to avoid empty padding)
  const hasFactionContent = !!(getGoals(data) || getAssets(data) || getWeaknesses(data))
  const hasGuideSteps = 'steps' in data && Array.isArray(data.steps) && data.steps.length > 0
  const hasBodyContent =
    hasTopMatterContent ||
    !!children ||
    !!chassisAbilitiesBlock ||
    !!afterExtraContent ||
    !!afterChoicesContent ||
    !!droneEntity ||
    hasStatblockEquipment ||
    hasFactionContent ||
    hasGuideSteps ||
    ('bonusPerTechLevel' in data && !!data.bonusPerTechLevel) ||
    (effects && effects.length > 0) ||
    !!table ||
    entityHasChoices ||
    !!expand ||
    shouldShowExtraContent

  // Footer data. Sources are self-referencing books: they keep their source
  // tag in the footer but hide the (placeholder) page number. Actions resolve
  // their source/page/booklet from their `actionSource` parent.
  const footerEntity = resolveFooterEntity(data)
  const isSources = schemaName === 'sources'
  const footerSource = 'source' in footerEntity ? footerEntity.source : undefined
  const footerPage = 'page' in footerEntity ? footerEntity.page : undefined
  const footerBooklet = getBooklet(footerEntity)
  const hasPage = !isSources && !!footerPage
  const hasSource = !!footerSource
  const footerDisplayName = getDisplayName(schemaName)
  // App-supplied external cross-link (e.g. ITUN's "View in SRD →"). Full
  // displays only — compact/listing cards stay uncluttered; the detail modal
  // renders full content, so it picks the link up too.
  const externalLink = !compact && !listing ? externalLinkNode : undefined

  // Foot extras force the foot band even without source/page data — they are
  // live-play affordances, not source chrome.
  const hasFootExtras = !!footActions || (!!footMeta && footMeta.length > 0) || !!externalLink
  const hasFooter = (!hide.footer && (hasPage || hasSource)) || hasFootExtras

  // Themed border for expansion-sourced entities.
  const sourceBorderColor = getSourceBorderColor(source) ?? 'var(--color-su-black)'

  // Accessible alt text for the entity illustration.
  const imageAltText = title
    ? `${title} ${getDisplayName(schemaName)} illustration`
    : `${getDisplayName(schemaName)} illustration`

  const footer = footerOverride ? (
    footerOverride
  ) : hasFooter ? (
    <ReferenceEntityFooter
      footerDisplayName={!hide.footer ? footerDisplayName : undefined}
      source={!hide.footer && hasSource ? footerSource : undefined}
      booklet={footerBooklet}
      page={!hide.footer && hasPage ? footerPage : undefined}
      headerBg={headerBg}
      headerBgColor={headerBgColor}
      footActions={footActions}
      footMeta={footMeta}
      externalLink={externalLink}
    />
  ) : null

  // Build stats for DisplayCard
  const resolvedStats: StatItem[] | undefined = statsProp
    ? statsProp
    : !hide.stats
      ? buildReferenceEntityStats(data, {
          compact,
          listing,
          primaryOnly: primaryStatsOnlyProp,
          svOverride: statsOverride,
          techLevel,
          schemaName,
        })
      : undefined

  // Compose header content (previously assembled by Card internally)
  const titleNode = title ? (
    <div>
      {/* Layers the enlarge animation over the shared card-title sizing — see
          cardTitleClasses (the size/tracking literals live there once). */}
      <Text
        variant="pseudoheader"
        as="span"
        className={cn(
          'relative z-10 transition-transform duration-300',
          cardTitleClasses(compact, disabled)
        )}
        style={cardTitleStyle(compact)}
      >
        {title}
      </Text>
    </div>
  ) : null

  // Trailing type-label tag (design-spec §2.1), appended last to the header
  // data row.
  const typeLabelNode =
    showTypeLabel || typeLabel != null ? (
      <Tag label={typeLabel ?? getDisplayName(schemaName)} />
    ) : null

  const headerContent = (
    <CardHeader
      title={titleSlot ?? titleNode ?? ''}
      subtitle={
        <ReferenceEntitySubTitleElement
          data={data}
          schemaName={schemaName}
          compact={compact}
          suppressExtractedDetails={entityHasChoices}
          subtitleExtra={
            resolvedDataRow || typeLabelNode ? (
              <>
                {subtitleExtra}
                {resolvedDataRow}
                {typeLabelNode}
              </>
            ) : (
              subtitleExtra
            )
          }
        />
      }
      rightContent={
        // `hasHeaderFlavor` already means "ability with a description", so the
        // node is never truthy-but-empty.
        hasHeaderFlavor ? (
          <ReferenceEntityRightHeaderContent data={data} accentColor={accentText} />
        ) : undefined
      }
      compact={compact}
      lightweight={lightweight}
      titleAs={titleAs}
    />
  )

  // Shared accent-surface fallback (bg class + optional dynamic backgroundColor).
  const accent = accentSurface(headerBg, headerBgColor)

  // Sources carry a `purchaseLink` to the publisher's store — surface it as a
  // "Buy" control in the top-right of the card header, opening the store in a
  // new tab.
  const purchaseLink =
    'purchaseLink' in data && typeof data.purchaseLink === 'string' ? data.purchaseLink : undefined
  const buyControl: ReferenceEntityControl | undefined = purchaseLink
    ? {
        key: 'buy',
        label: 'Buy',
        ariaLabel: title ? `Buy ${title}` : 'Buy this source',
        onClick: () => window.open(purchaseLink, '_blank', 'noopener,noreferrer'),
      }
    : undefined
  const resolvedControls = buyControl ? [...(controls ?? []), buyControl] : controls

  const card = (
    <DisplayCard
      headerBg={headerBg}
      headerBgColor={headerBgColor}
      headerContent={
        opacity.header !== 1 ? (
          <div style={{ opacity: opacity.header }}>{headerContent}</div>
        ) : (
          headerContent
        )
      }
      footerContent={!hasBodyContent ? footer : undefined}
      label={effectiveLabel}
      labelBadge={labelBadge}
      labelLead={labelLead}
      compact={compact}
      listing={listing}
      headerTestId="frame-header-container"
      borderColor={sourceBorderColor}
      disabled={disabled}
      controls={resolvedControls}
      stats={resolvedStats}
      onCardClick={onCardClick}
      cardClickable={cardClickable}
      status={status}
      onStatusClick={onStatusClick}
      statusSubject={typeof data.name === 'string' ? data.name : undefined}
    >
      {!listing && hasBodyContent && (
        <div className={cn('w-full', accent.className)} style={accent.style}>
          {/* Inset white body box floating in the accent field (design itun.css
              .ec__body margin: 0 12px 8px) — the accent wrapper above shows
              through the mx-3/mb-2 insets so colour surrounds the text. */}
          <div
            // No bottom margin: the footer's own symmetric py provides the gap
            // above its content, so the footer isn't top-heavy.
            // 3px left accent border in the card's "deep" (darker) accent tint.
            className={cn(
              'mx-3 min-w-0 bg-su-white p-0',
              accentDeep && 'border-l-[3px]',
              damageOverlayText && 'relative'
            )}
            style={{
              opacity: opacity.content,
              ...(accentDeep ? { borderLeftColor: accentDeep } : {}),
            }}
          >
            {/* Float zone: block flow so image float propagates to all children */}
            <div
              className={cn(spacing.sectionSpaceYClass)}
              style={{
                ...spacing.contentPaddingXStyle,
                paddingTop:
                  source !== 'Salvage Union Workshop Manual' && hasTopMatterContent
                    ? `calc(${spacing.contentPadding * 0.25}rem + 5px)`
                    : `${spacing.contentPadding}rem`,
                // See CONTENT_PADDING_BOTTOM_RATIO for the ratio rationale.
                paddingBottom: `${spacing.contentPadding * CONTENT_PADDING_BOTTOM_RATIO}rem`,
              }}
            >
              <EntityBodyTopMatter
                assetUrl={assetUrl}
                imageAltText={imageAltText}
                showContent={showContent}
                contentBlocks={contentBlocks}
                chassisAbilitiesBlock={chassisAbilitiesBlock}
                hasChassisAbilities={hasChassisAbilities}
                hideActions={!!hide.actions}
                afterExtraContent={afterExtraContent}
                imageFloats={imageFloats}
                headerBg={headerBg}
                headerBgColor={headerBgColor}
                borderColor={borderColor}
                data={data}
                interactive={interactive}
              >
                {children}
              </EntityBodyTopMatter>
              {(!hide.actions || (compact && !isTitanicStatblock && !rightContent)) && (
                <ReferenceEntityActions
                  suppressActions={hasChassisAbilities || isGrantingAbility}
                  compact={compact}
                  actionsToDisplay={visibleActions}
                  headerBg={headerBg}
                  sectionHeaders={schemaName === 'crawlers'}
                />
              )}
              {/* Granting ability: a `Grants` block — the nested compact equipment
                  renders its own intro paragraph, resolved row + choice cards.
                  Rendered in the main body flow so it is visible in compact mode. */}
              {showGrants && <ReferenceEntityGrants data={data} compact={compact} />}
              <EntityStatblockEquipment systems={statblockSystems} modules={statblockModules} />
              {/* Compact: chassis abilities render after actions */}
              {compact && chassisAbilitiesBlock}
              <ReferenceEntityResolvedChoices
                data={data}
                hideChoices={hide.choices}
                compact={compact}
                parentHeaderBg={headerBg}
                parentHeaderBgColor={headerBgColor}
                selections={choiceSelections}
                onSelectionChange={setChoiceSelections}
                readOnly={onSelectionChange === undefined}
                scalingParent={scalingParent}
              />
              <ReferenceEntityIntegratedSystems data={data} compact={compact} />

              <ReferenceEntityBonusPerTechLevel
                bonusPerTechLevel={'bonusPerTechLevel' in data ? data.bonusPerTechLevel : undefined}
                compact={compact}
                techLevel={techLevel}
              />
              {effects?.map((effect, index) => (
                <ConditionalSheetInfo
                  key={index}
                  propertyName="effects"
                  label={effect.label}
                  value={effect.value}
                  data={data}
                  compact={compact}
                  headerBg={headerBg}
                />
              ))}

              <ReferenceEntityRequirementDisplay data={data} compact={compact} />
              {table && !hide.rollTable && (
                <div className="relative z-10 rounded-md">
                  <RollTable
                    disabled={disabled}
                    table={table}
                    showCommand
                    compact
                    tableName={chassisName != null ? String(chassisName) : undefined}
                  />
                </div>
              )}
              <ReferenceEntityFormation
                data={data}
                headerFontSize={fontSize.lg}
                compact={compact}
              />
              <EntityNpcSection
                data={data}
                npcConfig={npcConfig}
                damaged={damaged}
                headerBg={headerBg}
                headerBgColor={headerBgColor}
                rightContent={rightContent}
                npcPosition={npcPosition}
              />
              {shouldShowExtraContent && (
                <EntityExtraSections
                  data={data}
                  droneEntity={droneEntity}
                  hidePatterns={!!hide.patterns}
                  hideDamagedEffect={!!hide.damagedEffect}
                  headerBg={headerBg}
                />
              )}
              {/* Caller-provided slot — renders whenever supplied, independent of
                the actions-gated extra content above. Compact selection cards
                (e.g. the pilot class wizard) hide actions but still need their
                injected ability/tree disclosure to appear. */}
              {afterExtraContent && (
                <>
                  <div className="clear-both" />
                  {afterExtraContent}
                </>
              )}
              {afterChoicesContent && (
                <>
                  <div className="clear-both" />
                  {afterChoicesContent}
                </>
              )}
              <div className="clear-both" />
            </div>
            {damageOverlayText && (
              <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center rounded-b-md bg-black/50 p-4">
                <div className="rounded border-2 border-red-500/60 bg-red-800/90 px-4 py-3 text-center shadow-lg">
                  <Text variant="pseudoheader" as="span" className="text-xs uppercase text-white">
                    Damaged
                  </Text>
                  <Text variant="default" className="mt-1 text-sm leading-snug text-red-100">
                    {damageOverlayText}
                  </Text>
                </div>
              </div>
            )}
          </div>
          {/* Expansion slot (design .ec__expand): on the accent field after
              the white body box, before the footer — same horizontal inset
              as the body box. */}
          {expand && <div className="mx-3 mt-2 min-w-0 pb-2">{expand}</div>}
          {/* Footer. Interactive wizards (renderFooter present) get a floating
              action that sticks to the bottom-right of the viewport as the form
              scrolls. Static (suref-web) cards keep the plain full-width accent
              footer below. The wrapper is click-through (pointer-events-none)
              so only the action itself is interactive. */}
          {interactive?.renderFooter ? (
            <div className="pointer-events-none sticky bottom-4 z-40 flex justify-end px-4 pb-2 [&>*]:pointer-events-auto [&_button]:shadow-lg">
              {interactive.renderFooter()}
            </div>
          ) : (
            footer
          )}
        </div>
      )}
    </DisplayCard>
  )

  return (
    <ReferenceEntityDisplayStateProvider value={displayState}>
      {card}
    </ReferenceEntityDisplayStateProvider>
  )
}
