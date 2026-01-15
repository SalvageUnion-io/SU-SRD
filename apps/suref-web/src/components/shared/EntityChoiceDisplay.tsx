import { Button, VStack, Box } from '@chakra-ui/react'
import { useState, useMemo, useCallback } from 'react'
import { SalvageUnionReference } from 'salvageunion-reference'
import type { SURefObjectChoice, SURefEnumSchemaName, SURefEntity } from 'salvageunion-reference'
import { EntityDisplay } from '../entity/EntityDisplay'
import { EntitySelectionModal } from '../entity/EntitySelectionModal'
import { usePlayerChoices, getSelectionsForChoice } from '../../hooks/suentity'
import { Text } from '../base/Text'

type EntityModeProps = {
  mode: 'entity'
  entityId: string | undefined
  onUpdateChoice?: (choiceId: string, value: string | undefined) => void
}

type WizardModeProps = {
  mode: 'wizard'
  selectedValue?: string
  onUpdateChoice?: (choiceId: string, value: string | undefined) => void
}

type EntityChoiceDisplayProps = {
  choice: SURefObjectChoice
} & (EntityModeProps | WizardModeProps)

/**
 * Unified component for displaying entity choices that works in both
 * entity mode (with database-backed player choices) and wizard mode
 * (with in-memory wizard state).
 */
