import { useMemo } from 'react'
import type { ReactNode } from 'react'
import { getTiltRotation } from '../../../../utils/tiltUtils'
import type { SURefClass, SURefEntity, SURefEnumSchemaName } from 'salvageunion-reference'
import {
  SalvageUnionReference,
  getDisplayName,
  getGoals,
  getAssets,
  getWeaknesses,
  getPatterns,
  getSalvageValue,
  normalizePatternName,
} from 'salvageunion-reference'
import { RollTable } from '../../../shared/RollTable'
import { DisplayCard } from '../../../shared/DisplayCard'
import { EntitySubTitleElement } from '../EntitySubTitleContent'
import { EntityLeftContent } from '../EntityLeftContent'
import { EntityRightHeaderContent } from '../EntityRightHeaderContent'
import { EntityChassisPatterns } from '../EntityChassisPatterns'
import { EntityChassisPattern } from '../EntityChassisPattern'
import { EntityFormation } from '../EntityFormation'
import { EntityNpcDisplay } from '../EntityNpcDisplay'
import { EntityChassisAbilitiesContent } from '../EntityChassisAbilitiesContent'
import { EntityRequirementDisplay } from '../EntityRequirementDisplay'
import { EntityChoices } from '../EntityChoices'
import { EntityGrants } from '../EntityGrants'
import { EntityBonusPerTechLevel } from '../EntityBonusPerTechLevel'
import { ConditionalSheetInfo } from '../ConditionalSheetInfo'
import { EntityActions } from '../EntityActions'
import { EntityImage } from '../EntityImage'
import { BlockContentRendererView } from '../../BlockContentRendererView'
import { GuideStepsDisplay } from '../../GuideStepsDisplay'
import type { GuideStepsInteractiveConfig } from '../../GuideStepsDisplay'
import { cn } from '../../../../utils/cn'
import { Text } from '../../../base/Text'
import { borderColorFromHeaderBg, getSourceStyles } from '../../entityDisplayHelpers'
import { useEntityDisplayState } from '../useEntityDisplayState'
import type { EntityDisplayStateInput } from '../useEntityDisplayState'
import type { EntityControl } from '../entityControlTypes'
import { useDetailModal } from '../useDetailModal'

export type EntityDisplayContentProps = EntityDisplayStateInput & {
  children?: ReactNode
  /** Controls to render in the header (add, delete, detail, etc.) */
  controls?: EntityControl[]
  /** Interactive config for guide entities — threads through to GuideStepsDisplay */
  interactive?: GuideStepsInteractiveConfig
}

