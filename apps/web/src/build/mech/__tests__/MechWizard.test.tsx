/**
 * Integration tests for MechWizard: the Mech Workshop's book steps (pp.94–95)
 * as four decisions, with HARD 20-Scrap + slot enforcement.
 *
 * Exercises the flow Chassis → Systems & Modules → Quirk & Look → Name &
 * Review → submit using the real wizard,
 * real SalvageUnionReference data, real Zod validation, and the real
 * in-memory entityStore (signed in, server commits stubbed).
 *
 * SalvageUnionReference is preloaded via bunfig.toml.
 */

import { describe, expect, it, mock } from 'bun:test'
import { act, render, screen, waitFor } from '@testing-library/react'
import { nameToSlug, SalvageUnionReference } from 'salvageunion-reference'
import { legalStartingPatterns, MECH_CREATION_SCRAP_CAP } from 'salvageunion-reference/rules'
import { must } from '../../../components/__tests__/must'
import { useUnits } from '../../../replica/units'
import {
  addOne,
  clickButton,
  clickNext,
  fillIdentity,
  getNextButton,
  getStep,
  isPicked,
  pickRadio,
  withWizardStore,
} from '../../__tests__/wizardHarness'
import { leftoverLine } from '../leftoverLine.model'
import { MechWizard } from '../MechWizard'

withWizardStore('mech')

// ---------------------------------------------------------------------------
// Fixture lookups (real catalog)
// ---------------------------------------------------------------------------

function mule() {
  const chassis = SalvageUnionReference.Chassis.getByName('Mule')
  if (!chassis) throw new Error('Mule chassis not found')
  return chassis
}

function systemByName(name: string) {
  const system = SalvageUnionReference.Systems.getByName(name)
  if (!system) throw new Error(`system "${name}" not found`)
  return system
}

// ---------------------------------------------------------------------------
// Interaction helpers (WizShell skeleton)
// ---------------------------------------------------------------------------

/** A row's Qty stepper reading: the value of the `Stat` its `−` follows. */
function qtyOf(name: string): string | undefined {
  return (
    getStep(name, 'Decrease').previousElementSibling?.querySelector('.su-stat-plate--value')
      ?.textContent ?? undefined
  )
}

/** The Create button, on the last step. */
function getCreateButton(): HTMLButtonElement {
  return screen.getByRole<HTMLButtonElement>('button', { name: /Create Mech/i })
}

function renderWizard() {
  return render(<MechWizard onComplete={() => {}} onCancel={() => {}} />)
}

/** Chassis (the Mule) → Systems & Modules. */
async function walkToLoadout(): Promise<void> {
  await pickRadio('Mule')
  await clickNext() // → Systems & Modules
}

// ---------------------------------------------------------------------------
// Happy path: book-order custom build under the 20-Scrap economy
// ---------------------------------------------------------------------------

