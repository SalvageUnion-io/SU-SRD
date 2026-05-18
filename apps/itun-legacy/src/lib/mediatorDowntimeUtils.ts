import type { OffloadReceipt } from './tallySalvageUtils'

type PilotLike = { id: string }

/**
 * Computes whether the mediator's Tally Salvage step is complete.
 * Returns true only when all pilots have an entry in offload_receipts.
 */
export function computeMediatorTallySalvageComplete(
  isLoading: boolean,
  pilots: PilotLike[] | null | undefined,
  offloadReceipts: Record<string, OffloadReceipt> | null | undefined
): boolean {
  if (isLoading) return false
  if (!pilots || pilots.length === 0) return false
  if (!offloadReceipts) return false
  return pilots.every((p) => !!offloadReceipts[p.id])
}
