/**
 * makeEntityStoreMock — builds a REAL Zustand store typed exactly as the
 * production `useEntityStore` hook, so tests inject it with no
 * through-`unknown` double-cast.
 *
 * The store's generic members (`list`/`get`/`create`/`update`) are accepted
 * here with their EntityType-union instantiations, so a plain test mock like
 * `mock((_type, id) => (id === mech.id ? mech : null))` assigns structurally.
 * Each override is bridged back onto the generic signature with (at most) a
 * single correlated-union assertion — the same pattern the production store
 * itself uses (microsoft/TypeScript#30581).
 */

import { create } from 'zustand'

import type { Crawler } from '../../lib/schemas/crawler'
import type { EntityRef } from '../../lib/schemas/entity'
import type { Mech } from '../../lib/schemas/mech'
import type { Pilot } from '../../lib/schemas/pilot'
import type { SoftLink } from '../../lib/schemas/softLink'
import type { useEntityStore } from '../../stores/entityStore'
import type { ChangeMeta, EntityState } from '../../stores/entityStore'
import type { CreateInput, EntityForType, EntityType } from '../../stores/types'
import type { EntityLookup } from '../sheet/composition'
import type { SoftLinkStore } from '../wiring/useSoftLinks'

type AnyEntity = Pilot | Mech | Crawler | SoftLink

/**
 * Overridable state members, with the production generics widened to their
 * EntityType-union instantiations so concrete mock functions assign without
 * any cast at the test call site.
 */
export type EntityStoreMockOverrides = {
  pilots?: Pilot[]
  mechs?: Mech[]
  crawlers?: Crawler[]
  softLinks?: SoftLink[]
  hydrated?: EntityState['hydrated']
  hydrate?: (type: EntityType) => Promise<void>
  rehydrate?: (type: EntityType) => Promise<void>
  list?: (type: EntityType) => AnyEntity[]
  get?: (type: EntityType, id: string) => AnyEntity | null
  create?: (type: EntityType, input: CreateInput<EntityType>) => Promise<AnyEntity | null>
  update?: (
    type: EntityType,
    id: string,
    patch: Partial<EntityForType<EntityType>>,
    meta?: ChangeMeta
  ) => Promise<AnyEntity | null>
  updateCrawlerBay?: EntityState['updateCrawlerBay']
  delete?: (type: EntityType, id: string) => Promise<void>
  transfer?: EntityState['transfer']
}

const KEY = {
  pilot: 'pilots',
  mech: 'mechs',
  crawler: 'crawlers',
  softLink: 'softLinks',
} as const

/**
 * Builds the injectable entityStore test double. Seeded arrays back the
 * default `list`/`get`; `create`/`update` default to throwing so a test that
 * forgets to stub a write path fails loudly instead of silently no-opping.
 */
export function makeEntityStoreMock(
  overrides: EntityStoreMockOverrides = {}
): typeof useEntityStore {
  const arrays = {
    pilots: overrides.pilots ?? [],
    mechs: overrides.mechs ?? [],
    crawlers: overrides.crawlers ?? [],
    softLinks: overrides.softLinks ?? [],
  }

  const listOf = <T extends EntityType>(type: T): EntityForType<T>[] =>
    // Single correlated-union assertion — same as the production store.
    arrays[KEY[type]] as EntityForType<T>[]

  const state: EntityState = {
    ...arrays,
    hydrated: overrides.hydrated ?? { pilots: true, mechs: true, crawlers: true, softLinks: true },
    hydrate: overrides.hydrate ?? (async () => {}),
    rehydrate: overrides.rehydrate ?? (async () => {}),
    list: overrides.list ? (overrides.list as EntityState['list']) : listOf,
    get: overrides.get
      ? (overrides.get as EntityState['get'])
      : <T extends EntityType>(type: T, id: string): EntityForType<T> | null =>
          listOf(type).find((e) => e.id === id) ?? null,
    create: overrides.create
      ? (overrides.create as EntityState['create'])
      : async () => {
          throw new Error('entityStore mock: create not stubbed')
        },
    update: overrides.update
      ? (overrides.update as EntityState['update'])
      : async () => {
          throw new Error('entityStore mock: update not stubbed')
        },
    updateCrawlerBay:
      overrides.updateCrawlerBay ??
      (async () => {
        throw new Error('entityStore mock: updateCrawlerBay not stubbed')
      }),
    delete: overrides.delete ?? (async () => {}),
    transfer:
      overrides.transfer ??
      (async () => {
        throw new Error('entityStore mock: transfer not stubbed')
      }),
  }

  return create<EntityState>(() => state)
}

/**
 * EntityLookup for fixture arrays: matches by id alone (fixture ids are
 * unique across types, mirroring the previous untyped test stubs).
 */
export function makeEntityLookupMock(
  entities: ReadonlyArray<Pilot | Mech | Crawler>
): EntityLookup {
  return {
    get: <T extends EntityRef['type']>(_type: T, id: string): EntityForType<T> | null =>
      // Single correlated-union assertion — same pattern as the production store.
      (entities.find((e) => e.id === id) ?? null) as EntityForType<T> | null,
  }
}

/**
 * SoftLinkStore stub for render-only tests: `create` is not expected to run —
 * it fails the test loudly if a code path ever starts creating links.
 */
export function makeSoftLinkStoreMock(links: SoftLink[] = []): SoftLinkStore {
  return {
    softLinks: links,
    create: async (): Promise<SoftLink> => {
      throw new Error('SoftLinkStore mock: create not expected in this test')
    },
    delete: async () => undefined,
  }
}
