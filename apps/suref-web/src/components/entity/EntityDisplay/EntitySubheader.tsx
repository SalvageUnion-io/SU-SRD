import { Text } from '../../base/Text'
import { useEntityDisplayContext } from './useEntityDisplayContext'

export function EntitySubheader({
  disabled = false,
  label,
}: {
  label: string
  disabled?: boolean
}) {
  const { fontSize } = useEntityDisplayContext()
  return (
    <Text
      fontSize={fontSize.lg}
      variant="pseudoheader"
      bg={disabled ? 'gray.600' : undefined}
      color={disabled ? 'gray.300' : undefined}
    >
      {label}
    </Text>
  )
}
