import type { ReactNode } from 'react'
import type { SURefEntity, SURefEnumSchemaName } from 'salvageunion-reference'
import {
  getDisplayName,
  getGoals,
  getAssets,
  getWeaknesses,
  getRecommended,
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
import { ReferenceEntityChassisPatterns } from '../ReferenceEntityChassisPatterns'
import { ReferenceEntityFormation } from '../ReferenceEntityFormation'
import { ReferenceEntityNpcDisplay } from '../ReferenceEntityNpcDisplay'
import { ReferenceEntityChassisAbilitiesContent } from '../ReferenceEntityChassisAbilitiesContent'
import { SectionSeparator } from '../SectionSeparator'
import { ReferenceEntityDisplay } from '../index'
import { PatternEquipmentItem } from '../PatternEquipmentItem'
import { ReferenceEntityRequirementDisplay } from '../ReferenceEntityRequirementDisplay'
import { ReferenceEntityChoices } from '../ReferenceEntityChoices'
import { ReferenceEntityGrants } from '../ReferenceEntityGrants'
import { ReferenceEntityBonusPerTechLevel } from '../ReferenceEntityBonusPerTechLevel'
import { ReferenceEntityIntegratedSystems } from '../ReferenceEntityIntegratedSystems'
import { ConditionalSheetInfo } from '../ConditionalSheetInfo'
import { ReferenceEntityActions } from '../ReferenceEntityActions'
import { CardImage } from '../../../shared/CardImage'
import { BlockContentRendererView } from '../../BlockContentRendererView'
import { GuideStepsDisplay } from '../../GuideStepsDisplay'
import type { GuideStepsInteractiveConfig } from '../../GuideStepsDisplay'
import { cn } from '../../../../utils/cn'
import {
  CALLOUT_META_LABELS,
  getClassTypeLabel,
} from '../../../../lib/referenceEntityDataExtraction'
import { Text } from '../../../base/Text'
import {
  accentSurface,
  borderColorFromHeaderBg,
  getSourceStyles,
  getSourceBorderColor,
} from '../../referenceEntityHelpers'
import { useReferenceEntityDisplayState } from '../useReferenceEntityDisplayState'
import type { ReferenceEntityDisplayStateInput } from '../useReferenceEntityDisplayState'
import type { ReferenceEntityControl } from '../referenceEntityControlTypes'
import type { ChoiceInputRenderer } from '../ReferenceEntityChoice'
import type { NpcConfig } from '../referenceEntityDisplayTypes'
import { ReferenceEntityFooter } from './ReferenceEntityFooter'
import { ReferenceEntityFactionData } from './ReferenceEntityFactionData'
import { GuideEntityListing } from './GuideEntityListing'

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
  /** Custom renderer for simple choice inputs (e.g., freeform text, roll tables) */
  choiceInputRenderer?: ChoiceInputRenderer
  /** Override stats in the card header (passed to DisplayCard.stats) */
  stats?: StatItem[]
}

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
  choiceInputRenderer,
  stats: statsProp,
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
    booklet,
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

  // Determine which content to render (from EntityTopMatter)
  let contentBlocks = hide.content ? undefined : 'content' in data ? data.content : undefined

  // Check if any action name matches the entity name - if so, use that action's content
  if (matchingAction && matchingAction.content && matchingAction.content.length > 0) {
    contentBlocks = matchingAction.content
  }

  // In compact list view (hide.actions), only show content before the first heading
  if (contentBlocks && compact && hide.actions) {
    const firstHeadingIndex = contentBlocks.findIndex((block) => block.type === 'heading')
    if (firstHeadingIndex > 0) {
      contentBlocks = contentBlocks.slice(0, firstHeadingIndex)
    }
  }

  // Show content if entity has content blocks
  const showContent = contentBlocks && contentBlocks.length > 0

  // The level/tech-level moves out of the header into the label as a badge
  // stamp ([LABEL] [N]):
  //  - basic/advanced abilities (numeric level 1-3) show their level beside the
  //    tree label; legendary ('L') and generic ('G') omit it entirely;
  //  - tech-level entities show their tech level beside a "Tech Level" label.
  // Gate on data shape, not schemaName, per .claude/rules/display-system.md — keeps
  // the label-callout logic schema-agnostic (works for app-injected entities too).
  const isAbilityEntity = isAbility(data)
  const abilityLevel = 'level' in data ? data.level : undefined
  const isAbilityWithNumericLevel =
    isAbilityEntity &&
    abilityLevel != null &&
    !['L', 'G'].includes(String(abilityLevel).toUpperCase())
  const labelBadge = isAbilityWithNumericLevel
    ? String(abilityLevel)
    : !isAbilityEntity && techLevel != null
      ? String(techLevel)
      : undefined
  // Classes surface their type ("Base Class" / "Hybrid Class") as the label;
  // tech-level entities surface "Tech Level". (Both move out of the data row.)
  // getClassTypeLabel is the shared producer of the label string (one source of
  // truth with the data-extraction layer + the subtitle de-dup filter).
  const classTypeLabel = isClass(data) ? getClassTypeLabel(data) : undefined
  const effectiveLabel =
    label ?? classTypeLabel ?? (!isAbilityEntity && techLevel != null ? 'Tech Level' : undefined)

  // "Recommended" moves from the data row into the label callout row, ordered
  // first, in the same rust as its data value. (It is filtered out of the
  // subtitle below.) Renders in header-only/compact/full like the rest of the row.
  const isRecommended = isEntityData(data) && getRecommended(data) === true
  const labelLead = isRecommended ? (
    <Text
      variant="pseudoheader"
      as="span"
      className="whitespace-nowrap bg-su-rust text-xs uppercase text-su-white"
    >
      {CALLOUT_META_LABELS.recommended}
    </Text>
  ) : undefined

  // Whether the right header column will actually render flavor. isAbility narrows
  // to SURefAbility (description is a declared optional field), so no cast/extra
  // membership check is needed; this mirrors ReferenceEntityRightHeaderContent's
  // own early-return guard so we never pass a truthy-but-empty node to CardHeader.
  const hasHeaderFlavor = isAbilityEntity && !!data.description

  // Consolidate chassis abilities logic — data-shape driven
  const chassisName = 'name' in data ? data.name : undefined
  const hasChassisAbilities = !!chassisAbilities && chassisAbilities.length > 0

  // Check if entity has actions that will be displayed (after filtering)
  const hasDisplayableActions =
    !!actionsToDisplay &&
    actionsToDisplay.length > 0 &&
    (!hide.actions || compact) &&
    !(compact && schemaName === 'titans')

  const hasTopMatterContent =
    !!showContent || hasChassisAbilities || !!assetUrl || hasDisplayableActions

  // Resolve drone entity from chassis abilities (rendered below the fold)
  const droneAbility = chassisAbilities?.find((a) => a.drone)
  const droneEntity = droneAbility?.drone
    ? SalvageUnionReference.findIn('drones', (d) => d.name === droneAbility.drone)
    : undefined

  // Resolve titan-equipped systems/modules into entities for inline listing
  const isTitan = schemaName === 'titans'
  const titanSystemNames =
    isTitan && 'systems' in data && Array.isArray(data.systems)
      ? (data.systems as string[])
      : undefined
  const titanModuleNames =
    isTitan && 'modules' in data && Array.isArray(data.modules)
      ? (data.modules as string[])
      : undefined
  const titanSystems = titanSystemNames
    ?.map((name) => SalvageUnionReference.findIn('systems', (s) => s.name === name))
    .filter((entity): entity is NonNullable<typeof entity> => !!entity)
  const titanModules = titanModuleNames
    ?.map((name) => SalvageUnionReference.findIn('modules', (m) => m.name === name))
    .filter((entity): entity is NonNullable<typeof entity> => !!entity)
  const hasTitanEquipment =
    (titanSystems && titanSystems.length > 0) || (titanModules && titanModules.length > 0)

  // Pre-built block for chassis abilities (reused at multiple render positions)
  // When abilitiesSection is provided by the caller, it replaces the entire built-in block
  const chassisAbilitiesBlock = abilitiesSection ? (
    abilitiesSection
  ) : hasChassisAbilities ? (
    <ReferenceEntityChassisAbilitiesContent
      chassisName={chassisName}
      spacing={spacing}
      compact={compact}
      chassisAbilities={chassisAbilities}
      hideDrone={!!droneEntity}
    />
  ) : null

  // Cache border color derivation (used in faction data and elsewhere)
  const borderColor = borderColorFromHeaderBg(headerBg, headerBgColor)

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
    hasTitanEquipment ||
    hasFactionContent ||
    hasGuideSteps ||
    ('bonusPerTechLevel' in data && !!data.bonusPerTechLevel) ||
    (effects && effects.length > 0) ||
    !!table ||
    shouldShowExtraContent

  // Footer data — sources entities are self-referencing, so hide page/source
  const isSources = schemaName === 'sources'
  const hasPage = !isSources && 'page' in data && !!data.page
  const hasSource = !isSources && 'source' in data && !!data.source
  const footerDisplayName = getDisplayName(schemaName)
  const hasFooter = !hide.footer && (hasPage || hasSource)

  // Pre-compute source styles for DisplayCard generic overrides
  const sourceCardStyle = getSourceStyles(source, disabled ?? false, 'card', !listing)
  const sourceHeaderStyle = getSourceStyles(source, disabled ?? false, 'header', !listing)
  const sourceFooterStyle = getSourceStyles(source, disabled ?? false, 'footer', !listing)
  const sourceBorderColor = getSourceBorderColor(source) ?? 'black'

  // Accessible alt text for the entity illustration: "{Title} {schema display name} illustration"
  // (e.g. "Iron Mongrel Chassis illustration"). Falls back to a generic label when title is absent.
  const imageAltText = title
    ? `${title} ${getDisplayName(schemaName)} illustration`
    : `${getDisplayName(schemaName)} illustration`

  const footer = footerOverride ? (
    footerOverride
  ) : hasFooter ? (
    <ReferenceEntityFooter
      footerDisplayName={footerDisplayName}
      source={hasSource ? data.source : undefined}
      booklet={booklet}
      page={hasPage ? data.page : undefined}
      headerBg={headerBg}
      headerBgColor={headerBgColor}
      sourceFooterStyles={sourceFooterStyle}
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

  const headerContent = (
    <CardHeader
      title={titleSlot ?? titleNode ?? ''}
      subtitle={
        <ReferenceEntitySubTitleElement
          data={data}
          schemaName={schemaName}
          spacing={spacing}
          compact={compact}
          subtitleExtra={subtitleExtra}
        />
      }
      rightContent={
        // Only pass right-header content when there's actually flavor to render
        // (ability description). Passing the element unconditionally made it a
        // truthy node even when it renders null — which flips CardHeader into the
        // capped flex-[0_1_auto] max-w branch and squishes the data row for
        // systems/modules (whose only right element is the separate stats column).
        !hide.stats && hasHeaderFlavor ? (
          <ReferenceEntityRightHeaderContent data={data} fontSize={fontSize} />
        ) : undefined
      }
      compact={compact}
      lightweight={lightweight}
      titleAs={titleAs}
    />
  )

  // Shared accent-surface fallback (bg class + optional dynamic backgroundColor).
  const accent = accentSurface(headerBg, headerBgColor)

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
      cardStyle={sourceCardStyle}
      headerStyle={sourceHeaderStyle}
      footerStyle={sourceFooterStyle}
      borderColor={sourceBorderColor}
      disabled={disabled}
      controls={controls}
      stats={resolvedStats}
      onCardClick={onCardClick}
      cardClickable={cardClickable}
    >
      {!listing && hasBodyContent && (
        <div className={cn('w-full', accent.className)} style={accent.style}>
          {/* Inset white body box floating in the accent field (design itun.css
              .ec__body margin: 0 12px 8px) — the accent wrapper above shows
              through the mx-3/mb-2 insets so colour surrounds the text. */}
          <div
            // No bottom margin: the footer's own symmetric py provides the gap
            // above its content, so the footer isn't top-heavy (the body box's
            // bottom edge meets the footer directly).
            className={cn('mx-3 min-w-0 bg-su-white p-0', damageOverlayText && 'relative')}
            style={{ opacity: opacity.content }}
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
                // The last content block already carries its own bottom margin,
                // so keep the container's bottom padding small to avoid doubling
                // the whitespace above the footer. 0.34 is empirically tuned
                // (~1/3 of the default content padding), not derived.
                paddingBottom: `${spacing.contentPadding * 0.34}rem`,
              }}
            >
              {assetUrl && hasChassisAbilities && !compact && !hide.actions ? (
                // Grid layout for chassis with images: ability anchored to bottom of image
                <div className="md:grid md:grid-cols-[auto_1fr]">
                  <CardImage url={assetUrl} alt={imageAltText} compact={compact} />
                  <div className="flex flex-col justify-evenly">
                    <div>
                      {showContent && (
                        <BlockContentRendererView
                          content={contentBlocks!}
                          fontSize={fontSize.sm}
                          compact={compact}
                          headerBg={headerBg}
                          headerBgColor={headerBgColor}
                        />
                      )}
                      {children}
                    </div>
                    {chassisAbilitiesBlock}
                  </div>
                </div>
              ) : (
                <>
                  {assetUrl && afterExtraContent && !compact ? (
                    // Grid layout: vertically center content beside image when
                    // afterExtraContent (e.g. class ability trees) will render below
                    <div className="md:grid md:grid-cols-[auto_1fr] md:items-center">
                      <CardImage url={assetUrl} alt={imageAltText} compact={compact} />
                      <div>
                        {showContent && (
                          <BlockContentRendererView
                            content={contentBlocks!}
                            fontSize={fontSize.sm}
                            compact={compact}
                            headerBg={headerBg}
                            headerBgColor={headerBgColor}
                          />
                        )}
                        {children}
                      </div>
                    </div>
                  ) : (
                    <>
                      {assetUrl && (
                        <CardImage url={assetUrl} alt={imageAltText} compact={compact} />
                      )}
                      {showContent && (
                        <BlockContentRendererView
                          content={contentBlocks!}
                          fontSize={fontSize.sm}
                          compact={compact}
                          headerBg={headerBg}
                          headerBgColor={headerBgColor}
                        />
                      )}
                      {children}
                    </>
                  )}
                  <ReferenceEntityFactionData
                    data={data}
                    compact={compact}
                    fontSize={fontSize}
                    borderColor={borderColor}
                  />
                  {/* Guide steps — data-shape driven */}
                  {'steps' in data && Array.isArray(data.steps) && data.steps.length > 0 && (
                    <GuideStepsDisplay
                      steps={data.steps}
                      compact={compact}
                      headerBg={headerBg}
                      headerBgColor={headerBgColor}
                      fontSize={fontSize}
                      interactive={interactive}
                      renderEntityListing={(
                        entityData,
                        entitySchemaName,
                        key,
                        isListing,
                        forceCompact,
                        entityControls,
                        entityDisabled
                      ) => (
                        <GuideEntityListing
                          key={key}
                          data={entityData as SURefEntity}
                          schemaName={entitySchemaName as SURefEnumSchemaName}
                          compact={forceCompact ?? isListing}
                          listing={isListing}
                          disabled={!!entityDisabled}
                          controls={entityControls}
                        />
                      )}
                    />
                  )}
                  {/* Non-compact: chassis abilities render before actions */}
                  {!compact && !hide.actions && chassisAbilitiesBlock}
                </>
              )}
              {(!hide.actions || (compact && schemaName !== 'titans' && !rightContent)) && (
                <ReferenceEntityActions
                  suppressActions={hasChassisAbilities}
                  spacing={spacing}
                  compact={compact}
                  actionsToDisplay={actionsToDisplay}
                  headerBg={headerBg}
                  sectionHeaders={schemaName === 'crawlers'}
                />
              )}
              {/* Titan-equipped systems/modules render as compact listings under actions */}
              {titanSystems && titanSystems.length > 0 && (
                <>
                  <SectionSeparator label="Mech Systems" compact={compact} />
                  <div className={cn('flex flex-col', spacing.sectionSpaceYClass)}>
                    {titanSystems.map((system) => (
                      <PatternEquipmentItem key={`titan-system-${system.id}`} data={system} />
                    ))}
                  </div>
                </>
              )}
              {titanModules && titanModules.length > 0 && (
                <>
                  <SectionSeparator label="Mech Modules" compact={compact} />
                  <div className={cn('flex flex-col', spacing.sectionSpaceYClass)}>
                    {titanModules.map((mod) => (
                      <PatternEquipmentItem key={`titan-module-${mod.id}`} data={mod} />
                    ))}
                  </div>
                </>
              )}
              {/* Compact: chassis abilities render after actions */}
              {compact && chassisAbilitiesBlock}
              <ReferenceEntityChoices
                data={data}
                spacing={spacing}
                fontSize={fontSize}
                hideChoices={hide.choices}
                compact={compact}
                choiceInputRenderer={choiceInputRenderer}
              />
              <ReferenceEntityIntegratedSystems data={data} compact={compact} />

              <ReferenceEntityBonusPerTechLevel
                bonusPerTechLevel={'bonusPerTechLevel' in data ? data.bonusPerTechLevel : undefined}
                spacing={spacing}
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
                  fontSize={fontSize}
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
              {(() => {
                const npcBlock = (
                  <>
                    <ReferenceEntityNpcDisplay
                      data={data}
                      compact={compact}
                      embedded
                      fontSize={fontSize}
                      spacing={spacing}
                      npcChildren={npcConfig?.children}
                      hpSlot={npcConfig?.hpSlot}
                      damaged={npcConfig?.damaged ?? damaged}
                      headerBg={headerBg}
                      headerBgColor={headerBgColor}
                      npcName={npcConfig?.name}
                      onNpcNameChange={npcConfig?.onNameChange}
                      onNpcNameBlur={npcConfig?.onNameBlur}
                      readOnly={npcConfig?.readOnly}
                      showSeparator={npcConfig?.showNpcSeparator}
                      hideHeader={npcConfig?.hideNpcHeader}
                    />
                    {npcConfig?.afterContent}
                  </>
                )
                return rightContent ? (
                  <>
                    <div
                      className={
                        npcPosition === 'right'
                          ? 'md:float-right md:ml-4 md:w-1/2 md:border-l md:border-su-grey-light md:pl-4'
                          : 'md:float-left md:mr-4 md:w-1/2 md:border-r md:border-su-grey-light md:pr-4'
                      }
                      style={{ shapeOutside: 'margin-box' }}
                    >
                      {npcBlock}
                    </div>
                    {rightContent}
                    <div className="clear-both !mt-0" />
                  </>
                ) : (
                  npcBlock
                )
              })()}
              {shouldShowExtraContent && (
                <>
                  {droneEntity && (
                    <>
                      <SectionSeparator label="Drone" compact={compact} />
                      <ReferenceEntityDisplay
                        data={droneEntity}
                        compact
                        hide={{ actions: true, patterns: true }}
                        choiceInputRenderer={choiceInputRenderer}
                      />
                    </>
                  )}
                  {!hide.patterns && (
                    <ReferenceEntityChassisPatterns
                      patterns={'patterns' in data ? data.patterns : undefined}
                      headerFontSize={fontSize.lg}
                      chassisEntity={data}
                    />
                  )}
                  {!hide.damagedEffect && 'damagedEffect' in data && data.damagedEffect && (
                    <ConditionalSheetInfo
                      propertyName="damagedEffect"
                      labelBgColor="text-brand-srd"
                      label="Damaged Effect"
                      data={data}
                      compact={compact}
                      fontSize={fontSize}
                      headerBg={headerBg}
                    />
                  )}
                  <ReferenceEntityGrants data={data} spacing={spacing} />
                </>
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
          {/* Footer — full-width accent bar (design itun.css .ec__foot: no
              margin, accent background spanning the full card width). */}
          {interactive?.renderFooter ? (
            <div
              className={cn('w-full py-3', accent.className, sourceFooterStyle.className)}
              style={{
                ...spacing.contentPaddingXStyle,
                ...accent.style,
                ...sourceFooterStyle.style,
              }}
            >
              {interactive.renderFooter()}
            </div>
          ) : (
            footer
          )}
        </div>
      )}
    </DisplayCard>
  )

  return card
}
