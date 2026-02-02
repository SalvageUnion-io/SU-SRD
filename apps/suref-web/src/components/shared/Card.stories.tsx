import type { Story } from '@ladle/react'
import { Card } from './Card'
import { Box, Button } from '@chakra-ui/react'
import { Text } from '../base/Text'

export default {
  title: 'Shared/Card',
}

export const Default: Story = () => (
  <Card title="Card Title" bg="su.lightBlue">
    <Text>Card content goes here</Text>
  </Card>
)

export const WithLeftAndRightContent: Story = () => (
  <Card
    title="Equipment"
    bg="su.orange"
    leftContent={<Box w="40px" h="40px" bg="white" borderRadius="md" />}
    rightContent={<Button size="sm">Action</Button>}
  >
    <Text>Card with header elements</Text>
  </Card>
)

export const WithLabel: Story = () => (
  <Card title="Systems" bg="su.green" label="Mech Systems">
    <Text>Card with a label above</Text>
  </Card>
)

export const Compact: Story = () => (
  <Card title="Compact Card" bg="su.lightBlue" compact>
    <Text>Smaller card variant</Text>
  </Card>
)

export const Disabled: Story = () => (
  <Card title="Disabled Card" bg="su.orange" disabled>
    <Text>This card is disabled</Text>
  </Card>
)

export const HeaderOnly: Story = () => <Card title="Header Only Card" bg="su.pink" />

export const WithSubtitle: Story = () => (
  <Card
    title="Main Title"
    bg="su.lightBlue"
    subTitleContent={<Text fontSize="sm">Subtitle content here</Text>}
  >
    <Text>Main content</Text>
  </Card>
)

export const Reversed: Story = () => (
  <Card
    title="Reversed Layout"
    bg="su.green"
    reverse
    rightContent={<Box w="30px" h="30px" bg="white" borderRadius="full" />}
  >
    <Text>Title appears on the right</Text>
  </Card>
)

export const CustomBodyBackground: Story = () => (
  <Card title="Different Body" bg="su.orange" bodyBg="su.lightBlue" bodyPadding={6}>
    <Text>Header and body have different backgrounds</Text>
  </Card>
)

export const ClickableHeader: Story = () => (
  <Card title="Click Me" bg="su.lightBlue" onHeaderClick={() => alert('Header clicked!')}>
    <Text>Click the header to trigger an action</Text>
  </Card>
)