export function EntityChoiceDisplay(props: EntityChoiceDisplayProps) {
  const { choice, mode } = props
  const [isModalOpen, setIsModalOpen] = useState(false)
  const isMultiSelect = 'multiSelect' in choice && choice.multiSelect === true
  const hasChoiceOptions = 'choiceOptions' in choice && choice.choiceOptions

  // Get selected values based on mode
  const entityId = mode === 'entity' ? (props as EntityModeProps).entityId : undefined
  const { data: playerChoices } = usePlayerChoices(entityId)

  const selectedValues = useMemo(() => {
    if (mode === 'wizard') {
      // Wizard mode doesn't support multi-select yet, return empty array
      return []
    }
    if (!playerChoices) return []
    return getSelectionsForChoice(playerChoices, choice.id)
  }, [mode, playerChoices, choice.id])

  const wizardSelectedValue =
    mode === 'wizard' ? (props as WizardModeProps).selectedValue : undefined
  const selectedValue = useMemo(() => {
    if (mode === 'wizard') {
      return wizardSelectedValue || null
    }
    if (isMultiSelect) return null // For multi-select, use selectedValues instead
    const playerChoice = playerChoices?.find((pc) => pc.choice_ref_id === choice.id)
    return playerChoice?.value || null
  }, [mode, isMultiSelect, playerChoices, choice.id, wizardSelectedValue])

  const selectedEntity = useMemo(() => {
    if (!selectedValue) return null

    const entity = SalvageUnionReference.getByRef(selectedValue)
    if (!entity) return null

    const parsed = SalvageUnionReference.parseRef(selectedValue)
    if (!parsed) return null

    // EntityDisplay expects SURefEntity, but getByRef can return meta schemas
    // Since choices only reference entity schemas, this is safe
    return { entity: entity as SURefEntity, schemaName: parsed.schemaName.toLowerCase() }
  }, [selectedValue])

  const schemaNames = useMemo(() => {
    const { schema } = choice

    if (!schema) return []

    const pluralToSchemaName: Record<string, SURefEnumSchemaName> = {
      Systems: 'systems',
      Modules: 'modules',
      Abilities: 'abilities',
      Crawlers: 'crawlers',
      CrawlerBays: 'crawler-bays',
      Creatures: 'creatures',
      Drones: 'drones',
      Vehicles: 'vehicles',
      BioTitans: 'bio-titans',
      NPCs: 'npcs',
      Squads: 'squads',
      Keywords: 'keywords',
      Traits: 'traits',
      RollTables: 'roll-tables',
      CrawlerTechLevels: 'crawler-tech-levels',
    }

    return schema
      .map((schema) => {
        if (schema in pluralToSchemaName) {
          return pluralToSchemaName[schema as keyof typeof pluralToSchemaName]
        }

        return schema as SURefEnumSchemaName
      })
      .filter((name): name is SURefEnumSchemaName => name !== undefined)
  }, [choice])

  const handleSelect = useCallback(
    (entityId: string, schemaName: SURefEnumSchemaName) => {
      const value = SalvageUnionReference.composeRef(schemaName, entityId)
      props.onUpdateChoice?.(choice.id, value)
      setIsModalOpen(false)
    },
    [choice.id, props]
  )

  const handleSelectOption = useCallback(
    (value: string) => {
      props.onUpdateChoice?.(choice.id, value)
    },
    [choice.id, props]
  )

  const handleRemove = useCallback(
    (valueToRemove?: string) => {
      if (isMultiSelect && valueToRemove) {
        // For multi-select, remove specific selection
        props.onUpdateChoice?.(choice.id, valueToRemove)
      } else {
        // For single-select, clear the choice
        props.onUpdateChoice?.(choice.id, undefined)
      }
    },
    [choice.id, isMultiSelect, props]
  )

  const entityName =
    selectedEntity?.entity && 'name' in selectedEntity.entity
      ? selectedEntity.entity.name
      : choice.name

  // Handle choiceOptions (like Custom Sniper Rifle modifications)
  if (hasChoiceOptions && choice.choiceOptions) {
    const availableOptions = choice.choiceOptions

    return (
      <VStack gap={2} alignItems="stretch" mt={2}>
        {selectedValues.map((selection) => {
          const option = choice.choiceOptions!.find((opt) => opt.value === selection.value)
          if (!option) return null

          return (
            <Box key={selection.id} p={3} bg="su.lightBlue" borderRadius="md">
              <Text fontSize="md" fontWeight="bold" mb={option.description ? 1 : 0}>
                {option.label}
              </Text>
              {option.description && (
                <Text fontSize="sm" color="su.black" opacity={0.8} mb={2}>
                  {option.description}
                </Text>
              )}
              {props.onUpdateChoice && (
                <Button
                  bg="brand.srd"
                  color="su.white"
                  size="sm"
                  onClick={() => handleRemove(selection.value)}
                  mt={2}
                >
                  Remove
                </Button>
              )}
            </Box>
          )
        })}
        {/* Handle wizard mode single selection for choiceOptions */}
        {mode === 'wizard' &&
          selectedValue &&
          !isMultiSelect &&
          (() => {
            const option = availableOptions.find((opt) => opt.value === selectedValue)
            if (!option) return null
            return (
              <Box p={3} bg="su.lightBlue" borderRadius="md">
                <Text fontSize="md" fontWeight="bold" mb={option.description ? 1 : 0}>
                  {option.label}
                </Text>
                {option.description && (
                  <Text fontSize="sm" color="su.black" opacity={0.8} mb={2}>
                    {option.description}
                  </Text>
                )}
                {props.onUpdateChoice && (
                  <Button
                    bg="brand.srd"
                    color="su.white"
                    size="sm"
                    onClick={() => handleRemove()}
                    mt={2}
                  >
                    Remove
                  </Button>
                )}
              </Box>
            )
          })()}
        {props.onUpdateChoice && (
          <VStack gap={2} alignItems="stretch" mt={2}>
            {availableOptions
              .filter((opt) => {
                // For multi-select, show options that aren't already selected
                if (isMultiSelect) {
                  return !selectedValues.some((sv) => sv.value === opt.value)
                }
                // For single-select, show all if none selected
                if (mode === 'wizard') {
                  return !selectedValue
                }
                return selectedValues.length === 0
              })
              .map((option) => (
                <Box
                  key={option.value}
                  p={3}
                  bg="su.white"
                  borderWidth="2px"
                  borderColor="su.black"
                  borderRadius="md"
                >
                  <Text fontSize="md" fontWeight="bold" mb={option.description ? 1 : 0}>
                    {option.label}
                  </Text>
                  {option.description && (
                    <Text fontSize="sm" color="su.black" opacity={0.8} mb={2}>
                      {option.description}
                    </Text>
                  )}
                  <Button
                    bg="su.orange"
                    color="su.white"
                    size="sm"
                    onClick={() => handleSelectOption(option.value)}
                    mt={2}
                  >
                    Add
                  </Button>
                </Box>
              ))}
          </VStack>
        )}
      </VStack>
    )
  }

  // Handle multi-select with entities (entity mode only)
  if (isMultiSelect && selectedValues.length > 0 && mode === 'entity') {
    return (
      <VStack gap={3} alignItems="stretch" mt={2}>
        {selectedValues.map((selection) => {
          const entity = SalvageUnionReference.getByRef(selection.value)
          if (!entity) return null

          const parsed = SalvageUnionReference.parseRef(selection.value)
          if (!parsed) return null

          const displayEntity = {
            entity: entity as SURefEntity,
            schemaName: parsed.schemaName.toLowerCase(),
          }
          const displayName =
            displayEntity.entity && 'name' in displayEntity.entity
              ? displayEntity.entity.name
              : choice.name

          return (
            <EntityDisplay
              key={selection.id}
              data={displayEntity.entity}
              compact
              collapsible
              defaultExpanded={false}
              buttonConfig={
                props.onUpdateChoice
                  ? {
                      bg: 'brand.srd',
                      color: 'su.white',
                      fontWeight: 'bold',
                      textTransform: 'uppercase',
                      _hover: { bg: 'su.black' },
                      onClick: (e) => {
                        e.stopPropagation()
                        const confirmed = window.confirm(
                          `Are you sure you want to remove "${displayName}"?`
                        )
                        if (confirmed) {
                          handleRemove(selection.value)
                        }
                      },
                      children: 'Remove',
                    }
                  : undefined
              }
            />
          )
        })}
        {props.onUpdateChoice && (
          <Button onClick={() => setIsModalOpen(true)} w="full">
            Add {choice.name}
          </Button>
        )}
        {props.onUpdateChoice && (
          <EntitySelectionModal
            isOpen={isModalOpen}
            onClose={() => setIsModalOpen(false)}
            schemaNames={schemaNames}
            onSelect={handleSelect}
            title={`Select ${choice.name}`}
          />
        )}
      </VStack>
    )
  }

  // Handle single-select (existing behavior)
  return (
    <>
      {!selectedEntity ? (
        props.onUpdateChoice && (
          <Button onClick={() => setIsModalOpen(true)} w="full" mt={2}>
            Select {choice.name}
          </Button>
        )
      ) : (
        <EntityDisplay
          data={selectedEntity.entity}
          compact
          collapsible
          defaultExpanded={false}
          buttonConfig={
            props.onUpdateChoice
              ? {
                  bg: 'brand.srd',
                  color: 'su.white',
                  fontWeight: 'bold',
                  textTransform: 'uppercase',
                  _hover: { bg: 'su.black' },
                  onClick: (e) => {
                    e.stopPropagation()
                    const confirmed = window.confirm(
                      `Are you sure you want to remove "${entityName}"?`
                    )
                    if (confirmed) {
                      handleRemove()
                    }
                  },
                  children: `Remove ${choice.name}`,
                }
              : undefined
          }
        />
      )}

      {props.onUpdateChoice && (
        <EntitySelectionModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          schemaNames={schemaNames}
          onSelect={handleSelect}
          title={`Select ${choice.name}`}
        />
      )}
    </>
  )
}
