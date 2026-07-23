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

const NOW = '2026-01-01T00:00:00.000Z'

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
