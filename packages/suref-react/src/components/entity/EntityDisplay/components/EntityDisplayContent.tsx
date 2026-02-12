import { useCallback, useMemo } from 'react'
import type { ReactNode } from 'react'
import { getTiltRotation } from '../../../../utils/tiltUtils'
import type { SURefClass } from 'salvageunion-reference'
import { getDisplayName } from 'salvageunion-reference'
import { RollTable } from '../../../shared/RollTable'
import { Card } from '../../../shared/Card'
import { EntitySubTitleElement } from '../EntitySubTitleContent'
import { EntityLeftContent } from '../EntityLeftContent'
import { EntityRightHeaderContent } from '../EntityRightHeaderContent'
import { EntityChassisPatterns } from '../EntityChassisPatterns'
import { EntityChassisAbilitiesContent } from '../EntityChassisAbilitiesContent'
import { EntityRequirementDisplay } from '../EntityRequirementDisplay'
import { EntityChoices } from '../EntityChoices'
import { EntityGrants } from '../EntityGrants'
import { EntityBonusPerTechLevel } from '../EntityBonusPerTechLevel'
import { useEntityDisplayContext } from '../useEntityDisplayContext'
import { ConditionalSheetInfo } from '../ConditionalSheetInfo'
import { EntityPopulationRange } from '../EntityPopulationRange'
import { EntityActions } from '../EntityActions'
import { EntityImage } from '../EntityImage'
import { ContentBlockRenderer } from '../ContentBlockRenderer'
import type { EntityButtonConfig } from '../entityDisplayContext'
import { cn } from '../../../../utils/cn'
import { Text } from '../../../base/Text'
import { getSourceStyles } from '../../entityDisplayHelpers'

function ButtonWithConfig({
  buttonConfig,
}: {
  buttonConfig: EntityButtonConfig & { children: ReactNode }
}) {
  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLButtonElement>) => {
      e.stopPropagation()
      buttonConfig.onClick?.(e)
    },
    [buttonConfig]
  )

  return (
    <button
      className={cn('mt-3 w-full cursor-pointer rounded-md px-4 py-2', buttonConfig.className)}
      onClick={handleClick}
    >
      {buttonConfig.children}
    </button>
  )
}

