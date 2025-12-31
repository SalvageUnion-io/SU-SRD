import { Box, Flex, HStack } from '@chakra-ui/react'
import { Text } from '../base/Text'
import { StatDisplay } from '../StatDisplay'
import { useHydratedCrawler } from '../../hooks/crawler'

interface CrawlerDisplayProps {
  crawlerId: string
}

export function CrawlerDisplay({ crawlerId }: CrawlerDisplayProps) {
  const { crawler, maxSP, selectedCrawlerType } = useHydratedCrawler(crawlerId)

  const currentSP = maxSP - (crawler?.current_damage ?? 0)
  const techLevel = crawler?.tech_level ?? 1

  return (
    <Box
      w="full"
      p={4}
      borderWidth="2px"
      borderColor="border.default"
      borderRadius="md"
      bg="su.pink"
    >
      <Flex
        gap={4}
        direction={{ base: 'column', lg: 'row' }}
        alignItems={{ base: 'flex-start', lg: 'center' }}
        justifyContent="space-between"
      >
        <HStack gap={4} alignItems="center">
          <Text variant="pseudoheader" fontSize="lg">
            {crawler?.name || 'Unnamed Crawler'}
          </Text>
          <Text fontSize="md">|</Text>
          <StatDisplay
            label="tech"
            bottomLabel="Level"
            value={techLevel}
            disabled={!selectedCrawlerType}
          />
        </HStack>

        <HStack gap={4} alignItems="center">
          <Text variant="pseudoheader" fontSize="sm">
            Structure:
          </Text>
          <Text fontSize="md">
            {currentSP}/{maxSP}
          </Text>
        </HStack>
      </Flex>
    </Box>
  )
}
