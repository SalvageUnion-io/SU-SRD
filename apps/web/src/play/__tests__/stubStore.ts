import type { Crawler } from 'game-domain/schemas/crawler'
import type { Mech } from 'game-domain/schemas/mech'
import type { Pilot } from 'game-domain/schemas/pilot'
import { makeEntityStoreMock } from '../../components/__tests__/mockEntityStore'
import type { ChangeMeta } from '../../replica/units'
import type { PlayStore } from '../play.model'

/** One `store.update` Play sent. */
export type StoreCall = { type: string; id: string; patch: Record<string, unknown> }

/**
 * A `PlayStore` over `entities` that records every update: the patch in
 * `calls`, its Change Log tag in `metas`; a transfer, each unit's share. It writes nothing back, so a read
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
    // A batch (a craft, r7 D6) records each unit's share as its own call.
    transfer: async (ops, meta) => {
      for (const u of ops.updates ?? []) calls.push({ type: u.type, id: u.id, patch: u.patch })
      metas.push(meta)
    },
  }).getState()
  return { store, calls, metas }
}