export function EntityDisplayContent({ children }: { children?: React.ReactNode }) {
  const {
    data,
    schemaName,
    compact,
    title,
    headerBg,
    spacing,
    contentBg,
    opacity,
    shouldShowExtraContent,
    handleHeaderClick,
    isExpanded,
    collapsible,
    hideActions,
    hidePatterns,
    showFooter,
    damaged,
    disabled,
    buttonConfig,
    userChoices,
    fontSize,
    imageWidth,
    assetUrl,
    chassisAbilities,
    effects,
    table,
    actionsToDisplay,
    matchingAction,
    source,
    label,
    classAbilitiesRenderer,
  } = useEntityDisplayContext()

  // Determine which content to render (from EntityTopMatter)
  let contentBlocks = 'content' in data ? data.content : undefined

  // Check if any action name matches the entity name - if so, use that action's content
  if (matchingAction && matchingAction.content && matchingAction.content.length > 0) {
    contentBlocks = matchingAction.content
  }

  // Show content if entity has content blocks
  const showContent = contentBlocks && contentBlocks.length > 0

  // Consolidate chassis abilities logic
  const hasChassisAbilities =
    schemaName === 'chassis' && !!chassisAbilities && chassisAbilities.length > 0
  const hasChassisAbilitiesInTopMatter = hasChassisAbilities && !hideActions && !compact

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

  // Footer data
  const hasPage = 'page' in data && !!data.page
  const hasSource = 'source' in data && !!data.source
  const footerDisplayName = getDisplayName(schemaName)
  const sourceFooterStyles = getSourceStyles(source, disabled ?? false, 'footer', isExpanded)

  return (
    <Card
      bg="bg-su-blue-light"
      label={label}
      headerBg={headerBg}
      headerOpacity={opacity.header}
      leftContent={<EntityLeftContent />}
      subTitleContent={<EntitySubTitleElement />}
      rightContent={<EntityRightHeaderContent isExpanded={isExpanded} collapsible={collapsible} />}
      compact={compact}
      title={title}
      titleRotation={useMemo(() => (damaged ? getTiltRotation() : 0), [damaged])}
      bodyPadding="p-0"
      onHeaderClick={handleHeaderClick}
      headerTestId="frame-header-container"
      source={source}
      isExpanded={isExpanded}
    >
      {(!collapsible || isExpanded) && (
        <div
          className={cn('min-w-0 p-0', contentBg)}
          style={{ opacity: opacity.content, width: '100%' }}
        >
          {/* Float zone: block flow so image float propagates to all children */}
          <div
            className={cn(spacing.smallGap <= 1.5 ? 'space-y-1.5' : 'space-y-2')}
            style={{
              paddingLeft: `${spacing.contentPaddingX}rem`,
              paddingRight: `${spacing.contentPaddingX}rem`,
              paddingTop:
                source !== 'Salvage Union Workshop Manual' && hasTopMatterContent
                  ? `calc(${spacing.contentPadding * 0.25}rem + 5px)`
                  : `${spacing.contentPadding}rem`,
              paddingBottom: `${spacing.contentPadding}rem`,
            }}
          >
            {assetUrl && <EntityImage customWidth={imageWidth} />}
            {showContent && (
              <ContentBlockRenderer
                content={contentBlocks!}
                fontSize={fontSize.sm}
                compact={compact}
                damaged={damaged}
                headerBg={headerBg}
              />
            )}
            {children}

            {hasChassisAbilitiesInTopMatter && <EntityChassisAbilitiesContent />}
            {(!hideActions || (compact && schemaName !== 'bio-titans')) && <EntityActions />}

            {compact && hasChassisAbilities && <EntityChassisAbilitiesContent />}

            <EntityPopulationRange />
            <EntityBonusPerTechLevel />
            {effects?.map((effect, index) => (
              <ConditionalSheetInfo
                key={index}
                propertyName="effects"
                label={effect.label}
                value={effect.value}
              />
            ))}

            <EntityRequirementDisplay />
            {table && (
              <div className="relative z-10 rounded-md">
                <RollTable
                  disabled={disabled}
                  table={table}
                  showCommand
                  compact
                  tableName={'name' in data ? String(data.name) : undefined}
                />
              </div>
            )}
            {shouldShowExtraContent && (
              <>
                {!hidePatterns && <EntityChassisPatterns />}
                {'damagedEffect' in data && data.damagedEffect && (
                  <ConditionalSheetInfo
                    propertyName="damagedEffect"
                    labelBgColor="text-brand-srd"
                    label="Damaged Effect"
                  />
                )}
                {schemaName === 'classes' &&
                  classAbilitiesRenderer?.({
                    compact,
                    selectedClass,
                    selectedAdvancedClass,
                  })}
                <EntityGrants />
              </>
            )}
            {buttonConfig && (
              <div className="clear-both flex">
                <ButtonWithConfig buttonConfig={buttonConfig} />
              </div>
            )}
            <EntityChoices userChoices={userChoices} onChoiceSelection={undefined} />
            <div className="clear-both" />
          </div>
          {/* Footer — always full-width, outside float zone */}
          {(showFooter ?? (compact || !hideActions)) && (hasPage || hasSource) && (
            <div
              className={cn(
                'flex w-full items-center justify-between gap-4 py-3 text-su-black',
                headerBg || 'bg-su-white',
                sourceFooterStyles.className
              )}
              style={{
                paddingLeft: `${spacing.contentPaddingX}rem`,
                paddingRight: `${spacing.contentPaddingX}rem`,
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
                    className={cn(
                      'whitespace-nowrap text-xs font-semibold uppercase',
                      hasPage && 'mr-4'
                    )}
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
          )}
        </div>
      )}
    </Card>
  )
}
