import type { Crawler } from 'cantina-domain/schemas/crawler'
import type { Mech } from 'cantina-domain/schemas/mech'
import type { Pilot } from 'cantina-domain/schemas/pilot'
import type { ChangeMeta } from '../../../stores/entityStore'
import { makeEntityStoreMock } from '../../__tests__/mockEntityStore'
import type { PlayStore } from '../play.model'

/** One `store.update` Play sent. */
export type StoreCall = { type: string; id: string; patch: Record<string, unknown> }

/**
 * A `PlayStore` over `entities` that records every update: the patch in
 * `calls`, its Change Log tag in `metas`. It writes nothing back, so a read
 * after a write still sees the entity as given.
 */
export function stubStore(...entities: (Pilot | Mech | Crawler)[]): {
  store: PlayStore
  calls: StoreCall[]
  metas: ChangeMeta[]
} {
  const calls: StoreCall[] = []
  const metas: ChangeMeta[] = []
  const store: PlayStore = makeEntityStoreMock({
    get: (_type, id) => entities.find((e) => e.id === id) ?? null,
    update: async (type, id, patch, meta) => {
      calls.push({ type, id, patch })
      if (meta) metas.push(meta)
      return entities.find((e) => e.id === id) ?? null
    },
  }).getState()
  return { store, calls, metas }
}
