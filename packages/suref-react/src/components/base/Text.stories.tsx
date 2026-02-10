import type { Story } from '@ladle/react'
import { Flex } from '@chakra-ui/react'
import { Text } from './Text'

export default {
  title: 'Base/Text',
}

export const DefaultText: Story = () => (
  <Text>This is default body text using the Fira Code monospace font.</Text>
)

export const Pseudoheader: Story = () => (
  <Flex direction="column" gap={2}>
    <Text variant="pseudoheader">Pseudoheader Label</Text>
    <Text variant="pseudoheader" fontSize="sm">
      Smaller Pseudoheader
    </Text>
    <Text variant="pseudoheader" fontSize="xs">
      Extra Small Pseudoheader
    </Text>
  </Flex>
)

export const PseudoheaderInverse: Story = () => (
  <Flex direction="column" gap={2} bg="su.black" p={4}>
    <Text variant="pseudoheaderInverse">Inverse Pseudoheader</Text>
    <Text variant="pseudoheaderInverse" fontSize="sm">
      Smaller Inverse
    </Text>
  </Flex>
)

export const AllVariants: Story = () => (
  <Flex direction="column" gap={3}>
    <Text>Default text paragraph</Text>
    <Text variant="pseudoheader">Pseudoheader</Text>
    <Text variant="pseudoheaderInverse">Pseudoheader Inverse</Text>
  </Flex>
)
