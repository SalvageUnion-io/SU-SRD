import { Box, Button, Flex, Grid, Tabs, VStack } from '@chakra-ui/react'
import { useIsMutating, useQuery } from '@tanstack/react-query'
import { Text } from '../../base/Text'
import { CrawlerHeaderInputs } from '../../CrawlerLiveSheet/CrawlerHeaderInputs'
import { CrawlerAbilities } from '../../CrawlerLiveSheet/CrawlerAbilities'
import { CrawlerResourceSteppers } from '../../CrawlerLiveSheet/CrawlerResourceSteppers'
import { BayCard } from '../../shared/BayCard'
import { StorageCargoBay } from '../../CrawlerLiveSheet/StorageCargoBay'
import { Notes } from '../../shared/Notes'
import { Card } from '../../shared/Card'
import { LiveSheetControlBar } from '../../shared/LiveSheetControlBar'
import { CrawlerNPC } from '../../CrawlerLiveSheet/CrawlerNPC'
import { DeleteEntity } from '../../shared/DeleteEntity'
import { PilotMechCell } from '../../Dashboard/PilotMechCell'
import { useUpdateCrawler, useHydratedCrawler, useDeleteCrawler } from '../../../hooks/crawler'
import { useInitializeCrawlerBays } from '../../../hooks/crawler/useInitializeCrawlerBays'
import { useCurrentUser } from '../../../hooks/useCurrentUser'
import { isOwner } from '../../../lib/permissions'
import { fetchCrawlerPilots, fetchPilotsMechs } from '../../../lib/api'

interface CrawlerLiveSheetContentProps {
  crawlerId: string
  isLocal: boolean
}

