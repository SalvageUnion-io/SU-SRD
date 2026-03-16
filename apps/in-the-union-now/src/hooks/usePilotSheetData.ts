import { useCurrentUser } from './useCurrentUser'
import {
  usePilot,
  usePilotEntityRefs,
  useUpdatePilot,
  useDeletePilot,
  useUpdateEntityRef,
  useDeleteEntityRef,
  useCreateEntityRef,
  pilotKeys,
} from './usePilots'
import {
  useMech,
  useMechEntityRefs,
  useUpdateMech,
  useUpdateMechEntityRef,
  mechKeys,
} from './useMechs'
import { useCrawler, useActiveDowntimeRecord, useUpdateCrawler, crawlerKeys } from './useCrawlers'
import { useSaveStatus } from './useSaveStatus'
import { useRealtimeSubscription } from './useRealtimeSubscription'

/**
 * Handles all data fetching, mutation objects, realtime subscriptions,
 * and save status tracking for the pilot sheet.
 */
export function usePilotSheetData(pilotId: string) {
  const user = useCurrentUser()
  const { data: pilot, isLoading, error } = usePilot(pilotId)
  const { data: pilotRefs } = usePilotEntityRefs(pilotId)
  const updatePilot = useUpdatePilot()
  const updateEntityRef = useUpdateEntityRef()
  const deletePilot = useDeletePilot()

  const { data: mech, isLoading: mechLoading } = useMech(pilot?.mech_id ?? undefined)
  const { data: mechRefs } = useMechEntityRefs(mech?.id)
  const { data: crawler } = useCrawler(pilot?.crawler_id ?? undefined)
  const { data: activeDowntime } = useActiveDowntimeRecord(pilot?.crawler_id ?? undefined)
  const updateMech = useUpdateMech()
  const updateMechEntityRef = useUpdateMechEntityRef()
  const updateCrawlerMutation = useUpdateCrawler()
  const deleteEntityRefMutation = useDeleteEntityRef()
  const createEntityRefMutation = useCreateEntityRef()

  // Realtime: sync pilot, entity refs, mech, and mech entity refs across clients
  useRealtimeSubscription('pilots', `id=eq.${pilotId}`, [pilotKeys.detail(pilotId)])
  useRealtimeSubscription('entity_refs', `parent_id=eq.${pilotId}`, [pilotKeys.entityRefs(pilotId)])
  useRealtimeSubscription('mechs', pilot?.mech_id ? `id=eq.${pilot.mech_id}` : undefined, [
    mechKeys.detail(pilot?.mech_id ?? ''),
  ])
  useRealtimeSubscription('entity_refs', mech ? `parent_id=eq.${mech.id}` : undefined, [
    mechKeys.entityRefs(mech?.id ?? ''),
  ])
  useRealtimeSubscription('crawlers', crawler ? `id=eq.${crawler.id}` : undefined, [
    crawlerKeys.detail(crawler?.id ?? ''),
  ])
  useRealtimeSubscription(
    'downtime_records',
    pilot?.crawler_id ? `crawler_id=eq.${pilot.crawler_id}` : undefined,
    [crawlerKeys.activeDowntime(pilot?.crawler_id ?? '')]
  )

  const pilotSaveStatus = useSaveStatus({
    isSaving:
      updatePilot.isPending ||
      updateEntityRef.isPending ||
      deleteEntityRefMutation.isPending ||
      createEntityRefMutation.isPending ||
      updateMech.isPending ||
      updateMechEntityRef.isPending ||
      updateCrawlerMutation.isPending,
  })

  return {
    user,
    pilot,
    pilotRefs: pilotRefs ?? [],
    isLoading,
    error,
    mech,
    mechRefs: mechRefs ?? [],
    mechLoading,
    crawler,
    activeDowntime: activeDowntime ?? null,
    pilotSaveStatus,
    // Mutation objects (passed to usePilotSheetMutations)
    mutations: {
      updatePilot,
      updateEntityRef,
      deletePilot,
      deleteEntityRefMutation,
      createEntityRefMutation,
      updateMech,
      updateMechEntityRef,
      updateCrawlerMutation,
    },
  }
}

export type PilotSheetData = ReturnType<typeof usePilotSheetData>