describe('MechWizard — book-order happy path (custom build)', () => {
  it('walks Chassis → Systems & Modules → Quirk & Look → Name & Review and creates a legal mech', async () => {
    const onComplete = mock(() => {})
    render(<MechWizard onComplete={onComplete} onCancel={() => {}} />)

    // --- Step 1: Chassis (the book's Gain Scrap is its rule; the tracker debuts full) ---
    expect(screen.getByTestId('scrap-spent').textContent).toContain(`0/${MECH_CREATION_SCRAP_CAP}`)
    // A radio; its SV debits the budget.
    await pickRadio('Mule')
    const afterChassis = MECH_CREATION_SCRAP_CAP - mule().salvageValue
    expect(screen.getByTestId('scrap-spent').textContent).toContain(`${mule().salvageValue}/`)
    await clickNext()

    // --- Step 2: Systems (Qty stepper; shared scrap pool + system slots) ---
    const cargoPod = systemByName('Cargo Pod')
    await addOne('Cargo Pod')
    expect(screen.getByTestId('scrap-spent').textContent).toContain(
      `${MECH_CREATION_SCRAP_CAP - afterChassis + cargoPod.salvageValue}/`
    )
    expect(screen.getByTestId('system-slot-count').textContent).toContain('1/')

    // --- and Modules, in the same step (optional; module slots) ---
    await addOne('Comms Module')
    expect(screen.getByTestId('module-slot-count').textContent).toContain('1/')
    await clickNext()

    // --- Step 3: Quirk + Appearance (flavor — never gates) ---
    await fillIdentity('quirk', 'Rattles at speed')
    expect(getNextButton().disabled).toBe(false)
    await clickNext()

    // --- Step 4: Pattern Name (required; name IS pattern), over the review ---
    expect(getCreateButton().disabled).toBe(true)
    await fillIdentity('mech name', 'Iron Fist')
    expect(getCreateButton().disabled).toBe(false)

    // The leftover Scrap is said, and goes into the hold on Create (r2 E7).
    const leftover =
      afterChassis -
      cargoPod.salvageValue -
      (SalvageUnionReference.Modules.getByName('Comms Module')?.salvageValue ?? 0)
    expect(
      screen.getByText(new RegExp(`^${leftover} Scrap left over goes into this Mech’s hold\\.`))
    ).toBeTruthy()
    await clickButton(/Create Mech/i)

    await waitFor(() => {
      const mechs = useUnits.getState().list('mech')
      expect(mechs.length).toBe(1)
      const m = must(mechs[0])
      expect(m.name).toBe('Iron Fist')
      // A custom build started from no book pattern: the name is the pattern's, with no provenance.
      expect(m.startingPatternRef).toBeUndefined()
      expect(m.chassisRef).toBe('mule')
      expect(m.systems).toEqual(['cargo-pod'])
      expect(m.modules).toEqual(['comms-module'])
      // The unspent Scrap is carried: one Tech 1 Scrap line, nothing else.
      expect(m.cargoLots).toHaveLength(1)
      expect(m.cargoLots[0]).toMatchObject({ cat: 'SCRAP', tl: 1, qty: leftover, kind: 'bulk' })
      expect(m.quirk).toBe('Rattles at speed')
      expect(m.currentHeat).toBeUndefined()
      expect(m.schemaVersion).toBe(1)
    })

    expect(onComplete).toHaveBeenCalledTimes(1)
  })
})

// ---------------------------------------------------------------------------
// Hard enforcement: filters, gates, and the chassis-change refund
// ---------------------------------------------------------------------------

describe('MechWizard — hard creation enforcement', () => {
  it('offers only Tech 1 chassis and only Tech 1 systems', async () => {
    renderWizard()

    const higherTlChassis = SalvageUnionReference.Chassis.find((c) => c.techLevel === 2)
    expect(higherTlChassis).toBeDefined()
    expect(screen.queryByRole('radio', { name: must(higherTlChassis).name })).toBeNull()

    await pickRadio('Mule')
    await clickNext() // → Systems & Modules

    const higherTlSystem = SalvageUnionReference.Systems.find((s) => s.techLevel === 2)
    expect(higherTlSystem).toBeDefined()
    expect(
      screen.queryByRole('button', { name: `Increase ${must(higherTlSystem).name} count` })
    ).toBeNull()
  })

  it('gates the chassis and the pattern name; systems/modules stay optional', async () => {
    renderWizard()

    // Chassis required.
    expect(getNextButton().disabled).toBe(true)
    expect(screen.getByText('Craft your Chassis to continue')).toBeTruthy()
    await pickRadio('Mule')
    expect(getNextButton().disabled).toBe(false)
    await clickNext() // → Systems & Modules

    // ZERO systems and modules does not block.
    expect(getNextButton().disabled).toBe(false)
    await clickNext() // → Quirk & Look
    expect(getNextButton().disabled).toBe(false)
    await clickNext() // → Name & Review

    // Name required — nothing persisted while blocked.
    expect(getCreateButton().disabled).toBe(true)
    expect(screen.getByText('Name your Mech to continue')).toBeTruthy()
    expect(useUnits.getState().list('mech').length).toBe(0)
    await fillIdentity('mech name', 'Iron Fist')
    expect(getCreateButton().disabled).toBe(false)
  })

  it('changing the chassis refunds its scrap and wipes the loadout with a toast', async () => {
    renderWizard()
    await walkToLoadout()
    await addOne('Cargo Pod')
    expect(screen.getByTestId('system-slot-count').textContent).toContain('1/')

    // Back to the chassis step, swap to another Tech 1 chassis.
    await clickButton(/Chassis$/)
    await pickRadio('Scrapper')
    const scrapper = SalvageUnionReference.Chassis.getByName('Scrapper')
    expect(screen.getByTestId('scrap-spent').textContent).toContain(
      `${must(scrapper).salvageValue}/`
    )
    await clickNext() // → Systems & Modules
    // Loadout wiped — the Cargo Pod copy is gone (its Qty stepper reads 0).
    expect(qtyOf('Cargo Pod')).toBe('0')
    expect(screen.getByTestId('system-slot-count').textContent).toContain('0/')
  })
})

