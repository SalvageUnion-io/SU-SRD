import type { UnitsStore } from '../../../replica/units'
/**
 * Pilot hero on the LiveSheet shell
 *
 * Replaces the old PilotSheet-editable body-stat tests: HP/AP/TP now live as
 * hero StatBlock trackers wired straight to the entity store.
 *
 * Asserts that:
 *   1. HP/AP steppers persist currentHP/currentAP via store.update.
 *   2. Maxima are DERIVED: injuries lower max HP (10 + mod − Σ injuries).
 *   3. TP is an unbounded counter (no max readout) persisting trainingPoints.
 *   4. Used-toggles (background/motto/keepsake) render as chips in the
 *      identity block and persist usedToggles.
 *   5. Dead state (derived max HP ≤ 0) surfaces a Dead pill + KIA banner.
 *   6. readOnly suppresses steppers, used-toggle buttons and all writes.
 *   7. readOnly prints no Read | Edit, and the identity card repeats
 *      nothing the band already says (class; a callsign that is the name).
 */

import { beforeAll, describe, expect, mock, test } from 'bun:test'
import { act, fireEvent, render, screen, within } from '@testing-library/react'
import type { Pilot } from 'game-domain/schemas/pilot'
import { pilotFixture } from '../../../components/__tests__/fixtures'
import { hydrateStores } from '../../../components/__tests__/hydrateStores'
import {
  makeEntityLookupMock,
  makeEntityStoreMock,
  makeSoftLinkStoreMock,
} from '../../../components/__tests__/mockEntityStore'
import { must } from '../../../components/__tests__/must'
import { LIVE_SHEET_MANUAL } from '../../../replica/provenance'
import { pilotStamp } from '../bandStamps.model'
import { Sheet } from '../Sheet'

beforeAll(hydrateStores)

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makePilot(overrides: Partial<Pilot> = {}): Pilot {
  return pilotFixture({
    id: 'pilot-hero-1',
    name: 'Yara Voss',
    callsign: 'Ghost',
    motto: 'Waste not.',
    keepsake: 'A bent coin.',
    background: 'Union-born.',
    currentHP: 10,
    currentAP: 4,
    ...overrides,
  })
}

function makeStubStore(pilot: Pilot, updateSpy?: ReturnType<typeof mock>): UnitsStore {
  const updateMock = updateSpy ?? mock(async () => pilot)
  return makeEntityStoreMock({
    pilots: [pilot],
    hydrated: { pilots: true, mechs: false, crawlers: false, npcs: false, softLinks: false },
    hydrate: mock(async () => {}),
    list: mock(() => [pilot]),
    get: mock((_type: string, id: string) => (id === pilot.id ? pilot : null)),
    create: mock(async () => pilot),
    update: updateMock,
    delete: mock(async () => {}),
  })
}

function renderHero(pilot: Pilot, updateSpy?: ReturnType<typeof mock>, readOnly = false) {
  return render(
    <Sheet
      kind="pilot"
      id={pilot.id}
      entityStore={makeEntityLookupMock([pilot])}
      softLinkStore={makeSoftLinkStoreMock()}
      store={makeStubStore(pilot, updateSpy)}
      readOnly={readOnly}
    />
  )
}

// ---------------------------------------------------------------------------
// HP / AP trackers
// ---------------------------------------------------------------------------

