import { Grid, VStack } from '@chakra-ui/react'
import { Text } from '../../base/Text'
import { PilotActions } from './PilotActions'
import { MechActions } from './MechActions'
import { CrawlerActions } from './CrawlerActions'
import { useUniversalActions } from '../../../hooks/useUniversalActions'

interface ActionsListProps {
  pilotId: string
}

export function ActionsList({ pilotId }: ActionsListProps) {
  const { pilot, mech, crawler, loading, error } = useUniversalActions(pilotId)

  if (loading) {
    return (
      <VStack gap={4} alignItems="stretch">
        <Text>Loading actions...</Text>
      </VStack>
    )
  }

  if (error) {
    return (
      <VStack gap={4} alignItems="stretch">
        <Text color="red.600">Error loading actions: {error}</Text>
      </VStack>
    )
  }

  const hasPilotActions = pilot.length > 0
  const hasMechActions = mech.length > 0
  const hasCrawlerActions = crawler.length > 0

  if (!hasPilotActions && !hasMechActions && !hasCrawlerActions) {
    return (
      <VStack gap={4} alignItems="stretch">
        <Text variant="pseudoheader" textAlign="center">
          No actions available
        </Text>
      </VStack>
    )
  }

  // Split actions into two columns
  const pilotActionsCol1 = pilot.slice(0, Math.ceil(pilot.length / 2))
  const pilotActionsCol2 = pilot.slice(Math.ceil(pilot.length / 2))
  const mechActionsCol1 = mech.slice(0, Math.ceil(mech.length / 2))
  const mechActionsCol2 = mech.slice(Math.ceil(mech.length / 2))
  const crawlerActionsCol1 = crawler.slice(0, Math.ceil(crawler.length / 2))
  const crawlerActionsCol2 = crawler.slice(Math.ceil(crawler.length / 2))

  return (
    <VStack gap={6} alignItems="stretch">
      {hasPilotActions && (
        <VStack gap={3} alignItems="stretch">
          <Text variant="pseudoheader" fontSize="lg">
            PILOT ACTIONS
          </Text>
          <Grid templateColumns={{ base: '1fr', lg: 'repeat(2, 1fr)' }} gap={4}>
            <PilotActions actions={pilotActionsCol1} />
            <PilotActions actions={pilotActionsCol2} />
          </Grid>
        </VStack>
      )}

      {hasMechActions && (
        <VStack gap={3} alignItems="stretch">
          <Text variant="pseudoheader" fontSize="lg">
            ACTIVE MECH ACTIONS
          </Text>
          <Grid templateColumns={{ base: '1fr', lg: 'repeat(2, 1fr)' }} gap={4}>
            <MechActions actions={mechActionsCol1} />
            <MechActions actions={mechActionsCol2} />
          </Grid>
        </VStack>
      )}

      {hasCrawlerActions && (
        <VStack gap={3} alignItems="stretch">
          <Text variant="pseudoheader" fontSize="lg">
            CRAWLER ACTIONS
          </Text>
          <Grid templateColumns={{ base: '1fr', lg: 'repeat(2, 1fr)' }} gap={4}>
            <CrawlerActions actions={crawlerActionsCol1} />
            <CrawlerActions actions={crawlerActionsCol2} />
          </Grid>
        </VStack>
      )}
    </VStack>
  )
}
