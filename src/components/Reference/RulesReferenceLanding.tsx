import { Box, Flex, Link } from '@chakra-ui/react'
import { Text } from '../base/Text'

export function RulesReferenceLanding() {
  return (
    <Flex flexDirection="column" bg="bg.landing" h="full" w="full">
      <Flex flex="1" alignItems="center" justifyContent="center" w="full">
        <Box
          display="flex"
          flexDirection="column"
          alignItems="center"
          justifyContent="center"
          shadow="lg"
          gap={2}
          m="auto"
          bg="su.white"
          p={4}
          borderRadius="md"
        >
          <Text
            as="span"
            variant="pseudoheader"
            fontSize="2xl"
            textAlign="center"
            display="inline-block"
            alignSelf="center"
          >
            Salvage Union
          </Text>
          <Text
            as="span"
            fontSize="2xl"
            color="brand.srd"
            fontWeight="medium"
            bg="transparent"
            textAlign="center"
          >
            System Reference Document
          </Text>
          <Text fontSize="sm" color="brand.srd" textAlign="center">
            An SRD for the{' '}
            <Link
              href="https://leyline.press/collections/salvage-union"
              target="_blank"
              rel="noopener noreferrer"
              color="brand.srd"
              textDecoration="underline"
              _hover={{ color: 'su.orange' }}
            >
              Salvage Union
            </Link>{' '}
            TTRPG
          </Text>
        </Box>
      </Flex>
    </Flex>
  )
}
