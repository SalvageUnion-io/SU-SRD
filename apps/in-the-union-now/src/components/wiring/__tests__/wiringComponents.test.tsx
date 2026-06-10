/**
 * Tests for AssignPilotToMech, AssignCrawlerToPilot, UnassignLinkButton.
 *
 * Uses dep-injection (no mock.module()) to supply fake stores.
 * Covers:
 *   - Trigger button renders
 *   - Dialog opens on click
 *   - Confirm calls store.create with correct args
 *   - Cancel closes without creating a link
 *   - UnassignLinkButton: confirm calls store.delete
 *   - UnassignLinkButton: cancel does not call store.delete
 */

import { describe, expect, mock, test } from 'bun:test'
import { render, screen, fireEvent, act } from '@testing-library/react'

import { AssignPilotToMech } from '../AssignPilotToMech'
import type { AssignPilotStore } from '../AssignPilotToMech'
import { AssignCrawlerToPilot } from '../AssignCrawlerToPilot'
import type { AssignCrawlerStore } from '../AssignCrawlerToPilot'
import { UnassignLinkButton } from '../UnassignLinkButton'
import type { UnassignStore } from '../UnassignLinkButton'
import type { SoftLink } from '../../../lib/schemas/softLink'
import type { Pilot } from '../../../lib/schemas/pilot'
import type { Crawler } from '../../../lib/schemas/crawler'

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
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
}

const fakeCrawler: Crawler = {
  id: 'crawler-1',
  schemaVersion: 1,
  name: 'Iron Tortoise',
  techLevel: 'tech-2',
  systems: [],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
}

type MockCreateFn = ReturnType<
  typeof mock<(type: 'softLink', input: Omit<SoftLink, 'id' | 'createdAt'>) => Promise<SoftLink>>
>
type MockDeleteFn = ReturnType<typeof mock<(type: 'softLink', id: string) => Promise<void>>>

function makeCreateMock(): MockCreateFn {
  return mock(
    async (type: 'softLink', input: Omit<SoftLink, 'id' | 'createdAt'>): Promise<SoftLink> => {
      void type
      return { ...input, id: 'link-new', createdAt: new Date().toISOString() }
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

function makeUnassignStore(): { deleteFn: MockDeleteFn } & UnassignStore {
  const deleteFn = makeDeleteMock()
  return {
    delete: deleteFn,
    deleteFn,
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

// ---------------------------------------------------------------------------
// UnassignLinkButton
// ---------------------------------------------------------------------------

describe('UnassignLinkButton', () => {
  test('renders with default label "Unassign"', () => {
    render(<UnassignLinkButton linkId="link-1" store={makeUnassignStore()} />)
    expect(screen.getByRole('button', { name: /unassign — remove soft link/i })).toBeTruthy()
  })

  test('confirm dialog appears on click', async () => {
    render(<UnassignLinkButton linkId="link-1" store={makeUnassignStore()} />)
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /unassign/i }))
    })
    expect(screen.getByRole('dialog')).toBeTruthy()
  })

  test('copy explains no entity deletion', async () => {
    render(<UnassignLinkButton linkId="link-1" store={makeUnassignStore()} />)
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /unassign/i }))
    })
    // Text is split across elements ("not" is in <strong>); check dialog text content
    const dialog = screen.getByRole('dialog')
    expect(dialog.textContent).toMatch(/does\s+not\s+delete/i)
  })

  test('cancel closes without calling store.delete', async () => {
    const store = makeUnassignStore()
    render(<UnassignLinkButton linkId="link-1" store={store} />)

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /unassign/i }))
    })
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /cancel/i }))
    })

    expect(screen.queryByRole('dialog')).toBeNull()
    expect(store.deleteFn).toHaveBeenCalledTimes(0)
  })

  test('confirm calls store.delete with the link id', async () => {
    const store = makeUnassignStore()
    const onUnassigned = mock(() => {})
    render(<UnassignLinkButton linkId="link-99" store={store} onUnassigned={onUnassigned} />)

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /unassign/i }))
    })
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /confirm unassign/i }))
    })

    expect(store.deleteFn).toHaveBeenCalledTimes(1)
    expect(store.deleteFn.mock.calls[0]).toEqual(['softLink', 'link-99'])
    expect(onUnassigned).toHaveBeenCalledTimes(1)
  })

  test('accepts a custom label prop', () => {
    render(<UnassignLinkButton linkId="link-1" store={makeUnassignStore()} label="Remove pilot" />)
    expect(screen.getByRole('button', { name: /remove pilot — remove soft link/i })).toBeTruthy()
  })
})
