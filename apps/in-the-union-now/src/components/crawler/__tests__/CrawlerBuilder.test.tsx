/**
 * CrawlerBuilder tests.
 *
 * NOTE: This file avoids a direct top-level import of `salvageunion-reference`
 * because the bun workspace package resolver does not follow the link in git
 * worktrees (the same limitation affects the pre-existing rules/__tests__
 * files). We instead mock SalvageUnionReference via property replacement at
 * runtime after React+Testing-Library have already set up the DOM.
 */
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, mock, test, beforeEach, afterEach } from 'bun:test'

import { CrawlerSchema } from '../../../lib/schemas/crawler'
import { useEntityStore } from '../../../stores/entityStore'
import { CrawlerBuilder } from '../CrawlerBuilder'

// ---------------------------------------------------------------------------
// Inline mock data — shaped like SURefMetaCrawlerTechLevel / SURefSystem
// without importing the types (avoids workspace resolution failure).
// ---------------------------------------------------------------------------

const MOCK_TECH_LEVELS = [
  {
    id: 'tl-1',
    name: 'Hamlet Crawler',
    techLevel: 1,
    structurePoints: 20,
    upkeepCost: 5,
    upgradeCost: 30,
    populationMin: 100,
    populationMax: 500,
    schemaName: 'crawler-tech-levels',
  },
  {
    id: 'tl-2',
    name: 'Village Crawler',
    techLevel: 2,
    structurePoints: 25,
    upkeepCost: 5,
    upgradeCost: 30,
    populationMin: 500,
    populationMax: 2000,
    schemaName: 'crawler-tech-levels',
  },
]

const MOCK_SYSTEMS = [
  { id: 'system-drill', name: 'Drill', techLevel: 1, schemaName: 'systems', actions: [], slots: 1 },
  {
    id: 'system-shield',
    name: 'Shield',
    techLevel: 2,
    schemaName: 'systems',
    actions: [],
    slots: 1,
  },
]

// ---------------------------------------------------------------------------
// Patch SalvageUnionReference dynamically (after module load)
// ---------------------------------------------------------------------------

type Restore = () => void

async function patchSalvageUnionReference(): Promise<Restore> {
  // Dynamic import avoids the top-level workspace resolution failure.
  const { SalvageUnionReference } = await import('salvageunion-reference')

  const originalPreload = SalvageUnionReference.preload.bind(SalvageUnionReference)
  SalvageUnionReference.preload = mock(async () => undefined)

  const originalCtlAll = SalvageUnionReference.CrawlerTechLevels.all.bind(
    SalvageUnionReference.CrawlerTechLevels
  )
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  SalvageUnionReference.CrawlerTechLevels.all = mock(() => MOCK_TECH_LEVELS as any)

  const originalSysAll = SalvageUnionReference.Systems.all.bind(SalvageUnionReference.Systems)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  SalvageUnionReference.Systems.all = mock(() => MOCK_SYSTEMS as any)

  return () => {
    SalvageUnionReference.preload = originalPreload
    SalvageUnionReference.CrawlerTechLevels.all = originalCtlAll
    SalvageUnionReference.Systems.all = originalSysAll
  }
}

// ---------------------------------------------------------------------------
// Patch entityStore.create
// ---------------------------------------------------------------------------

type StorePatch = {
  createMock: ReturnType<typeof mock>
  restore: () => void
}

