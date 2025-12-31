import { Flex, Switch } from '@chakra-ui/react'
import { Text } from '../base/Text'

interface ActiveToggleProps {
  active: boolean
  onChange: (active: boolean) => void
  disabled?: boolean
  label?: string
}

/**
 * Toggle switch for marking an entity as active
 * Used in mech, pilot, crawler, and game sheets
 */
export function ActiveToggle({
  active,
  onChange,
  disabled = false,
  label = 'Active',
}: ActiveToggleProps) {
  return (
    <Flex alignItems="center" gap={2}>
      <Text fontWeight="semibold" fontSize="sm" color={disabled ? 'gray.400' : 'su.black'}>
        {label}
      </Text>
      <Switch.Root
        checked={active}
        onCheckedChange={(e) => onChange(e.checked)}
        disabled={disabled}
        colorPalette="green"
      >
        <Switch.HiddenInput />
        <Switch.Control>
          <Switch.Thumb />
        </Switch.Control>
      </Switch.Root>
    </Flex>
  )
}
