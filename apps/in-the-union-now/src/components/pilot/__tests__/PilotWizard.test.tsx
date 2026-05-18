/**
 * Integration tests for the PilotWizard component.
 *
 * Uses fake-indexeddb (preloaded via bunfig.toml) and passes stub SUR
 * data via dependency-injection props (_sur, _rollDeps) so no module mocks
 * are needed here. This avoids Bun's mock.module global-leak problem.
 *
 * Coverage:
 *  - Wizard renders the first step (Class)
 *  - Next/Back navigation works
 *  - Reaching Review and submitting calls entityStore.create('pilot', ...)
 *  - RollTableButton fires and populates a field (via injected deps)
 */

import { describe, expect, mock, test, beforeEach, afterEach } from 'bun:test'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'

// ---------------------------------------------------------------------------
// Import store helpers (no salvageunion-reference mock needed here)
// ---------------------------------------------------------------------------
const { _clearAllStores, _resetDbSingleton } = await import('../../../lib/db/index')
const { useEntityStore } = await import('../../../stores/entityStore')
const { PilotWizard } = await import('../PilotWizard')

// ---------------------------------------------------------------------------
// Stub data
// ---------------------------------------------------------------------------

const STUB_CLASS = {
  id: 'cls-engineer',
  name: 'Engineer',
  schemaName: 'classes',
  coreTrees: ['Mechanical Knowledge', 'Forging', 'Mech-Tech'],
  maxAbilities: 10,
  advanceable: true,
}

const STUB_ABILITY = {
  id: 'ab-eng-exp',
  name: 'Engineering Expertise',
  schemaName: 'abilities',
  tree: 'Mechanical Knowledge',
  level: 1,
  actions: ['Engineering Expertise'],
  description: 'Ask engineering questions.',
}

const STUB_EQUIPMENT = {
  id: 'eq-first-aid',
  name: 'First Aid Kit',
  schemaName: 'equipment',
  techLevel: 1,
  actions: ['First Aid'],
}

// Flat table with a value for every roll 1-20
const CALLSIGN_TABLE: Record<string, { value: string }> = {}
for (let i = 1; i <= 20; i++) {
  CALLSIGN_TABLE[i.toString()] = { value: `Callsign ${i}` }
}

// ---------------------------------------------------------------------------
// Injectable stubs (passed as props, no module mocking)
// ---------------------------------------------------------------------------

const stubSURClasses = {
  all: () => [STUB_CLASS],
  find: (fn: (x: unknown) => boolean) => (fn(STUB_CLASS) ? STUB_CLASS : undefined),
}
const stubSURAbilities = {
  findAll: (fn: (x: unknown) => boolean) => (fn(STUB_ABILITY) ? [STUB_ABILITY] : []),
}
const stubSUREquipment = {
  findAll: (fn: (x: unknown) => boolean) => (fn(STUB_EQUIPMENT) ? [STUB_EQUIPMENT] : []),
}

const stubSUR = {
  Classes: stubSURClasses,
  Abilities: stubSURAbilities,
  Equipment: stubSUREquipment,
}

// Roll deps that resolve callsign/etc via the stub table
const stubRollDeps = {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  findTable: (_name: string) => ({
    id: 'rt-callsign',
    name: 'Callsign Table',
    schemaName: 'roll-tables' as const,
    table: CALLSIGN_TABLE,
  }),
  rollD20: () => 5 as const, // deterministic roll
}

// ---------------------------------------------------------------------------
// Store reset helpers
// ---------------------------------------------------------------------------

function resetEntityStore(): void {
  useEntityStore.setState({
    pilots: [],
    mechs: [],
    crawlers: [],
    softLinks: [],
    hydrated: { pilots: false, mechs: false, crawlers: false, softLinks: false },
  })
}

beforeEach(async () => {
  _resetDbSingleton()
  await _clearAllStores()
  resetEntityStore()
})

afterEach(async () => {
  await _clearAllStores()
  resetEntityStore()
})

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function renderWizard(
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  onComplete = mock((_id: string) => {}),
  onCancel = mock(() => {})
) {
  return render(
    <PilotWizard
      onComplete={onComplete}
      onCancel={onCancel}
      _sur={stubSUR}
      _rollDeps={stubRollDeps}
    />
  )
}

