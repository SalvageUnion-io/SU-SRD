import { cn } from '../../utils/cn'
import { Text } from '../base/Text'

type ValueDisplayProps = {
  label: string | number
  value?: string | number
  compact?: boolean
  inverse?: boolean
  inline?: boolean
  bgColor?: string
  textColor?: string
  borderColor?: string
}

export function ValueDisplay({
  label,
  value,
  compact = false,
  inverse = false,
  inline = true,
  bgColor,
  textColor,
  borderColor,
}: ValueDisplayProps) {
  const fontSize = compact ? 'text-xs' : 'text-sm'
  const mainVariant = inverse ? 'pseudoheaderInverse' : 'pseudoheader'
  const valueVariant = inverse ? 'pseudoheader' : 'pseudoheaderInverse'

  return (
    <span
      className={cn(
        'shrink-0 grow-0 cursor-default whitespace-nowrap border border-su-black',
        inline ? 'inline-flex' : 'flex',
        'w-fit'
      )}
      style={borderColor ? { borderColor } : undefined}
    >
      <Text
        variant={mainVariant}
        as="span"
        className={cn('uppercase', fontSize, compact ? 'font-normal' : 'font-semibold')}
        style={bgColor || textColor ? { backgroundColor: bgColor, color: textColor } : undefined}
      >
        {label}
      </Text>
      {value !== undefined && (
        <Text
          variant={valueVariant}
          as="span"
          className={cn('uppercase', fontSize, compact ? 'font-normal' : 'font-semibold')}
        >
          {value}
        </Text>
      )}
    </span>
  )
}
