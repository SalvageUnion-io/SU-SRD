import { Box, VStack, HStack } from '@chakra-ui/react'
import { Text } from '../base/Text'
import { Card } from '../shared/Card'
import { SheetSelect } from '../shared/SheetSelect'
import { AddStatButton } from '../shared/AddStatButton'
import { useAvailableCrawlers } from '../../hooks/crawler'
import { useUpdatePilot } from '../../hooks/pilot'
import { useCreateCrawlerForPilot } from '../../hooks/useCrawlerAssignment'
import type { Tables } from '../../types/database-generated.types'
import CrawlerLiveSheet from '../CrawlerLiveSheet'

type PilotRow = Tables<'pilots'>

interface CrawlerTabProps {
  pilot: PilotRow | undefined
  pilotId: string
  isLocal: boolean
  isEditable: boolean
}

export function CrawlerTab({ pilot, pilotId, isLocal, isEditable }: CrawlerTabProps) {
  const { data: availableCrawlers = [], isLoading: loadingCrawlers } = useAvailableCrawlers()
  const { createCrawlerForPilot, isPending: isCreatingCrawler } = useCreateCrawlerForPilot(pilotId)
  const updatePilot = useUpdatePilot()

  const handleCrawlerChange = (crawlerId: string | null) => {
    updatePilot.mutate({
      id: pilotId,
      updates: { crawler_id: crawlerId },
    })
  }

  const unassignedCrawlers = availableCrawlers.filter((c) => c.id !== pilot?.crawler_id)

  return (
    <VStack gap={6} align="stretch" mt={6}>
      {pilot?.crawler_id ? (
        <>
          {!isLocal && isEditable && unassignedCrawlers.length > 0 && (
            <Box>
              <SheetSelect
                label="Change Crawler"
                value={null}
                options={unassignedCrawlers.map((c) => ({ id: c.id, name: c.name }))}
                onChange={handleCrawlerChange}
                placeholder="Select a different crawler..."
                loading={loadingCrawlers}
              />
            </Box>
          )}
          <CrawlerLiveSheet id={pilot.crawler_id} flat />
        </>
      ) : (
        <Card bg="su.grey">
          <VStack gap={4}>
            <Text variant="pseudoheader" textAlign="center">
              No crawler assigned to this pilot
            </Text>
            {!isLocal && isEditable && (
              <HStack gap={4} justify="center">
                <AddStatButton
                  label="Create"
                  bottomLabel="Crawler"
                  onClick={createCrawlerForPilot}
                  disabled={isCreatingCrawler}
                  ariaLabel="Create new crawler for this pilot"
                />
                {availableCrawlers.length > 0 && (
                  <Box w="300px">
                    <SheetSelect
                      label="Or Assign Existing"
                      value={null}
                      options={availableCrawlers.map((c) => ({ id: c.id, name: c.name }))}
                      onChange={handleCrawlerChange}
                      placeholder="Select a crawler..."
                      loading={loadingCrawlers}
                    />
                  </Box>
                )}
              </HStack>
            )}
          </VStack>
        </Card>
      )}
    </VStack>
  )
}