// ---------------------------------------------------------------------------
// Starting-pattern strip: stored-flag filter + prefill arithmetic
// ---------------------------------------------------------------------------

describe('MechWizard — a dimmed row says which limit it is (r4 E22)', () => {
  it('marks every row that no longer fits with Slots or Scrap, on the row', async () => {
    renderWizard()
    await walkToLoadout()
    // Spend until something no longer fits.
    for (let i = 0; i < 12 && document.querySelector('tr[data-blocked]') === null; i++)
      await addOne('Cargo Pod')
    const dimmed = [...document.querySelectorAll('tr[data-blocked]')]
    expect(dimmed.length).toBeGreaterThan(0)
    for (const row of dimmed) {
      const why = row.querySelector('.su-ledger__why')?.textContent
      expect(['Too few Slots', 'Too little Scrap']).toContain(why as string)
      // The mark agrees with the fuller reason a pointer reads.
      expect(row.getAttribute('title')).toContain(why === 'Too few Slots' ? 'Slots' : 'Scrap')
    }
  })
})

describe('MechWizard — legalStarting pattern strip', () => {
  it('picks ONLY legalStarting patterns, lists the rest dimmed, and prefills the loadout + name from the pick', async () => {
    const chassis = mule()
    const legal = legalStartingPatterns(chassis.patterns)
    expect(legal.length).toBeGreaterThan(0)
    const pattern = must(legal[0]) // 'Hauler Pattern'
    const unflagged = chassis.patterns.find((p) => p.legalStarting !== true)
    expect(unflagged).toBeDefined()

    renderWizard()
    await pickRadio('Mule')

    // The flagged pattern is a row of the pattern list; an unflagged one is
    // listed too, dimmed with its reason, and a press on it picks nothing.
    expect(screen.getByRole('radio', { name: pattern.name })).toBeTruthy()
    const beyond = screen.getByRole('radio', { name: must(unflagged).name })
    expect(beyond.closest('[data-blocked]')?.getAttribute('title')).toMatch(
      /Not a starting Pattern/
    )
    // The reason is on the row itself, not only a line under the table (r4 E22).
    expect(beyond.closest('tr')?.querySelector('.su-ledger__why')?.textContent).toBe(
      'Not a starting build'
    )
    await pickRadio(must(unflagged).name)
    expect((beyond as HTMLInputElement).checked).toBe(false)

    await pickRadio(pattern.name)
    // Prefill debits the budget: remaining drops below the bare-chassis value.
    const expectedSystems = pattern.systems.flatMap((s) =>
      new Array<string>(s.count ?? 1).fill(nameToSlug(s.name))
    )
    const expectedModules = pattern.modules.flatMap((m) =>
      new Array<string>(m.count ?? 1).fill(nameToSlug(m.name))
    )
    // A whole build: the pick opens Name & Review, the name prefilled (r7 F9).
    expect(await screen.findByRole('button', { name: /Create Mech/i })).toBeTruthy()
    expect(getCreateButton().disabled).toBe(false)
    // Systems & Modules stays one press back on the rail, the copies in its steppers.
    await clickButton(/Systems & Modules/)
    for (const slug of new Set(expectedSystems)) {
      const item = SalvageUnionReference.Systems.find((s) => nameToSlug(s.name) === slug)
      const count = expectedSystems.filter((x) => x === slug).length
      expect(qtyOf(must(item).name)).toBe(String(count))
    }
    await clickNext() // → Quirk & Look
    await clickNext() // → Name & Review
    expect(getCreateButton().disabled).toBe(false)
    await clickButton(/Create Mech/i)

    await waitFor(() => {
      const m = must(useUnits.getState().list('mech')[0])
      expect(m.name).toBe(pattern.name)
      expect(m.systems).toEqual(expectedSystems)
      expect(m.modules).toEqual(expectedModules)
    })
  })
})

