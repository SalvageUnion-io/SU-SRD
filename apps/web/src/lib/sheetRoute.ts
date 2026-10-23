/**
 * The four sheet routes' shared definition — `/pilots/$id`, `/mechs/$id`,
 * `/crawlers/$id`, `/npcs/$id`: the one way to view an entity, at the plural
 * of its kind, as the wizards that make it (`/pilots/new`) and the reference
 * pages (`/chassis/mule/`) are addressed.
 *
 * Only what a route DEFINITION needs lives here (the loader and the title), so
 * the page body stays in each route's lazy chunk (`autoCodeSplitting`,
 * `routes/__tests__/routeExports.test.ts`).
 */
import { PRODUCT } from 'game-domain/product'
import { useEntityStore } from '../stores/entityStore'
import { areaTitle } from './pageTitle'

/**
 * Hydrate ALL entity kinds (not just the viewed one): wired compositions
 * resolve linked entities (rail chips, Hold Load targets) from the other
 * kinds' stores via SoftLinks.
 */
export async function loadSheet(): Promise<void> {
  const store = useEntityStore.getState()
  await Promise.all([
    store.hydrate('pilot'),
    store.hydrate('mech'),
    store.hydrate('crawler'),
    store.hydrate('npc'),
    store.hydrate('softLink'),
  ])
}

/**
 * The generic title. The entity's own name comes from the store in
 * `SheetView`, so the tab follows a rename: a loader reads no player entity.
 */
export function sheetHead() {
  return { meta: [{ title: areaTitle(PRODUCT.build, 'Sheet') }] }
}
