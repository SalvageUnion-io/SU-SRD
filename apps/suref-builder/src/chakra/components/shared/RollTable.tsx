import { useState, useRef, useEffect } from 'react'
import { Box, Flex, IconButton, Button } from '@chakra-ui/react'
import { resultForTable, type SURefObjectTable } from 'salvageunion-reference'
import { roll } from '@randsum/roller'
import { useParseTraitReferences } from '../../utils/parseTraitReferences'
import { Text } from '../base/Text'

interface DigestedRollTable {
  order: number
  label: string | null
  value: string
  key: string
}

type TableContent = string | { label?: string; value: string }

type RollTableType =
  | SURefObjectTable
  | { type: 'standard' | 'alternate' | 'flat' | 'full'; [key: string]: TableContent }

interface RollTableDisplayProps {
  table: RollTableType
  showCommand?: boolean
  disabled?: boolean
  compact?: boolean
  tableName?: string
}

function digestRollTable(table: RollTableType): DigestedRollTable[] {
  if (!table) return []

  // Helper function to extract numeric value from a key for sorting
  // Handles: "20" -> 20, "11-19" -> 11, "2-5" -> 2, etc.
  const getSortValue = (key: string): number => {
    if (key === 'type') return -1 // Will be filtered out anyway
    const firstPart = key.split('-')[0]?.trim()
    if (!firstPart) return 0
    const num = parseInt(firstPart, 10)
    return isNaN(num) ? 0 : num
  }

  const sorted = Object.keys(table)
    .filter((key) => key !== 'type')
    .sort((a, b) => {
      const aNum = getSortValue(a)
      const bNum = getSortValue(b)
      // Sort descending (highest to lowest)
      return bNum - aNum
    })

  return sorted
    .map((key, order) => {
      const content = table[key as keyof typeof table]

      // Handle new tableContent format: { label?: string, value: string }
      if (
        content &&
        typeof content === 'object' &&
        content !== null &&
        'value' in content &&
        typeof (content as { value: unknown }).value === 'string'
      ) {
        const tableContent = content as { label?: string; value: string }
        return {
          order,
          label: tableContent.label || null,
          value: tableContent.value,
          key,
        }
      }

      // Handle old string format: "Label: Description" or just "Description"
      const fullDescription = typeof content === 'string' ? content : ''
      const parts = fullDescription.split(':')
      const labelPart = parts[0]?.trim()
      const valuePart = parts.slice(1).join(':').trim()

      return {
        order,
        label: labelPart && labelPart !== valuePart ? labelPart : null,
        value: valuePart || fullDescription,
        key,
      }
    })
    .filter((item): item is DigestedRollTable => item.value !== undefined)
}

function RollTableDescription({
  label,
  value,
  compact,
}: {
  label: string | null
  value: string
  compact?: boolean
}) {
  const parsed = useParseTraitReferences(value)
  return (
    <Box color="su.black" fontSize={compact ? 'xs' : 'md'}>
      {label && (
        <Box as="span" fontWeight="bold">
          {label}:{' '}
        </Box>
      )}
      {parsed}
    </Box>
  )
}

