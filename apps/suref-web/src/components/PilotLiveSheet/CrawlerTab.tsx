import { Box, VStack, HStack } from '@chakra-ui/react'
import { Text } from '../base/Text'
import { Card } from '../shared/Card'
import { SheetSelect } from '../shared/SheetSelect'
import { CrawlerSmallDisplay } from '../Dashboard/CrawlerSmallDisplay'
import { AddStatButton } from '../shared/AddStatButton'
import { useAvailableCrawlers } from '../../hooks/crawler'
import { useCreateCrawler } from '../../hooks/crawler'
import { useUpdatePilot } from '../../hooks/pilot'
import { useCurrentUser } from '../../hooks/useCurrentUser'
import type { Tables } from '../../types/database-generated.types'

type PilotRow = Tables<'pilots'>

interface CrawlerTabProps {
  pilot: PilotRow | undefined
  pilotId: string
  isLocal: boolean
  isEditable: boolean
}

export function CrawlerTab({ pilot, pilotId, isLocal, isEditable }: CrawlerTabProps) {
  const { userId } = useCurrentUser()
  const { data: availableCrawlers = [], isLoading: loadingCrawlers } = useAvailableCrawlers()
  const createCrawler = useCreateCrawler()
  const updatePilot = useUpdatePilot()

  const handleCreateCrawler = async () => {
    if (!userId) return

    const newCrawler = await createCrawler.mutateAsync({
      name: 'New Crawler',
      active: false,
      private: true,
      user_id: userId,
    })

    updatePilot.mutate({
      id: pilotId,
      updates: { crawler_id: newCrawler.id },
    })
  }

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
          <CrawlerSmallDisplay id={pilot.crawler_id} />
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
                  onClick={handleCreateCrawler}
                  disabled={createCrawler.isPending}
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
