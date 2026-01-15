import { createFileRoute, Link } from '@tanstack/react-router'
import { Box, Flex, VStack } from '@chakra-ui/react'
import { Button } from '@chakra-ui/react'
import { Heading } from '../components/base/Heading'
import { Text } from '../components/base/Text'
import { getSchemaCatalog } from 'salvageunion-reference'

const schemaIndexData = getSchemaCatalog()

export const Route = createFileRoute('/404')({
  component: NotFoundPage,
  head: () => ({
    meta: [
      {
        title: '404 - Page Not Found - Salvage Union System Reference Document',
      },
      {
        name: 'description',
        content: 'The page you are looking for could not be found.',
      },
      {
        name: 'robots',
        content: 'noindex, nofollow',
      },
    ],
  }),
  staticData: {
    ssr: true,
    prerender: true,
  },
})

function NotFoundPage() {
  return (
    <Flex alignItems="center" justifyContent="center" minH="80vh" bg="bg.surface" p={4}>
      <Box
        maxW="2xl"
        w="full"
        p={8}
        bg="bg.canvas"
        borderRadius="md"
        shadow="lg"
        borderWidth="2px"
        borderColor="brand.srd"
      >
        <VStack gap={6} alignItems="center">
          <Heading level="h1" fontSize="6xl" fontWeight="bold" color="brand.srd">
            404
          </Heading>
          <Heading
            level="h2"
            fontSize="2xl"
            fontWeight="bold"
            textAlign="center"
            color="fg.default"
          >
            SALVAGE OPERATION FAILED
          </Heading>
          <Text color="fg.default" textAlign="center" fontSize="lg">
            The page you're looking for has been lost to the wastes. It might have been scrapped,
            relocated, or never existed in the first place.
          </Text>

          <Box w="full" mt={4}>
            <Text color="brand.srd" fontWeight="semibold" mb={2}>
              Try one of these instead:
            </Text>
            <VStack gap={2} alignItems="stretch">
              <Button
                asChild
                w="full"
                px={4}
                py={2}
                bg="su.orange"
                color="su.white"
                borderRadius="md"
                _hover={{ bg: 'brand.srd' }}
                fontWeight="medium"
              >
                <Link to="/">Return to Home</Link>
              </Button>
              <Button
                asChild
                w="full"
                px={4}
                py={2}
                bg="su.green"
                color="su.white"
                borderRadius="md"
                _hover={{ bg: 'brand.srd' }}
                fontWeight="medium"
              >
                <Link to="/">Browse Reference Data</Link>
              </Button>
            </VStack>
          </Box>

          <Box w="full" mt={6} pt={6} borderTopWidth="2px" borderTopColor="border.default">
            <Text color="brand.srd" fontWeight="semibold" mb={3} fontSize="sm">
              Popular Schemas:
            </Text>
            <Flex flexWrap="wrap" gap={2}>
              {schemaIndexData.schemas
                .filter((s) => !s.meta)
                .slice(0, 6)
                .map((schema) => (
                  <Button
                    key={schema.id}
                    asChild
                    size="sm"
                    px={3}
                    py={1}
                    bg="bg.surface"
                    color="fg.default"
                    borderRadius="md"
                    _hover={{ bg: 'su.orange', color: 'su.white' }}
                    fontSize="xs"
                  >
                    <Link to="/schema/$schemaId" params={{ schemaId: schema.id }}>
                      {schema.displayName}
                    </Link>
                  </Button>
                ))}
            </Flex>
          </Box>
        </VStack>
      </Box>
    </Flex>
  )
}
