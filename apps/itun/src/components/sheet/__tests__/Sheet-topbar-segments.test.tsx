/**
 * Plan 4.8 integration surface — top-bar actions + mobile segment switch.
 *
 *   - NO sheet has a global top-bar Edit toggle (redesign: unified edit
 *     language — editing is per-section; each Identity panel owns its own
 *     Edit button).
 *   - The segmented Pilot/Mech/Crawler switch (design §3.7) renders only on
 *     wired compositions: one segment per present counterpart, the viewed
 *     kind marked active (aria-current, rust fill), the others linking to
 *     their wired counterpart's sheet.
 *
 * Rendered without a RouterProvider — AppLink degrades to plain anchors, so
 * hrefs are asserted directly.
 */

import { beforeAll, describe, expect, test } from 'bun:test'
import { render, screen } from '@testing-library/react'
import { buttonVariants } from 'component-lib'
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

const fakePilot = pilotFixture({
  id: 'pilot-1',
  name: 'Yara Voss',
  callsign: 'Ghost',
  motto: 'Waste not.',
  keepsake: 'A bent coin.',
  appearance: 'Tall, weathered.',
})

const fakeMech = mechFixture({
  id: 'mech-1',
  name: 'Iron Fist',
  chassisRef: 'iron-mongrel',
})

const fakeCrawler = crawlerFixture({
  id: 'crawler-1',
  name: 'Iron Tortoise',
  techLevel: 'tech-2',
})

const mechToPilot = softLinkFixture('mech-to-pilot', 'mech-1', 'pilot-1')
const pilotToCrawler = softLinkFixture('pilot-to-crawler', 'pilot-1', 'crawler-1')

// ---------------------------------------------------------------------------
// Top-bar Edit action
// ---------------------------------------------------------------------------

describe('Sheet — top-bar Edit action', () => {
  test('pilot sheet has NO Edit toggle — fields are click-to-edit', () => {
    render(
      <Sheet
        kind="pilot"
        id="pilot-1"
        entityStore={makeEntityLookupMock([fakePilot])}
        softLinkStore={makeSoftLinkStoreMock([])}
      />
    )
    // Unified edit language: no global build-edit mode on the pilot sheet, and
    // no per-section one either — fields are edited by clicking the field.
    expect(screen.queryByRole('button', { name: /edit this pilot/i })).toBeNull()
    expect(screen.queryByRole('button', { name: /edit identity/i })).toBeNull()
  })

  test('identity fields are click-to-edit with no toggle to unlock first', () => {
    render(
      <Sheet
        kind="pilot"
        id="pilot-1"
        entityStore={makeEntityLookupMock([fakePilot])}
        softLinkStore={makeSoftLinkStoreMock([])}
      />
    )
    // No gate: the field is its own affordance from the first render. (It used
    // to take a section "Edit identity" toggle to reveal these.)
    expect(screen.getByRole('button', { name: /edit callsign/i })).toBeTruthy()
    // Class is picker-backed: its affordance opens the shared picker modal, so
    // its accessible name matches the visible 'Change' word (WCAG 2.5.3).
    expect(screen.getByRole('button', { name: /change class/i })).toBeTruthy()
  })

  test('mech sheet has NO Edit toggle — fields are click-to-edit', () => {
    render(
      <Sheet
        kind="mech"
        id="mech-1"
        entityStore={makeEntityLookupMock([fakeMech])}
        softLinkStore={makeSoftLinkStoreMock([])}
      />
    )
    expect(screen.queryByRole('button', { name: /edit this mech/i })).toBeNull()
    // No per-section toggle either — fields are edited by clicking the field.
    expect(screen.queryByRole('button', { name: /edit identity/i })).toBeNull()
  })

  test('crawler sheet has NO Edit toggle — fields are click-to-edit', () => {
    render(
      <Sheet
        kind="crawler"
        id="crawler-1"
        entityStore={makeEntityLookupMock([fakeCrawler])}
        softLinkStore={makeSoftLinkStoreMock([])}
      />
    )
    expect(screen.queryByRole('button', { name: /edit this crawler/i })).toBeNull()
    // No per-section toggle either — fields are edited by clicking the field.
    expect(screen.queryByRole('button', { name: /edit identity/i })).toBeNull()
  })

  test('readOnly hides Edit (and Share)', () => {
    render(
      <Sheet
        kind="pilot"
        id="pilot-1"
        entityStore={makeEntityLookupMock([fakePilot])}
        softLinkStore={makeSoftLinkStoreMock([])}
        readOnly
      />
    )
    expect(screen.queryByRole('button', { name: /edit this pilot/i })).toBeNull()
    expect(screen.queryByRole('button', { name: /edit identity/i })).toBeNull()
    expect(screen.queryByRole('button', { name: /share/i })).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// Mobile segment switch (design §3.7)
// ---------------------------------------------------------------------------

describe('Sheet — mobile segment switch', () => {
  test('absent on unwired sheets', () => {
    render(
      <Sheet
        kind="pilot"
        id="pilot-1"
        entityStore={makeEntityLookupMock([fakePilot])}
        softLinkStore={makeSoftLinkStoreMock([])}
      />
    )
    expect(screen.queryByRole('navigation', { name: /wired sheets/i })).toBeNull()
  })

  test('fully wired pilot sheet: active Pilot segment + Mech/Crawler links', () => {
    render(
      <Sheet
        kind="pilot"
        id="pilot-1"
        entityStore={makeEntityLookupMock([fakePilot, fakeMech, fakeCrawler])}
        softLinkStore={makeSoftLinkStoreMock([mechToPilot, pilotToCrawler])}
      />
    )
    const nav = screen.getByRole('navigation', { name: /wired sheets/i })
    expect(nav).toBeTruthy()
    // mobile-only row, stitched into the sticky bar
    expect(nav.className).toContain('sm:hidden')

    // Active segment = the viewed kind: primary (rust) fill, aria-current, not
    // a link.
    //
    // Asserted via `buttonVariants` rather than the `bg-rust` spelling it used
    // to emit. component-lib moved that recipe onto `.su-*` class names in
    // #799, and the spelling was never this test's subject — "the active
    // segment is the PRIMARY variant" is. Asking the recipe keeps that true
    // through the rename and any future one.
    const primaryClass = buttonVariants({ variant: 'primary' })
      .split(' ')
      .find((c) => c.startsWith('su-btn--')) as string
    const active = nav.querySelector('[aria-current="page"]')
    expect(active?.textContent).toBe('Pilot')
    expect(active?.className).toContain(primaryClass)
    expect(active?.tagName).not.toBe('A')

    // The other segments navigate to the wired counterparts' sheets.
    const links = Array.from(nav.querySelectorAll('a')).map((a) => [
      a.textContent,
      a.getAttribute('href'),
    ])
    expect(links).toEqual([
      ['Mech', '/sheet/mech/mech-1'],
      ['Crawler', '/sheet/crawler/crawler-1'],
    ])
  })

  test('wired mech sheet marks Mech active', () => {
    render(
      <Sheet
        kind="mech"
        id="mech-1"
        entityStore={makeEntityLookupMock([fakePilot, fakeMech])}
        softLinkStore={makeSoftLinkStoreMock([mechToPilot])}
      />
    )
    const nav = screen.getByRole('navigation', { name: /wired sheets/i })
    const active = nav.querySelector('[aria-current="page"]')
    expect(active?.textContent).toBe('Mech')
    const links = Array.from(nav.querySelectorAll('a')).map((a) => a.getAttribute('href'))
    expect(links).toEqual(['/sheet/pilot/pilot-1'])
  })
})
