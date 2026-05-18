import { crawlerKeys } from './useCrawlers'
import { useRealtimeSubscription } from './useRealtimeSubscription'

/**
 * Subscribes to live changes on the active downtime record and its crawler.
 * Invalidates TanStack Query cache on any change, triggering a refetch.
 *
 * Side-effect-only hook — no return value.
 */
export function useDowntimeRealtime(crawlerId: string, recordId: string | undefined): void {
  useRealtimeSubscription('downtime_records', recordId ? `id=eq.${recordId}` : undefined, [
    crawlerKeys.activeDowntime(crawlerId),
  ])

  useRealtimeSubscription('crawlers', `id=eq.${crawlerId}`, [crawlerKeys.detail(crawlerId)])
}
