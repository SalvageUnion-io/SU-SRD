import type { Story } from '@ladle/react'
import { Box, Flex } from '@chakra-ui/react'
import { InlineContentBlock } from './InlineContentBlock'
import type { SURefObjectContentBlock } from 'salvageunion-reference'
import { Text } from '../base/Text'

export default {
  title: 'Entity/InlineContentBlock',
}

const paragraphBlock: SURefObjectContentBlock = {
  type: 'paragraph',
  value: 'Deals 3 damage to a target within range.',
}

const hintBlock: SURefObjectContentBlock = {
  type: 'hint',
  value: 'This ability can be used once per round.',
}

export const Paragraph: Story = () => (
  <Box w="500px" bg="su.white" p={3}>
    <Flex alignItems="center" gap={1}>
      <Text as="span" fontWeight="bold">
        Laser Cutter:
      </Text>
      <InlineContentBlock block={paragraphBlock} fontSize="sm" />
    </Flex>
  </Box>
)

export const Hint: Story = () => (
  <Box w="500px" bg="su.white" p={3}>
    <Flex alignItems="center" gap={1}>
      <Text as="span" fontWeight="bold">
        Note:
      </Text>
      <InlineContentBlock block={hintBlock} fontSize="sm" />
    </Flex>
  </Box>
)
