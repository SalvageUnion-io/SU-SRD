import { useState } from 'react'
import { VStack, Box, Button } from '@chakra-ui/react'
import type { SURefCrawlerBay } from 'salvageunion-reference'

import { EntityChoiceDisplay } from './EntityChoiceDisplay'
import { useManageEntityChoices } from '../../hooks/suentity'
import { useParseTraitReferences } from '../../utils/parseTraitReferences'
import { getParagraphString } from '../../lib/contentBlockHelpers'

type EntityModeProps = {
  mode: 'entity'
  bayEntityId: string
}

type WizardModeProps = {
  mode: 'wizard'
  onUpdateChoice: (choiceId: string, value: string | undefined) => void
  selectedWeaponValue?: string
}

type BayInfoProps = {
  bayRef: SURefCrawlerBay
} & (EntityModeProps | WizardModeProps)

/**
 * Unified component for displaying bay information that works in both
 * entity mode (with database-backed entity) and wizard mode (with wizard state).
 */
export function BayInfo(props: BayInfoProps) {
  const { bayRef, mode } = props
  const [isFunctionExpanded, setIsFunctionExpanded] = useState(false)
  const handleUpdateChoiceEntity = useManageEntityChoices(
    mode === 'entity' ? props.bayEntityId : undefined
  )

  const description = getParagraphString(bayRef.content)
  const parsedDescription = useParseTraitReferences(description || '')

  const hasFunction = !!description
  const hasChoices = bayRef.choices && bayRef.choices.length > 0

  if (!hasFunction && !hasChoices) {
    return null
  }

  const handleUpdateChoice = mode === 'entity' ? handleUpdateChoiceEntity : props.onUpdateChoice

  return (
    <VStack mt="2" gap={2} justifyContent="flex-start" alignItems="stretch" w="full">
      {hasChoices &&
        bayRef.choices?.map((choice) => {
          // For wizard mode, check if this is the armament bay weapon choice
          const selectedValue =
            mode === 'wizard' && choice.id === '383de916-bbd6-4e34-9cfc-1b37e12178c8'
              ? (props as WizardModeProps).selectedWeaponValue
              : undefined

          if (mode === 'entity') {
            return (
              <EntityChoiceDisplay
                key={choice.id}
                choice={choice}
                mode="entity"
                entityId={(props as EntityModeProps).bayEntityId}
                onUpdateChoice={handleUpdateChoice}
              />
            )
          } else {
            return (
              <EntityChoiceDisplay
                key={choice.id}
                choice={choice}
                mode="wizard"
                selectedValue={selectedValue}
                onUpdateChoice={handleUpdateChoice}
              />
            )
          }
        })}
      {hasFunction && (
        <Button
          onClick={() => setIsFunctionExpanded(!isFunctionExpanded)}
          w="full"
          bg="su.black"
          color="su.white"
          _hover={{ bg: 'brand.srd' }}
          fontWeight="bold"
          py={2}
          borderRadius="md"
        >
          {isFunctionExpanded ? 'Hide Info' : 'Show Info'}
        </Button>
      )}

      {isFunctionExpanded && hasFunction && parsedDescription && (
        <Box
          bg="su.white"
          border="2px solid"
          borderColor="su.black"
          overflow="hidden"
          textAlign="left"
          borderRadius="md"
        >
          {/* Function content */}
          <Box
            bg="su.white"
            color="su.black"
            fontWeight="medium"
            lineHeight="relaxed"
            fontSize="sm"
            px={2}
            py={2}
          >
            {parsedDescription}
          </Box>
        </Box>
      )}
    </VStack>
  )
}
