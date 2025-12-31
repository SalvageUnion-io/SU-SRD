import { Box, Flex } from '@chakra-ui/react'
import { Heading } from '../base/Heading'
import { Text } from '../base/Text'

export function DashboardContent() {
  return (
    <Box p={8}>
      <Flex align="center" justify="center" minH="60vh">
        <Box textAlign="center">
          <Heading level="h1" mb={4}>
            <Text as="span" fontSize="inherit" fontWeight="bold" textTransform="uppercase">
              SALVAGE UNION
            </Text>{' '}
            <Text
              as="span"
              fontSize="inherit"
              color="brand.srd"
              fontWeight="bold"
              textTransform="uppercase"
            >
              DASHBOARD
            </Text>
          </Heading>
          <Text fontSize="lg" color="brand.srd">
            Use the navigation menu to manage your games, crawlers, pilots, and mechs.
          </Text>
        </Box>
      </Flex>
    </Box>
  )
}
