import type { Story } from '@ladle/react'
import { Flex, Box } from '@chakra-ui/react'
import { LevelDisplay } from './LevelDisplay'

export default {
  title: 'Shared/LevelDisplay',
}

export const AllTechLevels: Story = () => (
  <Flex gap={4} flexWrap="wrap" position="relative" minH="60px">
    {[1, 2, 3, 4, 5, 6].map((level) => (
      <Box key={level} position="relative" w="50px" h="50px">
        <LevelDisplay level={level} />
      </Box>
    ))}
  </Flex>
)

export const SpecialLevels: Story = () => (
  <Flex gap={4} position="relative" minH="60px">
    <Box position="relative" w="50px" h="50px">
      <LevelDisplay level="B" />
    </Box>
    <Box position="relative" w="50px" h="50px">
      <LevelDisplay level="N" />
    </Box>
    <Box position="relative" w="50px" h="50px">
      <LevelDisplay level="L" />
    </Box>
  </Flex>
)

export const Compact: Story = () => (
  <Flex gap={3} position="relative" minH="40px">
    {[1, 2, 3].map((level) => (
      <Box key={level} position="relative" w="40px" h="40px">
        <LevelDisplay level={level} compact />
      </Box>
    ))}
  </Flex>
)

export const Inline: Story = () => (
  <Flex gap={3} alignItems="center">
    <LevelDisplay level={2} inline />
    <LevelDisplay level={4} inline />
    <LevelDisplay level="B" inline />
  </Flex>
)
