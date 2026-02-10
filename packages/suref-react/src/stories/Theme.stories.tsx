import type { Story } from '@ladle/react'
import { Box, Flex, Button } from '@chakra-ui/react'
import { suColors, techLevelColors } from '../theme'
import { Heading } from '../components/base/Heading'
import { Text } from '../components/base/Text'

export default {
  title: 'Theme',
}

function Swatch({ name, color }: { name: string; color: string }) {
  return (
    <Flex direction="column" alignItems="center" gap={1} w="120px">
      <Box w="80px" h="80px" bg={color} borderRadius="md" border="1px solid black" />
      <Text fontSize="xs" textAlign="center">
        {name}
      </Text>
    </Flex>
  )
}

export const ColorPalette: Story = () => (
  <Flex direction="column" gap={6}>
    <Heading level="h2">Color Palette</Heading>
    <Flex flexWrap="wrap" gap={4}>
      {Object.entries(suColors).map(([name, value]) => (
        <Swatch key={name} name={name} color={value} />
      ))}
    </Flex>
  </Flex>
)

export const TechLevelColors: Story = () => (
  <Flex direction="column" gap={4}>
    <Heading level="h2">Tech Level Colors</Heading>
    <Flex gap={2} flexWrap="wrap">
      {Object.entries(techLevelColors).map(([level, color]) => (
        <Flex key={level} direction="column" alignItems="center" gap={1}>
          <Box
            w="100px"
            h="60px"
            bg={color}
            borderRadius="md"
            display="flex"
            alignItems="center"
            justifyContent="center"
          >
            <Text color="white" fontWeight="bold" fontSize="xl">
              TL {level}
            </Text>
          </Box>
        </Flex>
      ))}
    </Flex>
  </Flex>
)

export const SemanticTokens: Story = () => (
  <Flex direction="column" gap={4}>
    <Heading level="h2">Semantic Tokens</Heading>

    <Box>
      <Text fontWeight="bold" mb={2}>
        Builder Backgrounds
      </Text>
      <Flex gap={2}>
        <Box w="120px" h="60px" bg="bg.builder" borderRadius="md" p={2}>
          <Text fontSize="xs" color="white">
            bg.builder
          </Text>
        </Box>
        <Box w="120px" h="60px" bg="bg.builder.mech" borderRadius="md" p={2}>
          <Text fontSize="xs" color="white">
            bg.builder.mech
          </Text>
        </Box>
        <Box w="120px" h="60px" bg="bg.builder.pilot" borderRadius="md" p={2}>
          <Text fontSize="xs" color="white">
            bg.builder.pilot
          </Text>
        </Box>
        <Box w="120px" h="60px" bg="bg.builder.crawler" borderRadius="md" p={2}>
          <Text fontSize="xs" color="white">
            bg.builder.crawler
          </Text>
        </Box>
      </Flex>
    </Box>

    <Box>
      <Text fontWeight="bold" mb={2}>
        Brand Colors
      </Text>
      <Flex gap={2}>
        <Box w="120px" h="60px" bg="brand.solid" borderRadius="md" p={2}>
          <Text fontSize="xs" color="white">
            brand.solid
          </Text>
        </Box>
        <Box w="120px" h="60px" bg="brand.muted" borderRadius="md" p={2}>
          <Text fontSize="xs">brand.muted</Text>
        </Box>
      </Flex>
    </Box>
  </Flex>
)

export const ButtonRecipe: Story = () => (
  <Flex direction="column" gap={4}>
    <Heading level="h2">Button Recipe</Heading>
    <Flex gap={3} flexWrap="wrap">
      <Button bg="su.black" color="su.white">
        Default
      </Button>
      <Button bg="su.orange" color="su.white">
        Orange
      </Button>
      <Button bg="su.green" color="su.white">
        Green
      </Button>
      <Button bg="su.pink" color="su.white">
        Pink
      </Button>
      <Button bg="brand.srd" color="su.white">
        Brand SRD
      </Button>
      <Button bg="su.black" color="su.white" size="sm">
        Small
      </Button>
      <Button bg="su.black" color="su.white" size="lg">
        Large
      </Button>
    </Flex>
  </Flex>
)
