import { Box } from '@chakra-ui/react'

export function LevelDisplay({
  level,
  compact = false,
  inline = false,
}: {
  level: number | string
  compact?: boolean
  inline?: boolean
}) {
  const size = compact ? '20px' : '25px'
  const fontSize = compact ? 'lg' : '2xl'

  if (inline) {
    // Inline mode: render without absolute positioning for use in left content
    return (
      <Box
        width={size}
        height={size}
        bg="black"
        color="white"
        display="flex"
        alignItems="center"
        justifyContent="center"
        fontWeight="bold"
        fontSize={fontSize}
        borderRadius="sm"
        flexShrink={0}
      >
        {level}
      </Box>
    )
  }

  // Absolute mode: original positioning for backward compatibility
  return (
    <Box
      position="absolute"
      top="-2px"
      left="-15px"
      width={size}
      height={size}
      bg="black"
      color="white"
      display="flex"
      alignItems="center"
      justifyContent="center"
      fontWeight="bold"
      fontSize={fontSize}
      zIndex={10}
      opacity={1}
      css={{
        opacity: '1 !important',

        transform: 'translateZ(0)',
        willChange: 'transform',
      }}
      pointerEvents="none"
    >
      {level}
    </Box>
  )
}
