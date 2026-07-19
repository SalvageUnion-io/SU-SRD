/**
 * Blank entities render on their live sheets (wizard-refresh Phase 1,
 * Open Question 4): a blank pilot (classRef ''), blank mech (chassisRef '')
 * and blank crawler (TL only, no type) — exactly what createBlank persists —
 * must render /sheet/{kind}/{id} without crashing.
 *
 * Follows the sheet-crawler-composition.test.tsx pattern: Sheet with an
 * injected EntityLookup + SoftLinkStore, no router provider needed.
 */

import { afterEach, beforeAll, describe, expect, test } from 'bun:test'
import { cleanup, render, screen } from '@testing-library/react'
import { SalvageUnionReference } from 'salvageunion-reference'

import type { Crawler } from '../../../lib/schemas/crawler'
import type { Mech } from '../../../lib/schemas/mech'
import type { Pilot } from '../../../lib/schemas/pilot'
import { seedDefaultCrawlerBays } from '../../../lib/wizard/crawlerFormState'
import type { SoftLinkStore } from '../../wiring/useSoftLinks'
import { Sheet } from '../Sheet'
import type { EntityLookup } from '../Sheet'

beforeAll(async () => {
  // The live sheets resolve refs across many schemas; load the full dataset
  // like the app's GameDataReady gate does.
  await SalvageUnionReference.preload('all')
})

afterEach(() => {
  cleanup()
})

const now = new Date().toISOString()

const blankPilot: Pilot = {
  id: 'blank-pilot-1',
  schemaVersion: 1,
  name: 'Rook Halden',
  callsign: 'Static',
  classRef: '',
  abilities: [],
  equipment: [],
  motto: '',
  keepsake: '',
  appearance: '',
  background: '',
  conditions: [],
  currentHP: 10,
  currentAP: 5,
  createdAt: now,
  updatedAt: now,
}

const blankMech: Mech = {
  id: 'blank-mech-1',
  schemaVersion: 1,
  name: 'Unnamed Hulk',
  chassisRef: '',
  systems: [],
  modules: [],
  cargoLots: [],
  conditions: [],
  currentHeat: 0,
  createdAt: now,
  updatedAt: now,
}

const blankCrawler: Crawler = {
  id: 'blank-crawler-1',
  schemaVersion: 1,
  name: 'The Long Haul',
  techLevel: 'tech-1',
  systems: [],
  crawlerBays: seedDefaultCrawlerBays(),
  scrapPool: {},
  upgradePool: 0,
  currentSP: 20,
  createdAt: now,
  updatedAt: now,
}

const lookup: EntityLookup = {
  get: (type, id) => {
    if (type === 'pilot' && id === blankPilot.id) return blankPilot
    if (type === 'mech' && id === blankMech.id) return blankMech
    if (type === 'crawler' && id === blankCrawler.id) return blankCrawler
    return null
  },
} as EntityLookup

const noLinks: SoftLinkStore = { softLinks: [] } as unknown as SoftLinkStore

describe('blank entities render on their live sheets', () => {
  test('blank pilot (classRef "") renders without crashing', () => {
    render(<Sheet kind="pilot" id={blankPilot.id} entityStore={lookup} softLinkStore={noLinks} />)
    expect(screen.getAllByText('Rook Halden').length).toBeGreaterThan(0)
  })

  test('blank mech (chassisRef "") renders without crashing', () => {
    render(<Sheet kind="mech" id={blankMech.id} entityStore={lookup} softLinkStore={noLinks} />)
    expect(screen.getAllByText('Unnamed Hulk').length).toBeGreaterThan(0)
  })

  test('blank crawler (TL 1, no type) renders without crashing', () => {
    render(
      <Sheet kind="crawler" id={blankCrawler.id} entityStore={lookup} softLinkStore={noLinks} />
    )
    expect(screen.getAllByText('The Long Haul').length).toBeGreaterThan(0)
  })
})
