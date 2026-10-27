import type { DurableObject } from 'cloudflare:workers'
import type { HomeAddress, UnitHome } from '../rooms/handoff'
import { settleLease } from '../rooms/handoff'

type RoomStorage = ConstructorParameters<typeof DurableObject>[0]['storage']

/** How long an offer may wait on its target before the alarm settles it. */
export const LEASE_SETTLE_MS = 60_000

/**
 * A room's alarm: settle every offer its target (`homeOf`) never answered,
 * so no unit is left leaving, and come back while any offer is still out.
 */
export async function settleStaleOffers(
  home: UnitHome,
  transit: { staleOffers(before: number): { leaseId: string; to: HomeAddress }[] },
  storage: RoomStorage,
  homeOf: (address: HomeAddress) => UnitHome
): Promise<void> {
  const now = Date.now()
  for (const { leaseId, to } of transit.staleOffers(now - LEASE_SETTLE_MS + 1)) {
    try {
      await settleLease(home, homeOf(to), leaseId, now)
    } catch (error) {
      console.error('settling a lease failed', leaseId, error)
    }
  }
  if (transit.staleOffers(Number.MAX_SAFE_INTEGER).length > 0) {
    await storage.setAlarm(now + LEASE_SETTLE_MS)
  }
}
