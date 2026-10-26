/**
 * A count of what the rooms said changed, for the Games reads to fetch again
 * by (`roomCalls.ts`): a room socket's message (`roomSocket.ts`) and this
 * tab's own Games write each add one. Several in a row are one change, told
 * once the burst is over.
 */

let count = 0
let pending: ReturnType<typeof setTimeout> | undefined
const listeners = new Set<() => void>()

/** How long a burst of messages is waited out before the reads go again. */
const SETTLE_MS = 100

/** Something in a room changed: every Games read fetches again, shortly. */
export function noteRoomChange(): void {
  if (pending !== undefined) return
  pending = setTimeout(() => {
    pending = undefined
    count += 1
    for (const listener of listeners) listener()
  }, SETTLE_MS)
}

export function subscribeRoomChanges(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function roomChangeCount(): number {
  return count
}
