/**
 * Integration tests for MechWizard (create + edit on the WizShell skeleton).
 *
 * Exercises Chassis → Systems → Modules → Identity → Review → submit using
 * the real wizard, real SalvageUnionReference data, real Zod validation, and
 * a fake-indexeddb-backed entityStore.
 *
 * fake-indexeddb/auto is preloaded via bunfig.toml.
 * SalvageUnionReference is preloaded in beforeAll.
 */

import { afterEach, beforeAll, beforeEach, describe, expect, it, mock } from 'bun:test'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { SalvageUnionReference } from 'salvageunion-reference'
import { useEntityStore } from '../../../stores/entityStore'
import { _clearAllStores, _resetDbSingleton } from '../../../lib/db/index'
import { mechFormToCreateInput, mechToFormState } from '../../../lib/wizard/mechFormState'
import { MechWizard } from '../MechWizard'

// ---------------------------------------------------------------------------
// Pre-load reference data
// ---------------------------------------------------------------------------

beforeAll(async () => {
  // ReferenceEntityDisplay renders trait keywords/drones inline, so preload
  // everything even though the wizard directly queries only three schemas.
  await SalvageUnionReference.preload('all')
})

// ---------------------------------------------------------------------------
// Store reset helpers
// ---------------------------------------------------------------------------

function resetEntityStore(): void {
  useEntityStore.setState({
    pilots: [],
    mechs: [],
    crawlers: [],
    softLinks: [],
    hydrated: {
      pilots: false,
      mechs: false,
      crawlers: false,
      softLinks: false,
    },
  })
}

beforeEach(async () => {
  _resetDbSingleton()
  await _clearAllStores()
  resetEntityStore()
  await useEntityStore.getState().hydrate('mech')
})

afterEach(async () => {
  await act(async () => {
    cleanup()
  })
  await _clearAllStores()
  resetEntityStore()
})

// ---------------------------------------------------------------------------
// Helpers (WizShell skeleton)
// ---------------------------------------------------------------------------

/**
 * Chassis rows are OptRow <button>s whose accessible text contains the
 * chassis name; system/module cards are Sel wrappers — div[role="button"]
 * with aria-label set to the entity name.
 */
function getPickByName(name: string): HTMLElement {
  const candidates = screen.getAllByRole('button')
  const exact = candidates.find((b) => b.getAttribute('aria-label') === name)
  if (exact) return exact
  const row = candidates.find((b) => (b.textContent ?? '').includes(name))
  if (!row) throw new Error(`No role=button pick for "${name}"`)
  return row
}

async function pick(name: string): Promise<void> {
  await act(async () => {
    fireEvent.click(getPickByName(name))
  })
}

/** The primary CTA is labeled from the steps array: 'Next · {step} →'. */
function getNextButton(): HTMLButtonElement {
  return screen.getByRole('button', { name: /^Next ·/ }) as HTMLButtonElement
}

async function clickNext(): Promise<void> {
  await act(async () => {
    fireEvent.click(getNextButton())
  })
}

// ---------------------------------------------------------------------------
// Happy path: full mech creation
// ---------------------------------------------------------------------------

