import { Box, Flex, Image, Link, Text } from '@chakra-ui/react'

export default function Footer() {
  return (
    <Box
      as="footer"
      bg="bg.canvas"
      borderTopWidth="1px"
      borderTopColor="border.default"
      py={3}
      shadow={{ base: 'none', lg: 'sm' }}
    >
      <Flex
        maxW="7xl"
        mx="auto"
        color="fg.default"
        fontSize="xs"
        alignItems="center"
        justifyContent="center"
        gap={4}
        flexDirection="row"
        flexWrap="wrap"
      >
        <Box textAlign="center" flex="1" minW="0">
          <Text>
            Salvage Union is copyrighted by{' '}
            <Link
              href="https://leyline.press"
              target="_blank"
              rel="noopener noreferrer"
              textDecoration="underline"
              color="fg.default"
              _hover={{ color: 'brand.srd' }}
            >
              Leyline Press
            </Link>
            .
          </Text>
          <Text>
            Salvage Union and the "Powered by Salvage" logo are used with permission of Leyline
            Press, under the{' '}
            <Link
              href="https://leyline.press/pages/salvage-union-open-game-licence-1-0b"
              target="_blank"
              rel="noopener noreferrer"
              textDecoration="underline"
              color="fg.default"
              _hover={{ color: 'brand.srd' }}
            >
              Salvage Union Open Game Licence 1.0b
            </Link>
            .
          </Text>
          <Text>
            All Workshop Manual Images are used with special permission from{' '}
            <Link
              href="https://leyline.press"
              target="_blank"
              rel="noopener noreferrer"
              textDecoration="underline"
              color="fg.default"
              _hover={{ color: 'brand.srd' }}
            >
              Leyline Press
            </Link>
            .
          </Text>
        </Box>
        <Box
          p={2}
          borderRadius="md"
          display="inline-block"
          bg="var(--footer-logo-bg)"
          flexShrink={0}
        >
          <Image src="/Powered_by_Salvage_Black.webp" alt="Powered by Salvage" h="12" w="auto" />
        </Box>
      </Flex>
    </Box>
  )
}
