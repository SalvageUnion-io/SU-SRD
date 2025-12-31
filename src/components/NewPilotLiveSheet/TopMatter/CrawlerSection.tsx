import { Box, HStack, VStack } from '@chakra-ui/react'
import { useQuery } from '@tanstack/react-query'
import { Text } from '../../base/Text'
import { AddStatButton } from '../../shared/AddStatButton'
import { SheetSelect } from '../../shared/SheetSelect'
import { CrawlerDisplay } from '../../shared/CrawlerDisplay'
import { useAvailableCrawlers } from '../../../hooks/crawler'
import { useUpdatePilot } from '../../../hooks/pilot'
import { useCreateCrawlerForPilot } from '../../../hooks/useCrawlerAssignment'
import { supabase } from '../../../lib/supabase'
import type { Tables } from '../../../types/database-generated.types'

type Pilot = Tables<'pilots'>

interface CrawlerSectionProps {
  pilotId: string
  isEditable: boolean
  isLocal: boolean
}

export function CrawlerSection({ pilotId, isEditable, isLocal }: CrawlerSectionProps) {
  const { data: availableCrawlers = [], isLoading: loadingCrawlers } = useAvailableCrawlers()
  const { createCrawlerForPilot, isPending: isCreatingCrawler } = useCreateCrawlerForPilot(pilotId)
  const updatePilot = useUpdatePilot()

  const { data: pilot } = useQuery({
    queryKey: ['pilot', pilotId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('pilots')
        .select('crawler_id')
        .eq('id', pilotId)
        .single()

      if (error) throw error
      return (data as Pick<Pilot, 'crawler_id'> | null) ?? null
    },
    enabled: !!pilotId,
  })

  const handleCrawlerChange = (crawlerId: string | null) => {
    updatePilot.mutate({
      id: pilotId,
      updates: { crawler_id: crawlerId },
    })
  }

  if (!pilot?.crawler_id) {
    const unassignedCrawlers = availableCrawlers.filter((c) => c.id !== pilot?.crawler_id)

    return (
      <Box
        w="full"
        p={4}
        borderWidth="2px"
        borderColor="border.default"
        borderRadius="md"
        bg="su.grey"
      >
        <VStack gap={4}>
          <Text variant="pseudoheader" textAlign="center">
            No crawler assigned
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
              {unassignedCrawlers.length > 0 && (
                <Box w="300px">
                  <SheetSelect
                    label="Or Assign Existing"
                    value={null}
                    options={unassignedCrawlers.map((c) => ({ id: c.id, name: c.name }))}
                    onChange={handleCrawlerChange}
                    placeholder="Select a crawler..."
                    loading={loadingCrawlers}
                  />
                </Box>
              )}
            </HStack>
          )}
        </VStack>
      </Box>
    )
  }

  return <CrawlerDisplay crawlerId={pilot.crawler_id} />
}
