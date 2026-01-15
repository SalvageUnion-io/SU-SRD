import { useState, useMemo } from 'react'
import { VStack, Flex, Badge, Text } from '@chakra-ui/react'
import { Button } from '@chakra-ui/react'
import { rollTable } from '@randsum/salvageunion'
import { SheetInput } from '../shared/SheetInput'
import type { SURefChassis } from 'salvageunion-reference'
import type { HydratedEntity } from '../../types/hydrated'

interface PatternSelectorProps {
  pattern: string
  selectedChassis: HydratedEntity | undefined
  onChange: (patternName: string) => void
  disabled?: boolean
}

export function PatternSelector({
  pattern,
  selectedChassis,
  onChange,
  disabled = false,
}: PatternSelectorProps) {
  const [showSuggestions, setShowSuggestions] = useState(false)

  const chassisRef = selectedChassis?.ref as SURefChassis | undefined

  const filteredPatterns = useMemo(() => {
    if (!chassisRef?.patterns || !pattern) return chassisRef?.patterns || []
    return chassisRef.patterns.filter((p) => p.name.toLowerCase().includes(pattern.toLowerCase()))
  }, [chassisRef, pattern])

  const handleRollPattern = () => {
    const {
      result: { label },
    } = rollTable('Mech Pattern Names')
    onChange(label)
  }

  return (
    <SheetInput
      label="Pattern"
      value={pattern}
      onChange={(value) => {
        onChange(value)
        setShowSuggestions(true)
      }}
      onFocus={() => setShowSuggestions(true)}
      onBlur={() => {
        setTimeout(() => setShowSuggestions(false), 200)
      }}
      disabled={disabled || !selectedChassis}
      isOwner={!disabled}
      placeholder="Enter or select a pattern..."
      onDiceRoll={handleRollPattern}
      diceRollAriaLabel="Roll for pattern name"
      diceRollTitle="Roll on the Mech Pattern Names table"
    >
      {showSuggestions && selectedChassis && filteredPatterns.length > 0 && (
        <VStack
          position="absolute"
          zIndex={10}
          w="full"
          mt={11}
          bg="bg.canvas"
          borderWidth="2px"
          borderColor="border.default"
          borderRadius="md"
          shadow="lg"
          maxH="60"
          overflowY="auto"
          gap={0}
          alignItems="stretch"
        >
          {filteredPatterns.map((p, index) => (
            <Button
              key={p.name}
              variant="ghost"
              onClick={() => {
                onChange(p.name)
                setShowSuggestions(false)
              }}
              w="full"
              textAlign="left"
              p={3}
              _hover={{ bg: 'bg.hover' }}
              fontWeight="semibold"
              color="fg.default"
              borderBottomWidth={index < filteredPatterns.length - 1 ? '1px' : 0}
              borderBottomColor="border.default"
              borderRadius={0}
              justifyContent="flex-start"
              h="auto"
            >
              <Flex alignItems="center" gap={2}>
                <Text>{p.name}</Text>
                {'legalStarting' in p && (
                  <Badge
                    bg="su.green"
                    color="su.white"
                    fontSize="xs"
                    fontWeight="bold"
                    px={2}
                    py={1}
                  >
                    LEGAL STARTING PATTERN
                  </Badge>
                )}
              </Flex>
            </Button>
          ))}
        </VStack>
      )}
    </SheetInput>
  )
}
