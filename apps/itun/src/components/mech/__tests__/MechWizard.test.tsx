/**
 * Integration tests for MechWizard (wizard-refresh Phase 4): the Mech
 * Workshop's 8 book steps + Review (pp.94–95) with HARD 20-Scrap + slot
 * enforcement in create mode, and the soft edit regime.
 *
 * Exercises the flow Gain Scrap → Chassis → Statistics → Systems → Modules →
 * Quirk → Appearance → Pattern Name → Review → submit using the real wizard,
 * real SalvageUnionReference data, real Zod validation, and a
 * fake-indexeddb-backed entityStore.
 *
 * fake-indexeddb/auto and SalvageUnionReference are preloaded via bunfig.toml.
 */

import { afterEach, beforeEach, describe, expect, it, mock } from 'bun:test'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { nameToSlug, SalvageUnionReference } from 'salvageunion-reference'
import { legalStartingPatterns, MECH_CREATION_SCRAP_CAP } from 'salvageunion-reference/rules'
import { _clearAllStores, _resetDbSingleton } from '../../../lib/db/index'
import { mechFormToCreateInput, mechToFormState } from '../../../lib/wizard/mechFormState'
import { useEntityStore } from '../../../stores/entityStore'
import { LIVE_SHEET_MANUAL } from '../../../stores/surfaceProvenance'
import { must } from '../../__tests__/must'
import { MechWizard } from '../MechWizard'

// ---------------------------------------------------------------------------
// Pre-load reference data
// ---------------------------------------------------------------------------

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
  await useEntityStore.getState().hydrate('mech')
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
// Fixture lookups (real catalog)
// ---------------------------------------------------------------------------

function mule() {
  const chassis = SalvageUnionReference.Chassis.find((c) => c.name === 'Mule')
  if (!chassis) throw new Error('Mule chassis not found')
  return chassis
}

function systemByName(name: string) {
  const system = SalvageUnionReference.Systems.find((s) => s.name === name)
  if (!system) throw new Error(`system "${name}" not found`)
  return system
}

function moduleByName(name: string) {
  const module = SalvageUnionReference.Modules.find((m) => m.name === name)
  if (!module) throw new Error(`module "${name}" not found`)
  return module
}

// ---------------------------------------------------------------------------
// Interaction helpers (WizShell skeleton, Phase-4 layout)
// ---------------------------------------------------------------------------

/** Chassis / pattern picks are radio Sel rings named by the entity. */
async function pickRadio(name: string): Promise<void> {
  await act(async () => {
    fireEvent.click(screen.getByRole('radio', { name }))
  })
}

/** Craft-step count-stepper: one click of a card's `+`. */
async function addOne(name: string): Promise<void> {
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: `Add one ${name}` }))
  })
}

/** IdentityField click-to-edit write (quirk / pattern-name steps). */
async function typeIdentity(editLabel: string, value: string): Promise<void> {
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: editLabel }))
  })
  const input = screen.getByRole<HTMLInputElement>('textbox', { name: editLabel })
  await act(async () => {
    fireEvent.change(input, { target: { value } })
    fireEvent.blur(input, { target: { value } })
  })
}

/** The primary CTA is labeled from the steps array: 'Next · {step} →'. */
function getNextButton(): HTMLButtonElement {
  return screen.getByRole<HTMLButtonElement>('button', { name: /^Next ·/ })
}

async function clickNext(): Promise<void> {
  await act(async () => {
    fireEvent.click(getNextButton())
  })
}

async function submit(label: RegExp): Promise<void> {
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: label }))
  })
}

// ---------------------------------------------------------------------------
// Happy path: book-order custom build under the 20-Scrap economy
// ---------------------------------------------------------------------------

