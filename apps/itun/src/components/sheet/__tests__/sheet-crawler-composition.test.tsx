/**
 * Sheet — crawler-wired composition mode rendering (#244).
 *
 * Covers three composition scenarios NOT yet asserted by Sheet.test.tsx or
 * sheet-smoke.test.tsx in terms of sub-sheet content visibility:
 *
 *   A. pilot + crawler (no mech) — both PilotSheet and CrawlerSheet render
 *   B. full wired: mech + pilot + crawler — all three sub-sheets render
 *   C. crawler + pilots (wired) — CrawlerSheet renders with wired pilot names
 *
 * These complement the rail-empty tests in Sheet.test.tsx (which verify
 * stand-ins appear/disappear) by asserting entity content is actually rendered.
 *
 * Conventions: toBeTruthy() not toBeInTheDocument(), no mock.module().
 */

import { beforeAll, describe, expect, test } from 'bun:test'
import { render, screen } from '@testing-library/react'
import {
  crawlerFixture,
  mechFixture,
  pilotFixture,
  softLinkFixture,
} from '../../__tests__/fixtures'
import { hydrateStores } from '../../__tests__/hydrateStores'
import { makeEntityLookupMock, makeSoftLinkStoreMock } from '../../__tests__/mockEntityStore'
import { Sheet } from '../Sheet'

beforeAll(hydrateStores)

// ---------------------------------------------------------------------------
// Shared fake entities
// ---------------------------------------------------------------------------

const fakePilot = pilotFixture({
  id: 'pilot-comp-1',
  name: 'Desta Oryn',
  callsign: 'Delta',
  classRef: 'mechanic',
  motto: 'One wrench.',
  keepsake: 'Nothing.',
  appearance: 'Scarred.',
})

const fakePilot2 = pilotFixture({
  id: 'pilot-comp-2',
  name: 'Hann Vex',
  callsign: 'Echo',
  motto: 'Move fast.',
  keepsake: 'A token.',
  appearance: 'Wiry.',
})

const fakeMech = mechFixture({
  id: 'mech-comp-1',
  name: 'Dust Hammer',
  chassisRef: 'iron-mongrel',
})

const fakeCrawler = crawlerFixture({
  id: 'crawler-comp-1',
  name: 'The Hive',
  techLevel: 'tech-2',
})

// ---------------------------------------------------------------------------
// Scenario A — pilot + crawler (no mech)
// kind=pilot with pilot-to-crawler outgoing link, no mech-to-pilot link
// ---------------------------------------------------------------------------

describe('Sheet — pilot+crawler wired composition (no mech)', () => {
  const pilotToCrawlerLink = softLinkFixture('pilot-to-crawler', 'pilot-comp-1', 'crawler-comp-1')

  test('PilotSheet content (pilot name) is visible', () => {
    render(
      <Sheet
        kind="pilot"
        id="pilot-comp-1"
        entityStore={makeEntityLookupMock([fakePilot, fakeCrawler])}
        softLinkStore={makeSoftLinkStoreMock([pilotToCrawlerLink])}
      />
    )
    expect(screen.getAllByText(/Desta Oryn/).length).toBeGreaterThan(0)
  })

  test('CrawlerSheet content (crawler name) is visible', () => {
    render(
      <Sheet
        kind="pilot"
        id="pilot-comp-1"
        entityStore={makeEntityLookupMock([fakePilot, fakeCrawler])}
        softLinkStore={makeSoftLinkStoreMock([pilotToCrawlerLink])}
      />
    )
    expect(screen.getAllByText(/The Hive/).length).toBeGreaterThan(0)
  })

  test('mech RailEmpty renders (no mech is wired)', () => {
    render(
      <Sheet
        kind="pilot"
        id="pilot-comp-1"
        entityStore={makeEntityLookupMock([fakePilot, fakeCrawler])}
        softLinkStore={makeSoftLinkStoreMock([pilotToCrawlerLink])}
      />
    )
    expect(screen.getByText(/No mech assigned/)).toBeTruthy()
  })
})

// ---------------------------------------------------------------------------
// Scenario B — full wired: mech + pilot + crawler
// kind=pilot with both mech-to-pilot incoming AND pilot-to-crawler outgoing
// ---------------------------------------------------------------------------

