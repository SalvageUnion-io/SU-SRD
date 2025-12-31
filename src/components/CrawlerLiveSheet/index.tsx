import { useNavigate } from '@tanstack/react-router'
import { Box, Button, Flex, Grid, Tabs, VStack } from '@chakra-ui/react'
import { Text } from '../base/Text'
import { useIsMutating, useQuery } from '@tanstack/react-query'
import { CrawlerHeaderInputs } from './CrawlerHeaderInputs'
import { CrawlerAbilities } from './CrawlerAbilities'
import { CrawlerResourceSteppers } from './CrawlerResourceSteppers'
import { BayCard } from '../shared/BayCard'
import { StorageCargoBay } from './StorageCargoBay'
import { Notes } from '../shared/Notes'
import { Card } from '../shared/Card'
import { LiveSheetLayout } from '../shared/LiveSheetLayout'
import { LiveSheetControlBar } from '../shared/LiveSheetControlBar'
import { CrawlerNPC } from './CrawlerNPC'
import { DeleteEntity } from '../shared/DeleteEntity'
import { PilotMechCell } from '../Dashboard/PilotMechCell'
import { useUpdateCrawler, useHydratedCrawler, useDeleteCrawler } from '../../hooks/crawler'
import { useInitializeCrawlerBays } from '../../hooks/crawler/useInitializeCrawlerBays'
import { useIsEditable } from '../../hooks/useIsEditable'
import { LiveSheetStateGuard } from '../shared/LiveSheetStateGuard'
import { fetchCrawlerPilots, fetchPilotsMechs } from '../../lib/api'

interface CrawlerLiveSheetProps {
  id: string
  flat?: boolean
}

