import { Box } from '@chakra-ui/react'
import { Text } from '../base/Text'
import { useParseTraitReferences } from '../../utils/parseTraitReferences'

interface DamagedEffectDisplayProps {
  damagedEffect: string
}

/**
 * Component for displaying damaged effect with content block styling
 */
export function DamagedEffectDisplay({ damagedEffect }: DamagedEffectDisplayProps) {
  const parsedContent = useParseTraitReferences(damagedEffect)

  return (
    <Box
      position="absolute"
      top="50%"
      left={0}
      right={0}
      transform="translateY(-50%)"
      zIndex={1}
      px={2}
      filter="drop-shadow(0 0 4px rgba(0, 0, 0, 0.8))"
    >
      <Box
        bg="su.white"
        border="2px solid"
        borderColor="su.black"
        overflow="hidden"
        textAlign="left"
        borderRadius="md"
      >
        <Box bg="su.white" bgColor="su.white" px={2} py={2}>
          <Text
            as="span"
            fontWeight="bold"
            fontSize="lg"
            color="su.black"
            lineHeight="relaxed"
            display="block"
          >
            Damaged Effect
          </Text>
          <Box
            color="su.black"
            fontWeight="medium"
            lineHeight="relaxed"
            wordBreak="break-word"
            overflowWrap="break-word"
            whiteSpace="normal"
            fontSize="sm"
            mb={2}
          >
            {parsedContent}
          </Box>
        </Box>
      </Box>
    </Box>
  )
}
