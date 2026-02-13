import { useCallback, useMemo, useState } from 'react'
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
import { ConditionalSheetInfo } from '../ConditionalSheetInfo'
import { EntityPopulationRange } from '../EntityPopulationRange'
import { EntityActions } from '../EntityActions'
import { EntityImage } from '../EntityImage'
import { BlockContentRendererView } from '../../BlockContentRendererView'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import type { EntityButtonConfig } from '../entityDisplayTypes'
import { cn } from '../../../../utils/cn'
import { Text } from '../../../base/Text'
import { getSourceStyles } from '../../entityDisplayHelpers'
import { useEntityDisplayState } from '../useEntityDisplayState'
import type { EntityDisplayStateInput } from '../useEntityDisplayState'
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
    spacing,
    contentBg,
    opacity,
    shouldShowExtraContent,
    handleHeaderClick,
    isExpanded,
    collapsible,
    hideActions,
    hidePatterns,
    hideChoices,
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
    techLevel,
    hideLevel,
    rightContent,
    imageComponent,
    hasActions: hasActionsValue,
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

  // Footer data
  const hasPage = 'page' in data && !!data.page
  const hasSource = 'source' in data && !!data.source
  const footerDisplayName = getDisplayName(schemaName)
  const sourceFooterStyles = getSourceStyles(source, disabled ?? false, 'footer', isExpanded)

  const [modalOpen, setModalOpen] = useState(false)
  const handleDetailClick = () => setModalOpen(true)

  const card = (
    <Card
      bg="bg-su-blue-light"
      label={label}
      headerBg={headerBg}
      headerOpacity={opacity.header}
      leftContent={
        <EntityLeftContent
          techLevel={techLevel}
          compact={compact}
          data={data}
          hideLevel={hideLevel}
        />
      }
      subTitleContent={
        <EntitySubTitleElement
          data={data}
          schemaName={schemaName}
          spacing={spacing}
          compact={compact}
          damaged={damaged}
        />
      }
      rightContent={
        <EntityRightHeaderContent
          data={data}
          compact={compact}
          fontSize={fontSize}
          rightContent={rightContent}
          collapsible={collapsible}
          onDetailClick={collapsible ? handleDetailClick : undefined}
        />
      }
      compact={compact}
      title={title}
      titleRotation={useMemo(() => (damaged ? getTiltRotation() : 0), [damaged])}
      bodyPadding="p-0"
      onHeaderClick={collapsible ? handleDetailClick : handleHeaderClick}
      headerTestId="frame-header-container"
      source={source}
      isExpanded={isExpanded}
    >
      {!collapsible && (
        <div
          className={cn('min-w-0 p-0', contentBg)}
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
            {assetUrl && (
              <EntityImage
                title={title}
                compact={compact}
                assetUrl={assetUrl}
                imageComponent={imageComponent}
                customWidth={imageWidth}
              />
            )}
            {showContent && (
              <BlockContentRendererView
                content={contentBlocks!}
                fontSize={fontSize.sm}
                compact={compact}
                damaged={damaged}
                headerBg={headerBg}
              />
            )}
            {children}

            {/* Non-compact: chassis abilities render before actions */}
            {!compact && hasChassisAbilities && !hideActions && (
              <EntityChassisAbilitiesContent
                data={data}
                spacing={spacing}
                compact={compact}
                chassisAbilities={chassisAbilities}
              />
            )}
            {(!hideActions || (compact && schemaName !== 'bio-titans')) && (
              <EntityActions
                schemaName={schemaName}
                spacing={spacing}
                compact={compact}
                hasActions={hasActionsValue}
                actionsToDisplay={actionsToDisplay}
                headerBg={headerBg}
              />
            )}
            {/* Compact: chassis abilities render after actions */}
            {compact && hasChassisAbilities && (
              <EntityChassisAbilitiesContent
                data={data}
                spacing={spacing}
                compact={compact}
                chassisAbilities={chassisAbilities}
              />
            )}

            <EntityPopulationRange data={data} schemaName={schemaName} spacing={spacing} />
            <EntityBonusPerTechLevel
              data={data}
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
                  tableName={'name' in data ? String(data.name) : undefined}
                />
              </div>
            )}
            {shouldShowExtraContent && (
              <>
                {!hidePatterns && <EntityChassisPatterns data={data} fontSize={fontSize} />}
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
            {buttonConfig && (
              <div className="clear-both flex">
                <ButtonWithConfig buttonConfig={buttonConfig} />
              </div>
            )}
            <EntityChoices
              data={data}
              spacing={spacing}
              fontSize={fontSize}
              hideChoices={hideChoices}
              userChoices={userChoices}
              onChoiceSelection={undefined}
            />
            <div className="clear-both" />
          </div>
          {/* Footer — always full-width, outside float zone */}
          {(hasPage || hasSource) && (
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

  if (collapsible) {
    return (
      <>
        {card}
        <DialogPrimitive.Root open={modalOpen} onOpenChange={setModalOpen}>
          <DialogPrimitive.Portal>
            <DialogPrimitive.Overlay className="fixed inset-0 z-50 overflow-y-auto bg-black/60 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0">
              <div className="flex min-h-full items-center justify-center px-4 py-8">
                <DialogPrimitive.Close className="fixed top-4 right-4 z-[60] rounded-full bg-su-black/70 p-2 text-su-white opacity-70 transition-opacity hover:opacity-100">
                  <X className="h-6 w-6" />
                  <span className="sr-only">Close</span>
                </DialogPrimitive.Close>
                <DialogPrimitive.Content className="relative w-full max-w-6xl bg-transparent outline-none">
                  <DialogPrimitive.Title className="sr-only">{title}</DialogPrimitive.Title>
                  <DialogPrimitive.Description className="sr-only">
                    Entity display details
                  </DialogPrimitive.Description>
                  <EntityDisplayContent
                    data={data}
                    schemaName={schemaName}
                    compact={false}
                    collapsible={false}
                    dimHeader={false}
                    disabled={false}
                    hideActions={false}
                    hidePatterns={false}
                    hideChoices={false}
                    hideLevel={false}
                  />
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