export default function CrawlerLiveSheet({ id, flat = false }: CrawlerLiveSheetProps) {
  const navigate = useNavigate()

  const { crawler, loading, error, selectedCrawlerType, isLocal, bays } = useHydratedCrawler(id)
  const deleteCrawler = useDeleteCrawler()
  const updateCrawler = useUpdateCrawler()

  useInitializeCrawlerBays(id, bays.length > 0)

  const { data: pilotsWithMechs = [] } = useQuery({
    queryKey: ['crawler-pilots-mechs', id],
    queryFn: async () => {
      const pilots = await fetchCrawlerPilots(id)
      if (pilots.length === 0) return []

      const pilotIds = pilots.map((p) => p.id)
      const mechs = await fetchPilotsMechs(pilotIds)

      return pilots.map((pilot) => ({
        pilot,
        mech: mechs.find((m) => m.pilot_id === pilot.id) || null,
      }))
    },
    enabled: !!id && !isLocal,
  })

  const mutatingCount = useIsMutating()
  const hasPendingChanges = mutatingCount > 0

  const isEditable = useIsEditable(crawler, isLocal)

  const storageBay = bays.find((bay) => bay.ref.name === 'Storage Bay')
  const regularBays = bays.filter((bay) => bay.ref.name !== 'Storage Bay')

  const commonContent = (
    <>
      {!isLocal && (
        <LiveSheetControlBar
          bg="su.pink"
          hasPendingChanges={hasPendingChanges}
          active={crawler?.active ?? false}
          onActiveChange={(active) => updateCrawler.mutate({ id, updates: { active } })}
          isPrivate={crawler?.private ?? true}
          onPrivateChange={(isPrivate) =>
            updateCrawler.mutate({ id, updates: { private: isPrivate } })
          }
          disabled={!isEditable}
        />
      )}
      <Flex gap={6} w="full" alignItems="stretch">
        <CrawlerHeaderInputs disabled={!isEditable} incomplete={!selectedCrawlerType} id={id} />

        <CrawlerResourceSteppers
          id={id}
          disabled={!isEditable}
          incomplete={!selectedCrawlerType}
          flashingTLs={[]}
        />
      </Flex>
    </>
  )

  const downgradeButton = (
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
      _hover={{ bg: 'gray.600' }}
      onClick={() => {
        const currentTL = crawler?.tech_level || 1
        if (currentTL > 1) {
          updateCrawler.mutate({ id, updates: { tech_level: currentTL - 1 } })
        }
      }}
      disabled={!selectedCrawlerType || !isEditable || (crawler?.tech_level || 1) <= 1}
    >
      DOWNGRADE TECH LEVEL
    </Button>
  )

  if (flat) {
    return (
      <LiveSheetStateGuard entityType="Crawler" entity={crawler} loading={loading} error={error}>
        <>
          {commonContent}
          <VStack gap={6} alignItems="stretch" mt={6}>
            {/* Abilities Section */}
            <Box>
              <Text variant="pseudoheader" fontSize="lg" mb={4}>
                Abilities
              </Text>
              <Flex gap={6} w="full">
                <CrawlerAbilities id={id} disabled={!selectedCrawlerType} readOnly={!isEditable} />
                <CrawlerNPC id={id} disabled={!selectedCrawlerType} readOnly={!isEditable} />
              </Flex>
            </Box>

            {/* Bays Section */}
            {regularBays.length > 0 && (
              <Box>
                <Text variant="pseudoheader" fontSize="lg" mb={4}>
                  Bays
                </Text>
                <Grid gridTemplateColumns="repeat(3, 1fr)" gap={4}>
                  {regularBays.map((bay) => (
                    <BayCard
                      key={bay.id}
                      mode="entity"
                      bay={bay}
                      disabled={!selectedCrawlerType}
                      readOnly={!isEditable}
                    />
                  ))}
                </Grid>
              </Box>
            )}

            {/* Storage Bay Section */}
            <Box>
              <Text variant="pseudoheader" fontSize="lg" mb={4}>
                Storage Bay
              </Text>
              <VStack gap="0" alignItems="stretch">
                {storageBay && (
                  <BayCard
                    mode="entity"
                    bay={storageBay}
                    disabled={!selectedCrawlerType}
                    readOnly={!isEditable}
                  />
                )}

                <StorageCargoBay id={id} disabled={!selectedCrawlerType} readOnly={!isEditable} />
              </VStack>
            </Box>

            {/* Notes Section */}
            <Box>
              <Text variant="pseudoheader" fontSize="lg" mb={4}>
                Notes
              </Text>
              <Notes
                notes={crawler?.notes ?? ''}
                onChange={(value) => updateCrawler.mutate({ id, updates: { notes: value } })}
                backgroundColor="bg.builder.crawler"
                placeholder="Add notes about your crawler..."
                disabled={!isEditable}
                incomplete={!selectedCrawlerType}
              />
            </Box>

            {/* Pilots & Mechs Section */}
            {!isLocal && (
              <Box>
                <Text variant="pseudoheader" fontSize="lg" mb={4}>
                  Pilots & Mechs
                </Text>
                <VStack gap={4} align="stretch">
                  {pilotsWithMechs.length === 0 ? (
                    <Card bg="su.grey">
                      <Text variant="pseudoheader" textAlign="center">
                        No pilots assigned to this crawler
                      </Text>
                    </Card>
                  ) : (
                    <Grid gridTemplateColumns="repeat(2, 1fr)" gap={4}>
                      {pilotsWithMechs.map(({ pilot }) => (
                        <PilotMechCell key={pilot.id} crawlerId={id} memberId={pilot.user_id} />
                      ))}
                    </Grid>
                  )}
                </VStack>
              </Box>
            )}
          </VStack>

          {downgradeButton}

          {!isLocal && (
            <DeleteEntity
              entityName="Crawler"
              onConfirmDelete={async () => {
                await deleteCrawler.mutateAsync(id)
                navigate({ to: '/dashboard/crawlers' })
              }}
              disabled={!isEditable || !id || updateCrawler.isPending}
            />
          )}
        </>
      </LiveSheetStateGuard>
    )
  }

  return (
    <LiveSheetStateGuard entityType="Crawler" entity={crawler} loading={loading} error={error}>
      <LiveSheetLayout>
        {commonContent}

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
              <CrawlerAbilities id={id} disabled={!selectedCrawlerType} readOnly={!isEditable} />
              <CrawlerNPC id={id} disabled={!selectedCrawlerType} readOnly={!isEditable} />
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
                    readOnly={!isEditable}
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
                  readOnly={!isEditable}
                />
              )}

              <StorageCargoBay id={id} disabled={!selectedCrawlerType} readOnly={!isEditable} />
            </VStack>
          </Tabs.Content>

          <Tabs.Content value="notes">
            <Box mt={6}>
              <Notes
                notes={crawler?.notes ?? ''}
                onChange={(value) => updateCrawler.mutate({ id, updates: { notes: value } })}
                backgroundColor="bg.builder.crawler"
                placeholder="Add notes about your crawler..."
                disabled={!isEditable}
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
                      <PilotMechCell key={pilot.id} crawlerId={id} memberId={pilot.user_id} />
                    ))}
                  </Grid>
                )}
              </VStack>
            </Tabs.Content>
          )}
        </Tabs.Root>

        {downgradeButton}

        {!isLocal && (
          <DeleteEntity
            entityName="Crawler"
            onConfirmDelete={async () => {
              await deleteCrawler.mutateAsync(id)
              navigate({ to: '/dashboard/crawlers' })
            }}
            disabled={!isEditable || !id || updateCrawler.isPending}
          />
        )}
      </LiveSheetLayout>
    </LiveSheetStateGuard>
  )
}
