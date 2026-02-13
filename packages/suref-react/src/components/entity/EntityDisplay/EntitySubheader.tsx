import { Text } from '../../base/Text'
import { cn } from '../../../utils/cn'
import type { getEntityFontSizes } from './entityDisplayTypes'

type EntitySubheaderProps = {
  label: string
  disabled?: boolean
  fontSize?: ReturnType<typeof getEntityFontSizes>
}

export function EntitySubheader({ disabled = false, label, fontSize }: EntitySubheaderProps) {
  return (
    <Text
      variant="pseudoheader"
      className={cn(fontSize?.lg ?? 'text-lg', disabled && 'bg-gray-600 text-gray-300')}
    >
      {label}
    </Text>
  )
}
