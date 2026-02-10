import type { Story } from '@ladle/react'
import { Flex, Box } from '@chakra-ui/react'
import { SheetDisplay } from './SheetDisplay'
import { Text } from '../base/Text'

export default {
  title: 'Shared/SheetDisplay',
}

export const Default: Story = () => (
  <Box w="300px">
    <SheetDisplay label="Mech Name" value="Iron Bastion" />
  </Box>
)

export const Compact: Story = () => (
  <Box w="300px">
    <SheetDisplay label="Pilot" value="Rex Steele" compact />
  </Box>
)

export const CustomLabelColor: Story = () => (
  <Box w="300px">
    <SheetDisplay label="Crawler" value="The Dustrunner" labelColor="su.pink" />
  </Box>
)

export const WithChildren: Story = () => (
  <Box w="300px">
    <SheetDisplay label="Description">
      <Text fontSize="sm">A heavily modified salvage mech with reinforced armor plating.</Text>
    </SheetDisplay>
  </Box>
)

export const Multiple: Story = () => (
  <Flex gap={4} flexWrap="wrap">
    <Box w="200px">
      <SheetDisplay label="Structure Points" value="8 / 8" />
    </Box>
    <Box w="200px">
      <SheetDisplay label="Energy Points" value="6 / 6" />
    </Box>
    <Box w="200px">
      <SheetDisplay label="Heat" value="0 / 6" />
    </Box>
  </Flex>
)
