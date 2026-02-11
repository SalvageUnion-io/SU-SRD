import { Text } from '../../base/Text'
import { useEntityDisplayContext } from './useEntityDisplayContext'
import { cn } from '../../../utils/cn'

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
      variant="pseudoheader"
      className={cn(fontSize.lg, disabled && 'bg-gray-600 text-gray-300')}
    >
      {label}
    </Text>
  )
}