// ---------------------------------------------------------------------------
// Deep-link preselection (`?chassis=` from an SRD chassis page)
// ---------------------------------------------------------------------------

describe('MechWizard — preselected chassis', () => {
  it('starts on the deep-linked chassis, debited, with nothing to discard', async () => {
    const onCancel = mock(() => {})
    render(<MechWizard onComplete={() => {}} onCancel={onCancel} preselectChassis="mule" />)

    expect(screen.getByTestId('scrap-spent').textContent).toContain(`${mule().salvageValue}/`)
    expect(isPicked('Mule')).toBe(true)
    expect(getNextButton().disabled).toBe(false)

    // The preselection is the baseline: cancelling asks nothing.
    await clickButton('Cancel')
    expect(onCancel).toHaveBeenCalledTimes(1)
  }, 30000)

  it('a deep-linked pattern opens at the review with its loadout prefilled, with nothing to discard', async () => {
    const hauler = must(mule().patterns.find((p) => p.name === 'Hauler'))
    const onCancel = mock(() => {})
    render(
      <MechWizard
        onComplete={() => {}}
        onCancel={onCancel}
        preselectChassis="mule"
        preselectPattern={hauler}
      />
    )
    // It opens at the review (r6 E6), the pattern's loadout debited along with the chassis.
    expect(screen.getAllByText('Name your Mech and review it').length).toBeGreaterThan(0)
    expect(screen.getByTestId('scrap-spent').textContent).not.toContain(`${mule().salvageValue}/`)
    // The preselection is the baseline: cancelling asks nothing.
    await clickButton('Cancel')
    expect(onCancel).toHaveBeenCalledTimes(1)
  }, 30000)

  it('never overrides the chassis of a build in progress', async () => {
    const { unmount } = renderWizard()
    await pickRadio('Mule')
    await act(async () => {
      unmount()
    })

    const other = must(
      SalvageUnionReference.Chassis.all().find((c) => c.techLevel === 1 && c.name !== 'Mule')
    )
    render(
      <MechWizard
        onComplete={() => {}}
        onCancel={() => {}}
        preselectChassis={nameToSlug(other.name)}
      />
    )
    expect(isPicked('Mule')).toBe(true)
  }, 30000)
})

describe('MechWizard — leftover Scrap (U12, r2 E7)', () => {
  async function toReview() {
    renderWizard()
    await pickRadio('Mule')
    await clickNext()
    await clickNext()
    await clickNext()
  }

  it('says how much goes into the hold, crawler or none', async () => {
    await toReview()
    const leftover = MECH_CREATION_SCRAP_CAP - mule().salvageValue
    expect(
      screen.getByText(new RegExp(`^${leftover} Scrap left over goes into this Mech’s hold\\.`))
    ).toBeTruthy()
    expect(screen.queryByText(/banks to your Union Crawler/)).toBeNull()
  })

  it('says how many went in and how many are left for the crawler when the hold fills (r3 F1)', () => {
    expect(leftoverLine({ stowed: 7, banked: 9 })).toBe(
      '16 Scrap left over: 7 goes into this Mech’s hold, which is then full (each Scrap takes one Cargo Slot, Core Book p.246). The other 9 is for your Union Crawler’s Scrap Pool.'
    )
    expect(leftoverLine({ stowed: 0, banked: 4 })).toBe(
      '4 Scrap left over. The hold is full, so it is for your Union Crawler’s Scrap Pool.'
    )
  })
})
