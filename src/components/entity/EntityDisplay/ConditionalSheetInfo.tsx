import { Flex, Box } from '@chakra-ui/react'
import { SheetDisplay } from '../../shared/SheetDisplay'
import { useEntityDisplayContext } from './useEntityDisplayContext'
import { useParseTraitReferences } from '../../../utils/parseTraitReferences'
import { useMemo } from 'react'
import { getTiltRotation } from '../../../utils/tiltUtils'
import { Text } from '../../base/Text'

interface ConditionalSheetInfoProps {
  /** Property name to check in data (for backwards compatibility) */
  propertyName: string
  /** Optional explicit value to display (takes precedence over propertyName) */
  value?: string
  /** Optional label */
  label?: string
  /** Optional label color */
  labelBgColor?: string
  /** Optional children to render */
  children?: React.ReactNode
}

/**
 * Wrapper component for conditional SheetDisplay rendering.
 * Can either extract value from entity data via propertyName, or use explicit value prop.
 */
export function ConditionalSheetInfo({
  propertyName,
  value: explicitValue,
  label,
  labelBgColor,
  children,
}: ConditionalSheetInfoProps) {
  const { data, spacing, compact, damaged, fontSize } = useEntityDisplayContext()

  let displayValue: string | undefined
  if (explicitValue !== undefined) {
    displayValue = explicitValue
  } else {
    const extractedValue = data[propertyName as keyof typeof data]
    displayValue = typeof extractedValue === 'string' ? extractedValue : undefined
  }

  const parsedContent = useParseTraitReferences(displayValue)
  const valueRotation = useMemo(() => (damaged ? getTiltRotation() : 0), [damaged])

  if (!displayValue) return null
  if (!(propertyName in data) && explicitValue === undefined) return null

  // Special handling for damagedEffect - render with content block styling
  if (propertyName === 'damagedEffect') {
    return (
      <Box p={spacing.contentPadding}>
        <Box
          transform={damaged ? `rotate(${valueRotation}deg)` : undefined}
          transition="transform 0.3s ease"
        >
          {label && (
            <Text
              as="span"
              fontWeight="bold"
              fontSize={fontSize.lg}
              color="su.black"
              lineHeight="relaxed"
              display="block"
            >
              {label}
            </Text>
          )}
          <Box
            color="su.black"
            fontWeight="medium"
            lineHeight="relaxed"
            wordBreak="break-word"
            overflowWrap="break-word"
            whiteSpace="normal"
            fontSize={fontSize.sm}
            mb={2}
          >
            {children || parsedContent}
          </Box>
        </Box>
      </Box>
    )
  }

  return (
    <Flex p={spacing.contentPadding}>
      <Box
        transform={damaged ? `rotate(${valueRotation}deg)` : undefined}
        transition="transform 0.3s ease"
      >
        <SheetDisplay compact={compact} label={label} labelColor={labelBgColor}>
          {children || parsedContent}
        </SheetDisplay>
      </Box>
    </Flex>
  )
}