describe('Pilot hero — HP/AP trackers', () => {
  test('HP tracker shows current of derived max (base 10)', () => {
    renderHero(makePilot({ currentHP: 7 }))
    expect(screen.getByRole('group', { name: 'HP 7 of 10' })).toBeTruthy()
  })

  test('clicking the top-lit HP segment persists the decremented currentHP', async () => {
    // HP/AP are VitalGauges (poster §gauge): clicking the top-lit segment
    // (index 6) steps HP 7 → 6 (pipClickValue click-to-set). The segments are
    // pointer-only; the track is the one `slider` tab stop that takes the click.
    const pilot = makePilot({ currentHP: 7 })
    const updateSpy = mock(async () => pilot)
    renderHero(pilot, updateSpy)

    await act(async () => {
      const hp = screen.getByRole('slider', { name: 'HP' })
      fireEvent.click(must(hp.querySelector('[data-pip-index="6"]')))
    })

    expect(updateSpy).toHaveBeenCalledWith('pilot', pilot.id, { currentHP: 6 }, LIVE_SHEET_MANUAL)
  })

  test('clicking the top AP segment persists currentAP (clamped to derived max 5)', async () => {
    const pilot = makePilot({ currentAP: 4 })
    const updateSpy = mock(async () => pilot)
    renderHero(pilot, updateSpy)

    await act(async () => {
      // The last segment (index 4) fills to currentAP 5 (max).
      const ap = screen.getByRole('slider', { name: 'AP' })
      fireEvent.click(must(ap.querySelector('[data-pip-index="4"]')))
    })

    expect(updateSpy).toHaveBeenCalledWith('pilot', pilot.id, { currentAP: 5 }, LIVE_SHEET_MANUAL)
  })

  test('injuries lower the derived max HP (10 − 1 minor − 2 major = 7)', () => {
    renderHero(
      makePilot({
        currentHP: 10,
        injuries: [
          { severity: 'minor', note: 'sprain' },
          { severity: 'major', note: 'shrapnel' },
        ],
      })
    )
    // current clamps to the derived max for display
    expect(screen.getByRole('group', { name: 'HP 7 of 7' })).toBeTruthy()
  })

  test('maxHpModifier raises the derived max', () => {
    renderHero(makePilot({ currentHP: 12, maxHpModifier: 2 }))
    expect(screen.getByRole('group', { name: 'HP 12 of 12' })).toBeTruthy()
  })
})

// ---------------------------------------------------------------------------
// TP tracker
// ---------------------------------------------------------------------------

describe('Pilot hero — TP tracker', () => {
  test('TP renders without a max (unbounded counter)', () => {
    renderHero(makePilot({ trainingPoints: 2 }))
    // A label-first chip, `TRAINING POINTS | 2`, with no `/max`.
    const label = screen.getByText('Training Points')
    expect(label.closest('.su-stat-cell')?.textContent).toBe('Training Points2')
  })

  test('increasing TP persists trainingPoints', async () => {
    const pilot = makePilot({ trainingPoints: 2 })
    const updateSpy = mock(async () => pilot)
    renderHero(pilot, updateSpy)

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Increase Training Points' }))
    })

    expect(updateSpy).toHaveBeenCalledWith(
      'pilot',
      pilot.id,
      {
        trainingPoints: 3,
      },
      LIVE_SHEET_MANUAL
    )
  })
})

// ---------------------------------------------------------------------------
// Used-toggles in the identity block
// ---------------------------------------------------------------------------

describe('Pilot hero — identity used-toggles', () => {
  test('marking the motto used persists usedToggles', async () => {
    const pilot = makePilot()
    const updateSpy = mock(async () => pilot)
    renderHero(pilot, updateSpy)

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Mark motto used' }))
    })

    expect(updateSpy).toHaveBeenCalledWith(
      'pilot',
      pilot.id,
      {
        usedToggles: { motto: true },
      },
      LIVE_SHEET_MANUAL
    )
  })

  test('resetting a used flag merges with existing flags', async () => {
    const pilot = makePilot({ usedToggles: { motto: true, keepsake: true } })
    const updateSpy = mock(async () => pilot)
    renderHero(pilot, updateSpy)

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Reset motto used' }))
    })

    expect(updateSpy).toHaveBeenCalledWith(
      'pilot',
      pilot.id,
      {
        usedToggles: { motto: false, keepsake: true },
      },
      LIVE_SHEET_MANUAL
    )
  })

  test('readOnly: no toggle buttons, set flags render as static stamps', () => {
    renderHero(makePilot({ usedToggles: { background: true } }), undefined, true)

    expect(screen.queryByRole('button', { name: /mark .* used/i })).toBeNull()
    expect(screen.queryByRole('button', { name: /reset .* used/i })).toBeNull()
    expect(screen.getAllByText('Used').length).toBe(1)
  })
})

