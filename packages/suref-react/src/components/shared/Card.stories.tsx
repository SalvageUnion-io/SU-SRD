import type { Story } from '@ladle/react'
import { Flex, Box } from '@chakra-ui/react'
import { Card } from './Card'
import { Text } from '../base/Text'
import { ValueDisplay } from './ValueDisplay'

export default {
  title: 'Shared/Card',
}

export const Default: Story = () => (
  <Box w="400px">
    <Card title="Standard Card" bg="su.lightBlue">
      <Text>Card body content goes here.</Text>
    </Card>
  </Box>
)

export const WithHeaderContent: Story = () => (
  <Box w="400px">
    <Card
      title="Mech Card"
      bg="su.green"
      rightContent={<ValueDisplay label="SP" value={8} />}
      subTitleContent={<ValueDisplay label="TL" value={3} />}
    >
      <Text>A mech card with right and subtitle content.</Text>
    </Card>
  </Box>
)

export const Compact: Story = () => (
  <Box w="300px">
    <Card title="Compact Card" bg="su.orange" compact>
      <Text fontSize="sm">Compact body content.</Text>
    </Card>
  </Box>
)

export const Disabled: Story = () => (
  <Box w="400px">
    <Card title="Disabled Card" bg="su.lightBlue" disabled>
      <Text>This card is disabled.</Text>
    </Card>
  </Box>
)

export const WithLabel: Story = () => (
  <Box w="400px" pt={4}>
    <Card title="Pilot Name" bg="su.orange" label="PILOT">
      <Text>Card with a label above.</Text>
    </Card>
  </Box>
)

export const HeaderOnly: Story = () => (
  <Box w="400px">
    <Card title="Header Only Card" bg="su.pink" />
  </Box>
)

export const Reversed: Story = () => (
  <Box w="400px">
    <Card
      title="Reversed Layout"
      bg="su.twoBlue"
      reverse
      rightContent={<ValueDisplay label="EP" value={2} />}
    >
      <Text>Title and right content are swapped.</Text>
    </Card>
  </Box>
)

export const MultipleCards: Story = () => (
  <Flex direction="column" gap={4} w="400px">
    <Card title="Mech Systems" bg="su.green">
      <Text>Green for mechs.</Text>
    </Card>
    <Card title="Pilot Abilities" bg="su.orange">
      <Text>Orange for pilots.</Text>
    </Card>
    <Card title="Crawler Bays" bg="su.pink">
      <Text>Pink for crawlers.</Text>
    </Card>
  </Flex>
)
