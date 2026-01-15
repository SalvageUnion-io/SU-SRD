import { useState } from 'react'
import { Button, Flex } from '@chakra-ui/react'
import type { SURefChassis } from 'salvageunion-reference'
import { Text } from '../base/Text'
import { EntitySelectionModal } from '../entity/EntitySelectionModal'

interface ChassisSelectorProps {
  chassisId: string | null
  allChassis: SURefChassis[]
  onChange: (chassisId: string | null) => void
  disabled?: boolean
  isOwner?: boolean
}

export function ChassisSelector({
  chassisId,
  allChassis,
  onChange,
  disabled = false,
  isOwner = true,
}: ChassisSelectorProps) {
  const [isModalOpen, setIsModalOpen] = useState(false)

  const selectedChassis = allChassis.find((c) => c.id === chassisId)
  const displayText = selectedChassis?.name || 'Select a Chassis...'
  const showDisabledStyling = disabled && isOwner

  const handleSelect = (id: string) => {
    onChange(id)
  }

  return (
    <>
      <Flex direction="column">
        <Text
          variant="pseudoheader"
          fontSize="sm"
          textTransform="uppercase"
          ml={3}
          mb={-2}
          zIndex={1}
        >
          Chassis
        </Text>
        <Button
          onClick={() => setIsModalOpen(true)}
          disabled={disabled}
          w="full"
          px={3}
          py={2}
          borderWidth="2px"
          borderColor="su.black"
          borderRadius="md"
          bg="su.white"
          color="su.black"
          fontWeight="semibold"
          textAlign="left"
          justifyContent="flex-start"
          _disabled={
            showDisabledStyling
              ? {
                  cursor: 'not-allowed',
                  opacity: 0.5,
                  bg: 'gray.100',
                  color: 'gray.500',
                }
              : {
                  cursor: 'not-allowed',
                  opacity: 1,
                  bg: 'su.white',
                  color: 'su.black',
                }
          }
          aria-label="Select Chassis"
        >
          {displayText}
        </Button>
      </Flex>

      <EntitySelectionModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        schemaNames={['chassis']}
        selectedEntityId={chassisId}
        selectedEntitySchemaName="chassis"
        hidePatterns
        onSelect={(entityId) => handleSelect(entityId)}
        title="Select Chassis"
        selectButtonTextPrefix="Select"
      />
    </>
  )
}
