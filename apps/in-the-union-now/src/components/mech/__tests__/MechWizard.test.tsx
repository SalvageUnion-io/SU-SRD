/**
 * Integration tests for MechWizard (create + edit on the WizShell skeleton).
 *
 * Exercises the flow Chassis → Pattern → (Loadout, custom only) → Identity →
 * Review → submit using the real wizard, real SalvageUnionReference data, real
 * Zod validation, and a fake-indexeddb-backed entityStore.
 *
 * fake-indexeddb/auto is preloaded via bunfig.toml.
 * SalvageUnionReference is preloaded in beforeAll.
 */

import { afterEach, beforeAll, beforeEach, describe, expect, it, mock } from 'bun:test'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { SalvageUnionReference, nameToSlug } from 'salvageunion-reference'
import { useEntityStore } from '../../../stores/entityStore'
import { _clearAllStores, _resetDbSingleton } from '../../../lib/db/index'
import { mechFormToCreateInput, mechToFormState } from '../../../lib/wizard/mechFormState'
import { MechWizard } from '../MechWizard'
import { patternsForChassis } from '../patternData'

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
 * Chassis/pattern rows are OptRow <button>s whose accessible text contains the
 * name; system/module cards are Sel wrappers — div[role="button"] with
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

/** Loadout Systems/Modules tab buttons are role="tab". */
async function clickTab(name: 'Systems' | 'Modules'): Promise<void> {
  await act(async () => {
    fireEvent.click(screen.getByRole('tab', { name }))
  })
}

/**
 * Loadout install cards expose a per-entity "Add" button (aria-label
 * "Add {name}"). Each click appends one copy — duplicates are rules-legal.
 */
async function addInstall(name: string): Promise<void> {
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: `Add ${name}` }))
  })
}

/**
 * Each chosen loadout entry in the right-hand panel has a "Remove {name}"
 * button that drops a single copy (remove-by-index). When duplicates exist
 * there are multiple matching buttons; click the first.
 */
async function removeInstall(name: string): Promise<void> {
  const buttons = screen.getAllByRole('button', { name: `Remove ${name}` })
  await act(async () => {
    fireEvent.click(buttons[0]!)
  })
}

async function typeInto(label: RegExp, value: string): Promise<void> {
  const input = screen.getByLabelText(label) as HTMLInputElement
  await act(async () => {
    fireEvent.change(input, { target: { value } })
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
// Happy path: custom-pattern mech creation
// ---------------------------------------------------------------------------

describe('MechWizard — custom pattern happy path', () => {
  it('walks Chassis → Pattern(custom) → Loadout → Identity → Review and creates a mech', async () => {
    const onComplete = mock(() => {})
    render(<MechWizard onComplete={onComplete} onCancel={() => {}} />)

    // --- Step 1: Chassis (master-detail OptRow list) ---
    await pick('Mule')
    await clickNext()

    // --- Step 2: Pattern — Custom requires a name before advancing ---
    expect(getNextButton().disabled).toBe(true)
    await pick('Custom Pattern')
    expect(getNextButton().disabled).toBe(true)
    await typeInto(/Pattern name/i, 'Field Rig')
    expect(getNextButton().disabled).toBe(false)
    await clickNext()

    // --- Step 3: Loadout — combined Systems / Modules tabs ---
    expect(screen.getByTestId('system-slot-count').textContent).toContain('0 /')
    await addInstall('Cargo Pod')
    expect(screen.getByTestId('system-slot-count').textContent).toContain('1 /')
    await clickTab('Modules')
    await addInstall('Comms Module')
    expect(screen.getByTestId('module-slot-count').textContent).toContain('1 /')
    await clickNext()

    // --- Step 4: Identity (name required) ---
    await typeInto(/Mech name/i, 'Iron Fist')
    await clickNext()

    // --- Step 5: Review → submit ('Create Mech ✦') ---
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Create Mech/i }))
    })

    await waitFor(() => {
      const mechs = useEntityStore.getState().list('mech')
      expect(mechs.length).toBe(1)
      const m = mechs[0]!
      expect(m.name).toBe('Iron Fist')
      expect(m.chassisRef).toBe('mule')
      expect(m.patternName).toBe('Field Rig')
      expect(m.systems).toEqual(['cargo-pod'])
      expect(m.modules).toEqual(['comms-module'])
      expect(m.cargoLots).toEqual([])
      expect(m.currentHeat).toBe(0)
      expect(m.schemaVersion).toBe(1)
    })

    expect(onComplete).toHaveBeenCalledTimes(1)
  }, 30000)
})

// ---------------------------------------------------------------------------
// Canonical pattern: fills the loadout and skips the Loadout step
// ---------------------------------------------------------------------------

