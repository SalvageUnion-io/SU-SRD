/**
 * Tests for DisplayView — the cockpit's main display. Verifies each dial-focus
 * kind renders without throwing and reuses the real reference components:
 * a resolvable chassis → a ReferenceEntityDisplay card; Tables → a RollTable;
 * unresolvable slugs → a graceful note (never a crash).
 *
 * Reference content needs the ORM, so preload('all') runs once. A real chassis
 * slug is picked from the loaded set so the card path is genuinely exercised.
 */

import { beforeAll, describe, expect, test } from 'bun:test'
import { render } from '@testing-library/react'
import { EntityHrefProvider } from 'suref-react'
import { SalvageUnionReference } from 'salvageunion-reference'

import type { Crawler } from '../../../lib/schemas/crawler'
import type { Mech } from '../../../lib/schemas/mech'
import { DisplayView } from '../DisplayView'
import type { DialItem } from '../dialItems'

let chassisSlug = 'iron-mongrel'

beforeAll(async () => {
  await SalvageUnionReference.preload('all')
  const first = SalvageUnionReference.Chassis.all()[0] as { id?: string } | undefined
  if (first?.id) chassisSlug = first.id
})

function renderDV(focus: DialItem | undefined, mechChassis = chassisSlug) {
  const mech = { id: 'm1', name: 'Rig', chassisRef: mechChassis } as unknown as Mech
  const crawler = { id: 'c1', name: 'Hauler', techLevel: '3' } as unknown as Crawler
  return render(
    <EntityHrefProvider value={() => undefined}>
      <DisplayView focus={focus} mech={mech} pilot={null} crawler={crawler} />
    </EntityHrefProvider>
  )
}

describe('DisplayView', () => {
  test('mech focus → a resolvable chassis renders a reference card', () => {
    const focus: DialItem = {
      key: 'mech:m1',
      kind: 'mech',
      statless: false,
      label: 'Mech · Rig',
      tone: 'mech',
      gauges: [],
    }
    const { container } = renderDV(focus)
    // The reference card renders real content, not the fallback note.
    expect(container.querySelector('.pc-display-note')).toBeNull()
    expect(container.querySelector('.pc-display-scroll')).toBeTruthy()
  })

  test('mech focus → an unresolvable chassis falls back to a note, no throw', () => {
    const focus: DialItem = {
      key: 'mech:m1',
      kind: 'mech',
      statless: false,
      label: 'Mech · Rig',
      tone: 'mech',
      gauges: [],
    }
    const { container } = renderDV(focus, 'definitely-not-a-chassis')
    expect(container.querySelector('.pc-display-note')?.textContent).toContain(
      'not in the reference set'
    )
  })

  test('Tables focus → a RollTable renders', () => {
    const focus: DialItem = {
      key: 'tables',
      kind: 'tables',
      statless: true,
      label: 'Tables',
      sublabel: 'roll',
    }
    const { container } = renderDV(focus)
    expect(container.querySelector('.pc-display-scroll')).toBeTruthy()
    // The reused RollTable renders a real table (not the fallback note).
    expect(container.querySelector('table')).toBeTruthy()
    expect(container.querySelector('.pc-display-note')).toBeNull()
  })

  test('Actions focus → the interactive ActionsDeck (Phase 5)', () => {
    const focus: DialItem = {
      key: 'actions',
      kind: 'actions',
      statless: true,
      label: 'Actions',
      sublabel: 'deck',
    }
    const { container } = renderDV(focus)
    // The deck renders (list or empty state), never the generic placeholder note.
    expect(container.querySelector('.pc-display-scroll')).toBeTruthy()
    expect(container.querySelector('.pc-deck, .pc-deck-empty')).toBeTruthy()
    expect(container.querySelector('.pc-display-note')).toBeNull()
  })

  test('no focus → graceful empty note', () => {
    const { container } = renderDV(undefined)
    expect(container.querySelector('.pc-display-note')?.textContent).toContain('Nothing selected')
  })
})