export function CrawlerLiveSheetContent({ crawlerId, isLocal }: CrawlerLiveSheetContentProps) {
  const { crawler, loading, error, selectedCrawlerType, bays } = useHydratedCrawler(crawlerId)
  const deleteCrawler = useDeleteCrawler()
  const updateCrawler = useUpdateCrawler()

  useInitializeCrawlerBays(crawlerId, bays.length > 0)

  const { data: pilotsWithMechs = [] } = useQuery({
    queryKey: ['crawler-pilots-mechs', crawlerId],
    queryFn: async () => {
      const pilots = await fetchCrawlerPilots(crawlerId)
      if (pilots.length === 0) return []

      const pilotIds = pilots.map((p) => p.id)
      const mechs = await fetchPilotsMechs(pilotIds)

      return pilots.map((pilot) => ({
        pilot,
        mech: mechs.find((m) => m.pilot_id === pilot.id) || null,
      }))
    },
    enabled: !!crawlerId && !isLocal,
  })

  const mutatingCount = useIsMutating()
  const hasPendingChanges = mutatingCount > 0

  const { userId } = useCurrentUser()

  const isCrawlerEditable = isLocal || (crawler ? isOwner(crawler.user_id, userId) : false)

  if (loading) {
    return (
      <Box p={4} mt={6}>
        <Text>Loading crawler...</Text>
      </Box>
    )
  }

  if (error) {
    return (
      <Box p={4} mt={6}>
        <Text color="red.500">Error loading crawler: {error}</Text>
      </Box>
    )
  }

  if (!crawler) {
    return (
      <Box p={4} mt={6}>
        <Text>Crawler not found</Text>
      </Box>
    )
  }

  const storageBay = bays.find((bay) => bay.ref.name === 'Storage Bay')
  const regularBays = bays.filter((bay) => bay.ref.name !== 'Storage Bay')

  return (
    <>
      {!isLocal && (
        <LiveSheetControlBar
          bg="su.pink"
          hasPendingChanges={hasPendingChanges}
          active={crawler?.active ?? false}
          onActiveChange={(active) => updateCrawler.mutate({ id: crawlerId, updates: { active } })}
          isPrivate={crawler?.private ?? true}
          onPrivateChange={(isPrivate) =>
            updateCrawler.mutate({ id: crawlerId, updates: { private: isPrivate } })
          }
          disabled={!isCrawlerEditable}
        />
      )}
      <Flex gap={6} w="full" alignItems="stretch" mt={6}>
        <CrawlerHeaderInputs
          disabled={!isCrawlerEditable}
          incomplete={!selectedCrawlerType}
          id={crawlerId}
        />

        <CrawlerResourceSteppers
          id={crawlerId}
          disabled={!isCrawlerEditable}
          incomplete={!selectedCrawlerType}
          flashingTLs={[]}
        />
      </Flex>

      <Tabs.Root defaultValue="abilities">
        <Tabs.List borderColor="border.default">
          <Tabs.Trigger value="abilities" color="fg.default">
            Abilities
          </Tabs.Trigger>
          <Tabs.Trigger value="bays" color="fg.default">
            Bays
          </Tabs.Trigger>
          <Tabs.Trigger value="storage" color="fg.default">
            Storage Bay
          </Tabs.Trigger>
          <Tabs.Trigger value="notes" color="fg.default">
            Notes
          </Tabs.Trigger>
          <Box flex="1" />
          {!isLocal && (
            <Tabs.Trigger value="pilots" color="fg.default">
              Pilots & Mechs
            </Tabs.Trigger>
          )}
        </Tabs.List>

        <Tabs.Content value="abilities">
          <Flex gap={6} w="full" mt={6}>
            <CrawlerAbilities
              id={crawlerId}
              disabled={!selectedCrawlerType}
              readOnly={!isCrawlerEditable}
            />
            <CrawlerNPC
              id={crawlerId}
              disabled={!selectedCrawlerType}
              readOnly={!isCrawlerEditable}
            />
          </Flex>
        </Tabs.Content>

        <Tabs.Content value="bays">
          {regularBays.length > 0 && (
            <Grid gridTemplateColumns="repeat(3, 1fr)" gap={4} mt={6}>
              {regularBays.map((bay) => (
                <BayCard
                  key={bay.id}
                  mode="entity"
                  bay={bay}
                  disabled={!selectedCrawlerType}
                  readOnly={!isCrawlerEditable}
                />
              ))}
            </Grid>
          )}
        </Tabs.Content>

        <Tabs.Content value="storage">
          <VStack gap="0" alignItems="stretch" mt={6}>
            {storageBay && (
              <BayCard
                mode="entity"
                bay={storageBay}
                disabled={!selectedCrawlerType}
                readOnly={!isCrawlerEditable}
              />
            )}

            <StorageCargoBay
              id={crawlerId}
              disabled={!selectedCrawlerType}
              readOnly={!isCrawlerEditable}
            />
          </VStack>
        </Tabs.Content>

        <Tabs.Content value="notes">
          <Box mt={6}>
            <Notes
              notes={crawler?.notes ?? ''}
              onChange={(value) =>
                updateCrawler.mutate({ id: crawlerId, updates: { notes: value } })
              }
              backgroundColor="bg.builder.crawler"
              placeholder="Add notes about your crawler..."
              disabled={!isCrawlerEditable}
              incomplete={!selectedCrawlerType}
            />
          </Box>
        </Tabs.Content>

        {!isLocal && (
          <Tabs.Content value="pilots">
            <VStack gap={4} align="stretch" mt={6}>
              {pilotsWithMechs.length === 0 ? (
                <Card bg="su.grey">
                  <Text variant="pseudoheader" textAlign="center">
                    No pilots assigned to this crawler
                  </Text>
                </Card>
              ) : (
                <Grid gridTemplateColumns="repeat(2, 1fr)" gap={4}>
                  {pilotsWithMechs.map(({ pilot }) => (
                    <PilotMechCell key={pilot.id} crawlerId={crawlerId} memberId={pilot.user_id} />
                  ))}
                </Grid>
              )}
            </VStack>
          </Tabs.Content>
        )}
      </Tabs.Root>

      <Button
        w="full"
        bg="gray.500"
        color="white"
        borderWidth="3px"
        borderColor="su.black"
        borderRadius="md"
        fontSize="lg"
        fontWeight="bold"
        py={6}
        mt={6}
        _hover={{ bg: 'gray.600' }}
        onClick={() => {
          const currentTL = crawler?.tech_level || 1
          if (currentTL > 1) {
            updateCrawler.mutate({ id: crawlerId, updates: { tech_level: currentTL - 1 } })
          }
        }}
        disabled={!selectedCrawlerType || !isCrawlerEditable || (crawler?.tech_level || 1) <= 1}
      >
        DOWNGRADE TECH LEVEL
      </Button>

      {!isLocal && (
        <DeleteEntity
          entityName="Crawler"
          onConfirmDelete={() =>
            deleteCrawler.mutate(crawlerId, {
              onSuccess: () => {
                // Don't navigate, just refresh the tab
                window.location.reload()
              },
            })
          }
          disabled={!isCrawlerEditable || !crawlerId || updateCrawler.isPending}
        />
      )}
    </>
  )
}
