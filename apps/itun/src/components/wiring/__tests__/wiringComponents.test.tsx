/**
 * Tests for AssignPilotToMech and AssignCrawlerToPilot.
 *
 * Uses dep-injection (no mock.module()) to supply fake stores.
 * Covers:
 *   - Trigger button renders
 *   - Dialog opens on click
 *   - Confirm calls store.create with correct args
 *   - Cancel closes without creating a link
 */

import { describe, expect, mock, test } from 'bun:test'
import { act, fireEvent, render, screen } from '@testing-library/react'
import type { Crawler } from '../../../lib/schemas/crawler'
import type { Pilot } from '../../../lib/schemas/pilot'
import type { SoftLink } from '../../../lib/schemas/softLink'
import { FIXTURE_NOW } from '../../__tests__/fixtures'
import type { AssignCrawlerStore } from '../AssignCrawlerToPilot'
import { AssignCrawlerToPilot } from '../AssignCrawlerToPilot'
import type { AssignPilotStore } from '../AssignPilotToMech'
import { AssignPilotToMech } from '../AssignPilotToMech'

// ---------------------------------------------------------------------------
// Fake data
// ---------------------------------------------------------------------------

const fakePilot: Pilot = {
  id: 'pilot-1',
  schemaVersion: 1,
  name: 'Yara Voss',
  callsign: 'Ghost',
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

const fakeCrawler: Crawler = {
  id: 'crawler-1',
  schemaVersion: 1,
  name: 'Iron Tortoise',
  techLevel: 'tech-2',
  systems: [],
  createdAt: FIXTURE_NOW,
  updatedAt: FIXTURE_NOW,
}

type MockCreateFn = ReturnType<
  typeof mock<(type: 'softLink', input: Omit<SoftLink, 'id' | 'createdAt'>) => Promise<SoftLink>>
>
type MockDeleteFn = ReturnType<typeof mock<(type: 'softLink', id: string) => Promise<void>>>

function makeCreateMock(): MockCreateFn {
  return mock(
    async (type: 'softLink', input: Omit<SoftLink, 'id' | 'createdAt'>): Promise<SoftLink> => {
      void type
      return { ...input, id: 'link-new', createdAt: FIXTURE_NOW }
    }
  )
}

function makeDeleteMock(): MockDeleteFn {
  return mock(async (type: 'softLink', id: string): Promise<void> => {
    void type
    void id
  })
}

function makeAssignPilotStore(
  pilots: Pilot[] = [fakePilot]
): AssignPilotStore & { createFn: MockCreateFn } {
  const createFn = makeCreateMock()
  const deleteFn = makeDeleteMock()
  return {
    softLinks: [],
    pilots,
    create: createFn,
    delete: deleteFn,
    createFn,
  }
}

function makeAssignCrawlerStore(
  crawlers: Crawler[] = [fakeCrawler]
): AssignCrawlerStore & { createFn: MockCreateFn } {
  const createFn = makeCreateMock()
  const deleteFn = makeDeleteMock()
  return {
    softLinks: [],
    crawlers,
    create: createFn,
    delete: deleteFn,
    createFn,
  }
}

// ---------------------------------------------------------------------------
// AssignPilotToMech
// ---------------------------------------------------------------------------

describe('AssignPilotToMech', () => {
  test('renders trigger button', () => {
    render(<AssignPilotToMech mechId="mech-1" store={makeAssignPilotStore()} />)
    expect(screen.getByRole('button', { name: /assign pilot/i })).toBeTruthy()
  })

  test('dialog is hidden initially', () => {
    render(<AssignPilotToMech mechId="mech-1" store={makeAssignPilotStore()} />)
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  test('clicking trigger opens dialog', async () => {
    render(<AssignPilotToMech mechId="mech-1" store={makeAssignPilotStore()} />)
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /assign pilot/i }))
    })
    expect(screen.getByRole('dialog')).toBeTruthy()
  })

  test('pilot names appear in dialog', async () => {
    render(<AssignPilotToMech mechId="mech-1" store={makeAssignPilotStore()} />)
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /assign pilot/i }))
    })
    expect(screen.getByText('Yara Voss')).toBeTruthy()
  })

  test('cancel closes dialog without creating a link', async () => {
    const store = makeAssignPilotStore()
    render(<AssignPilotToMech mechId="mech-1" store={store} />)

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /assign pilot/i }))
    })
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /cancel/i }))
    })

    expect(screen.queryByRole('dialog')).toBeNull()
    expect(store.createFn).toHaveBeenCalledTimes(0)
  })

  test('selecting a pilot and confirming calls store.create', async () => {
    const store = makeAssignPilotStore()
    const onAssigned = mock(() => {})
    render(<AssignPilotToMech mechId="mech-1" store={store} onAssigned={onAssigned} />)

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /assign pilot/i }))
    })

    // Select the pilot via radio input
    await act(async () => {
      fireEvent.click(screen.getByRole('radio'))
    })

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /confirm pilot assignment/i }))
    })

    expect(store.createFn).toHaveBeenCalledTimes(1)
    const [callType, callInput] = store.createFn.mock.calls[0] as [
      'softLink',
      Omit<SoftLink, 'id' | 'createdAt'>,
    ]
    expect(callType).toBe('softLink')
    expect(callInput.from).toEqual({ type: 'mech', id: 'mech-1' })
    expect(callInput.to).toEqual({ type: 'pilot', id: 'pilot-1' })
    expect(callInput.type).toBe('mech-to-pilot')
    expect(onAssigned).toHaveBeenCalledTimes(1)
  })

  test('shows empty state when no pilots available', async () => {
    const store = makeAssignPilotStore([])
    render(<AssignPilotToMech mechId="mech-1" store={store} />)
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /assign pilot/i }))
    })
    expect(screen.getByText(/no pilots found/i)).toBeTruthy()
  })
})

// ---------------------------------------------------------------------------
// AssignCrawlerToPilot
// ---------------------------------------------------------------------------

describe('AssignCrawlerToPilot', () => {
  test('renders trigger button', () => {
    render(<AssignCrawlerToPilot pilotId="pilot-1" store={makeAssignCrawlerStore()} />)
    expect(screen.getByRole('button', { name: /assign crawler/i })).toBeTruthy()
  })

  test('dialog opens on trigger click', async () => {
    render(<AssignCrawlerToPilot pilotId="pilot-1" store={makeAssignCrawlerStore()} />)
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /assign crawler/i }))
    })
    expect(screen.getByRole('dialog')).toBeTruthy()
  })

  test('selecting a crawler and confirming calls store.create with pilot-to-crawler type', async () => {
    const store = makeAssignCrawlerStore()
    render(<AssignCrawlerToPilot pilotId="pilot-1" store={store} />)

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /assign crawler/i }))
    })

    await act(async () => {
      fireEvent.click(screen.getByRole('radio'))
    })

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /confirm crawler assignment/i }))
    })

    expect(store.createFn).toHaveBeenCalledTimes(1)
    const [, callInput] = store.createFn.mock.calls[0] as [
      'softLink',
      Omit<SoftLink, 'id' | 'createdAt'>,
    ]
    expect(callInput.from).toEqual({ type: 'pilot', id: 'pilot-1' })
    expect(callInput.to).toEqual({ type: 'crawler', id: 'crawler-1' })
    expect(callInput.type).toBe('pilot-to-crawler')
  })
})
