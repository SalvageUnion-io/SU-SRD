import type { Story } from '@ladle/react'
import { Flex } from '@chakra-ui/react'
import { Heading } from './Heading'

export default {
  title: 'Base/Heading',
}

export const AllLevels: Story = () => (
  <Flex direction="column" gap={4}>
    <Heading level="h1">Heading Level 1</Heading>
    <Heading level="h2">Heading Level 2</Heading>
    <Heading level="h3">Heading Level 3</Heading>
    <Heading level="h4">Heading Level 4</Heading>
    <Heading level="h5">Heading Level 5</Heading>
    <Heading level="h6">Heading Level 6</Heading>
  </Flex>
)

export const H1: Story = () => <Heading level="h1">Salvage Union</Heading>

export const H2: Story = () => <Heading level="h2">Systems & Modules</Heading>

export const Default: Story = () => <Heading>Default (h3)</Heading>
