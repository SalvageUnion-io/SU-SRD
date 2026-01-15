import { Box, VStack, Button, Flex } from '@chakra-ui/react'
import { useCallback, useMemo } from 'react'
import { getTiltRotation } from '../../../../utils/tiltUtils'
import type { SURefClass } from 'salvageunion-reference'
import { EntityDisplayFooter } from '../../../shared/EntityDisplayFooter'
import { RollTable } from '../../../shared/RollTable'
import { Card } from '../../../shared/Card'
import { EntitySubTitleElement } from '../EntitySubTitleContent'
import { EntityLeftContent } from '../EntityLeftContent'
import { EntityRightHeaderContent } from '../EntityRightHeaderContent'
import { EntityChassisPatterns } from '../EntityChassisPatterns'
import { EntityOptions } from '../EntityOptions'
import { EntityChassisAbilitiesContent } from '../EntityChassisAbilitiesContent'
import { EntityRequirementDisplay } from '../EntityRequirementDisplay'
import { EntityChoices } from '../EntityChoices'
import { EntityGrants } from '../EntityGrants'
import { ClassAbilitiesList } from '../../../PilotLiveSheet/ClassAbilitiesList'
import { EntityBonusPerTechLevel } from '../EntityBonusPerTechLevel'
import { useEntityDisplayContext } from '../useEntityDisplayContext'
import { ConditionalSheetInfo } from '../ConditionalSheetInfo'
import { EntityPopulationRange } from '../EntityPopulationRange'
import { EntityActions } from '../EntityActions'
import { EntityImage } from '../EntityImage'
import { ContentBlockRenderer } from '../ContentBlockRenderer'
import type { ButtonProps } from '@chakra-ui/react'
import type { ReactNode } from 'react'

function ButtonWithConfig({
  buttonConfig,
}: {
  buttonConfig: ButtonProps & { children: ReactNode }
}) {
  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLButtonElement>) => {
      e.stopPropagation()
      buttonConfig.onClick?.(e)
    },
    [buttonConfig]
  )

  return (
    <Button w="full" mt={3} onClick={handleClick} {...buttonConfig}>
      {buttonConfig.children}
    </Button>
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
    !!actionsToDisplay && actionsToDisplay.length > 0 && (!hideActions || compact)

  // Check if we should render top matter content:
  // 1. Entity has content blocks, OR
  // 2. Entity has chassis abilities, OR
  // 3. Entity has an image URL (so images can render even without content), OR
  // 4. Entity has actions that will be displayed (so actions can render even without content)
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

  return (
    <Card
      bg="su.lightBlue"
      w="full"
      headerBg={headerBg}
      headerOpacity={opacity.header}
      leftContent={<EntityLeftContent />}
      subTitleContent={<EntitySubTitleElement />}
      rightContent={<EntityRightHeaderContent isExpanded={isExpanded} collapsible={collapsible} />}
      compact={compact}
      title={title}
      titleRotation={useMemo(() => (damaged ? getTiltRotation() : 0), [damaged])}
      bodyPadding="0"
      onHeaderClick={handleHeaderClick}
      headerTestId="frame-header-container"
      source={source}
      isExpanded={isExpanded}
    >
      {(!collapsible || isExpanded) && (
        <VStack
          flex="1"
          bg={contentBg}
          opacity={opacity.content}
          p={0}
          gap={spacing.smallGap}
          alignItems="stretch"
          minW="0"
          w="full"
        >
          {hasTopMatterContent && (
            <>
              <Box
                p={spacing.contentPadding}
                pt={
                  source !== 'Salvage Union Workshop Manual' && hasTopMatterContent
                    ? `calc(${spacing.contentPadding * 0.25}rem + 5px)`
                    : undefined
                }
              >
                {assetUrl && <EntityImage customWidth={imageWidth} />}
                {showContent && (
                  <ContentBlockRenderer
                    content={contentBlocks!}
                    fontSize={fontSize.sm}
                    compact={compact}
                    damaged={damaged}
                  />
                )}
                {children}
              </Box>
              {hasChassisAbilitiesInTopMatter && <EntityChassisAbilitiesContent />}
              {(!hideActions || compact) && <EntityActions />}
            </>
          )}

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
          {/* Always show table in compact mode, regardless of schema */}
          {table && (
            <Box p={spacing.contentPadding} borderRadius="md" position="relative" zIndex={10}>
              <RollTable
                disabled={disabled}
                table={table}
                showCommand
                compact
                tableName={'name' in data ? String(data.name) : undefined}
              />
            </Box>
          )}
          {shouldShowExtraContent && (
            <>
              {!hidePatterns && <EntityChassisPatterns />}
              <EntityOptions />
              {'damagedEffect' in data && data.damagedEffect && (
                <ConditionalSheetInfo
                  propertyName="damagedEffect"
                  labelBgColor="brand.srd"
                  label="Damaged Effect"
                />
              )}
              {schemaName === 'classes' && (
                <ClassAbilitiesList
                  compact={compact}
                  selectedClass={selectedClass}
                  selectedAdvancedClass={selectedAdvancedClass}
                />
              )}
              <EntityGrants />
            </>
          )}
          {buttonConfig && (
            <Flex p={spacing.contentPadding}>
              <ButtonWithConfig buttonConfig={buttonConfig} />
            </Flex>
          )}
          <EntityChoices userChoices={userChoices} onChoiceSelection={undefined} />
          {(showFooter ?? !hideActions) && <EntityDisplayFooter bg={headerBg} />}
        </VStack>
      )}
    </Card>
  )
}
