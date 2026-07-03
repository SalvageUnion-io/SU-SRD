/**
 * Integration tests for PilotWizard (create + edit on the WizShell skeleton).
 *
 * Exercises ClassStep → AbilitiesStep → EquipmentStep → IdentityStep →
 * BackgroundStep → Review → submit using the real wizard, real
 * SalvageUnionReference data, real Zod validation, and a
 * fake-indexeddb-backed entityStore.
 *
 * fake-indexeddb/auto is preloaded via bunfig.toml.
 * SalvageUnionReference is preloaded in beforeAll.
 */

import { afterEach, beforeAll, beforeEach, describe, expect, it, mock } from 'bun:test'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { SalvageUnionReference } from 'salvageunion-reference'
import { useEntityStore } from '../../../stores/entityStore'
import { _clearAllStores, _resetDbSingleton } from '../../../lib/db/index'
import { pilotFormToCreateInput, pilotToFormState } from '../../../lib/wizard/pilotFormState'
import { PilotWizard } from '../PilotWizard'

// ---------------------------------------------------------------------------
// Pre-load reference data
// ---------------------------------------------------------------------------

beforeAll(async () => {
  // ReferenceEntityDisplay renders trait keywords inline, so 'traits' must be
  // preloaded too even though the wizard does not directly query it.
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
  await useEntityStore.getState().hydrate('pilot')
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
 * Class rows are OptRow <button>s whose accessible text starts with the
 * class name; ability/equipment cards are Sel wrappers — div[role="button"]
 * with aria-label set to the entity name. Both report role=button, so a
 * name match across role=button covers the whole wizard.
 */
function getPickByName(name: string): HTMLElement {
  const candidates = screen.getAllByRole('button')
  const exact = candidates.find((b) => b.getAttribute('aria-label') === name)
  if (exact) return exact
  // OptRows lead with the 44px 'art' placeholder, so match by inclusion.
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
function getNextButton(): HTMLElement {
  return screen.getByRole('button', { name: /^Next ·/ })
}

async function clickNext(): Promise<void> {
  await act(async () => {
    fireEvent.click(getNextButton())
  })
}

function idOf(name: string, accessor: { find: (fn: (x: { name: string }) => boolean) => unknown }) {
  const found = accessor.find((x) => x.name === name) as { id: string } | undefined
  if (!found) throw new Error(`Reference entity "${name}" not found`)
  return found.id
}

// ---------------------------------------------------------------------------
// Happy path: full pilot creation
// ---------------------------------------------------------------------------

describe('PilotWizard — happy path', () => {
  it('walks through every step and creates a valid pilot', async () => {
    const onComplete = mock(() => {})
    const onCancel = mock(() => {})
    render(<PilotWizard onComplete={onComplete} onCancel={onCancel} />)

    // --- Step 1: Class (master-detail OptRow list) ---
    await pick('Engineer')
    await clickNext()

    // --- Step 2: Abilities — three level-1 picks, live count in subtitle ---
    await pick('Engineering Expertise')
    expect(screen.getByTestId('ability-count').textContent).toContain('1 / 3')
    await pick('Jury Rig')
    await pick('Mass Field Maintenance')
    expect(screen.getByTestId('ability-count').textContent).toContain('3 / 3')
    await clickNext()

    // --- Step 3: Equipment ---
    const equipment = SalvageUnionReference.Equipment.findAll(
      (e: unknown) => (e as { techLevel: number }).techLevel === 1
    )
    expect(equipment.length).toBeGreaterThan(0)
    const firstEquipment = equipment[0] as { name: string }
    await pick(firstEquipment.name)
    await clickNext()

    // --- Step 4: Identity (name + callsign required) ---
    const nameInput = screen.getByLabelText(/^Name/) as HTMLInputElement
    const callsignInput = screen.getByLabelText(/Callsign/) as HTMLInputElement
    await act(async () => {
      fireEvent.change(nameInput, { target: { value: 'Mira Voss' } })
      fireEvent.change(callsignInput, { target: { value: 'Sparks' } })
    })
    await clickNext()

    // --- Step 5: Background (optional) ---
    await clickNext()

    // --- Step 6: Review → submit ('Create Pilot ✦') ---
    const submit = screen.getByRole('button', { name: /Create Pilot/i })
    await act(async () => {
      fireEvent.click(submit)
    })

    // Pilot should appear in the entityStore.
    await waitFor(() => {
      const pilots = useEntityStore.getState().list('pilot')
      expect(pilots.length).toBe(1)
      const p = pilots[0]!
      expect(p.name).toBe('Mira Voss')
      expect(p.callsign).toBe('Sparks')
      expect(p.classRef).toBeTruthy()
      expect(p.abilities.length).toBe(3)
      expect(p.equipment.length).toBe(1)
      expect(p.conditions).toEqual([])
      expect(p.schemaVersion).toBe(1)
    })

    // onComplete should have fired with the new pilot id.
    expect(onComplete).toHaveBeenCalledTimes(1)
  }, 30000)
})

// ---------------------------------------------------------------------------
// Background field round-trip
// ---------------------------------------------------------------------------

describe('PilotWizard — background field round-trips', () => {
  it('persists the background text entered on the Background step', async () => {
    const onComplete = mock(() => {})
    render(<PilotWizard onComplete={onComplete} onCancel={() => {}} />)

    // Step 1: Class
    await pick('Engineer')
    await clickNext()

    // Step 2: Abilities — pick three
    await pick('Engineering Expertise')
    await pick('Jury Rig')
    await pick('Mass Field Maintenance')
    await clickNext()

    // Step 3: Equipment — skip (just proceed)
    await clickNext()

    // Step 4: Identity
    const nameInput = screen.getByLabelText(/^Name/) as HTMLInputElement
    const callsignInput = screen.getByLabelText(/Callsign/) as HTMLInputElement
    await act(async () => {
      fireEvent.change(nameInput, { target: { value: 'Bex Okafor' } })
      fireEvent.change(callsignInput, { target: { value: 'Rust' } })
    })
    await clickNext()

    // Step 5: Background — type a background
    const backgroundTextarea = screen.getByLabelText(/Background/i) as HTMLTextAreaElement
    await act(async () => {
      fireEvent.change(backgroundTextarea, {
        target: { value: 'Grew up scavenging in the Rust Belt.' },
      })
    })
    await clickNext()

    // Step 6: Review → submit
    const submit = screen.getByRole('button', { name: /Create Pilot/i })
    await act(async () => {
      fireEvent.click(submit)
    })

    // The created pilot must have the background field persisted.
    await waitFor(() => {
      const pilots = useEntityStore.getState().list('pilot')
      expect(pilots.length).toBe(1)
      const p = pilots[0]!
      expect((p as { background?: string }).background).toBe('Grew up scavenging in the Rust Belt.')
    })
  }, 30000)
})

// ---------------------------------------------------------------------------
// Edge case: 3-ability creation budget
// ---------------------------------------------------------------------------

describe('PilotWizard — ability budget cap (create mode)', () => {
  it('blocks selection of a 4th ability once the 3-pick budget is reached', async () => {
    render(<PilotWizard onComplete={() => {}} onCancel={() => {}} />)

    // Select Engineer
    await pick('Engineer')
    await clickNext()

    // Pick three abilities
    await pick('Engineering Expertise')
    await pick('Jury Rig')
    await pick('Mass Field Maintenance')

    expect(screen.getByTestId('ability-count').textContent).toContain('3 / 3')

    // The budget notice renders ONCE, in the WizShell footer beside the
    // buttons — never per-card.
    const maxNotes = screen.getAllByText(/Max Abilities selected \(3 \/ 3\)/i)
    expect(maxNotes.length).toBe(1)
    expect(screen.queryByText(/Budget reached/i)).toBeNull()
  }, 30000)
})

// ---------------------------------------------------------------------------
// Edit mode: upsert branch + advancement beyond the creation budget
// ---------------------------------------------------------------------------

async function seedEngineerPilot() {
  const classId = idOf('Engineer', SalvageUnionReference.Classes)
  const input = pilotFormToCreateInput({
    name: 'Mira Voss',
    classId,
    abilities: [
      idOf('Engineering Expertise', SalvageUnionReference.Abilities),
      idOf('Jury Rig', SalvageUnionReference.Abilities),
      idOf('Mass Field Maintenance', SalvageUnionReference.Abilities),
    ],
    equipment: [],
    callsign: 'Sparks',
    motto: 'Measure twice',
    keepsake: 'A bent wrench',
    appearance: 'Grease-stained',
    background: 'Workshop kid.',
  })
  return useEntityStore.getState().create('pilot', input)
}

describe('PilotWizard — edit mode', () => {
  it('prefills from the pilot, allows a 4th (level-2) ability, and updates without duplicating', async () => {
    const pilot = await seedEngineerPilot()
    const onComplete = mock(() => {})

    render(
      <PilotWizard
        pilotId={pilot.id}
        initialState={pilotToFormState(pilot)}
        onComplete={onComplete}
        onCancel={() => {}}
      />
    )

    // Eyebrow flips to edit mode; class is prefilled so Next is enabled.
    expect(screen.getByText('Edit Pilot')).toBeTruthy()
    await clickNext()

    // Abilities step in edit mode: all levels offered, uncapped, TP visible.
    expect(screen.getByText(/TP available/i)).toBeTruthy()
    await pick('Talk Shop') // Mechanical Knowledge level 2 — in order
    await clickNext() // Equipment
    await clickNext() // Identity (prefilled name/callsign)
    await clickNext() // Background
    await clickNext() // Review
    // Review → 'Save Pilot' (never 'Create')
    const save = screen.getByRole('button', { name: /Save Pilot/i })
    await act(async () => {
      fireEvent.click(save)
    })

    await waitFor(() => {
      const pilots = useEntityStore.getState().list('pilot')
      // Upsert branch: same record updated — never a duplicate create.
      expect(pilots.length).toBe(1)
      const p = pilots[0]!
      expect(p.id).toBe(pilot.id)
      expect(p.abilities.length).toBe(4)
      expect(p.abilities).toContain(idOf('Talk Shop', SalvageUnionReference.Abilities))
      // Live-play state untouched by the wizard patch.
      expect(p.currentHP).toBe(pilot.currentHP)
      expect(p.callsign).toBe('Sparks')
    })
    expect(onComplete).toHaveBeenCalledWith(pilot.id)
  }, 30000)

  it('shows a pre-save soft warning for an out-of-order pick but never blocks saving', async () => {
    const pilot = await seedEngineerPilot()
    render(
      <PilotWizard
        pilotId={pilot.id}
        initialState={pilotToFormState(pilot)}
        onComplete={() => {}}
        onCancel={() => {}}
      />
    )

    await clickNext() // Abilities
    // 'Auto-Turret' is Forging level 3; level 2 ('Mech-Gyver') is not taken.
    await pick('Auto-Turret')
    await clickNext() // Equipment
    await clickNext() // Identity
    await clickNext() // Background
    await clickNext() // Review

    // Advisory banner present…
    await waitFor(() => {
      expect(screen.getByRole('alert').textContent).toContain('taken in order')
    })
    // …and the save CTA is still enabled (warnings never block).
    const save = screen.getByRole('button', { name: /Save Pilot/i })
    expect((save as HTMLButtonElement).disabled).toBe(false)
  }, 30000)
})