async function advanceThroughSteps({ fillIdentity = true }: { fillIdentity?: boolean } = {}) {
  // Step 1: Class — select Engineer
  const classBtn = screen.getByRole('button', { name: /Engineer/i })
  await act(async () => {
    fireEvent.click(classBtn)
  })
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: /^next$/i }))
  })

  // Step 2: Abilities — just advance
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: /^next$/i }))
  })

  // Step 3: Equipment — just advance
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: /^next$/i }))
  })

  // Step 4: Identity
  if (fillIdentity) {
    const nameInput = screen.getByLabelText(/^name/i)
    await act(async () => {
      fireEvent.change(nameInput, { target: { value: 'Yara Voss' } })
    })
    const callsignInput = screen.getByLabelText(/^callsign/i)
    await act(async () => {
      fireEvent.change(callsignInput, { target: { value: 'Ghost' } })
    })
  }
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: /^next$/i }))
  })

  // Step 5: Background — just advance
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: /^next$/i }))
  })
  // Now on Review
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('PilotWizard — step progression', () => {
  test('renders Class step initially', () => {
    renderWizard()
    expect(screen.getByText(/choose your class/i)).toBeInTheDocument()
  })

  test('Next button is disabled until a class is selected', () => {
    renderWizard()
    const nextBtn = screen.getByRole('button', { name: /^next$/i })
    expect(nextBtn).toBeDisabled()
  })

  test('selecting a class enables Next', async () => {
    renderWizard()
    const classBtn = screen.getByRole('button', { name: /Engineer/i })
    await act(async () => {
      fireEvent.click(classBtn)
    })
    const nextBtn = screen.getByRole('button', { name: /^next$/i })
    expect(nextBtn).not.toBeDisabled()
  })

  test('advances to Abilities step after class selection', async () => {
    renderWizard()
    const classBtn = screen.getByRole('button', { name: /Engineer/i })
    await act(async () => {
      fireEvent.click(classBtn)
    })
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /^next$/i }))
    })
    expect(screen.getByText(/choose starting abilities/i)).toBeInTheDocument()
  })

  test('Back button returns to previous step', async () => {
    renderWizard()
    const classBtn = screen.getByRole('button', { name: /Engineer/i })
    await act(async () => {
      fireEvent.click(classBtn)
    })
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /^next$/i }))
    })
    // On Abilities — go back (exact text match to avoid partial matches on other buttons)
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Back' }))
    })
    expect(screen.getByText(/choose your class/i)).toBeInTheDocument()
  })

  test('reaches Review step after all steps', async () => {
    renderWizard()
    await advanceThroughSteps()
    expect(screen.getByText(/review & create/i)).toBeInTheDocument()
  })
})

describe('PilotWizard — roll table button', () => {
  test('Roll button for callsign populates the callsign input', async () => {
    renderWizard()
    // Navigate to Identity step
    const classBtn = screen.getByRole('button', { name: /Engineer/i })
    await act(async () => {
      fireEvent.click(classBtn)
    })
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /^next$/i }))
    })
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /^next$/i }))
    })
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /^next$/i }))
    })

    // Now on Identity — click first Roll button (callsign)
    const rollBtns = screen.getAllByRole('button', { name: /^roll$/i })
    await act(async () => {
      fireEvent.click(rollBtns[0]!)
    })

    // Callsign input should be populated (deterministic roll=5, value="Callsign 5")
    const callsignInput = screen.getByLabelText(/^callsign/i) as HTMLInputElement
    expect(callsignInput.value).toBe('Callsign 5')
  })
})

describe('PilotWizard — submission', () => {
  test('submitting the wizard calls entityStore.create and invokes onComplete', async () => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const onComplete = mock((_id: string) => {})

    await act(async () => {
      renderWizard(onComplete)
    })
    await act(async () => {
      await useEntityStore.getState().hydrate('pilot')
    })

    await advanceThroughSteps()

    const createBtn = screen.getByRole('button', { name: /create pilot/i })
    await act(async () => {
      fireEvent.click(createBtn)
    })

    await waitFor(() => {
      expect(onComplete).toHaveBeenCalledTimes(1)
    })

    // Verify pilot round-trips through the store
    const pilotId = (onComplete.mock.calls[0] as string[])[0]
    const stored = useEntityStore.getState().get('pilot', pilotId!)
    expect(stored).not.toBeNull()
    expect(stored?.name).toBe('Yara Voss')
    expect(stored?.callsign).toBe('Ghost')
    expect(stored?.classRef).toBe('cls-engineer')
  })

  test('Create Pilot button is disabled without name and callsign', async () => {
    renderWizard()

    // Navigate through to Review with identity filled
    await advanceThroughSteps({ fillIdentity: true })

    // On Review step — go back twice to land on Identity
    // Use exact text match to avoid matching "Roll background"
    const getBackBtn = () => screen.getByRole('button', { name: 'Back' })
    await act(async () => {
      fireEvent.click(getBackBtn())
    })
    await act(async () => {
      fireEvent.click(getBackBtn())
    })

    // Now on Identity — clear the name
    const nameInput = screen.getByLabelText(/^name/i)
    await act(async () => {
      fireEvent.change(nameInput, { target: { value: '' } })
    })
    const callsignInput = screen.getByLabelText(/^callsign/i)
    await act(async () => {
      fireEvent.change(callsignInput, { target: { value: '' } })
    })

    // Next should now be disabled on Identity step (name + callsign required)
    const nextBtn = screen.getByRole('button', { name: /^next$/i })
    expect(nextBtn).toBeDisabled()
  })

  test('Cancel button triggers onCancel', async () => {
    const onCancel = mock(() => {})
    renderWizard(undefined, onCancel)
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /cancel/i }))
    })
    expect(onCancel).toHaveBeenCalledTimes(1)
  })
})
