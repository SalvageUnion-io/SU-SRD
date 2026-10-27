/**
 * Tests for Sheet.tsx — composition mode rendering.
 *
 * Uses dep-injection (no mock.module()) to supply fake entity stores and
 * softLink snapshots. All four composition modes + stand-in cases are covered.
 *
 * Uses toBeTruthy() not toBeInTheDocument() (Wave 4 workaround).
 */

import { beforeAll, describe, expect, test } from 'bun:test'
import { render, screen, within } from '@testing-library/react'
import type { Crawler } from 'game-domain/schemas/crawler'
import type { Mech } from 'game-domain/schemas/mech'
import type { Pilot } from 'game-domain/schemas/pilot'
import type { SoftLink } from 'game-domain/schemas/softLink'
import { hydrateStores } from '../../../components/__tests__/hydrateStores'
import {
  makeEntityLookupMock,
  makeSoftLinkStoreMock,
} from '../../../components/__tests__/mockEntityStore'
import { Sheet } from '../Sheet'
import { fakeCrawler, fakeMech, fakePilot, mechToPilot, pilotToCrawler } from './sheetFixtures'

beforeAll(hydrateStores)

const ENTITY = { pilot: fakePilot, mech: fakeMech, crawler: fakeCrawler }
type Kind = keyof typeof ENTITY

/** The sheet of `kind`'s fixture, over `others` and the links among them. */
function renderSheet(
  kind: Kind,
  { others = [], links = [], readOnly = false } = {} as {
    others?: Array<Pilot | Mech | Crawler>
    links?: SoftLink[]
    readOnly?: boolean
  }
) {
  return render(
    <Sheet
      kind={kind}
      id={ENTITY[kind].id}
      readOnly={readOnly}
      entityStore={makeEntityLookupMock([ENTITY[kind], ...others])}
      softLinkStore={makeSoftLinkStoreMock(links)}
    />
  )
}

/** Field edit states: a "Edit …" role=button only where the sheet can write. */
const editButtons = () =>
  screen
    .queryAllByRole('button')
    .filter((el) => (el.getAttribute('aria-label') ?? '').startsWith('Edit '))

// ---------------------------------------------------------------------------
// Unwired: each kind alone
// ---------------------------------------------------------------------------

describe('Sheet — one unit, no links', () => {
  // Each sheet prints its name, and an unresolved ref (class, system) as its slug.
  test.each([
    ['pilot', /Yara Voss/, /scavenger/i],
    ['mech', 'Iron Fist', 'heavy-blaster'],
    ['crawler', 'Iron Tortoise', null],
  ] as const)('the %s sheet renders its name', (kind, name, ref) => {
    renderSheet(kind)
    expect(screen.getAllByText(name).length).toBeGreaterThan(0)
    if (ref) expect(screen.getAllByText(ref).length).toBeGreaterThan(0)
  })

  test('a mech with no pilot offers its Assign control (R5), not a role stamp', () => {
    renderSheet('mech')
    expect(screen.getByRole('button', { name: 'Assign pilot to mech' })).toBeTruthy()
    expect(screen.queryByText(/Yara Voss/)).toBeNull()
  })

  test('the Pilots slot renders empty when no pilots are wired', () => {
    renderSheet('crawler')
    // The slot is "Pilots" now, not a single lead.
    expect(screen.getByRole('button', { name: /add crew/i })).toBeTruthy()
  })

  test("crawler tech level is the band's TL chip, not identity's", () => {
    renderSheet('crawler')
    // Tech Level is the chapter band's `TL | n` chip, ahead of its type, and
    // nowhere in the body.
    const band = screen.getByRole('heading', { level: 1 }).closest('.su-chapter-band__row')
    expect(within(band as HTMLElement).getByText('TL')).toBeTruthy()
    const identity = screen.getByRole('region', { name: 'Crawler identity' })
    expect(within(identity).queryByText('TL')).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// wired mode: mech + pilot link
// ---------------------------------------------------------------------------

describe('Sheet — wired (mech WITH pilot link)', () => {
  test('renders both units, and no Assign pilot control', () => {
    renderSheet('mech', { others: [fakePilot], links: [mechToPilot] })
    // Pilot name — PilotSheet h2 also includes callsign, use partial match
    expect(screen.getAllByText(/Yara Voss/).length).toBeGreaterThan(0)
    // Mech name — in the hero chip and condensed strip
    expect(screen.getAllByText('Iron Fist').length).toBeGreaterThan(0)
    expect(screen.queryByRole('button', { name: 'Assign pilot to mech' })).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// Mech RailEmpty on the pilot sheet
// ---------------------------------------------------------------------------

describe('Sheet — mech RailEmpty on the pilot sheet', () => {
  test.each([
    ['no links', [], [], true],
    ['a mech wired', [fakeMech], [mechToPilot], false],
    ['a crawler but no mech', [fakeCrawler], [pilotToCrawler], true],
    [
      'mech and crawler (full wired)',
      [fakeMech, fakeCrawler],
      [mechToPilot, pilotToCrawler],
      false,
    ],
  ] as const)('with %s, Assign mech shows: %p', (_case, others, links, shown) => {
    renderSheet('pilot', { others: [...others], links: [...links] })
    const assign = screen.queryByRole('button', { name: 'Assign mech to pilot' })
    expect(assign !== null).toBe(shown)
  })
})

// ---------------------------------------------------------------------------
// ConditionToggle renders in editable sheet context
// ---------------------------------------------------------------------------

test('Sheet — the pilot sheet equipment carries its ConditionToggle, Intact', () => {
  renderSheet('pilot')
  // fakePilot has equipment: ['pistol'] — its condition cycles via the card
  // status badge, which starts Intact and persists to the store on change
  expect(screen.getByRole('button', { name: /status: intact/i })).toBeTruthy()
  expect(screen.getAllByText('Intact').length).toBeTruthy()
})

// ---------------------------------------------------------------------------
// readOnly propagation — stat cells non-interactive when Sheet readOnly=true
// ---------------------------------------------------------------------------

describe('Sheet — readOnly propagates to sub-sheets', () => {
  test.each(['pilot', 'mech', 'crawler'] as const)(
    'the %s sheet has no Field edit buttons when readOnly',
    (kind) => {
      renderSheet(kind, { readOnly: true })
      expect(editButtons().length).toBe(0)
    }
  )

  test('stat cells ARE interactive (role=button) when Sheet is NOT readOnly', () => {
    renderSheet('pilot')
    expect(editButtons().length).toBeGreaterThan(0)
  })
})