// ---------------------------------------------------------------------------
// Dead state (derived max HP ≤ 0)
// ---------------------------------------------------------------------------

const DEAD_INJURIES: Pilot['injuries'] = [
  { severity: 'major', note: '' },
  { severity: 'major', note: '' },
  { severity: 'major', note: '' },
  { severity: 'major', note: '' },
  { severity: 'major', note: '' },
]

describe('Pilot hero — dead state', () => {
  // The sheet's one unit-out treatment (hard rule R11): a stamp on the band
  // and the consequence as the body's first line.
  test('derived max HP 0 stamps the band Killed in Action and says why', () => {
    renderHero(makePilot({ injuries: DEAD_INJURIES }))

    expect(screen.getByText('Killed in Action')).toBeTruthy()
    expect(screen.getByText(/maximum HP to 0/).closest('[role="status"]')).toBeTruthy()
  })

  test('living pilot shows neither', () => {
    renderHero(makePilot())
    expect(screen.queryByText('Killed in Action')).toBeNull()
    expect(screen.queryByText(/maximum HP to 0/)).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// readOnly
// ---------------------------------------------------------------------------

describe('Pilot hero — readOnly', () => {
  test('no steppers render and nothing is written', () => {
    const pilot = makePilot()
    const updateSpy = mock(async () => pilot)
    renderHero(pilot, updateSpy, true)

    expect(screen.queryByRole('button', { name: /increase/i })).toBeNull()
    expect(screen.queryByRole('button', { name: /decrease/i })).toBeNull()
    expect(updateSpy).not.toHaveBeenCalled()
  })
})

describe('Pilot hero — readOnly identity', () => {
  test('prints no Read | Edit: a read-only sheet has nothing to switch to', () => {
    renderHero(makePilot(), undefined, true)
    expect(screen.queryByRole('group', { name: /Read or edit/ })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Edit' })).toBeNull()
  })

  test('the class is the band’s stamp alone, not a field under it', () => {
    const pilot = makePilot()
    renderHero(pilot, undefined, true)
    const band = must(
      screen.getByRole('heading', { level: 1 }).closest<HTMLElement>('.su-chapter-band')
    )
    const className = must(pilotStamp(pilot.classRef)).name
    expect(within(band).getByText(className)).toBeTruthy()
    expect(screen.getAllByText(className)).toHaveLength(1)
    // `CLASS | Engineer` is the band's chip; there is no Class field under it.
    const outsideBand = (el: HTMLElement) => el.closest('.su-chapter-band') === null
    expect(screen.queryAllByText('Class').filter(outsideBand)).toHaveLength(0)
  })

  test('a callsign that differs from the name still prints', () => {
    renderHero(makePilot({ name: 'Yara Voss', callsign: 'Ghost' }), undefined, true)
    expect(screen.getByText('Callsign')).toBeTruthy()
    expect(screen.getByText('Ghost')).toBeTruthy()
  })

  test('a callsign that is the name is the band’s title alone', () => {
    renderHero(makePilot({ name: 'Bonesaw', callsign: 'Bonesaw' }), undefined, true)
    expect(screen.queryByText('Callsign')).toBeNull()
    expect(screen.getByRole('heading', { level: 1, name: 'Bonesaw (Pilot)' })).toBeTruthy()
  })

  test('Edit keeps both fields: they are where callsign and class are changed', () => {
    renderHero(makePilot({ name: 'Bonesaw', callsign: 'Bonesaw' }))
    expect(screen.getByText('Callsign')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Change class' })).toBeTruthy()
  })
})
