/**
 * hydrateStores — load the real entity and pattern stores before rendering.
 *
 * A component that reads either store through its hooks starts a lazy,
 * fire-and-forget hydration on first render. Through fake-indexeddb that
 * resolves after any act() scope has closed, and React reports every mounted
 * subscriber it re-renders as "not wrapped in act(...)" — which the preload
 * turns into a test failure. Hydrated first, those reads start nothing.
 *
 * It reloads even a hydrated store: the reload queues behind any load an
 * earlier file left in flight (fake-indexeddb answers requests in order), so
 * that load lands here rather than inside this file's first test.
 *
 * Use it in `beforeAll` (or `beforeEach`, when the file resets the stores),
 * even when the test injects mock stores: the hooks deeper in the tree still
 * read the real ones.
 */

import { useEntityStore } from '../../stores/entityStore'
import { usePatternStore } from '../../stores/patternStore'

export async function hydrateStores(): Promise<void> {
  const entities = useEntityStore.getState()
  await Promise.all([
    entities.rehydrate('pilot'),
    entities.rehydrate('mech'),
    entities.rehydrate('crawler'),
    entities.rehydrate('softLink'),
    usePatternStore.getState().rehydrate(),
  ])
}
