import { Flex, Group, IconButton, Input } from '@chakra-ui/react'
import { Checkbox as ChakraCheckbox } from '@chakra-ui/react'
import { Text } from '../base/Text'
import { useState, useEffect, type ReactNode } from 'react'
import { DEBOUNCE_TIMINGS } from '../../constants/gameRules'

interface SheetInputProps {
  label?: string
  value: string
  onChange?: (value: string) => void
  placeholder?: string
  disabled?: boolean

  isOwner?: boolean

  onDiceRoll?: () => void
  diceRollAriaLabel?: string
  diceRollTitle?: string

  toggleChecked?: boolean
  onToggleChange?: (checked: boolean) => void
  toggleLabel?: string

  onFocus?: () => void
  onBlur?: () => void

  suffixText?: string

  children?: ReactNode
}

export function SheetInput({
  label,
  value,
  onChange,
  placeholder,
  disabled = false,
  isOwner = true,
  onDiceRoll,
  diceRollAriaLabel,
  diceRollTitle,
  toggleChecked,
  onToggleChange,
  toggleLabel = 'Used',
  onFocus,
  onBlur,
  suffixText,
  children,
}: SheetInputProps) {
  const hasToggle = toggleChecked !== undefined && onToggleChange !== undefined
  const hasDiceRoll = onDiceRoll !== undefined
  const hasSuffix = suffixText !== undefined

  const showDisabledStyling = disabled && isOwner

  const [localValue, setLocalValue] = useState(value)

  useEffect(() => {
    setLocalValue(value)
  }, [value])

  useEffect(() => {
    const timer = setTimeout(() => {
      if (localValue !== value && onChange) {
        onChange(localValue)
      }
    }, DEBOUNCE_TIMINGS.autoSave)

    return () => clearTimeout(timer)
  }, [localValue, value, onChange])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setLocalValue(e.target.value)
  }

  return (
    <Flex direction="column" position="relative">
      {label && (
        <Flex alignItems="center" mb={hasToggle ? -4 : -2} zIndex={1}>
          <Text variant="pseudoheader" fontSize="sm" textTransform="uppercase" ml={3}>
            {label}
          </Text>
          {hasToggle && (
            <ChakraCheckbox.Root
              checked={toggleChecked}
              onCheckedChange={(e: { checked: boolean | 'indeterminate' }) =>
                onToggleChange(e.checked === true)
              }
              disabled={disabled}
            >
              <ChakraCheckbox.HiddenInput aria-label={`${label} ${toggleLabel}`} />
              <ChakraCheckbox.Control
                bg="su.white"
                borderWidth="2px"
                mb={2}
                borderColor="su.black"
                h="14px"
                w="14px"
                _checked={{
                  bg: 'brand.srd',
                  borderColor: 'su.black',
                }}
              />
            </ChakraCheckbox.Root>
          )}
        </Flex>
      )}

      <Group attached w="full">
        <Input
          type="text"
          value={localValue}
          onChange={handleChange}
          onFocus={onFocus}
          onBlur={onBlur}
          disabled={disabled}
          placeholder={placeholder}
          flex="1"
          minW="120px"
          p={3}
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
        />
        {hasSuffix && (
          <Flex
            alignItems="center"
            px={3}
            bg="su.black"
            color="su.white"
            borderWidth="2px"
            borderColor="su.black"
            borderRadius="0"
            fontWeight="semibold"
            fontSize="sm"
            whiteSpace="nowrap"
            flexShrink={0}
          >
            {suffixText}
          </Flex>
        )}
        {hasDiceRoll && (
          <IconButton
            onClick={onDiceRoll}
            disabled={disabled}
            color="su.white"
            bg="su.black"
            _hover={{ bg: 'brand.srd' }}
            _disabled={{ cursor: 'not-allowed' }}
            borderWidth="2px"
            borderColor="su.black"
            borderRadius="0"
            aria-label={diceRollAriaLabel || `Roll for ${label}`}
            title={diceRollTitle || `Roll for ${label}`}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              height="20"
              viewBox="0 -960 960 960"
              width="20"
              fill="currentColor"
            >
              <path d="M240-120q-50 0-85-35t-35-85q0-50 35-85t85-35q50 0 85 35t35 85q0 50-35 85t-85 35Zm480 0q-50 0-85-35t-35-85q0-50 35-85t85-35q50 0 85 35t35 85q0 50-35 85t-85 35ZM240-600q-50 0-85-35t-35-85q0-50 35-85t85-35q50 0 85 35t35 85q0 50-35 85t-85 35Zm240 240q-50 0-85-35t-35-85q0-50 35-85t85-35q50 0 85 35t35 85q0 50-35 85t-85 35Zm240-240q-50 0-85-35t-35-85q0-50 35-85t85-35q50 0 85 35t35 85q0 50-35 85t-85 35Z" />
            </svg>
          </IconButton>
        )}
      </Group>

      {children}
    </Flex>
  )
}