describe('Sheet — full wired (mech+pilot+crawler)', () => {
  const mechToPilotLink = softLinkFixture('mech-to-pilot', 'mech-comp-1', 'pilot-comp-1')
  const pilotToCrawlerLink = softLinkFixture('pilot-to-crawler', 'pilot-comp-1', 'crawler-comp-1')

  test('PilotSheet content (pilot name) is visible', () => {
    render(
      <Sheet
        kind="pilot"
        id="pilot-comp-1"
        entityStore={makeEntityLookupMock([fakePilot, fakeMech, fakeCrawler])}
        softLinkStore={makeSoftLinkStoreMock([mechToPilotLink, pilotToCrawlerLink])}
      />
    )
    expect(screen.getAllByText(/Desta Oryn/).length).toBeGreaterThan(0)
  })

  test('MechSheet content (mech name) is visible', () => {
    render(
      <Sheet
        kind="pilot"
        id="pilot-comp-1"
        entityStore={makeEntityLookupMock([fakePilot, fakeMech, fakeCrawler])}
        softLinkStore={makeSoftLinkStoreMock([mechToPilotLink, pilotToCrawlerLink])}
      />
    )
    expect(screen.getAllByText(/Dust Hammer/).length).toBeGreaterThan(0)
  })

  test('CrawlerSheet content (crawler name) is visible', () => {
    render(
      <Sheet
        kind="pilot"
        id="pilot-comp-1"
        entityStore={makeEntityLookupMock([fakePilot, fakeMech, fakeCrawler])}
        softLinkStore={makeSoftLinkStoreMock([mechToPilotLink, pilotToCrawlerLink])}
      />
    )
    expect(screen.getAllByText(/The Hive/).length).toBeGreaterThan(0)
  })

  test('no stand-ins rendered (all three entities are wired)', () => {
    render(
      <Sheet
        kind="pilot"
        id="pilot-comp-1"
        entityStore={makeEntityLookupMock([fakePilot, fakeMech, fakeCrawler])}
        softLinkStore={makeSoftLinkStoreMock([mechToPilotLink, pilotToCrawlerLink])}
      />
    )
    expect(screen.queryByText(/No mech assigned/)).toBeNull()
    expect(screen.queryByText(/No pilot assigned/)).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// Scenario C — crawler + pilots (wired)
// kind=crawler with pilot-to-crawler incoming links from multiple pilots
// ---------------------------------------------------------------------------

describe('Sheet — crawler+pilots wired composition', () => {
  const pilot1ToCrawlerLink = softLinkFixture('pilot-to-crawler', 'pilot-comp-1', 'crawler-comp-1')
  const pilot2ToCrawlerLink = softLinkFixture('pilot-to-crawler', 'pilot-comp-2', 'crawler-comp-1')

  test('CrawlerSheet content (crawler name) is visible', () => {
    render(
      <Sheet
        kind="crawler"
        id="crawler-comp-1"
        entityStore={makeEntityLookupMock([fakeCrawler, fakePilot, fakePilot2])}
        softLinkStore={makeSoftLinkStoreMock([pilot1ToCrawlerLink, pilot2ToCrawlerLink])}
      />
    )
    expect(screen.getAllByText(/The Hive/).length).toBeGreaterThan(0)
  })

  test('a wired pilot appears as a linked row', () => {
    render(
      <Sheet
        kind="crawler"
        id="crawler-comp-1"
        entityStore={makeEntityLookupMock([fakeCrawler, fakePilot, fakePilot2])}
        softLinkStore={makeSoftLinkStoreMock([pilot1ToCrawlerLink, pilot2ToCrawlerLink])}
      />
    )
    expect(screen.getAllByText(/Desta Oryn/).length).toBeGreaterThan(0)
  })

  test('EVERY wired pilot renders — a crawler is a home for a crew, not a lead', () => {
    render(
      <Sheet
        kind="crawler"
        id="crawler-comp-1"
        entityStore={makeEntityLookupMock([fakeCrawler, fakePilot, fakePilot2])}
        softLinkStore={makeSoftLinkStoreMock([pilot1ToCrawlerLink, pilot2ToCrawlerLink])}
      />
    )
    // A crawler has no single "lead pilot": both wired pilots get a row.
    expect(screen.getAllByText(/Hann Vex/).length).toBeGreaterThan(0)
  })

  test('lead-pilot RailEmpty not rendered when pilots are wired', () => {
    render(
      <Sheet
        kind="crawler"
        id="crawler-comp-1"
        entityStore={makeEntityLookupMock([fakeCrawler, fakePilot, fakePilot2])}
        softLinkStore={makeSoftLinkStoreMock([pilot1ToCrawlerLink, pilot2ToCrawlerLink])}
      />
    )
    expect(screen.queryByText(/No lead pilot set/)).toBeNull()
  })
})
