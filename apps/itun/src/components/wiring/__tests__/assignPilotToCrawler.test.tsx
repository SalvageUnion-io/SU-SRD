/**
 * AssignPilotToCrawler — adding existing crew from the crawler's own sheet.
 *
 * The gap this closes: `AssignCrawlerToPilot` let you pick a crawler *from a
 * pilot*, but from a crawler the rails offered `+ Create` and nothing else. So
 * the ordinary move at a table — put a character who already exists aboard —
 * had no path from the surface where you would look for it.
 *
 * It is also why the complaint arrived as a **mech** problem. A mech reaches a
 * bay through its pilot (`mech-to-pilot` + `pilot-to-crawler`), and
 * `resolveLinkType` throws if asked for a mech→crawler pairing, so with no way
 * to add crew there was no way to dock a mech either — beside an empty rail
 * that said "dock one".
 *
 * Dep-injected stores, no `mock.module()`, matching `wiringComponents.test.tsx`.
 */

import { describe, expect, mock, test } from 'bun:test'
import { act, fireEvent, render, screen } from '@testing-library/react'
import type { Pilot } from '../../../lib/schemas/pilot'
import type { SoftLink } from '../../../lib/schemas/softLink'
import { FIXTURE_NOW } from '../../__tests__/fixtures'
import type { AssignCrewStore } from '../AssignPilotToCrawler'
import { AssignPilotToCrawler } from '../AssignPilotToCrawler'

function pilot(id: string, name: string): Pilot {
  return {
    id,
    schemaVersion: 1,
    name,
    // Deliberately NOT the name: the Radio renders the callsign as its
    // description, so equal values would make every `getByText(name)` below
    // ambiguous rather than assertive.
    callsign: `${id}-callsign`,
    classRef: 'scavenger',
    abilities: [],
    equipment: [],
    motto: '',
    keepsake: '',
    appearance: '',
    background: '',
    conditions: [],
    createdAt: FIXTURE_NOW,
    updatedAt: FIXTURE_NOW,
  }
}

function makeStore(over: Partial<AssignCrewStore> = {}): AssignCrewStore {
  return {
    pilots: [pilot('pilot-1', 'Yara Voss')],
    softLinks: [],
    create: mock(async () => ({}) as SoftLink),
    delete: mock(async () => {}),
    ...over,
  }
}

const CRAWLER_ID = 'crawler-1'

describe('AssignPilotToCrawler', () => {
  test('confirming wires the pilot to the crawler, pilot-end first', async () => {
    const store = makeStore()
    render(<AssignPilotToCrawler crawlerId={CRAWLER_ID} store={store} />)

    fireEvent.click(screen.getByRole('button', { name: /add an existing pilot/i }))
    fireEvent.click(screen.getByRole('radio'))
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /confirm crew assignment/i }))
    })

    // The direction is fixed by the schema, not by which end you pressed: the
    // pilot is always `from`. Getting this backwards would write a link no
    // resolver reads.
    expect(store.create).toHaveBeenCalledWith('softLink', {
      from: { type: 'pilot', id: 'pilot-1' },
      to: { type: 'crawler', id: CRAWLER_ID },
      type: 'pilot-to-crawler',
    })
  })

  test('pilots already crewing this crawler are not offered again', () => {
    const store = makeStore({
      pilots: [pilot('pilot-1', 'Yara Voss'), pilot('pilot-2', 'Dag')],
      softLinks: [
        {
          id: 'l1',
          from: { type: 'pilot', id: 'pilot-1' },
          to: { type: 'crawler', id: CRAWLER_ID },
          type: 'pilot-to-crawler',
          createdAt: FIXTURE_NOW,
        },
      ],
    })
    render(<AssignPilotToCrawler crawlerId={CRAWLER_ID} store={store} />)

    fireEvent.click(screen.getByRole('button', { name: /add an existing pilot/i }))

    // Re-drawing an existing link is harmless — the mirror is idempotent by
    // endpoints — but offering it implies something would happen.
    expect(screen.queryByText('Yara Voss')).toBeNull()
    expect(screen.getByText('Dag')).toBeTruthy()
    expect(screen.getAllByRole('radio')).toHaveLength(1)
  })

  test('a pilot crewing a DIFFERENT crawler is still offered', () => {
    const store = makeStore({
      softLinks: [
        {
          id: 'l1',
          from: { type: 'pilot', id: 'pilot-1' },
          to: { type: 'crawler', id: 'some-other-crawler' },
          type: 'pilot-to-crawler',
          createdAt: FIXTURE_NOW,
        },
      ],
    })
    render(<AssignPilotToCrawler crawlerId={CRAWLER_ID} store={store} />)

    fireEvent.click(screen.getByRole('button', { name: /add an existing pilot/i }))
    expect(screen.getByText('Yara Voss')).toBeTruthy()
  })

  test('confirming nothing asks rather than writing', async () => {
    const store = makeStore()
    render(<AssignPilotToCrawler crawlerId={CRAWLER_ID} store={store} />)

    fireEvent.click(screen.getByRole('button', { name: /add an existing pilot/i }))
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /confirm crew assignment/i }))
    })

    expect(store.create).not.toHaveBeenCalled()
    expect(screen.getByText(/please select a pilot/i)).toBeTruthy()
  })

  test('says which kind of empty it is', () => {
    const none = makeStore({ pilots: [] })
    const { unmount } = render(<AssignPilotToCrawler crawlerId={CRAWLER_ID} store={none} />)
    fireEvent.click(screen.getByRole('button', { name: /add an existing pilot/i }))
    // "You have no pilots" and "they are all already aboard" are different
    // problems with different next actions.
    expect(screen.getByText(/create one first/i)).toBeTruthy()
    unmount()

    const allCrewed = makeStore({
      softLinks: [
        {
          id: 'l1',
          from: { type: 'pilot', id: 'pilot-1' },
          to: { type: 'crawler', id: CRAWLER_ID },
          type: 'pilot-to-crawler',
          createdAt: FIXTURE_NOW,
        },
      ],
    })
    render(<AssignPilotToCrawler crawlerId={CRAWLER_ID} store={allCrewed} />)
    fireEvent.click(screen.getByRole('button', { name: /add an existing pilot/i }))
    expect(screen.getByText(/already crewing this crawler/i)).toBeTruthy()
  })
})
