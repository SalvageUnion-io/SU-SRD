import { Text } from '../base/Text'

export function CardHeader({
  title,
  titleRotation = 0,
  disabled = false,
  compact = false,
}: {
  title: string
  titleRotation?: number
  disabled?: boolean
  compact?: boolean
}) {
  return (
    <Text
      variant="pseudoheader"
      textTransform="uppercase"
      transform={titleRotation !== 0 ? `rotate(${titleRotation}deg)` : undefined}
      transition="transform 0.3s ease"
      opacity={disabled ? 0.5 : 1}
      whiteSpace={compact ? 'nowrap' : undefined}
      css={{
        fontSize: compact ? 'clamp(0.4rem, 2vw, 1rem)' : 'clamp(1rem, 2vw, 2rem)',
      }}
    >
      {title}
    </Text>
  )
}
