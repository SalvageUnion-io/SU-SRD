import { Flex, Text } from '@chakra-ui/react'
import { Switch } from '@chakra-ui/react'

interface PrivateToggleProps {
  isPrivate: boolean
  onChange: (isPrivate: boolean) => void
  disabled?: boolean
  label?: string
}

/**
 * Toggle switch for marking an entity as private
 * Used in mech, pilot, crawler, and game sheets
 */
export function PrivateToggle({
  isPrivate,
  onChange,
  disabled = false,
  label = 'Private',
}: PrivateToggleProps) {
  return (
    <Flex alignItems="center" gap={2}>
      <Text fontWeight="semibold" fontSize="sm" color={disabled ? 'gray.400' : 'su.black'}>
        {label}
      </Text>
      <Switch.Root
        checked={isPrivate}
        onCheckedChange={(e) => onChange(e.checked)}
        disabled={disabled}
        colorPalette="orange"
      >
        <Switch.HiddenInput />
        <Switch.Control>
          <Switch.Thumb />
        </Switch.Control>
      </Switch.Root>
    </Flex>
  )
}