export function EntityDisplayContent({
  children,
  controls,
  interactive,
  ...inputProps
}: EntityDisplayContentProps) {
  const state = useEntityDisplayState(inputProps)
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
    hideActions,
    hidePatterns,
    hideChoices,
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
    classAbilitiesRenderer,
    techLevel,
    patternOverride,
    hideStats,
    hideContent,
  } = state

  // Determine which content to render (from EntityTopMatter)
  let contentBlocks = hideContent ? undefined : 'content' in data ? data.content : undefined

  // Check if any action name matches the entity name - if so, use that action's content
  if (matchingAction && matchingAction.content && matchingAction.content.length > 0) {
    contentBlocks = matchingAction.content
  }

  // In compact list view (hideActions), only show content before the first heading
  if (contentBlocks && compact && hideActions) {
    const firstHeadingIndex = contentBlocks.findIndex((block) => block.type === 'heading')
    if (firstHeadingIndex > 0) {
      contentBlocks = contentBlocks.slice(0, firstHeadingIndex)
    }
  }

  // Show content if entity has content blocks
  const showContent = contentBlocks && contentBlocks.length > 0

  // Consolidate chassis abilities logic
  const chassisName = 'name' in data ? data.name : undefined
  const hasChassisAbilities =
    schemaName === 'chassis' && !!chassisAbilities && chassisAbilities.length > 0

  // Check if entity has actions that will be displayed (after filtering)
  const hasDisplayableActions =
    !!actionsToDisplay &&
    actionsToDisplay.length > 0 &&
    (!hideActions || compact) &&
    !(compact && schemaName === 'bio-titans')

  const hasTopMatterContent =
    !!showContent || hasChassisAbilities || !!assetUrl || hasDisplayableActions

  // Memoize class selection logic
  const selectedClass = useMemo(() => {
    if (schemaName !== 'classes') return undefined
    if ('coreTrees' in data && Array.isArray((data as { coreTrees: string[] }).coreTrees)) {
      return data as SURefClass
    }
    return undefined
  }, [schemaName, data])

  const selectedAdvancedClass = useMemo(() => {
    if (schemaName !== 'classes') return undefined
    if ('hybrid' in data && (data as { hybrid?: boolean }).hybrid === true) {
      return data as SURefClass
    }
    return undefined
  }, [schemaName, data])

  // Pattern override: resolve the full pattern data for page/source info
  const overridePatternData = useMemo(() => {
    if (schemaName !== 'chassis' || !patternOverride) return undefined
    const patterns = getPatterns(data)
    if (!patterns) return undefined
    const normalizedOverride = normalizePatternName(patternOverride.name)
    return patterns.find((p) => normalizePatternName(p.name) === normalizedOverride)
  }, [schemaName, data, patternOverride])

  // Compute whether a pattern override qualifies as a legal starting mech (total SV <= 20)
  const isLegalStartingMech = useMemo(() => {
    if (schemaName !== 'chassis' || !patternOverride) return false
    const STARTING_MECH_BUDGET = 20
    let total = getSalvageValue(data) ?? 0
    for (const sys of patternOverride.systems) {
      const entity = SalvageUnionReference.Systems.find((s) => s.name === sys.name)
      if (entity) total += getSalvageValue(entity) ?? 0
    }
    for (const mod of patternOverride.modules) {
      const entity = SalvageUnionReference.Modules.find((m) => m.name === mod.name)
      if (entity) total += getSalvageValue(entity) ?? 0
    }
    return total <= STARTING_MECH_BUDGET
  }, [schemaName, data, patternOverride])

  // Pre-built block for pattern info + chassis abilities (reused at multiple render positions)
  const chassisAbilitiesBlock =
    hasChassisAbilities || overridePatternData ? (
      <div className={spacing.sectionSpaceYClass}>
        {overridePatternData && (
          <div className={spacing.smallSpaceYClass}>
            <div className="flex items-center gap-2">
              <Text
                variant="pseudoheader"
                as="span"
                className={cn(compact ? 'text-xs' : 'text-sm', 'font-bold uppercase')}
              >
                {normalizePatternName(overridePatternData.name)} Pattern
              </Text>
              {overridePatternData.page && (
                <Text variant="pseudoheader" as="span" className="text-xs font-semibold uppercase">
                  Page {overridePatternData.page}
                </Text>
              )}
              {!compact && overridePatternData.source && (
                <Text
                  variant="pseudoheader"
                  as="span"
                  className="text-xs font-semibold uppercase opacity-70"
                >
                  {overridePatternData.source}
                </Text>
              )}
            </div>
            {overridePatternData.content && overridePatternData.content.length > 0 && (
              <BlockContentRendererView
                content={overridePatternData.content}
                fontSize={fontSize.sm}
                compact={compact}
                damaged={damaged}
              />
            )}
          </div>
        )}
        {hasChassisAbilities && (
          <EntityChassisAbilitiesContent
            chassisName={chassisName}
            spacing={spacing}
            compact={compact}
            chassisAbilities={chassisAbilities}
            droneEquipment={overridePatternData?.drone}
          />
        )}
      </div>
    ) : null

  // Faction strategic data (Goals, Assets, Weaknesses)
  const factionData = [
    { label: 'Goals', value: getGoals(data) },
    { label: 'Assets', value: getAssets(data) },
    { label: 'Weaknesses', value: getWeaknesses(data) },
  ]

  // Determine if there is any body content to render (to avoid empty padding)
  const hasFactionContent = factionData.some(({ value }) => !!value)
  const hasGuideSteps =
    schemaName === 'guides' && 'steps' in data && Array.isArray(data.steps) && data.steps.length > 0
  const hasBodyContent =
    hasTopMatterContent ||
    !!children ||
    !!chassisAbilitiesBlock ||
    hasFactionContent ||
    hasGuideSteps ||
    ('bonusPerTechLevel' in data && !!data.bonusPerTechLevel) ||
    (effects && effects.length > 0) ||
    !!table ||
    shouldShowExtraContent

  // Footer data
  const hasPage = 'page' in data && !!data.page
  const hasSource = 'source' in data && !!data.source
  const footerDisplayName = getDisplayName(schemaName)
  const sourceFooterStyles = getSourceStyles(source, disabled ?? false, 'footer', !listing)
  const hasFooter = hasPage || hasSource

  const footer = hasFooter ? (
    <div
      className={cn(
        'flex w-full items-center justify-between gap-4 py-3 text-su-black',
        headerBg || 'bg-su-white',
        sourceFooterStyles.className
      )}
      style={{
        paddingLeft: `${spacing.contentPaddingX}rem`,
        paddingRight: `${spacing.contentPaddingX}rem`,
        ...(headerBgColor ? { backgroundColor: headerBgColor } : {}),
        ...sourceFooterStyles.style,
      }}
    >
      <div className="flex min-w-0 shrink items-center gap-2">
        {footerDisplayName && (
          <Text
            variant="pseudoheader"
            as="span"
            className={cn(
              'shrink-0 overflow-hidden text-ellipsis whitespace-nowrap text-xs uppercase',
              compact ? 'font-semibold' : 'font-bold'
            )}
          >
            {footerDisplayName}
          </Text>
        )}
      </div>

      <div className="flex shrink-0">
        {hasSource && (
          <Text
            variant="pseudoheader"
            as="span"
            className={cn('whitespace-nowrap text-xs font-semibold uppercase', hasPage && 'mr-4')}
          >
            {data.source}
          </Text>
        )}
        {hasPage && (
          <Text
            variant="pseudoheader"
            as="span"
            className={cn(
              'whitespace-nowrap text-xs uppercase',
              compact ? 'font-semibold' : 'font-bold'
            )}
          >
            Page {data.page}
          </Text>
        )}
      </div>
    </div>
  ) : null

  // Compose header content (previously assembled by Card internally)
  const titleRotation = useMemo(() => (damaged ? getTiltRotation() : 0), [damaged])

  const headerContent = (
    <>
      <div className={cn('flex min-w-0 items-center', compact ? 'gap-0.5' : 'gap-1')}>
        <EntityLeftContent
          techLevel={techLevel}
          compact={compact}
          listing={listing}
          level={'level' in data ? data.level : undefined}
        />
        <div
          className={cn(
            'flex min-w-0 flex-col justify-center overflow-visible',
            compact ? 'gap-0.5' : 'gap-1'
          )}
        >
          {title && (
            <div
              className={cn(compact ? '' : 'overflow-hidden text-ellipsis whitespace-nowrap')}
              style={titleRotation !== 0 ? { transform: `rotate(${titleRotation}deg)` } : undefined}
            >
              <Text
                variant="pseudoheader"
                as="span"
                className={cn(
                  'relative z-10 uppercase tracking-[-0.02em] transition-transform duration-300',
                  compact ? 'py-[3px] text-base' : 'text-[1.75rem]',
                  disabled && 'opacity-50'
                )}
                style={compact ? { lineHeight: 1 } : undefined}
              >
                {title}
              </Text>
            </div>
          )}
          <EntitySubTitleElement
            data={data}
            schemaName={schemaName}
            spacing={spacing}
            compact={compact}
            damaged={damaged}
            hasPatternOverride={!!patternOverride}
            isLegalStartingMech={isLegalStartingMech}
          />
        </div>
      </div>
      {!hideStats ? (
        <EntityRightHeaderContent
          data={data}
          compact={compact}
          fontSize={fontSize}
          techLevel={techLevel}
          listing={listing}
          primaryStatsOnly={
            compact &&
            (listing || !!patternOverride) &&
            (schemaName === 'chassis' || schemaName === 'equipment')
          }
          controls={controls}
        />
      ) : controls && controls.length > 0 ? (
        <EntityRightHeaderContent
          data={data}
          compact={compact}
          fontSize={fontSize}
          techLevel={techLevel}
          listing={listing}
          controls={controls}
        />
      ) : null}
    </>
  )

  const card = (
    <DisplayCard
      headerBg={headerBg}
      headerBgColor={headerBgColor}
      headerOpacity={opacity.header}
      headerContent={headerContent}
      footerContent={!hasBodyContent ? footer : undefined}
      label={label}
      mode={listing ? 'listing' : compact ? 'compact' : 'full'}
      headerTestId="frame-header-container"
      source={source}
      isExpanded={!listing}
      bodyPadding="p-0"
      disabled={disabled}
    >
      {!listing && hasBodyContent && (
        <div
          className="min-w-0 bg-su-white p-0"
          style={{ opacity: opacity.content, width: '100%' }}
        >
          {/* Float zone: block flow so image float propagates to all children */}
          <div
            className={cn(spacing.sectionSpaceYClass)}
            style={{
              paddingLeft: `${spacing.contentPaddingX}rem`,
              paddingRight: `${spacing.contentPaddingX}rem`,
              paddingTop:
                source === 'We Were Here First!' || source === 'Rainmaker'
                  ? `calc(${spacing.contentPadding}rem + 10px)`
                  : source !== 'Salvage Union Workshop Manual' && hasTopMatterContent
                    ? `calc(${spacing.contentPadding * 0.25}rem + 5px)`
                    : `${spacing.contentPadding}rem`,
              paddingBottom:
                source === 'We Were Here First!' || source === 'Rainmaker'
                  ? `calc(${spacing.contentPadding}rem + 10px)`
                  : `${spacing.contentPadding}rem`,
            }}
          >
            {assetUrl && hasChassisAbilities && !compact && !hideActions ? (
              // Grid layout for chassis with images: ability anchored to bottom of image
              <div className="md:grid md:grid-cols-[auto_1fr]">
                <EntityImage title={title} compact={compact} assetUrl={assetUrl} />
                <div className="flex flex-col justify-evenly">
                  <div>
                    {showContent && (
                      <BlockContentRendererView
                        content={contentBlocks!}
                        fontSize={fontSize.sm}
                        compact={compact}
                        damaged={damaged}
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
                {assetUrl && <EntityImage title={title} compact={compact} assetUrl={assetUrl} />}
                {showContent && (
                  <BlockContentRendererView
                    content={contentBlocks!}
                    fontSize={fontSize.sm}
                    compact={compact}
                    damaged={damaged}
                    headerBg={headerBg}
                    headerBgColor={headerBgColor}
                  />
                )}
                {children}
                {/* Faction strategic data */}
                {factionData.map(({ label: sectionLabel, value }) =>
                  value ? (
                    <div key={sectionLabel} className="mt-2">
                      <h5
                        className={cn(
                          'font-mono inline self-start box-decoration-clone bg-su-black text-su-white px-1 font-bold uppercase leading-none tracking-tight mb-1',
                          fontSize.sm
                        )}
                        style={{ lineHeight: 1 }}
                      >
                        {sectionLabel}
                      </h5>
                      <div
                        className={compact ? 'pl-2' : 'pl-3'}
                        style={
                          borderColorFromHeaderBg(headerBg, headerBgColor)
                            ? {
                                borderLeft: `3px solid ${borderColorFromHeaderBg(headerBg, headerBgColor)}`,
                              }
                            : undefined
                        }
                      >
                        <div
                          className={cn(
                            'mb-2 break-words font-medium leading-relaxed whitespace-normal text-su-black',
                            fontSize.sm
                          )}
                          style={{ overflowWrap: 'break-word' }}
                        >
                          {value}
                        </div>
                      </div>
                    </div>
                  ) : null
                )}
                {/* Guide steps */}
                {schemaName === 'guides' &&
                  'steps' in data &&
                  Array.isArray(data.steps) &&
                  data.steps.length > 0 && (
                    <GuideStepsDisplay
                      steps={data.steps}
                      compact={compact}
                      headerBg={headerBg}
                      headerBgColor={headerBgColor}
                      fontSize={fontSize}
                      spacing={spacing}
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
                {/* Non-compact: chassis abilities + pattern data render before actions */}
                {!compact && !hideActions && chassisAbilitiesBlock}
              </>
            )}
            {(!hideActions || (compact && schemaName !== 'bio-titans')) && (
              <EntityActions
                schemaName={schemaName}
                spacing={spacing}
                compact={compact}
                actionsToDisplay={actionsToDisplay}
                headerBg={headerBg}
              />
            )}
            {/* Compact: pattern data + chassis abilities render after actions */}
            {compact && chassisAbilitiesBlock}

            <EntityBonusPerTechLevel
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
                damaged={damaged}
                fontSize={fontSize}
                headerBg={headerBg}
              />
            ))}

            <EntityRequirementDisplay data={data} compact={compact} />
            {table && (
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
            <EntityFormation data={data} headerFontSize={fontSize.lg} compact={compact} />
            <EntityNpcDisplay data={data} compact={compact} fontSize={fontSize} spacing={spacing} />
            {shouldShowExtraContent && patternOverride && (
              <EntityChassisPattern
                pattern={{
                  name: patternOverride.name,
                  systems: patternOverride.systems,
                  modules: patternOverride.modules,
                }}
              />
            )}
            {shouldShowExtraContent && !patternOverride && (
              <>
                {!hidePatterns && (
                  <EntityChassisPatterns
                    patterns={'patterns' in data ? data.patterns : undefined}
                    headerFontSize={fontSize.lg}
                    chassisEntity={data}
                  />
                )}
                {'damagedEffect' in data && data.damagedEffect && (
                  <ConditionalSheetInfo
                    propertyName="damagedEffect"
                    labelBgColor="text-brand-srd"
                    label="Damaged Effect"
                    data={data}
                    compact={compact}
                    damaged={damaged}
                    fontSize={fontSize}
                    headerBg={headerBg}
                  />
                )}
                {schemaName === 'classes' &&
                  classAbilitiesRenderer?.({
                    compact,
                    selectedClass,
                    selectedAdvancedClass,
                  })}
                <EntityGrants data={data} spacing={spacing} />
              </>
            )}
            <EntityChoices
              data={data}
              spacing={spacing}
              fontSize={fontSize}
              hideChoices={hideChoices}
              onChoiceSelection={undefined}
            />
            <div className="clear-both" />
          </div>
          {interactive?.renderFooter ? (
            <div
              className={cn('w-full py-3', headerBg || 'bg-su-white', sourceFooterStyles.className)}
              style={{
                paddingLeft: `${spacing.contentPaddingX}rem`,
                paddingRight: `${spacing.contentPaddingX}rem`,
                ...(headerBgColor ? { backgroundColor: headerBgColor } : {}),
                ...sourceFooterStyles.style,
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

/**
 * Wrapper for guide step entity listings that provides a detail modal.
 * Needed because the renderEntityListing callback can't call hooks directly.
 */
function GuideEntityListing({
  data,
  schemaName,
  compact,
  listing,
  disabled,
  controls,
}: {
  data: SURefEntity
  schemaName: SURefEnumSchemaName
  compact: boolean
  listing: boolean
  disabled: boolean
  controls?: EntityControl[]
}) {
  const detailModal = useDetailModal(data, { modalControls: controls })
  const allControls = listing ? [...(controls ?? []), detailModal.control] : controls

  return (
    <>
      <EntityDisplayContent
        data={data}
        schemaName={schemaName}
        compact={compact}
        listing={listing}
        dimHeader={false}
        disabled={disabled}
        hideActions={listing}
        hidePatterns
        hideChoices
        controls={allControls}
      />
      {listing && detailModal.modal}
    </>
  )
}
