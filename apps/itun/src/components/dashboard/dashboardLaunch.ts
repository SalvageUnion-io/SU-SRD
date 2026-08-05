/**
 * dashboardLaunch — the Dashboard launch chooser's entity-creation helpers
 * (plan §8, §10.5). Split out of DashboardChooser.tsx to keep that module
 * component-only (Biome Fast-Refresh rule) and to make the create paths
 * unit-testable behind an injectable store.
 *
 * These realize the two deferred chooser options:
 *   - a STAND-IN mech instantiated from a saved MechPattern (same write path as
 *     InstantiateFromPattern — seed live stats, fresh cargo-lot ids), and
 *   - a DEFAULT base crawler of a chosen Tech Level (minimal valid record with
 *     the official pre-printed base bays and full derived SP).
 *
 * Both persist a real record via entityStore.create (reversible — the player
 * can delete it), never a silent mutation of an existing entity, so they stay
 * on the right side of the ADR-007 boundary.
 */

import { resolveChassisRef } from 'salvageunion-reference/rules'
import { crawlerMaxSP } from '../../lib/rules/derivedStats'
import type { MechPattern } from '../../lib/schemas/pattern'
import { seedDefaultCrawlerBays } from '../../lib/wizard/crawlerFormState'
import type { CreateInput, EntityForType } from '../../stores/types'

/**
 * Minimal create surface for the launch helpers — injectable for tests.
 * Declared with the entity store's own generic vocabulary (CreateInput /
 * EntityForType) so the live store satisfies it structurally, no cast needed.
 */
export type LaunchStore = {
  create: <T extends 'mech' | 'crawler'>(
    type: T,
    input: CreateInput<T>
  ) => Promise<EntityForType<T>>
}

/** The Tech Levels a default base crawler can be spun up at. */
export const DEFAULT_CRAWLER_TLS = [1, 2, 3, 4, 5, 6] as const

/** Selection-token encoders so the chooser's radio list can mix kinds. */
export const patternToken = (id: string) => `pattern:${id}`
export const tlCrawlerToken = (tl: number) => `tl:${tl}`
export const parseSelToken = (token: string): { kind: 'pattern' | 'tl' | 'id'; value: string } => {
  if (token.startsWith('pattern:')) return { kind: 'pattern', value: token.slice(8) }
  if (token.startsWith('tl:')) return { kind: 'tl', value: token.slice(3) }
  return { kind: 'id', value: token }
}

/**
 * Instantiate a fresh Mech from a saved pattern — mirrors InstantiateFromPattern:
 * copy chassis/systems/modules, fresh cargo-lot ids, seed full SP/EP + Heat 0.
 * Returns the new mech's id.
 */
export async function instantiateMechFromPattern(
  store: LaunchStore,
  pattern: MechPattern
): Promise<string> {
  const chassis = resolveChassisRef(pattern.chassisRef)
  const mech = await store.create('mech', {
    schemaVersion: 1,
    name: `${pattern.name} (stand-in)`,
    chassisRef: pattern.chassisRef,
    systems: [...pattern.systems],
    modules: [...pattern.modules],
    cargoLots: pattern.cargoLots.map((lot) => ({ ...lot, id: crypto.randomUUID() })),
    conditions: [],
    currentSP: chassis?.structurePoints,
    currentEP: chassis?.energyPoints,
    currentHeat: 0,
  })
  return mech.id
}

/**
 * Create a default base crawler of the given Tech Level: a minimal valid record
 * (schemaVersion, name, techLevel, no systems) seeded with the official
 * pre-printed base bays and full derived SP. Returns the new crawler's id.
 */
export async function createBaseCrawler(store: LaunchStore, tl: number): Promise<string> {
  const techLevel = String(tl)
  const maxSP = crawlerMaxSP({ techLevel: `tech-${tl}` })
  const crawler = await store.create('crawler', {
    schemaVersion: 1,
    name: `Base Crawler (TL ${tl})`,
    techLevel,
    systems: [],
    crawlerBays: seedDefaultCrawlerBays(),
    ...(typeof maxSP === 'number' ? { currentSP: maxSP } : {}),
  })
  return crawler.id
}
