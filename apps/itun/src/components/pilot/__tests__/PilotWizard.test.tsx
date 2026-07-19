/**
 * Integration tests for PilotWizard (create + edit on the WizShell skeleton),
 * restructured to the Pilot Bay's book order (wizard-refresh Phase 3):
 *
 *   Stats → Class & Ability (merged) → Equipment → Callsign → Background →
 *   Motto → Keepsake → Appearance → Review → submit
 *
 * Create mode is HARD-enforced (1 ability radio, exactly 2 Tech-1 equipment
 * via count-steppers, gated Next); edit mode keeps the soft regime. Uses the
 * real wizard, real SalvageUnionReference data, real Zod validation, and a
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
import { must } from '../../__tests__/must'

// ---------------------------------------------------------------------------
// Pre-load reference data
// ---------------------------------------------------------------------------

beforeAll(async () => {
  // ReferenceEntityCard renders trait keywords inline, so 'traits' must be
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
  sessionStorage.clear()
  _resetDbSingleton()
  await _clearAllStores()
  resetEntityStore()
  await useEntityStore.getState().hydrate('pilot')
})

afterEach(async () => {
  await act(async () => {
    cleanup()
  })
  sessionStorage.clear()
  await _clearAllStores()
  resetEntityStore()
})

// ---------------------------------------------------------------------------
// Helpers (WizShell skeleton)
// ---------------------------------------------------------------------------

/**
 * Class/ability/equipment picks are SelCard rings — div[role="button"] with
 * aria-label set to the entity name.
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

function firstTech1Equipment(): { id: string; name: string } {
  const item = SalvageUnionReference.Equipment.find(
    (e) => (e as { techLevel?: number }).techLevel === 1
  ) as { id: string; name: string } | undefined
  if (!item) throw new Error('no Tech 1 equipment loaded')
  return item
}

/** Fill the Callsign step (Name + Callsign) and advance. */
async function fillCallsign(name: string, callsign: string): Promise<void> {
  const nameInput = screen.getByLabelText(/^Name/) as HTMLInputElement
  const callsignInput = screen.getByLabelText(/Callsign/) as HTMLInputElement
  await act(async () => {
    fireEvent.change(nameInput, { target: { value: name } })
    fireEvent.change(callsignInput, { target: { value: callsign } })
  })
}

// ---------------------------------------------------------------------------
// Happy path: full pilot creation in book order
// ---------------------------------------------------------------------------

describe('PilotWizard — happy path (book order, hard enforcement)', () => {
  it('walks Stats → Class & Ability → Equipment → Callsign → flavor → Review and creates a legal pilot', async () => {
    const onComplete = mock(() => {})
    const onCancel = mock(() => {})
    render(<PilotWizard onComplete={onComplete} onCancel={onCancel} />)

    // --- Step 1: Your Stats — display-only, Next always enabled ---
    // The fixed pilot stats render as read-only value boxes (HP 10/10, …).
    expect(screen.getByLabelText('HP')).toBeTruthy()
    expect((getNextButton() as HTMLButtonElement).disabled).toBe(false)
    await clickNext()

    // --- Step 2: Class & First Ability (merged, both gates hard) ---
    // Next locked until class + exactly 1 legal ability.
    expect((getNextButton() as HTMLButtonElement).disabled).toBe(true)
    await pick('Engineer')
    expect(screen.getByText('Choose your first Ability to continue')).toBeTruthy()
    await pick('Engineering Expertise')
    expect(screen.getByTestId('ability-count').textContent).toContain('1 / 1')
    expect((getNextButton() as HTMLButtonElement).disabled).toBe(false)
    await clickNext()

    // --- Step 3: Equipment — exactly 2 Tech 1 picks (duplicates allowed) ---
    expect((getNextButton() as HTMLButtonElement).disabled).toBe(true)
    expect(screen.getByText(/Choose 2 more equipment items to continue/i)).toBeTruthy()
    const item = firstTech1Equipment()
    await pick(item.name) // card click adds copy #1
    expect(screen.getByText(/Choose 1 more equipment item to continue/i)).toBeTruthy()
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: `Add one ${item.name}` })) // copy #2
    })
    expect(screen.getByTestId('equipment-count').textContent).toContain('2 / 2')
    expect((getNextButton() as HTMLButtonElement).disabled).toBe(false)
    // At the budget every '+' disables.
    const plusButtons = screen.getAllByRole('button', { name: /^Add one / })
    for (const plus of plusButtons) {
      expect((plus as HTMLButtonElement).disabled).toBe(true)
    }
    await clickNext()

    // --- Step 4: Callsign (Name + Callsign required) ---
    expect((getNextButton() as HTMLButtonElement).disabled).toBe(true)
    await fillCallsign('Mira Voss', 'Sparks')
    await clickNext()

    // --- Steps 5–8: Background, Motto, Keepsake, Appearance — optional ---
    await clickNext() // Background
    await clickNext() // Motto
    await clickNext() // Keepsake
    await clickNext() // Appearance

    // --- Review → submit ('Create Pilot ✦'), recap present, no soft banner ---
    expect(screen.getByText(/1 class · 1 ability · 2 Tech 1 items/i)).toBeTruthy()
    expect(screen.queryByRole('alert')).toBeNull()
    const submit = screen.getByRole('button', { name: /Create Pilot/i })
    await act(async () => {
      fireEvent.click(submit)
    })

    await waitFor(() => {
      const pilots = useEntityStore.getState().list('pilot')
      expect(pilots.length).toBe(1)
      const p = must(pilots[0])
      expect(p.name).toBe('Mira Voss')
      expect(p.callsign).toBe('Sparks')
      expect(p.classRef).toBeTruthy()
      expect(p.abilities.length).toBe(1)
      expect(p.equipment.length).toBe(2)
      expect(p.equipment[0]).toBe(p.equipment[1] as string) // duplicates are legal
      expect(p.conditions).toEqual([])
      expect(p.schemaVersion).toBe(1)
    })

    expect(onComplete).toHaveBeenCalledTimes(1)
  }, 30000)
})

