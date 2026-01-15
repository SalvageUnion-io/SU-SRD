import { useState } from 'react'
import { Box, Button, Flex, HStack, VStack } from '@chakra-ui/react'
import { Heading } from '../base/Heading'
import { Text } from '../base/Text'
import { SheetInput } from '../shared/SheetInput'
import { SheetTextarea } from '../shared/SheetTextarea'

interface GameInfoProps {
  name: string
  description: string | null
  onNameChange: (name: string) => void
  onDescriptionChange: (description: string) => void
  disabled?: boolean
}

export function GameInfo({
  name,
  description,
  onNameChange,
  onDescriptionChange,
  disabled = false,
}: GameInfoProps) {
  const [isExpanded, setIsExpanded] = useState(false)

  return (
    <Box bg="su.gameBlue" border="2px solid" borderColor="black" borderRadius="md" p={4} w="full">
      {isExpanded ? (
        <VStack gap={4} align="stretch">
          <Flex justify="space-between" align="center">
            <Heading as="h2" fontSize="lg" textTransform="uppercase">
              {name}
            </Heading>
            <Button
              size="sm"
              onClick={() => setIsExpanded(false)}
              disabled={disabled}
              bg="black"
              color="white"
              _hover={{ bg: 'gray.800' }}
            >
              Close
            </Button>
          </Flex>

          <SheetInput
            label="Name"
            value={name}
            onChange={onNameChange}
            placeholder="Enter game name"
            disabled={disabled}
          />

          <SheetTextarea
            label="Description"
            value={description ?? ''}
            onChange={onDescriptionChange}
            placeholder="Enter game description..."
            disabled={disabled}
            height="150px"
          />
        </VStack>
      ) : (
        <HStack justify="space-between" align="center" gap={4}>
          <Text variant="pseudoheader" fontSize="4xl" textTransform="uppercase">
            {name}
          </Text>

          <Text fontSize="sm" flex="1" color="gray.700">
            {description || 'No description'}
          </Text>

          <Button
            size="sm"
            onClick={() => setIsExpanded(true)}
            disabled={disabled}
            bg="black"
            color="white"
            _hover={{ bg: 'gray.800' }}
            flexShrink={0}
          >
            Edit
          </Button>
        </HStack>
      )}
    </Box>
  )
}
