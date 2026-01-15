import { VStack, Box, Button } from '@chakra-ui/react'
import { Text } from '../../base/Text'
import type {
  SURefObjectChoice,
  SURefObjectSystemModule,
  SURefMetaEntity,
  SURefEntity,
} from 'salvageunion-reference'
import { getModel, extractActions, isSystemModule } from 'salvageunion-reference'
import { EntityDisplay } from './index'
import { NestedActionDisplay } from '../NestedActionDisplay'
import { useEntityDisplayContext } from './useEntityDisplayContext'
import { resolveEntityName } from '../entityDisplayHelpers'
import { createChoiceButtonConfig } from './buttonConfigHelpers'

export interface EntityListDisplayProps {
  choice: SURefObjectChoice
  selectedChoice?: string
  userChoices?: Record<string, string> | null
  onChoiceSelection?: (choiceId: string, value: string | undefined) => void
  isMultiSelect?: boolean
}

/**
 * Unified component for rendering lists of entities from either schemaEntities or customSystemOptions.
 * Filters to show only the selected entity if selectedChoice is provided.
 * Renders in a vertical stack with collapsible entities.
 */
export function EntityListDisplay({
  choice,
  selectedChoice,
  userChoices,
  onChoiceSelection,
  isMultiSelect = false,
}: EntityListDisplayProps) {
  const { spacing } = useEntityDisplayContext()

  // Handle choiceOptions (structured options like Custom Sniper Rifle modifications)
  const choiceOptions =
    'choiceOptions' in choice && choice.choiceOptions ? choice.choiceOptions : []
  const hasChoiceOptions = choiceOptions.length > 0

  const entities = choice.schemaEntities
    ? choice.schemaEntities
        .map((entityName) => {
          const schema = choice.schema?.[0]
          if (!schema) return null

          const model = getModel(schema.toLowerCase())
          if (!model) return null

          return model.find((e) => e.name === entityName) ?? null
        })
        .filter((e): e is NonNullable<typeof e> => e !== null && e !== undefined)
    : choice.customSystemOptions || []

  // If we have choiceOptions, render them separately
  if (hasChoiceOptions) {
    const visibleOptions =
      selectedChoice && !isMultiSelect
        ? choiceOptions.filter((option) => option.value === selectedChoice)
        : choiceOptions

    if (visibleOptions.length === 0) return null

    return (
      <VStack gap={spacing.contentPadding + 1} alignItems="start">
        {visibleOptions.map((option, idx) => {
          const isSelected = isMultiSelect
            ? userChoices?.[choice.id] === option.value
            : userChoices?.[choice.id] === option.value

          const buttonConfig = onChoiceSelection
            ? createChoiceButtonConfig({
                isSelected,
                isMultiSelect,
                choiceId: choice.id,
                entityValue: option.value,
                onChoiceSelection,
              })
            : undefined

          return (
            <Box key={idx} p={spacing.contentPadding} bg="su.white" borderRadius="md" w="full">
              <Text fontSize="md" fontWeight="bold" mb={option.description ? 2 : 0}>
                {option.label}
              </Text>
              {option.description && (
                <Text fontSize="sm" color="su.black" opacity={0.8} mb={2}>
                  {option.description}
                </Text>
              )}
              {buttonConfig && <Button {...buttonConfig} w="full" mt={2} />}
            </Box>
          )
        })}
      </VStack>
    )
  }

  // Otherwise, render entities as before
  const allEntities = entities

  const visibleEntities =
    selectedChoice && !isMultiSelect
      ? allEntities.filter((entity) => {
          const entityName = resolveEntityName(entity as SURefMetaEntity | SURefObjectSystemModule)
          return entityName === selectedChoice
        })
      : allEntities

  if (visibleEntities.length === 0) return null

  return (
    <VStack gap={spacing.contentPadding + 1} alignItems="start">
      {visibleEntities.map((entity, idx) => {
        const entityName = resolveEntityName(entity as SURefMetaEntity | SURefObjectSystemModule)

        // For multi-select, check if this specific value is selected
        // For single-select, check if any value is selected for this choice
        const isSelected = isMultiSelect
          ? entityName !== undefined && userChoices?.[choice.id] === entityName
          : userChoices?.[choice.id] !== undefined

        const buttonConfig =
          onChoiceSelection && entityName
            ? createChoiceButtonConfig({
                isSelected,
                isMultiSelect,
                choiceId: choice.id,
                entityValue: entityName,
                onChoiceSelection,
              })
            : undefined

        const entityIsSystemModule = isSystemModule(entity as SURefMetaEntity)

        if (entityIsSystemModule) {
          const systemModule = entity as SURefObjectSystemModule
          const resolvedActions = extractActions(systemModule as SURefMetaEntity)
          const visibleActions = resolvedActions?.filter((a) => !a.hidden)
          const firstAction = visibleActions?.[0]
          if (firstAction) {
            return <NestedActionDisplay key={idx} data={firstAction} compact />
          }
          return null
        }

        // EntityDisplay only accepts SURefEntity, so we need to check if entity is a valid entity
        // System modules without id are handled separately above
        if (!('id' in entity)) {
          return null
        }
        return (
          <EntityDisplay
            key={idx}
            hideActions
            data={entity as SURefEntity}
            compact
            collapsible
            defaultExpanded={false}
            buttonConfig={buttonConfig}
          />
        )
      })}
    </VStack>
  )
}