describe('MechWizard — book-order happy path (custom build)', () => {
  it('walks Scrap → Chassis → Stats → Systems → Modules → Quirk → Appearance → Name → Review and creates a legal mech', async () => {
    const onComplete = mock(() => {})
    render(<MechWizard onComplete={onComplete} onCancel={() => {}} />)

    // --- Step 1: Gain Scrap (briefing — Next always enabled; tracker debuts) ---
    expect(screen.getByTestId('scrap-remaining').textContent).toContain(
      `${MECH_CREATION_SCRAP_CAP} / ${MECH_CREATION_SCRAP_CAP}`
    )
    expect(getNextButton().disabled).toBe(false)
    await clickNext()

    // --- Step 2: Chassis (radio; SV debits the budget) ---
    await pickRadio('Mule')
    const afterChassis = MECH_CREATION_SCRAP_CAP - mule().salvageValue
    expect(screen.getByTestId('scrap-remaining').textContent).toContain(`${afterChassis} /`)
    await clickNext()

    // --- Step 3: Statistics (display only) ---
    expect(getNextButton().disabled).toBe(false)
    await clickNext()

    // --- Step 4: Systems (count-stepper; shared scrap pool + system slots) ---
    const cargoPod = systemByName('Cargo Pod')
    await addOne('Cargo Pod')
    expect(screen.getByTestId('scrap-remaining').textContent).toContain(
      `${afterChassis - cargoPod.salvageValue} /`
    )
    expect(screen.getByTestId('system-slot-count').textContent).toContain('1 /')
    await clickNext()

    // --- Step 5: Modules (optional; module slots) ---
    await addOne('Comms Module')
    expect(screen.getByTestId('module-slot-count').textContent).toContain('1 /')
    await clickNext()

    // --- Steps 6–7: Quirk + Appearance (flavor — never gate) ---
    await typeIdentity('Edit quirk', 'Rattles at speed')
    await clickNext()
    expect(getNextButton().disabled).toBe(false)
    await clickNext()

    // --- Step 8: Pattern Name (required; name IS pattern) ---
    expect(getNextButton().disabled).toBe(true)
    await typeIdentity('Edit name / pattern', 'Iron Fist')
    expect(getNextButton().disabled).toBe(false)
    await clickNext()

    // --- Review: text-only banking callout, then create ---
    expect(screen.getByTestId('banking-callout').textContent).toContain(
      `${afterChassis - cargoPod.salvageValue - moduleByName('Comms Module').salvageValue} Tech 1 Scrap banks`
    )
    await submit(/Create Mech/i)

    await waitFor(() => {
      const mechs = useEntityStore.getState().list('mech')
      expect(mechs.length).toBe(1)
      const m = must(mechs[0])
      expect(m.name).toBe('Iron Fist')
      expect(m.patternName).toBe('Iron Fist') // lockstep — a mech's name IS its pattern
      expect(m.chassisRef).toBe('mule')
      expect(m.systems).toEqual(['cargo-pod'])
      expect(m.modules).toEqual(['comms-module'])
      expect(m.cargoLots).toEqual([]) // guided create grants no starting cargo
      expect(m.quirk).toBe('Rattles at speed')
      expect(m.currentHeat).toBe(0)
      expect(m.schemaVersion).toBe(1)
    })

    expect(onComplete).toHaveBeenCalledTimes(1)
  }, 45000)
})

// ---------------------------------------------------------------------------
// Hard enforcement: filters, gates, and the chassis-change refund
// ---------------------------------------------------------------------------

