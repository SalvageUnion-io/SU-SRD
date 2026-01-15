import { Box, Link, VStack } from '@chakra-ui/react'
import { Text } from '../base/Text'

export function LiveSheetBanner() {
  return (
    <VStack gap={1} alignItems="center">
      <Box textAlign="center">
        <Text variant="pseudoheader" fontSize="sm">
          {'< These are still under construction! Not all rules are supported yet. >'}
        </Text>
      </Box>
      <Box textAlign="center">
        <Text variant="pseudoheader" fontSize="sm">
          {'< To Request a specific feature, reach out on '}
          <Link
            href="https://github.com/alxjrvs/SU-SRD"
            target="_blank"
            rel="noopener noreferrer"
            textDecoration="underline"
            _hover={{ color: 'brand.srd' }}
            color="su.white"
          >
            Github
          </Link>
          {'! >'}
        </Text>
      </Box>
    </VStack>
  )
}