describe('MechWizard — canonical pattern', () => {
  it('fills systems/modules from the chosen pattern and skips the Loadout step', async () => {
    const pattern = patternsForChassis('Mule')[0]
    expect(pattern).toBeDefined()

    render(<MechWizard onComplete={() => {}} onCancel={() => {}} />)

    await pick('Mule')
    await clickNext()

    // Pick a ready-made pattern, then Next jumps straight to Identity.
    await pick(pattern!.name)
    await clickNext()

    // Loadout was skipped — its slot-count subtitle is absent; the Identity
    // name field is present.
    expect(screen.queryByTestId('system-slot-count')).toBeNull()
    await typeInto(/Mech name/i, 'Workhorse')
    await clickNext()

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Create Mech/i }))
    })

    await waitFor(() => {
      const m = useEntityStore.getState().list('mech')[0]!
      expect(m.patternName).toBe(pattern!.name)
      expect(m.systems).toEqual((pattern!.systems ?? []).map((s) => nameToSlug(s.name)))
      expect(m.modules).toEqual((pattern!.modules ?? []).map((mod) => nameToSlug(mod.name)))
    })
  }, 30000)
})

// ---------------------------------------------------------------------------
// Gating: chassis, pattern, and name are required; capacity never blocks
// ---------------------------------------------------------------------------

describe('MechWizard — gates', () => {
  it('gates chassis, pattern (custom needs a name), and the mech name', async () => {
    render(<MechWizard onComplete={() => {}} onCancel={() => {}} />)

    // Chassis required.
    expect(getNextButton().disabled).toBe(true)
    await pick('Mule')
    expect(getNextButton().disabled).toBe(false)
    await clickNext()

    // Pattern required — Custom blocks until a name is typed.
    expect(getNextButton().disabled).toBe(true)
    await pick('Custom Pattern')
    expect(getNextButton().disabled).toBe(true)
    await typeInto(/Pattern name/i, 'Rig')
    expect(getNextButton().disabled).toBe(false)
    await clickNext() // Loadout
    await clickNext() // Identity (loadout optional)

    // Identity — Next disabled with the name empty; no mech persisted.
    expect(getNextButton().disabled).toBe(true)
    expect(useEntityStore.getState().list('mech').length).toBe(0)
    await typeInto(/Mech name/i, 'Iron Fist')
    expect(getNextButton().disabled).toBe(false)
  }, 30000)

  it('over-slot module selection warns but never blocks navigation', async () => {
    render(<MechWizard onComplete={() => {}} onCancel={() => {}} />)

    await pick('Mule')
    await clickNext() // Pattern
    await pick('Custom Pattern')
    await typeInto(/Pattern name/i, 'Rig')
    await clickNext() // Loadout

    // Mule has 2 module slots — install three 1-slot modules to breach it.
    await clickTab('Modules')
    await addInstall('Comms Module')
    await addInstall('Equipment Locker')
    await addInstall('Firewall')

    // Soft warning banner appears…
    expect(screen.getByTestId('module-slot-count').textContent).toContain('3 /')
    expect(screen.getByText(/Module slots exceeded/i)).toBeTruthy()
    // …and Next stays enabled (capacity is soft — warn, never block).
    expect(getNextButton().disabled).toBe(false)
  }, 30000)
})

// ---------------------------------------------------------------------------
// Duplicate installs: per-entity "Add" appends copies; remove drops ONE
// ---------------------------------------------------------------------------

describe('MechWizard — duplicate installs', () => {
  it('adds multiple copies of the same system and persists every copy', async () => {
    render(<MechWizard onComplete={() => {}} onCancel={() => {}} />)

    await pick('Mule')
    await clickNext() // Pattern
    await pick('Custom Pattern')
    await typeInto(/Pattern name/i, 'Twin Rig')
    await clickNext() // Loadout

    // First click installs one; the card flips to an "Add another" affordance
    // and an "N Installed" count.
    await addInstall('Cargo Pod')
    expect(screen.getByTestId('install-count-Cargo Pod').textContent).toContain('1 Installed')
    await addInstall('Cargo Pod') // "Add another"
    expect(screen.getByTestId('install-count-Cargo Pod').textContent).toContain('2 Installed')
    expect(screen.getByTestId('system-slot-count').textContent).toContain('2 /')
    // The Loadout panel lists each copy as its own removable entry.
    expect(screen.getAllByTestId('loadout-entry').length).toBe(2)

    await clickNext() // Identity
    await typeInto(/Mech name/i, 'Iron Fist')
    await clickNext() // Review
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Create Mech/i }))
    })

    await waitFor(() => {
      const m = useEntityStore.getState().list('mech')[0]!
      expect(m.systems).toEqual(['cargo-pod', 'cargo-pod'])
    })
  }, 30000)

  it('removes a single copy (by index) leaving the other duplicate intact', async () => {
    render(<MechWizard onComplete={() => {}} onCancel={() => {}} />)

    await pick('Mule')
    await clickNext() // Pattern
    await pick('Custom Pattern')
    await typeInto(/Pattern name/i, 'Twin Rig')
    await clickNext() // Loadout

    await addInstall('Cargo Pod')
    await addInstall('Cargo Pod')
    expect(screen.getAllByTestId('loadout-entry').length).toBe(2)

    // Remove ONE copy — the count drops to 1, one entry remains.
    await removeInstall('Cargo Pod')
    expect(screen.getAllByTestId('loadout-entry').length).toBe(1)
    expect(screen.getByTestId('install-count-Cargo Pod').textContent).toContain('1 Installed')
    expect(screen.getByTestId('system-slot-count').textContent).toContain('1 /')

    await clickNext() // Identity
    await typeInto(/Mech name/i, 'Iron Fist')
    await clickNext() // Review
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Create Mech/i }))
    })

    await waitFor(() => {
      const m = useEntityStore.getState().list('mech')[0]!
      expect(m.systems).toEqual(['cargo-pod'])
    })
  }, 30000)
})

