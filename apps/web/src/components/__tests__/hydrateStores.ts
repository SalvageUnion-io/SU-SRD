/**
 * hydrateStores — settle the real entity and pattern stores before rendering.
 *
 * A component that reads either store through its hooks starts a lazy
 * hydration on first render if the store is not hydrated yet. It resolves on a
 * later microtask, after any act() scope has closed, and React reports every
 * mounted subscriber it re-renders as "not wrapped in act(...)" — which the
 * preload turns into a test failure. Hydrated first, those reads start nothing.
 *
 * Use it in `beforeAll` (or `beforeEach`, when the file resets the stores),
 * even when the test injects mock stores: the hooks deeper in the tree still
 * read the real ones.
 */

import { usePatterns } from '../../replica/collections'
import { useUnits } from '../../replica/units'

export async function hydrateStores(): Promise<void> {
  const entities = useUnits.getState()
  await Promise.all([
    entities.hydrate('pilot'),
    entities.hydrate('mech'),
    entities.hydrate('crawler'),
    entities.hydrate('npc'),
    entities.hydrate('softLink'),
    usePatterns.getState().hydrate(),
  ])
}
