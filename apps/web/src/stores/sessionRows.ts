/**
 * The rows a tab holds belong to its session.
 *
 * The stores hold one account's rows in memory, and the device copy holds them
 * for an offline reload (`deviceCopy.ts`, ADR-058). When the session ends —
 * this tab signed out, or another tab did and the auth layer ended it here
 * too — `AccountReconciler` drops both, so the next account to sign in on this
 * device never sees the last one's.
 */

import { dropCopy } from './deviceCopy'
import { useEncounterStore } from './encounterStore'
import { useEntityStore } from './entityStore'
import { usePatternStore } from './patternStore'
import { forgetVersions } from './serverVersions'

/**
 * Drop this tab's loaded rows and the device copy. The stores stay hydrated
 * and empty, which is what a signed-out read answers, and the adopted versions
 * are forgotten so the next sign-in's `ShelfSync` adopts every row afresh.
 */
export function forgetLoadedRows(): void {
  void dropCopy()
  forgetVersions()
  useEntityStore.setState({
    pilots: [],
    mechs: [],
    crawlers: [],
    npcs: [],
    softLinks: [],
    hydrated: { pilots: true, mechs: true, crawlers: true, npcs: true, softLinks: true },
  })
  usePatternStore.setState({ mechPatterns: [], hydrated: true })
  useEncounterStore.setState({ encounterNpcs: [], hydrated: true })
}
