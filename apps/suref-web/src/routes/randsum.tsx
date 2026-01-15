import { createFileRoute } from '@tanstack/react-router'
import { Box, Container, Flex, Image, Link, VStack, Button } from '@chakra-ui/react'
import { Text } from '../components/base/Text'
import { Heading } from '../components/base/Heading'

export const Route = createFileRoute('/randsum')({
  component: RandsumPage,
})

function RandsumPage() {
  return (
    <Flex direction="column" w="full" h="full" flex="1" justifyContent="center">
      <Container
        maxW="6xl"
        h="full"
        display="flex"
        flexDirection="column"
        justifyContent="center"
        alignItems="stretch"
        px={6}
        bg="transparent"
        borderWidth={0}
        shadow="none"
        m={0}
        mx="auto"
        py={8}
      >
        <VStack gap={8} align="stretch" bg="transparent">
          <Box textAlign="center">
            <Heading level="h1" mb={4}>
              RANDSUM.dev Discord Bot
            </Heading>
            <Text fontSize="lg" color="fg.default" fontWeight="semibold">
              With Special Sauce for Salvage Union!
            </Text>
          </Box>

          {/* Main content: Image and description */}
          <Flex
            direction={{ base: 'column', lg: 'row' }}
            gap={8}
            align={{ base: 'center', lg: 'flex-start' }}
          >
            {/* Left side: Image */}
            <Box flex="1" maxW={{ base: '100%', lg: '50%' }}>
              <Box
                borderWidth="2px"
                borderColor="border.default"
                borderRadius="md"
                overflow="hidden"
              >
                <Image
                  src="/robo-su-example.png"
                  alt="Randsum Robo Discord Bot example"
                  w="full"
                  h="auto"
                  objectFit="contain"
                  loading="lazy"
                  decoding="async"
                />
              </Box>
            </Box>

            {/* Right side: Description */}
            <Box flex="1" maxW={{ base: '100%', lg: '50%' }}>
              <VStack gap={6} align="stretch">
                <Box>
                  <Text
                    fontSize="md"
                    color="fg.default"
                    lineHeight="relaxed"
                    fontWeight="semibold"
                    mb={4}
                  >
                    Roll on all Salvage Union Roll Tables with contextual results tailored to your
                    Salvage Union sessions with the RANDSUM.dev Discord bot!
                  </Text>
                  <Text fontSize="md" color="fg.default" lineHeight="relaxed">
                    Visit{' '}
                    <Link
                      href="https://randsum.dev/packages/robo/"
                      target="_blank"
                      rel="noopener noreferrer"
                      textDecoration="underline"
                      _hover={{ color: 'brand.srd' }}
                      fontWeight="semibold"
                    >
                      randsum.dev
                    </Link>{' '}
                    to learn more about the RANDSUM.dev ecosystem of tools!
                  </Text>
                </Box>

                {/* Add to Discord Button */}
                <Box>
                  <Link
                    href="https://discord.com/oauth2/authorize?client_id=1290434147159904276&permissions=274877906944&scope=bot%20applications.commands"
                    target="_blank"
                    rel="noopener noreferrer"
                    textDecoration="none"
                    display="inline-block"
                    w="full"
                  >
                    <Button
                      w="full"
                      bg="su.discordBlurple"
                      color="su.white"
                      fontWeight="bold"
                      fontSize="lg"
                      py={6}
                      px={8}
                      borderRadius="md"
                      borderWidth="3px"
                      borderColor="border.default"
                      _hover={{ bg: 'su.discordBlurpleHover' }}
                      transition="background-color 0.2s"
                    >
                      + Add RANDSUM.dev to Discord
                    </Button>
                  </Link>
                </Box>
              </VStack>
            </Box>
          </Flex>
        </VStack>
      </Container>
    </Flex>
  )
}
