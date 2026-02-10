import { useParams } from '@tanstack/react-router'
import { Flex, Text } from '@chakra-ui/react'
import CrawlerLiveSheet from '../CrawlerLiveSheet'

export function CrawlerEdit() {
  const params = useParams({ from: '/dashboard/crawlers/$id' })
  const id = params.id

  if (!id) {
    return (
      <Flex align="center" justify="center" minH="100vh">
        <Text fontSize="xl" color="red.600">
          Error: No crawler ID provided
        </Text>
      </Flex>
    )
  }

  return <CrawlerLiveSheet id={id} />
}
