import { Flex, Box } from '@chakra-ui/react'
import { Text } from '../base/Text'

export function ValueDisplay({
  label,
  value,
  compact = false,
  inverse = false,
  inline = true,
  damaged = false,
  rotation = 0,
}: {
  label: string | number
  value?: string | number
  compact?: boolean
  inverse?: boolean
  /** Whether to display inline (default: true). Set to false for flex container contexts. */
  inline?: boolean
  /** Whether the value is damaged (applies tilt) */
  damaged?: boolean
  /** Optional rotation angle in degrees */
  rotation?: number
}) {
  const semiFontWeight = compact ? 'normal' : 'semibold'
  const fontSize = compact ? 'xs' : 'md'
  const mainVariant = inverse ? 'pseudoheaderInverse' : 'pseudoheader'
  const valueVariant = inverse ? 'pseudoheader' : 'pseudoheaderInverse'
  const tiltRotation = damaged ? rotation : 0

  const content = (
    <Flex
      gap={0}
      cursor="default"
      whiteSpace="nowrap"
      border="1px solid black"
      display={inline ? 'inline-flex' : 'flex'}
      flexShrink={0}
      flexGrow={0}
      width="fit-content"
    >
      <Text
        variant={mainVariant}
        textTransform="uppercase"
        as="span"
        fontWeight={semiFontWeight}
        fontSize={fontSize}
      >
        {label}
      </Text>
      {value !== undefined && (
        <Text
          textTransform="uppercase"
          variant={valueVariant}
          as="span"
          fontWeight={semiFontWeight}
          fontSize={fontSize}
        >
          {value}
        </Text>
      )}
    </Flex>
  )

  if (damaged && tiltRotation !== 0) {
    return (
      <Box
        transform={`rotate(${tiltRotation}deg)`}
        transition="transform 0.3s ease"
        display={inline ? 'inline-block' : 'block'}
      >
        {content}
      </Box>
    )
  }

  return content
}