describe('MechWizard — happy path', () => {
  it('walks through every step and creates a valid mech', async () => {
    const onComplete = mock(() => {})
    render(<MechWizard onComplete={onComplete} onCancel={() => {}} />)

    // --- Step 1: Chassis (master-detail OptRow list) ---
    await pick('Mule')
    await clickNext()

    // --- Step 2: Install Systems (1fr/300px grid, Sel cards, soft budget) ---
    expect(screen.getByTestId('system-slot-count').textContent).toContain('0 /')
    await pick('Cargo Pod')
    expect(screen.getByTestId('system-slot-count').textContent).toContain('1 /')
    await clickNext()

    // --- Step 3: Install Modules ---
    await pick('Comms Module')
    expect(screen.getByTestId('module-slot-count').textContent).toContain('1 /')
    await clickNext()

    // --- Step 4: Identity (name required) ---
    const nameInput = screen.getByLabelText(/Mech name/i) as HTMLInputElement
    await act(async () => {
      fireEvent.change(nameInput, { target: { value: 'Iron Fist' } })
    })
    await clickNext()

    // --- Step 5: Review → submit ('Create Mech ✦') ---
    const submit = screen.getByRole('button', { name: /Create Mech/i })
    await act(async () => {
      fireEvent.click(submit)
    })

    await waitFor(() => {
      const mechs = useEntityStore.getState().list('mech')
      expect(mechs.length).toBe(1)
      const m = mechs[0]!
      expect(m.name).toBe('Iron Fist')
      expect(m.chassisRef).toBe('Mule')
      expect(m.systems).toEqual(['Cargo Pod'])
      expect(m.modules).toEqual(['Comms Module'])
      expect(m.cargoLots).toEqual([])
      expect(m.conditions).toEqual([])
      expect(m.currentHeat).toBe(0)
      expect(m.schemaVersion).toBe(1)
    })

    expect(onComplete).toHaveBeenCalledTimes(1)
  }, 30000)
})

// ---------------------------------------------------------------------------
// Gating: chassis and name are required; capacity never blocks
// ---------------------------------------------------------------------------

describe('MechWizard — gates', () => {
  it('keeps Next disabled until a chassis is chosen, and on Identity until named', async () => {
    render(<MechWizard onComplete={() => {}} onCancel={() => {}} />)

    // Chassis step — Next disabled until a chassis is chosen.
    expect(getNextButton().disabled).toBe(true)
    await pick('Mule')
    expect(getNextButton().disabled).toBe(false)

    // Systems and Modules are optional — straight through.
    await clickNext()
    await clickNext()
    await clickNext()

    // Identity — Next disabled with the name empty; no mech persisted.
    expect(getNextButton().disabled).toBe(true)
    expect(useEntityStore.getState().list('mech').length).toBe(0)

    const nameInput = screen.getByLabelText(/Mech name/i) as HTMLInputElement
    await act(async () => {
      fireEvent.change(nameInput, { target: { value: 'Iron Fist' } })
    })
    expect(getNextButton().disabled).toBe(false)
  }, 30000)

  it('over-slot module selection warns but never blocks navigation', async () => {
    render(<MechWizard onComplete={() => {}} onCancel={() => {}} />)

    // Mule has 2 module slots — install three 1-slot modules to breach it.
    await pick('Mule')
    await clickNext() // Systems
    await clickNext() // Modules
    await pick('Comms Module')
    await pick('Equipment Locker')
    await pick('Firewall')

    // Soft warning banner appears…
    expect(screen.getByTestId('module-slot-count').textContent).toContain('3 /')
    expect(screen.getByText(/Module slots exceeded/i)).toBeTruthy()
    // …and Next stays enabled (capacity is soft — warn, never block).
    expect(getNextButton().disabled).toBe(false)
  }, 30000)
})

// ---------------------------------------------------------------------------
// Edit mode: upsert branch — loadout edits without duplicating
// ---------------------------------------------------------------------------

async function seedMuleMech() {
  const input = mechFormToCreateInput({
    name: 'Iron Fist',
    chassisName: 'Mule',
    systems: ['Cargo Pod'],
    modules: [],
    cargoLots: [],
  })
  return useEntityStore.getState().create('mech', input)
}