function patchEntityStore(): StorePatch {
  const originalCreate = useEntityStore.getState().create
  const createMock = mock(async (_type: unknown, input: Record<string, unknown>) => {
    const now = new Date().toISOString()
    return CrawlerSchema.parse({ id: 'test-id', createdAt: now, updatedAt: now, ...input })
  })
  useEntityStore.setState({
    create: createMock as unknown as typeof originalCreate,
  })
  return {
    createMock,
    restore: () => useEntityStore.setState({ create: originalCreate }),
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('CrawlerBuilder', () => {
  let restoreRef: Restore
  let storePatch: StorePatch

  beforeEach(async () => {
    restoreRef = await patchSalvageUnionReference()
    storePatch = patchEntityStore()
  })

  afterEach(() => {
    restoreRef()
    storePatch.restore()
  })

  test('renders form fields', () => {
    render(<CrawlerBuilder onCreated={() => undefined} onCancel={() => undefined} />)
    expect(screen.getByLabelText('Crawler Name')).toBeDefined()
    expect(screen.getByText('Tech Level')).toBeDefined()
    expect(screen.getByText('Bay Assignments')).toBeDefined()
  })

  test('shows pilot placeholder text', () => {
    render(<CrawlerBuilder onCreated={() => undefined} onCancel={() => undefined} />)
    expect(screen.getByText(/No Pilots Assigned/)).toBeDefined()
  })

  test('shows TL buttons after async load', async () => {
    render(<CrawlerBuilder onCreated={() => undefined} onCancel={() => undefined} />)
    await waitFor(() => {
      expect(screen.getByText('TL 1')).toBeDefined()
      expect(screen.getByText('TL 2')).toBeDefined()
    })
  })

  test('selecting TL 1 shows only TL-1 systems', async () => {
    render(<CrawlerBuilder onCreated={() => undefined} onCancel={() => undefined} />)

    await waitFor(() => screen.getByText('TL 1'))
    act(() => {
      fireEvent.click(screen.getByText('TL 1').closest('button')!)
    })

    await waitFor(() => {
      expect(screen.getByText('Drill')).toBeDefined()
      expect(screen.queryByText('Shield')).toBeNull()
    })
  })

  test('selecting TL 2 shows both systems', async () => {
    render(<CrawlerBuilder onCreated={() => undefined} onCancel={() => undefined} />)

    await waitFor(() => screen.getByText('TL 2'))
    act(() => {
      fireEvent.click(screen.getByText('TL 2').closest('button')!)
    })

    await waitFor(() => {
      expect(screen.getByText('Drill')).toBeDefined()
      expect(screen.getByText('Shield')).toBeDefined()
    })
  })

  test('submit calls entityStore.create with valid Crawler shape', async () => {
    const onCreated = mock(() => undefined)

    render(<CrawlerBuilder onCreated={onCreated} onCancel={() => undefined} />)

    // Fill name
    fireEvent.change(screen.getByLabelText('Crawler Name'), {
      target: { value: 'My Test Crawler' },
    })

    // Select TL
    await waitFor(() => screen.getByText('TL 1'))
    act(() => {
      fireEvent.click(screen.getByText('TL 1').closest('button')!)
    })

    // Submit
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Create Crawler/i }))
    })

    await waitFor(() => {
      expect(storePatch.createMock).toHaveBeenCalledTimes(1)
    })

    const [callType, callInput] = storePatch.createMock.mock.calls[0] as [
      string,
      Record<string, unknown>,
    ]
    expect(callType).toBe('crawler')
    expect(callInput.name).toBe('My Test Crawler')
    expect(callInput.techLevel).toBe('tech-1')
    expect(callInput.schemaVersion).toBe(1)
    expect(Array.isArray(callInput.bays)).toBe(true)
    expect(Array.isArray(callInput.systems)).toBe(true)
    expect(onCreated).toHaveBeenCalledTimes(1)
  })

  test('shows error when submitting without TL', async () => {
    render(<CrawlerBuilder onCreated={() => undefined} onCancel={() => undefined} />)

    fireEvent.change(screen.getByLabelText('Crawler Name'), {
      target: { value: 'My Crawler' },
    })

    act(() => {
      fireEvent.click(screen.getByRole('button', { name: /Create Crawler/i }))
    })

    await waitFor(() => {
      expect(screen.getByRole('alert').textContent).toContain('tech level')
    })
    expect(storePatch.createMock).not.toHaveBeenCalled()
  })

  test('cancel calls onCancel', () => {
    const onCancel = mock(() => undefined)
    render(<CrawlerBuilder onCreated={() => undefined} onCancel={onCancel} />)

    fireEvent.click(screen.getByRole('button', { name: /Cancel/i }))
    expect(onCancel).toHaveBeenCalledTimes(1)
  })
})
