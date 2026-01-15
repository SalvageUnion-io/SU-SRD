import { Box, Flex } from '@chakra-ui/react'
import { Text } from '../base/Text'

interface DataCellProps {
  leftBg: string
  leftTextColor: string
  leftContent: string
  rightBg: string
  rightTextColor: string
  rightContent: string
}

export function DataCell({
  leftBg,
  leftTextColor,
  leftContent,
  rightBg,
  rightTextColor,
  rightContent,
}: DataCellProps) {
  return (
    <Flex borderRadius="md" overflow="hidden" borderWidth="2px" borderColor="su.black">
      <Box bg={leftBg} px={2} py={1} w="33.33%">
        <Text fontSize="xs" fontWeight="bold" color={leftTextColor}>
          {leftContent}
        </Text>
      </Box>
      <Box bg={rightBg} px={2} py={1} w="66.67%">
        <Text fontSize="xs" color={rightTextColor} lineClamp={1}>
          {rightContent}
        </Text>
      </Box>
    </Flex>
  )
}
