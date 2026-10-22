/**
 * Empty every player-entity store, as a fresh page load has them.
 *
 * The stores hold rows in memory only, so this is the whole reset: no device
 * cache to clear. Hydration flags go back to false, and the adopted server
 * versions are forgotten. With no `ShelfSync` mounted, `hydrate()` resolves at
 * once (`rowArrival.ts`), so a test seeds through `adopt` (a row the server
 * sent) or a signed-in `create` (`withSignedInBackend()`).
 */

import { useEncounterStore } from '../encounterStore'
import { useEntityStore } from '../entityStore'
import { usePatternStore } from '../patternStore'
import { usePrepStore } from '../prepStore'
import { forgetVersions } from '../serverVersions'

export function resetStores(): void {
  forgetVersions()
  useEntityStore.setState({
    pilots: [],
    mechs: [],
    crawlers: [],
    npcs: [],
    softLinks: [],
    hydrated: { pilots: false, mechs: false, crawlers: false, npcs: false, softLinks: false },
  })
  usePatternStore.setState({ mechPatterns: [], hydrated: false })
  useEncounterStore.setState({ encounterNpcs: [], hydrated: false })
  usePrepStore.setState({ encounters: [], hydrated: false })
}
