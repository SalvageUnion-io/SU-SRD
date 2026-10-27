import type { UnitsStore } from '../../replica/units'
/**
 * makeEntityStoreMock — builds a REAL Zustand store typed exactly as the
 * production `useUnits` hook, so tests inject it with no
 * through-`unknown` double-cast.
 *
 * The store's generic members (`list`/`get`/`create`/`update`) are accepted
 * here with their EntityType-union instantiations, so a plain test mock like
 * `mock((_type, id) => (id === mech.id ? mech : null))` assigns structurally.
 * Each override is bridged back onto the generic signature with (at most) a
 * single correlated-union assertion — the same pattern the production store
 * itself uses (microsoft/TypeScript#30581).
 */

import type { Crawler } from 'game-domain/schemas/crawler'
import type { EntityRef } from 'game-domain/schemas/entity'
import type { Mech } from 'game-domain/schemas/mech'
import type { Npc } from 'game-domain/schemas/npc'
import type { Pilot } from 'game-domain/schemas/pilot'
import type { SoftLink } from 'game-domain/schemas/softLink'
import { create } from 'zustand'
import type { EntityLookup } from '../../build/sheet/composition.model'
import type { SoftLinkStore } from '../../build/wiring/useSoftLinks'
import type { CreateInput, EntityForType, EntityType } from '../../replica/types'
import type { ChangeMeta, UnitsState } from '../../replica/units'

type AnyEntity = Pilot | Mech | Crawler | Npc | SoftLink

/**
 * Overridable state members, with the production generics widened to their
 * EntityType-union instantiations so concrete mock functions assign without
 * any cast at the test call site.
 */
export type EntityStoreMockOverrides = {
  pilots?: Pilot[]
  mechs?: Mech[]
  crawlers?: Crawler[]
  npcs?: Npc[]
  softLinks?: SoftLink[]
  hydrated?: UnitsState['hydrated']
  hydrate?: (type: EntityType) => Promise<void>
  markArrived?: (types: readonly EntityType[]) => void
  list?: (type: EntityType) => AnyEntity[]
  get?: (type: EntityType, id: string) => AnyEntity | null
  create?: (type: EntityType, input: CreateInput<EntityType>) => Promise<AnyEntity | null>
  adopt?: (type: EntityType, record: AnyEntity) => Promise<AnyEntity | null>
  forget?: UnitsState['forget']
  update?: (
    type: EntityType,
    id: string,
    patch: Partial<EntityForType<EntityType>>,
    meta?: ChangeMeta
  ) => Promise<AnyEntity | null>
  updateCrawlerBay?: UnitsState['updateCrawlerBay']
  delete?: (type: EntityType, id: string) => Promise<void>
  transfer?: UnitsState['transfer']
}

const KEY = {
  pilot: 'pilots',
  mech: 'mechs',
  crawler: 'crawlers',
  npc: 'npcs',
  softLink: 'softLinks',
} as const

/**
 * Builds the injectable entityStore test double. Seeded arrays back the
 * default `list`/`get`; `create`/`update` default to throwing so a test that
 * forgets to stub a write path fails loudly instead of silently no-opping.
 */
export function makeEntityStoreMock(overrides: EntityStoreMockOverrides = {}): UnitsStore {
  const arrays = {
    pilots: overrides.pilots ?? [],
    mechs: overrides.mechs ?? [],
    crawlers: overrides.crawlers ?? [],
    npcs: overrides.npcs ?? [],
    softLinks: overrides.softLinks ?? [],
  }

  const listOf = <T extends EntityType>(type: T): EntityForType<T>[] =>
    // Single correlated-union assertion — same as the production store.
    arrays[KEY[type]] as EntityForType<T>[]

  const state: UnitsState = {
    ...arrays,
    hydrated: overrides.hydrated ?? {
      pilots: true,
      mechs: true,
      crawlers: true,
      npcs: true,
      softLinks: true,
    },
    hydrate: overrides.hydrate ?? (async () => {}),
    markArrived: overrides.markArrived ?? (() => {}),
    list: overrides.list ? (overrides.list as UnitsState['list']) : listOf,
    get: overrides.get
      ? (overrides.get as UnitsState['get'])
      : <T extends EntityType>(type: T, id: string): EntityForType<T> | null =>
          listOf(type).find((e) => e.id === id) ?? null,
    create: overrides.create
      ? (overrides.create as UnitsState['create'])
      : async () => {
          throw new Error('entityStore mock: create not stubbed')
        },
    adopt: overrides.adopt
      ? (overrides.adopt as UnitsState['adopt'])
      : async () => {
          throw new Error('entityStore mock: adopt not stubbed')
        },
    forget: overrides.forget ?? (async () => {}),
    update: overrides.update
      ? (overrides.update as UnitsState['update'])
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

  return create<UnitsState>(() => state)
}

type Unit = Pilot | Mech | Crawler

/**
 * The one-unit store most sheet tests want: `entity` seeded under its kind,
 * that kind hydrated (a crawler's NPCs too), and `get`/`list` serving it.
 * Writes resolve to the entity, so a test stubs `update` only to capture it.
 * Pass a getter as `entity` when the test's writes replace the unit. A defined
 * override wins over these defaults; an undefined one keeps the default.
 */
export function makeSingleUnitStore(
  kind: 'pilot' | 'mech' | 'crawler',
  entity: Unit | (() => Unit),
  overrides: EntityStoreMockOverrides = {}
): UnitsStore {
  const current = typeof entity === 'function' ? entity : () => entity
  return makeEntityStoreMock({
    [KEY[kind]]: [current()],
    hydrated: {
      pilots: kind === 'pilot',
      mechs: kind === 'mech',
      crawlers: kind === 'crawler',
      npcs: kind === 'crawler',
      softLinks: false,
    },
    list: () => [current()],
    get: (_type, id) => (id === current().id ? current() : null),
    create: async () => current(),
    update: async () => current(),
    updateCrawlerBay: async () => current() as Crawler,
    ...Object.fromEntries(Object.entries(overrides).filter(([, v]) => v !== undefined)),
  })
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