// ---------------------------------------------------------------------------
// Hard enforcement mechanics
// ---------------------------------------------------------------------------

describe('PilotWizard — hard creation enforcement', () => {
  it('ability pick is a RADIO: a new pick replaces the old, never a second slot', async () => {
    render(<PilotWizard onComplete={() => {}} onCancel={() => {}} />)
    await clickNext() // Stats → Class & Ability
    await pick('Engineer')
    await pick('Engineering Expertise')
    expect(screen.getByTestId('ability-count').textContent).toContain('1 / 1')
    await pick('Jury Rig')
    // Still exactly one pick — replaced, not added.
    expect(screen.getByTestId('ability-count').textContent).toContain('1 / 1')
    expect(getPickByName('Jury Rig').getAttribute('aria-pressed')).toBe('true')
    expect(getPickByName('Engineering Expertise').getAttribute('aria-pressed')).toBe('false')
  }, 30000)

  it('changing class clears a now-illegal ability (cross-step invalidation)', async () => {
    render(<PilotWizard onComplete={() => {}} onCancel={() => {}} />)
    await clickNext()
    await pick('Engineer')
    await pick('Engineering Expertise') // Mechanical Knowledge L1
    await pick('Soldier') // Mechanical Knowledge ∉ Soldier trees
    expect(screen.getByTestId('ability-count').textContent).toContain('0 / 1')
    expect((getNextButton() as HTMLButtonElement).disabled).toBe(true)
  }, 30000)

  it('keeps a still-legal ability across a class change (Salvager shares core trees)', async () => {
    render(<PilotWizard onComplete={() => {}} onCancel={() => {}} />)
    await clickNext()
    await pick('Engineer')
    await pick('Engineering Expertise') // Mechanical Knowledge L1 — also a Salvager tree
    await pick('Salvager')
    expect(screen.getByTestId('ability-count').textContent).toContain('1 / 1')
  }, 30000)

  it('offers the Salvager all 15 core-tree Level-1 abilities and no specialisation classes', async () => {
    render(<PilotWizard onComplete={() => {}} onCancel={() => {}} />)
    await clickNext()
    // Non-core classes are filtered OUT of guided create entirely.
    expect(screen.queryByRole('button', { name: 'Cyborg' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Fabricator' })).toBeNull()
    await pick('Salvager')
    const level1 = SalvageUnionReference.Abilities.findAll(
      (a) => (a as { level: number | string }).level === 1
    )
    expect(level1.length).toBe(25) // 15 core + 10 advanced-tree level-1s in the catalog
    const salvager = SalvageUnionReference.Classes.find((c) => c.name === 'Salvager') as {
      coreTrees: string[]
    }
    const legal = level1.filter((a) =>
      salvager.coreTrees.includes((a as { tree: string }).tree)
    ) as { name: string }[]
    expect(legal.length).toBe(15)
    for (const ability of legal) {
      expect(screen.getByRole('button', { name: ability.name })).toBeTruthy()
    }
    // Advanced-tree Level-1s never render in guided create.
    const advanced = level1.filter(
      (a) => !salvager.coreTrees.includes((a as { tree: string }).tree)
    ) as { name: string }[]
    for (const ability of advanced) {
      expect(screen.queryByRole('button', { name: ability.name })).toBeNull()
    }
  }, 30000)

  it('equipment count-stepper supports duplicates and the − removes a copy', async () => {
    render(<PilotWizard onComplete={() => {}} onCancel={() => {}} />)
    await clickNext()
    await pick('Engineer')
    await pick('Engineering Expertise')
    await clickNext()

    const item = firstTech1Equipment()
    const plus = () => screen.getByRole('button', { name: `Add one ${item.name}` })
    const minus = () => screen.getByRole('button', { name: `Remove one ${item.name}` })

    await act(async () => {
      fireEvent.click(plus())
    })
    await act(async () => {
      fireEvent.click(plus())
    })
    expect(screen.getByTestId('equipment-count').textContent).toContain('2 / 2')
    expect((plus() as HTMLButtonElement).disabled).toBe(true)
    await act(async () => {
      fireEvent.click(minus())
    })
    expect(screen.getByTestId('equipment-count').textContent).toContain('1 / 2')
    expect((plus() as HTMLButtonElement).disabled).toBe(false)
  }, 30000)

  it('slot preview uses pilotInventory math, not pick count', async () => {
    render(<PilotWizard onComplete={() => {}} onCancel={() => {}} />)
    await clickNext()
    await pick('Engineer')
    await pick('Engineering Expertise')
    await clickNext()
    // 0 picks → 0 / 6 slots (base capacity).
    expect(screen.getByTestId('slot-preview').textContent).toContain('/ 6')
  }, 30000)
})

// ---------------------------------------------------------------------------
// Draft clamping (§5.3): a pre-enforcement 3/3 draft heals deterministically
// ---------------------------------------------------------------------------

describe('PilotWizard — draft restore clamps to the 1/2 budgets', () => {
  it('trims excess ability and equipment picks oldest-first on mount', async () => {
    const classId = idOf('Engineer', SalvageUnionReference.Classes)
    const a1 = idOf('Engineering Expertise', SalvageUnionReference.Abilities)
    const a2 = idOf('Jury Rig', SalvageUnionReference.Abilities)
    const a3 = idOf('Mass Field Maintenance', SalvageUnionReference.Abilities)
    const item = firstTech1Equipment()
    sessionStorage.setItem(
      'itun-wizard-draft:pilot:new',
      JSON.stringify({
        name: 'Legacy',
        classId,
        abilities: [a1, a2, a3],
        equipment: [item.id, item.id, item.id],
        callsign: 'Old',
        motto: '',
        keepsake: '',
        appearance: '',
        background: '',
        description: '',
      })
    )

    render(<PilotWizard onComplete={() => {}} onCancel={() => {}} />)
    await clickNext() // Stats → Class & Ability

    // Oldest-first removal keeps the NEWEST ability pick (a3).
    expect(screen.getByTestId('ability-count').textContent).toContain('1 / 1')
    expect(getPickByName('Mass Field Maintenance').getAttribute('aria-pressed')).toBe('true')
    await clickNext() // → Equipment
    expect(screen.getByTestId('equipment-count').textContent).toContain('2 / 2')
  }, 30000)
})

// ---------------------------------------------------------------------------
// Edit mode: soft regime — merged step order minus Stats, lifted filters
// ---------------------------------------------------------------------------

async function seedEngineerPilot() {
  const classId = idOf('Engineer', SalvageUnionReference.Classes)
  const input = pilotFormToCreateInput({
    name: 'Mira Voss',
    description: '',
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
  it('starts at Class & Ability (no Stats step), allows a level-2 pick uncapped, and updates without duplicating', async () => {
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

    // Eyebrow flips to edit mode; the first step is the merged Class &
    // Ability (Stats is hidden in edit — §5.2) with every level offered.
    expect(screen.getByText('Edit Pilot')).toBeTruthy()
    expect(screen.queryByText('Your Stats')).toBeNull()
    await pick('Talk Shop') // Mechanical Knowledge level 2 — edit lifts allLevels
    expect(screen.getByTestId('ability-count').textContent).toBe('4') // uncapped, no budget suffix
    await clickNext() // → Equipment
    await clickNext() // → Callsign (prefilled name/callsign)
    await clickNext() // → Background
    await clickNext() // → Motto
    await clickNext() // → Keepsake
    await clickNext() // → Appearance
    await clickNext() // → Review
    // Review → 'Save Pilot' (never 'Create')
    const save = screen.getByRole('button', { name: /Save Pilot/i })
    await act(async () => {
      fireEvent.click(save)
    })

    await waitFor(() => {
      const pilots = useEntityStore.getState().list('pilot')
      // Upsert branch: same record updated — never a duplicate create.
      expect(pilots.length).toBe(1)
      const p = must(pilots[0])
      expect(p.id).toBe(pilot.id)
      expect(p.abilities.length).toBe(4)
      expect(p.abilities).toContain(idOf('Talk Shop', SalvageUnionReference.Abilities))
      // Live-play state untouched by the wizard patch.
      expect(p.currentHP).toBe(pilot.currentHP)
      expect(p.callsign).toBe('Sparks')
      // Assert inside waitFor: the wizard persists to the store before invoking
      // onComplete in a later microtask, so a bare assertion here races under
      // heavy parallel load.
      expect(onComplete).toHaveBeenCalledWith(pilot.id)
    })
  }, 30000)

  it('offers Advanced/Hybrid specialisation classes in edit mode', async () => {
    const pilot = await seedEngineerPilot()
    render(
      <PilotWizard
        pilotId={pilot.id}
        initialState={pilotToFormState(pilot)}
        onComplete={() => {}}
        onCancel={() => {}}
      />
    )
    expect(screen.getByRole('button', { name: 'Cyborg' })).toBeTruthy()
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

    // 'Auto-Turret' is Forging level 3; level 2 ('Mech-Gyver') is not taken.
    await pick('Auto-Turret')
    await clickNext() // → Equipment
    await clickNext() // → Callsign
    await clickNext() // → Background
    await clickNext() // → Motto
    await clickNext() // → Keepsake
    await clickNext() // → Appearance
    await clickNext() // → Review

    // Advisory banner present…
    await waitFor(() => {
      expect(screen.getByRole('alert').textContent).toContain('taken in order')
    })
    // …and the save CTA is still enabled (warnings never block in edit).
    const save = screen.getByRole('button', { name: /Save Pilot/i })
    expect((save as HTMLButtonElement).disabled).toBe(false)
  }, 30000)
})

// ---------------------------------------------------------------------------
// Draft persistence (audit item 3): unmount → remount restores the session
// draft; a confirmed Cancel discards it.
// ---------------------------------------------------------------------------

describe('PilotWizard — session drafts', () => {
  it('restores in-progress state after unmount and clears it on confirmed cancel', async () => {
    const { unmount } = render(<PilotWizard onComplete={() => {}} onCancel={() => {}} />)
    await clickNext() // Stats → Class & Ability
    await pick('Engineer')

    // Simulate a refresh/navigation: unmount, then mount a fresh wizard.
    await act(async () => {
      unmount()
    })
    expect(sessionStorage.getItem('itun-wizard-draft:pilot:new')).not.toBeNull()

    const onCancel = mock(() => {})
    render(<PilotWizard onComplete={() => {}} onCancel={onCancel} />)
    // The class pick survived: after advancing to Class & Ability, Engineer's
    // SelCard ring is the active selection.
    await clickNext()
    expect(getPickByName('Engineer').getAttribute('aria-pressed')).toBe('true')

    // Cancel on a dirty form asks first; confirming discards the draft.
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    })
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Discard' }))
    })
    expect(onCancel).toHaveBeenCalledTimes(1)
    expect(sessionStorage.getItem('itun-wizard-draft:pilot:new')).toBeNull()
  }, 30000)
})
