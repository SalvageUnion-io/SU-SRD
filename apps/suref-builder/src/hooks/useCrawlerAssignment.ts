import { useCallback } from 'react'
import { useCreateCrawler } from './crawler'
import { useUpdatePilot } from './pilot'
import { useCurrentUser } from './useCurrentUser'

/**
 * Hook to create a crawler and assign it to a pilot
 *
 * @param pilotId - ID of the pilot to assign the crawler to
 * @returns Object with createCrawlerForPilot function and isPending state
 */
export function useCreateCrawlerForPilot(pilotId: string) {
  const { userId } = useCurrentUser()
  const createCrawler = useCreateCrawler()
  const updatePilot = useUpdatePilot()

  const createCrawlerForPilot = useCallback(async () => {
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
  }, [userId, pilotId, createCrawler, updatePilot])

  return {
    createCrawlerForPilot,
    isPending: createCrawler.isPending || updatePilot.isPending,
  }
}
