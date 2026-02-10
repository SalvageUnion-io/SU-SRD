import { Box, Flex, VStack, Button } from '@chakra-ui/react'
import { Link } from '@tanstack/react-router'
import { Heading } from 'suref-react'
import { Text } from 'suref-react'

export function NotFoundDisplay() {
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
                <Link to="/dashboard">Go to Dashboard</Link>
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
                <Link to="/dashboard/pilots">My Pilots</Link>
              </Button>
            </VStack>
          </Box>
        </VStack>
      </Box>
    </Flex>
  )
}
