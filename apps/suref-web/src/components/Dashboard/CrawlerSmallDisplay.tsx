import { VStack } from '@chakra-ui/react'
import { Text } from '../base/Text'
import { UserEntitySmallDisplay } from './UserEntitySmallDisplay'
import { findCrawlerTechLevel } from 'salvageunion-reference'
import { ValueDisplay } from '../shared/ValueDisplay'
import { useHydratedCrawler, useDeleteCrawler } from '../../hooks/crawler'
import { useCurrentUser } from '../../hooks/useCurrentUser'
import { useQueryClient } from '@tanstack/react-query'
import { crawlersKeys } from '../../hooks/crawler/useCrawlers'
import { fetchEntity } from '../../lib/api/entities'
import type { Tables } from '../../types/database-generated.types'
import { DeleteButton } from '../shared/DeleteButton'

interface CrawlerSmallDisplayProps {
  id: string
}

export function CrawlerSmallDisplay({ id }: CrawlerSmallDisplayProps) {
  const queryClient = useQueryClient()
  const { userId: currentUserId } = useCurrentUser()
  const { crawler, selectedCrawlerType, loading } = useHydratedCrawler(id)
  const deleteCrawler = useDeleteCrawler()
  const typeName = selectedCrawlerType?.ref.name ?? 'Unknown'
  const techLevel = crawler?.tech_level ?? 1
  const name = crawler?.name

  const isOwner = currentUserId === crawler?.user_id
  const ownerName = isOwner ? 'You' : 'Owner'

  const handleMouseEnter = () => {
    queryClient.prefetchQuery({
      queryKey: crawlersKeys.byId(id),
      queryFn: () => fetchEntity<Tables<'crawlers'>>('crawlers', id),
    })
  }

  const techLevelData = techLevel ? findCrawlerTechLevel(techLevel) : null
  const populationMax = techLevelData?.populationMax ?? 0
  const population =
    populationMax > 0
      ? populationMax.toLocaleString()
      : techLevelData?.populationMin
        ? techLevelData.populationMin.toLocaleString()
        : 'Unknown'

  if (loading || !crawler) {
    return (
      <UserEntitySmallDisplay
        label="CRAWLER"
        to="/dashboard/crawlers/$id"
        params={{ id }}
        bgColor="su.pink"
        leftHeader="Loading..."
        rightHeader="..."
      />
    )
  }
  const handleDelete = async () => {
    await deleteCrawler.mutateAsync(id)
  }

  const deleteButton = isOwner ? (
    <DeleteButton
      entityName="Crawler"
      onConfirmDelete={handleDelete}
      disabled={deleteCrawler.isPending}
    />
  ) : undefined

  return (
    <UserEntitySmallDisplay
      label="CRAWLER"
      to="/dashboard/crawlers/$id"
      params={{ id }}
      onMouseEnter={handleMouseEnter}
      bgColor="su.pink"
      leftHeader={name ?? 'New Crawler'}
      detailLabel="Player"
      detailValue={ownerName}
      isInactive={crawler?.active === false}
      deleteButton={deleteButton}
      rightHeader={
        <VStack gap={0} alignItems="flex-end">
          <Text
            variant="pseudoheader"
            fontSize="md"
            color="su.white"
            fontWeight="bold"
            textTransform="uppercase"
          >
            {typeName.toUpperCase()}
          </Text>

          <ValueDisplay label="Population" value={population} compact />
        </VStack>
      }
    />
  )
}
