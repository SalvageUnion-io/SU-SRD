import { Flex } from '@chakra-ui/react'
import { NativeSelectField, NativeSelectRoot } from '@chakra-ui/react'
import { Text } from '../base/Text'
import type { ReactNode } from 'react'

interface SheetSelectProps {
  label: string
  value: string | null
  onChange: (value: string | null) => void
  disabled?: boolean

  isOwner?: boolean
  placeholder?: string
  loading?: boolean
  options?: { id: string; name: string }[]
  children?: ReactNode
}

export function SheetSelect({
  label,
  value,
  onChange,
  disabled = false,
  isOwner = true,
  placeholder = 'Select an option...',
  loading = false,
  options,
  children,
}: SheetSelectProps) {
  const showDisabledStyling = disabled && isOwner

  return (
    <Flex direction="column">
      <Text
        variant="pseudoheader"
        fontSize="sm"
        textTransform="uppercase"
        ml={3}
        mb={-2}
        zIndex={1}
      >
        {label}
      </Text>

      <NativeSelectRoot disabled={disabled}>
        <NativeSelectField
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value || null)}
          w="full"
          px={3}
          py={2}
          borderWidth="2px"
          borderColor="su.black"
          borderRadius="md"
          bg="su.white"
          color="su.black"
          fontWeight="semibold"
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
          aria-label={label}
        >
          <option value="">{loading ? 'Loading...' : placeholder}</option>
          {options
            ? options.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.name}
                </option>
              ))
            : children}
        </NativeSelectField>
      </NativeSelectRoot>
    </Flex>
  )
}
