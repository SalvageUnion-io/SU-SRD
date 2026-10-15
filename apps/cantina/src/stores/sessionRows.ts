/**
 * The rows a tab holds belong to its session.
 *
 * The stores hold one account's rows in memory and nothing on the device. When
 * the session ends — this tab signed out, or another tab did and the auth
 * layer ended it here too — `AccountReconciler` drops them, so the next
 * account to sign in on this tab never sees the last one's.
 */

import { useEncounterStore } from './encounterStore'
import { useEntityStore } from './entityStore'
import { usePatternStore } from './patternStore'
import { forgetVersions } from './serverVersions'

/**
 * Drop this tab's loaded rows. The stores stay hydrated and empty, which is
 * what a signed-out read answers, and the adopted versions are forgotten so the
 * next sign-in's `ShelfSync` adopts every row afresh.
 */
export function forgetLoadedRows(): void {
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
