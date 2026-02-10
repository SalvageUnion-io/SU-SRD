import type { Story } from '@ladle/react'
import { Flex, Box, Button } from '@chakra-ui/react'
import { Tooltip } from './tooltip'

export default {
  title: 'UI/Tooltip',
}

export const Basic: Story = () => (
  <Flex gap={4} p={8}>
    <Tooltip content="This is a tooltip">
      <Button bg="su.black" color="su.white">
        Hover me
      </Button>
    </Tooltip>
  </Flex>
)

export const WithArrow: Story = () => (
  <Flex gap={4} p={8}>
    <Tooltip content="Tooltip with arrow" showArrow>
      <Button bg="su.orange" color="su.white">
        With Arrow
      </Button>
    </Tooltip>
  </Flex>
)

export const Disabled: Story = () => (
  <Flex gap={4} p={8}>
    <Tooltip content="You won't see this" disabled>
      <Button bg="su.green" color="su.white">
        Disabled Tooltip
      </Button>
    </Tooltip>
  </Flex>
)

export const RichContent: Story = () => (
  <Flex gap={4} p={8}>
    <Tooltip
      content={
        <Box p={1}>
          <Box fontWeight="bold">System: Laser Cutter</Box>
          <Box fontSize="sm">Tech Level 2 - 1 EP</Box>
        </Box>
      }
    >
      <Button bg="su.twoBlue" color="su.white">
        Rich Content
      </Button>
    </Tooltip>
  </Flex>
)