describe('MechWizard — edit mode', () => {
  it('prefills from the mech, edits the loadout, and updates without duplicating', async () => {
    const mech = await seedMuleMech()
    // Live-play state that the wizard patch must never clobber.
    await useEntityStore.getState().update('mech', mech.id, {
      currentSP: 5,
      conditions: ['Vulnerable'],
      systemConditions: { 'Cargo Pod': 'damaged' },
    })
    const onComplete = mock(() => {})

    render(
      <MechWizard
        mechId={mech.id}
        initialState={mechToFormState(mech)}
        onComplete={onComplete}
        onCancel={() => {}}
      />
    )

    // Eyebrow flips to edit mode; chassis is prefilled so Next is enabled.
    expect(screen.getByText('Edit Mech')).toBeTruthy()
    expect(getNextButton().disabled).toBe(false)
    await clickNext() // Systems

    // Loadout panel shows the prefilled install (no empty-state message).
    expect(screen.queryByText(/Nothing installed yet/i)).toBeNull()
    await pick('Armour Plating') // add a second system
    await clickNext() // Modules
    await pick('Comms Module')
    await clickNext() // Identity (name prefilled)
    await clickNext() // Review

    // Review → 'Save Mech' (never 'Create')
    const save = screen.getByRole('button', { name: /Save Mech/i })
    await act(async () => {
      fireEvent.click(save)
    })

    await waitFor(() => {
      const mechs = useEntityStore.getState().list('mech')
      // Upsert branch: same record updated — never a duplicate create.
      expect(mechs.length).toBe(1)
      const m = mechs[0]!
      expect(m.id).toBe(mech.id)
      expect(m.systems.sort()).toEqual(['Armour Plating', 'Cargo Pod'])
      expect(m.modules).toEqual(['Comms Module'])
      // Live-play state untouched by the wizard patch.
      expect(m.currentSP).toBe(5)
      expect(m.conditions).toEqual(['Vulnerable'])
      expect(m.systemConditions).toEqual({ 'Cargo Pod': 'damaged' })
    })
    expect(onComplete).toHaveBeenCalledWith(mech.id)
  }, 30000)

  it('warns pre-save when a depended-on system is removed but never blocks', async () => {
    const mech = await seedMuleMech()
    render(
      <MechWizard
        mechId={mech.id}
        initialState={mechToFormState(mech)}
        onComplete={() => {}}
        onCancel={() => {}}
      />
    )

    await clickNext() // Systems
    await pick('Cargo Pod') // toggle OFF the only system
    await clickNext() // Modules
    await clickNext() // Identity
    await clickNext() // Review

    // The save CTA is enabled regardless of any advisory warnings.
    const save = screen.getByRole('button', {
      name: /Save Mech/i,
    }) as HTMLButtonElement
    expect(save.disabled).toBe(false)
  }, 30000)
})

// ---------------------------------------------------------------------------
// Cargo lots: Identity-step editor writes schema-valid lots
// ---------------------------------------------------------------------------

describe('MechWizard — cargo lots', () => {
  it('adds a SCRAP lot with a tech level and persists it on create', async () => {
    render(<MechWizard onComplete={() => {}} onCancel={() => {}} />)

    await pick('Mule')
    await clickNext() // Systems
    await clickNext() // Modules
    await clickNext() // Identity

    const nameInput = screen.getByLabelText(/Mech name/i) as HTMLInputElement
    await act(async () => {
      fireEvent.change(nameInput, { target: { value: 'Iron Fist' } })
    })

    // Switch the lot category to SCRAP (TL select appears), add 3 scrap at TL2.
    const catSelect = screen.getByLabelText(/Category/i) as HTMLSelectElement
    await act(async () => {
      fireEvent.change(catSelect, { target: { value: 'SCRAP' } })
    })
    const tlSelect = screen.getByLabelText(/Tech level/i) as HTMLSelectElement
    const unitsInput = screen.getByLabelText(/Scrap \(units\)/i) as HTMLInputElement
    await act(async () => {
      fireEvent.change(tlSelect, { target: { value: '2' } })
      fireEvent.change(unitsInput, { target: { value: '3' } })
    })
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Add cargo lot/i }))
    })
    expect(screen.getAllByTestId('cargo-lot').length).toBe(1)

    await clickNext() // Review
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Create Mech/i }))
    })

    await waitFor(() => {
      const mechs = useEntityStore.getState().list('mech')
      expect(mechs.length).toBe(1)
      const lot = mechs[0]!.cargoLots[0]!
      expect(lot.cat).toBe('SCRAP')
      expect(lot.tl).toBe(2)
      expect(lot.kind).toBe('bulk')
      expect(lot.units).toBe(3)
    })
  }, 30000)
})
