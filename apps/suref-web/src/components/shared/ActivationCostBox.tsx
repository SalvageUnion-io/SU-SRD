import { Flex, Box } from '@chakra-ui/react'

interface ActivationCostBoxProps {
  cost: string | number
  currency?: string | undefined | number
  compact?: boolean
}

/**
 * Reusable component for displaying activation costs in a "pointed box" style
 * Used in ActionCard, AbilityDisplay, and other components that show AP/EP costs
 * Features a black box with white text and a triangular pointer on the right
 */
export function ActivationCostBox({
  cost,
  currency = 'AP',
  compact = false,
}: ActivationCostBoxProps) {
  if (cost === undefined) return null
  const displayCost = cost === 'Variable' ? 'X' : cost

  return (
    <Flex alignItems="center" overflow="visible" p={0} display="inline-flex">
      <Flex
        bg="su.black"
        color="su.white"
        fontWeight="bold"
        textTransform="uppercase"
        alignItems="center"
        justifyContent="center"
        whiteSpace="nowrap"
        fontSize={compact ? 'xs' : 'md'}
        px={0.5}
        lineHeight={1}
        display="inline-flex"
        zIndex={2}
      >
        {`${displayCost} ${currency}`}
      </Flex>
      <Box
        w={0}
        h={0}
        borderTop={compact ? '0.4em solid transparent' : '7px solid transparent'}
        borderBottom={compact ? '0.4em solid transparent' : '7px solid transparent'}
        borderLeft={compact ? '6px solid' : '7px solid'}
        borderLeftColor="su.black"
        ml={0}
        zIndex={1}
        alignSelf="center"
      />
    </Flex>
  )
}
