import { useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { getTiltRotation } from '../../../../utils/tiltUtils'
import type { SURefClass } from 'salvageunion-reference'
import {
  getDisplayName,
  getGoals,
  getAssets,
  getWeaknesses,
  getPatterns,
  normalizePatternName,
} from 'salvageunion-reference'
import { RollTable } from '../../../shared/RollTable'
import { Card } from '../../../shared/Card'
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
import * as DialogPrimitive from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import { cn } from '../../../../utils/cn'
import { Text } from '../../../base/Text'
import { borderColorFromHeaderBg, getSourceStyles } from '../../entityDisplayHelpers'
import { useEntityDisplayState } from '../useEntityDisplayState'
import type { EntityDisplayStateInput } from '../useEntityDisplayState'

export type EntityDisplayContentProps = EntityDisplayStateInput & {
  children?: ReactNode
}

export function EntityDisplayContent({ children, ...inputProps }: EntityDisplayContentProps) {
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
  } = state

  // Determine which content to render (from EntityTopMatter)
  let contentBlocks = 'content' in data ? data.content : undefined

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
    return patterns.find((p) => normalizePatternName(p.name) === patternOverride.name)
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

  const [modalOpen, setModalOpen] = useState(false)
  const handleDetailClick = () => setModalOpen(true)

  const card = (
    <Card
      bg="bg-su-blue-light"
      label={label}
      headerBg={headerBg}
      headerBgColor={headerBgColor}
      headerOpacity={opacity.header}
      leftContent={
        <EntityLeftContent
          techLevel={techLevel}
          compact={compact}
          listing={listing}
          level={'level' in data ? data.level : undefined}
        />
      }
      subTitleContent={
        <EntitySubTitleElement
          data={data}
          schemaName={schemaName}
          spacing={spacing}
          compact={compact}
          damaged={damaged}
          hasPatternOverride={!!patternOverride}
        />
      }
      rightContent={
        hideStats ? undefined : (
          <EntityRightHeaderContent
            data={data}
            compact={compact}
            fontSize={fontSize}
            techLevel={techLevel}
            listing={listing}
            primaryStatsOnly={compact && listing && schemaName === 'chassis'}
            onDetailClick={listing ? handleDetailClick : undefined}
          />
        )
      }
      compact={compact}
      title={title}
      titleRotation={useMemo(() => (damaged ? getTiltRotation() : 0), [damaged])}
      bodyPadding="p-0"
      onHeaderClick={listing ? handleDetailClick : undefined}
      headerTestId="frame-header-container"
      source={source}
      isExpanded={!listing}
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
                      renderEntityListing={(
                        entityData,
                        entitySchemaName,
                        key,
                        isListing,
                        forceCompact
                      ) => (
                        <EntityDisplayContent
                          key={key}
                          data={entityData as typeof data}
                          schemaName={entitySchemaName as typeof schemaName}
                          compact={forceCompact ?? isListing}
                          listing={isListing}
                          dimHeader={false}
                          disabled={false}
                          hideActions={isListing}
                          hidePatterns
                          hideChoices
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
          {footer}
        </div>
      )}
      {/* Footer without body content — rendered directly in Card */}
      {!listing && !hasBodyContent && footer}
    </Card>
  )

  if (listing) {
    return (
      <>
        {card}
        <DialogPrimitive.Root open={modalOpen} onOpenChange={setModalOpen}>
          <DialogPrimitive.Portal>
            <DialogPrimitive.Overlay className="fixed inset-0 z-50 overflow-y-auto bg-black/60 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0">
              <div className="flex min-h-full items-center justify-center px-4 py-8">
                <DialogPrimitive.Content className="relative w-full max-w-6xl bg-transparent outline-none">
                  <DialogPrimitive.Close className="fixed top-4 right-4 z-[60] rounded-full bg-su-black/70 p-2 text-su-white opacity-70 transition-opacity hover:opacity-100">
                    <X className="h-6 w-6" aria-hidden="true" />
                    <span className="sr-only">Close</span>
                  </DialogPrimitive.Close>
                  <DialogPrimitive.Title className="sr-only">{title}</DialogPrimitive.Title>
                  <DialogPrimitive.Description className="sr-only">
                    Entity display details
                  </DialogPrimitive.Description>
                  <EntityDisplayContent
                    data={data}
                    schemaName={schemaName}
                    compact={false}
                    listing={false}
                    dimHeader={false}
                    disabled={false}
                    hideActions={false}
                    hidePatterns={!!patternOverride}
                    hideChoices={false}
                    patternOverride={patternOverride}
                  >
                    {children}
                  </EntityDisplayContent>
                </DialogPrimitive.Content>
              </div>
            </DialogPrimitive.Overlay>
          </DialogPrimitive.Portal>
        </DialogPrimitive.Root>
      </>
    )
  }

  return card
}
