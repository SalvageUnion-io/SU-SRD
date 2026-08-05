/**
 * Complete, schema-conforming entity fixtures for tests.
 *
 * Each factory fills every required field with an inert default so a test can
 * state only what it cares about (`mechFixture({ id: 'm1', name: 'Rig' })`)
 * and still hand components a real `Mech`/`Pilot`/`Crawler` — no
 * through-`unknown` casts from partial literals.
 */

import type { Crawler } from '../../lib/schemas/crawler'
import type { Mech } from '../../lib/schemas/mech'
import type { Pilot } from '../../lib/schemas/pilot'

/**
 * The one frozen instant every test fixture is stamped with.
 *
 * Exported because plenty of tests hand-build an entity literal rather than
 * calling a factory, and those used to reach for `new Date().toISOString()`.
 * A live clock in a fixture is a needless variable: it makes two entities
 * built microseconds apart differ, it makes snapshot-shaped assertions
 * unstable, and it hides genuine "did this write bump `updatedAt`?" bugs
 * behind a value that was never pinned in the first place. If a test needs a
 * *distinct* timestamp, pass one explicitly via overrides.
 */
export const FIXTURE_NOW = '2026-01-01T00:00:00.000Z'

const NOW = FIXTURE_NOW

export function pilotFixture(overrides: Partial<Pilot> & { id: string }): Pilot {
  return {
    schemaVersion: 1,
    name: 'Fixture Pilot',
    callsign: 'Fixture',
    classRef: 'scavenger',
    abilities: [],
    equipment: [],
    motto: '',
    keepsake: '',
    appearance: '',
    background: '',
    conditions: [],
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  }
}

export function mechFixture(overrides: Partial<Mech> & { id: string }): Mech {
  return {
    schemaVersion: 1,
    name: 'Fixture Mech',
    chassisRef: 'fixture-chassis',
    systems: [],
    modules: [],
    cargoLots: [],
    conditions: [],
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  }
}

export function crawlerFixture(overrides: Partial<Crawler> & { id: string }): Crawler {
  return {
    schemaVersion: 1,
    name: 'Fixture Crawler',
    techLevel: 'tech-1',
    systems: [],
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  }
}