describe('MechWizard — hard creation enforcement', () => {
  it('offers only Tech 1 chassis and only Tech 1 systems', async () => {
    render(<MechWizard onComplete={() => {}} onCancel={() => {}} />)
    await clickNext() // → Chassis

    const higherTlChassis = SalvageUnionReference.Chassis.find((c) => c.techLevel === 2)
    expect(higherTlChassis).toBeDefined()
    expect(screen.queryByRole('radio', { name: must(higherTlChassis).name })).toBeNull()

    await pickRadio('Mule')
    await clickNext() // → Stats
    await clickNext() // → Systems

    const higherTlSystem = SalvageUnionReference.Systems.find((s) => s.techLevel === 2)
    expect(higherTlSystem).toBeDefined()
    expect(
      screen.queryByRole('button', { name: `Add one ${must(higherTlSystem).name}` })
    ).toBeNull()
  }, 45000)

  it('gates the chassis and the pattern name; systems/modules stay optional', async () => {
    render(<MechWizard onComplete={() => {}} onCancel={() => {}} />)
    await clickNext() // → Chassis

    // Chassis required.
    expect(getNextButton().disabled).toBe(true)
    expect(screen.getByText('Craft your Chassis to continue')).toBeTruthy()
    await pickRadio('Mule')
    expect(getNextButton().disabled).toBe(false)
    await clickNext() // → Stats
    await clickNext() // → Systems

    // ZERO systems does not block (plan Q11) — the footer says so.
    expect(getNextButton().disabled).toBe(false)
    expect(screen.getByText(/Systems are optional/i)).toBeTruthy()
    await clickNext() // → Modules
    expect(getNextButton().disabled).toBe(false)
    await clickNext() // → Quirk
    await clickNext() // → Appearance
    await clickNext() // → Pattern Name

    // Name required — nothing persisted while blocked.
    expect(getNextButton().disabled).toBe(true)
    expect(screen.getByText('Name your Pattern to continue')).toBeTruthy()
    expect(useEntityStore.getState().list('mech').length).toBe(0)
    await typeIdentity('Edit name / pattern', 'Iron Fist')
    expect(getNextButton().disabled).toBe(false)
  }, 45000)

  it('changing the chassis refunds its scrap and wipes the loadout with a toast', async () => {
    render(<MechWizard onComplete={() => {}} onCancel={() => {}} />)
    await clickNext() // → Chassis
    await pickRadio('Mule')
    await clickNext() // → Stats
    await clickNext() // → Systems
    await addOne('Cargo Pod')
    expect(screen.getByTestId('system-slot-count').textContent).toContain('1 /')

    // Back to the chassis step, swap to another Tech 1 chassis.
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Craft your Chassis/i }))
    })
    await pickRadio('Scrapper')
    const scrapper = SalvageUnionReference.Chassis.find((c) => c.name === 'Scrapper')
    expect(screen.getByTestId('scrap-remaining').textContent).toContain(
      `${MECH_CREATION_SCRAP_CAP - must(scrapper).salvageValue} /`
    )
    await clickNext() // → Stats
    await clickNext() // → Systems
    // Loadout wiped — the Cargo Pod copy is gone (sr-only status readout).
    expect(screen.getByText('Cargo Pod count: 0')).toBeTruthy()
    expect(screen.getByTestId('system-slot-count').textContent).toContain('0 /')
  }, 45000)
})

// ---------------------------------------------------------------------------
// Starting-pattern strip: stored-flag filter + prefill arithmetic
// ---------------------------------------------------------------------------

describe('MechWizard — legalStarting pattern strip', () => {
  it('offers ONLY legalStarting patterns and prefills the loadout + name from the pick', async () => {
    const chassis = mule()
    const legal = legalStartingPatterns(chassis.patterns)
    expect(legal.length).toBeGreaterThan(0)
    const pattern = must(legal[0]) // 'Hauler Pattern'
    const unflagged = chassis.patterns.find((p) => p.legalStarting !== true)
    expect(unflagged).toBeDefined()

    render(<MechWizard onComplete={() => {}} onCancel={() => {}} />)
    await clickNext() // → Chassis
    await pickRadio('Mule')

    // Strip: the flagged pattern renders as a radio card; unflagged never does.
    expect(screen.getByRole('radio', { name: `${pattern.name} pattern` })).toBeTruthy()
    expect(screen.queryByRole('radio', { name: `${must(unflagged).name} pattern` })).toBeNull()

    await pickRadio(`${pattern.name} pattern`)
    // Prefill debits the budget: remaining drops below the bare-chassis value.
    const expectedSystems = pattern.systems.flatMap((s) =>
      new Array<string>(s.count ?? 1).fill(nameToSlug(s.name))
    )
    const expectedModules = pattern.modules.flatMap((m) =>
      new Array<string>(m.count ?? 1).fill(nameToSlug(m.name))
    )
    await clickNext() // → Stats
    await clickNext() // → Systems
    // The prefilled copies show in the counters (sr-only status readout).
    for (const slug of new Set(expectedSystems)) {
      const item = SalvageUnionReference.Systems.find((s) => nameToSlug(s.name) === slug)
      const count = expectedSystems.filter((x) => x === slug).length
      expect(screen.getByText(`${must(item).name} count: ${count}`)).toBeTruthy()
    }
    await clickNext() // → Modules
    await clickNext() // → Quirk
    await clickNext() // → Appearance
    await clickNext() // → Pattern Name (prefilled from the pattern pick)
    expect(getNextButton().disabled).toBe(false)
    await clickNext() // → Review
    await submit(/Create Mech/i)

    await waitFor(() => {
      const m = must(useEntityStore.getState().list('mech')[0])
      expect(m.name).toBe(pattern.name)
      expect(m.systems).toEqual(expectedSystems)
      expect(m.modules).toEqual(expectedModules)
    })
  }, 45000)
})

