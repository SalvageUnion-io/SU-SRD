import { useEffect, useState } from 'react'
import { SalvageUnionReference } from 'salvageunion-reference'

/**
 * The full dataset's preload, started at MODULE SCOPE, not on first render.
 *
 * Started inside a component, the fetch would wait for React to boot, mount
 * the provider tree and render down to `GameDataReady`: dead time on the
 * critical path. At module scope it overlaps React's bootstrap and the rest of
 * the entry chunk, as `apps/web/src/lib/gameData.ts` does.
 * `packages/gates/biome/noModuleScopeReferenceCall.grit` exempts `.preload()`
 * and `.isLoaded()` from the no-module-scope-ORM-access rule for this reason.
 *
 * It preloads `'all'` behind ONE gate. A per-route schema list would throw
 * "Schema not loaded" from an unrelated card, because `ReferenceEntityCard`
 * pulls traits and actions inline across schemas (see `GameDataReady`'s doc
 * comment); a non-blocking preload would need every ORM-touching component to
 * tolerate a not-ready state.
 */
export const gameDataPreload: Promise<unknown> = SalvageUnionReference.preload('all').then(() => {
  if (typeof document !== 'undefined') {
    document.body.dataset.gameDataReady = 'true'
  }
})

/**
 * Whether the dataset has loaded — for the controls that live in the bar, which
 * paints above the gate and so cannot suspend on it.
 */
export function useGameDataLoaded(): boolean {
  const [loaded, setLoaded] = useState(() => SalvageUnionReference.isLoaded('chassis'))
  useEffect(() => {
    let live = true
    void gameDataPreload.then(() => {
      if (live) setLoaded(true)
    })
    return () => {
      live = false
    }
  }, [])
  return loaded
}
