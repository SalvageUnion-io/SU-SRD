/**
 * deviceCopyRestore — an offline boot's one read of the device copy (ADR-053).
 *
 * Runs when the app boots Disconnected with a session on the device and no
 * served answer this load (`AccountReconciler`). The copy is applied through
 * `shelfApply`, exactly as a served answer would be, so the stores hold the
 * rows the server last sent, read-only: Disconnected refuses every write. When
 * the connection returns `ShelfSync` mounts and the server's answer wins over
 * whatever the copy said.
 *
 * Once per load: a session that drops mid-load keeps the rows it holds, and
 * a restore that has run has nothing more to add.
 */

import { beginRestore, hasServed, readCopy, settleRestore } from './deviceCopy'
import { useEncounterStore } from './encounterStore'
import { useEntityStore } from './entityStore'
import { usePatternStore } from './patternStore'
import { applyMine, applyWiring } from './shelfApply'

let ran = false

/** Restore the copy into the stores, once per load; resolves when settled. */
export async function restoreDeviceCopy(): Promise<void> {
  if (ran || hasServed()) {
    settleRestore()
    return
  }
  ran = true
  beginRestore()
  // A served answer arriving mid-restore is newer: stop and let it win.
  const superseded = hasServed
  try {
    const copy = await readCopy()
    if (copy === null || superseded()) return
    if (copy.mine !== null) await applyMine(copy.mine, superseded)
    if (copy.wiring !== null) await applyWiring(copy.wiring, new Map(), superseded)
    if (superseded()) return
    useEntityStore.getState().markArrived(['pilot', 'mech', 'crawler', 'npc', 'softLink'])
    usePatternStore.getState().markArrived()
    useEncounterStore.getState().markArrived()
  } finally {
    settleRestore()
  }
}

/** A unit test's reset. */
export function resetDeviceCopyRestore(): void {
  ran = false
}