// ---------------------------------------------------------------------------
// Edit mode: soft regime — steps 2,4,5,6,7,8,Review; filters lifted
// ---------------------------------------------------------------------------

async function seedMuleMech() {
  const input = mechFormToCreateInput({
    name: 'Iron Fist',
    quirk: '',
    appearance: '',
    chassisName: 'mule',
    patternName: 'Iron Fist',
    systems: ['cargo-pod'],
    modules: [],
    cargoLots: [],
  })
  return useEntityStore.getState().create('mech', input)
}

describe('MechWizard — edit mode (soft regime)', () => {
  it('hides the briefing steps, lifts the filters, and updates without duplicating', async () => {
    const mech = await seedMuleMech()
    // Live-play state that the wizard patch must never clobber.
    await useEntityStore.getState().update(
      'mech',
      mech.id,
      {
        currentSP: 5,
        conditions: ['Vulnerable'],
        systemConditions: { 'cargo-pod': 'damaged' },
      },
      LIVE_SHEET_MANUAL
    )
    const onComplete = mock(() => {})

    render(
      <MechWizard
        mechId={mech.id}
        initialState={mechToFormState(mech)}
        onComplete={onComplete}
        onCancel={() => {}}
      />
    )

    // Edit chrome: no Gain Scrap / Statistics steps, no scrap tracker.
    expect(screen.getByText('Edit Mech')).toBeTruthy()
    expect(screen.queryByRole('button', { name: /Gain Scrap/i })).toBeNull()
    expect(screen.queryByRole('button', { name: /Mech Statistics/i })).toBeNull()
    expect(screen.queryByTestId('scrap-remaining')).toBeNull()

    // Chassis step: filters lifted — a Tech 2 chassis is offered.
    const higherTl = SalvageUnionReference.Chassis.find((c) => c.techLevel === 2)
    expect(screen.getByRole('radio', { name: must(higherTl).name })).toBeTruthy()
    expect(getNextButton().disabled).toBe(false)
    await clickNext() // → Systems (soft InstallStep — TL chips, add beyond caps)

    expect(screen.getByRole('group', { name: /Filter by tech level/i })).toBeTruthy()
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Add Armour Plating' }))
    })
    await clickNext() // → Modules
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Add Comms Module' }))
    })
    await clickNext() // → Quirk
    await clickNext() // → Appearance
    await clickNext() // → Pattern Name (prefilled)
    await clickNext() // → Review

    await submit(/Save Mech/i)

    await waitFor(() => {
      const mechs = useEntityStore.getState().list('mech')
      // Upsert branch: same record updated — never a duplicate create.
      expect(mechs.length).toBe(1)
      const m = must(mechs[0])
      expect(m.id).toBe(mech.id)
      expect([...m.systems].sort()).toEqual(['armour-plating', 'cargo-pod'])
      expect(m.modules).toEqual(['comms-module'])
      // Live-play state untouched by the wizard patch.
      expect(m.currentSP).toBe(5)
      expect(m.conditions).toEqual(['Vulnerable'])
      expect(m.systemConditions).toEqual({ 'cargo-pod': 'damaged' })
      // Assert inside waitFor: the wizard persists to the store before invoking
      // onComplete in a later microtask, so a bare assertion here races under
      // heavy parallel load.
      expect(onComplete).toHaveBeenCalledWith(mech.id)
    })
  }, 45000)

  it('over-slot installs warn but never block in edit mode', async () => {
    const mech = await seedMuleMech()
    render(
      <MechWizard
        mechId={mech.id}
        initialState={mechToFormState(mech)}
        onComplete={() => {}}
        onCancel={() => {}}
      />
    )

    await clickNext() // → Systems
    await clickNext() // → Modules
    // Mule has 2 module slots — install three 1-slot modules to breach it.
    for (const name of ['Comms Module', 'Equipment Locker', 'Firewall']) {
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: `Add ${name}` }))
      })
    }
    expect(screen.getByText(/Module slots exceeded/i)).toBeTruthy()
    expect(getNextButton().disabled).toBe(false)
  }, 45000)
})
