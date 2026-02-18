import { Text } from '../../base/Text'
import { cn } from '../../../utils/cn'

type ReferenceEntitySubheaderProps = {
  label: string
  disabled?: boolean
  headerFontSize?: string
}

export function ReferenceEntitySubheader({
  disabled = false,
  label,
  headerFontSize,
}: ReferenceEntitySubheaderProps) {
  return (
    <Text
      variant="pseudoheader"
      className={cn(headerFontSize ?? 'text-lg', disabled && 'bg-gray-600 text-gray-300')}
    >
      {label}
    </Text>
  )
}