export function RollTable({
  compact,
  disabled,
  table,
  showCommand = false,
  tableName,
}: RollTableDisplayProps) {
  const digestedTable = digestRollTable(table)
  const [highlightedKey, setHighlightedKey] = useState<string | null>(null)
  const highlightedRowRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (highlightedKey && highlightedRowRef.current) {
      highlightedRowRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }, [highlightedKey])

  const handleRoll = () => {
    setHighlightedKey(null)
    const { key } = resultForTable(table as SURefObjectTable, roll('1d20').total)
    setTimeout(() => setHighlightedKey(key), 300)
  }

  const handleClearHighlight = () => {
    setHighlightedKey(null)
  }

  return (
    <Box position="relative" overflow="visible">
      <Box transition="opacity 0.2s" overflow="visible">
        {showCommand && (
          <Flex
            bg="su.black"
            color="su.white"
            fontWeight="bold"
            textTransform="uppercase"
            alignItems="center"
            justifyContent="center"
            gap={compact ? 1 : 2}
            p={compact ? 1 : 2}
            mb={compact ? 1 : 2}
          >
            <Text fontSize={compact ? 'xs' : 'md'}>ROLL THE DIE:</Text>
            {tableName && !disabled && (
              <IconButton
                onClick={handleRoll}
                color="su.white"
                bg="transparent"
                _hover={{ bg: 'brand.srd' }}
                borderRadius="md"
                size={compact ? 'xs' : 'sm'}
                aria-label="Roll on this table"
                title="Roll on this table"
                variant="ghost"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  height={compact ? '16' : '20'}
                  viewBox="0 -960 960 960"
                  width={compact ? '16' : '20'}
                  fill="currentColor"
                >
                  <path d="M240-120q-50 0-85-35t-35-85q0-50 35-85t85-35q50 0 85 35t35 85q0 50-35 85t-85 35Zm480 0q-50 0-85-35t-35-85q0-50 35-85t85-35q50 0 85 35t35 85q0 50-35 85t-85 35ZM240-600q-50 0-85-35t-35-85q0-50 35-85t85-35q50 0 85 35t35 85q0 50-35 85t-85 35Zm240 240q-50 0-85-35t-35-85q0-50 35-85t85-35q50 0 85 35t35 85q0 50-35 85t-85 35Zm240-240q-50 0-85-35t-35-85q0-50 35-85t85-35q50 0 85 35t35 85q0 50-35 85t-85 35Z" />
                </svg>
              </IconButton>
            )}
          </Flex>
        )}
        {digestedTable.map(({ label, value, key }, index) => {
          if (key === 'type') return null
          const isHighlighted = highlightedKey === key
          const bgColor = index % 2 === 0 ? 'su.lightOrange' : 'su.white'

          return (
            <Flex
              ref={isHighlighted ? highlightedRowRef : null}
              key={key + label + index}
              flexDirection="row"
              flexWrap="wrap"
              bg={bgColor}
              cursor={isHighlighted ? 'pointer' : 'default'}
              onClick={isHighlighted ? handleClearHighlight : undefined}
              position="relative"
              transition="transform 0.2s ease, box-shadow 0.2s ease"
              transform={isHighlighted ? 'scale(1.04)' : 'scale(1)'}
              boxShadow={
                isHighlighted ? '0 0 0 4px rgba(0,0,0,0.9), 0 14px 40px rgba(0,0,0,0.85)' : 'none'
              }
              zIndex={isHighlighted ? 1 : 0}
              gap={compact ? 1 : 2}
            >
              {isHighlighted && (
                <Button
                  onClick={(e: React.MouseEvent) => {
                    e.stopPropagation()
                    handleRoll()
                  }}
                  position="absolute"
                  bottom="-26px"
                  left="50%"
                  transform="translateX(-50%)"
                  px={compact ? 2 : 3}
                  py={0}
                  h="auto"
                  minH="auto"
                  bg="su.black"
                  color="su.white"
                  fontSize={compact ? 'xs' : 'sm'}
                  fontWeight="bold"
                  _hover={{ bg: 'brand.srd' }}
                  borderRadius={0}
                  zIndex={2}
                  display="flex"
                  alignItems="center"
                  gap={1}
                >
                  Reroll
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    height={compact ? '14' : '16'}
                    viewBox="0 -960 960 960"
                    width={compact ? '14' : '16'}
                    fill="currentColor"
                  >
                    <path d="M240-120q-50 0-85-35t-35-85q0-50 35-85t85-35q50 0 85 35t35 85q0 50-35 85t-85 35Zm480 0q-50 0-85-35t-35-85q0-50 35-85t85-35q50 0 85 35t35 85q0 50-35 85t-85 35ZM240-600q-50 0-85-35t-35-85q0-50 35-85t85-35q50 0 85 35t35 85q0 50-35 85t-85 35Zm240 240q-50 0-85-35t-35-85q0-50 35-85t85-35q50 0 85 35t35 85q0 50-35 85t-85 35Zm240-240q-50 0-85-35t-35-85q0-50 35-85t85-35q50 0 85 35t35 85q0 50-35 85t-85 35Z" />
                  </svg>
                </Button>
              )}
              <Flex
                flex="1"
                flexDirection="column"
                alignItems="center"
                justifyContent="center"
                minH="100%"
                alignSelf="stretch"
                py={compact ? 1 : 2}
              >
                <Text
                  fontSize={compact ? 'md' : 'xl'}
                  fontWeight="bold"
                  color="su.black"
                  textAlign="center"
                >
                  {key}
                </Text>
              </Flex>
              <Flex
                flex="4"
                flexDirection="row"
                flexWrap="wrap"
                alignItems="center"
                py={compact ? 0.5 : 1}
              >
                <RollTableDescription label={label} value={value} compact={compact} />
              </Flex>
            </Flex>
          )
        })}
      </Box>
    </Box>
  )
}
