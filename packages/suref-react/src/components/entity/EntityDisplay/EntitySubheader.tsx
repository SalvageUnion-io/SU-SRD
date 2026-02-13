import { Text } from '../../base/Text'
import { cn } from '../../../utils/cn'

type EntitySubheaderProps = {
  label: string
  disabled?: boolean
  headerFontSize?: string
}

export function EntitySubheader({ disabled = false, label, headerFontSize }: EntitySubheaderProps) {
  return (
    <Text
      variant="pseudoheader"
      className={cn(headerFontSize ?? 'text-lg', disabled && 'bg-gray-600 text-gray-300')}
    >
      {label}
    </Text>
  )
}
