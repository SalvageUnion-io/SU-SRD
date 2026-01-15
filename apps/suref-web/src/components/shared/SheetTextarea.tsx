import { Flex, Textarea } from '@chakra-ui/react'
import { Text } from '../base/Text'
import { useState, useEffect } from 'react'
import { DEBOUNCE_TIMINGS } from '../../constants/gameRules'

interface SheetTextareaProps {
  label?: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
  disabled?: boolean

  isOwner?: boolean
  height?: string | number
  rows?: number
}

export function SheetTextarea({
  label,
  value,
  onChange,
  placeholder,
  disabled = false,
  isOwner = true,
  height = '20',
  rows,
}: SheetTextareaProps) {
  const [localValue, setLocalValue] = useState(value)

  const showDisabledStyling = disabled && isOwner

  useEffect(() => {
    setLocalValue(value)
  }, [value])

  useEffect(() => {
    const timer = setTimeout(() => {
      if (localValue !== value) {
        onChange(localValue)
      }
    }, DEBOUNCE_TIMINGS.autoSave)

    return () => clearTimeout(timer)
  }, [localValue, value, onChange])

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setLocalValue(e.target.value)
  }

  return (
    <Flex
      direction="column"
      w="full"
      h={height === 'full' ? 'full' : undefined}
      flex={height === 'full' ? '1' : undefined}
    >
      {label && (
        <Flex alignItems="center" mb={-2} zIndex={1}>
          <Text variant="pseudoheader" fontSize="sm" textTransform="uppercase" ml={3}>
            {label}
          </Text>
        </Flex>
      )}

      <Textarea
        value={localValue}
        onChange={handleChange}
        disabled={disabled}
        placeholder={placeholder}
        w="full"
        h={height}
        rows={rows}
        p={3}
        borderWidth="3px"
        borderColor="su.black"
        minHeight="40"
        borderRadius="md"
        bg="su.white"
        color="su.black"
        fontWeight="semibold"
        resize="none"
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
      />
    </Flex>
  )
}