// ---------------------------------------------------------------------------
// Canonical patterns: duplicate equipment in a pre-made pattern survives copy
// ---------------------------------------------------------------------------

describe('MechWizard — pattern duplicates', () => {
  it('renders one preview card per copy and preserves duplicates when copying a canonical pattern', async () => {
    // Find a chassis whose pattern data contains a repeated system or module,
    // and capture the repeated name + its copy count.
    const allChassis = SalvageUnionReference.Chassis.all()
    let target:
      | {
          chassisName: string
          pattern: ReturnType<typeof patternsForChassis>[number]
          dupName: string
          dupCount: number
        }
      | undefined
    for (const c of allChassis) {
      for (const p of patternsForChassis(c.name)) {
        const names = [...(p.systems ?? []), ...(p.modules ?? [])].map((e) => e.name)
        const counts = new Map<string, number>()
        for (const n of names) counts.set(n, (counts.get(n) ?? 0) + 1)
        const dup = [...counts.entries()].find(([, count]) => count > 1)
        if (dup) {
          target = { chassisName: c.name, pattern: p, dupName: dup[0], dupCount: dup[1] }
          break
        }
      }
      if (target) break
    }

    // Fail loudly rather than silently no-op: a canonical pattern with
    // duplicate equipment is required fixture data (today: Trooper / DronTek,
    // with Articulated Rigging Arm ×2). If this ever returns undefined the
    // fixture has drifted and the test must be updated, not silently skipped.
    expect(
      target,
      'expected a canonical pattern shipping duplicate equipment (fixture drift?)'
    ).toBeDefined()
    const { chassisName, pattern, dupName, dupCount } = target!

    render(<MechWizard onComplete={() => {}} onCancel={() => {}} />)
    await pick(chassisName)
    await clickNext() // Pattern

    // Select the canonical pattern — its Loadout preview renders below.
    await pick(pattern.name)

    // The preview renders one head card per copy: the repeated entity's name
    // appears `dupCount` times (the per-index keys keep both copies mounted
    // instead of collapsing the repeat onto a single name-keyed card).
    await waitFor(() => {
      expect(screen.getAllByText(dupName).length).toBe(dupCount)
    })

    await clickNext() // Identity (canonical pattern skips Loadout)
    await typeInto(/Mech name/i, 'Pattern Build')
    await clickNext() // Review
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Create Mech/i }))
    })

    await waitFor(() => {
      const m = useEntityStore.getState().list('mech')[0]!
      // Duplicates from the canonical pattern survive the copy + persistence.
      expect(m.systems).toEqual((pattern.systems ?? []).map((s) => nameToSlug(s.name)))
      expect(m.modules).toEqual((pattern.modules ?? []).map((mod) => nameToSlug(mod.name)))
    })
  }, 30000)
})

// ---------------------------------------------------------------------------
// Edit mode: upsert branch — loadout edits without duplicating
// ---------------------------------------------------------------------------

async function seedMuleMech() {
  const input = mechFormToCreateInput({
    name: 'Iron Fist',
    description: '',
    chassisName: 'mule',
    patternName: '',
    systems: ['cargo-pod'],
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
      systemConditions: { 'cargo-pod': 'damaged' },
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
    await clickNext() // Pattern (edit lands on the custom path; name optional)
    expect(getNextButton().disabled).toBe(false)
    await clickNext() // Loadout

    // Loadout panel shows the prefilled install (no empty-state message).
    expect(screen.queryByText(/Nothing installed yet/i)).toBeNull()
    await addInstall('Armour Plating') // add a second system
    await clickTab('Modules')
    await addInstall('Comms Module')
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
      expect(m.systems.sort()).toEqual(['armour-plating', 'cargo-pod'])
      expect(m.modules).toEqual(['comms-module'])
      // Live-play state untouched by the wizard patch.
      expect(m.currentSP).toBe(5)
      expect(m.conditions).toEqual(['Vulnerable'])
      expect(m.systemConditions).toEqual({ 'cargo-pod': 'damaged' })
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

    await clickNext() // Pattern
    await clickNext() // Loadout
    await removeInstall('Cargo Pod') // remove the only system via the Loadout panel
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
    const pattern = patternsForChassis('Mule')[0]
    render(<MechWizard onComplete={() => {}} onCancel={() => {}} />)

    await pick('Mule')
    await clickNext() // Pattern
    await pick(pattern!.name) // canonical pattern — skips the Loadout step
    await clickNext() // Identity

    await typeInto(/Mech name/i, 'Iron Fist')

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
