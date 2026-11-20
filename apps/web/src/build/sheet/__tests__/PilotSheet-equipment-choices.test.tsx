/**
 * PilotSheet — pilot equipment choice persistence tests.
 *
 * Asserts that:
 *   1. A choice-bearing pilot equipment item renders its choice cards
 *      (e.g. Custom Sniper Rifle → "Weapon Type" with Ballistic / Energy).
 *   2. Toggling a choice persists to the store via update() under
 *      equipmentChoices[slug][choiceId], without clobbering other items.
 *   3. Persisted selections render as already-chosen (aria-pressed).
 *   4. readOnly (Read): the item is its shortform pill; nothing is written.
 *
 * Uses the store-injection seam + a real choice-bearing reference equipment.
 * NO mock.module().
 */

import { beforeAll, describe, expect, mock, test } from 'bun:test'
import { act, fireEvent, render, screen, within } from '@testing-library/react'
import type { Pilot } from 'game-domain/schemas/pilot'
import { getEntitySlug, SalvageUnionReference } from 'salvageunion-reference'
import { expandCards } from '../../../components/__tests__/expandCards'
import { pilotFixture } from '../../../components/__tests__/fixtures'
import { hydrateStores } from '../../../components/__tests__/hydrateStores'
import { makeSingleUnitStore } from '../../../components/__tests__/mockEntityStore'
import { LIVE_SHEET_MANUAL } from '../../../replica/provenance'
import { PilotSheet } from '../PilotSheet'

beforeAll(hydrateStores)

// PilotSheet resolves equipment slugs via salvageunion-reference at render, and
// the choice cards deep-link trait/keyword entities — preload 'all' so those
// nested lookups (TraitKeywordDisplayView) resolve.
//
// SNIPER_ID is resolved from the reference (not hardcoded) so the fixture keys
// pilot.equipment and equipmentChoices by the equipment's slug — the same key
// PilotWizard/EquipmentStep persist.
beforeAll(async () => {
  const sniper = SalvageUnionReference.Equipment.getByName(SNIPER_NAME)
  if (!sniper) throw new Error(`Fixture setup: equipment "${SNIPER_NAME}" not found in reference`)
  SNIPER_ID = getEntitySlug(sniper)
})

// ---------------------------------------------------------------------------
// Constants — Custom Sniper Rifle carries a "Weapon Type" permanent choice with
// Ballistic / Energy schema-entity options. The choice id is stable in the
// dataset; the options render as buttons labelled with their entity name.
// SNIPER_ID is the equipment's slug (resolved in beforeAll) — the persistence
// key used in production.
// ---------------------------------------------------------------------------

const SNIPER_NAME = 'Custom Sniper Rifle'
const WEAPON_TYPE_CHOICE_ID = 'd2e3f4a5-b6c7-4d8e-9f0a-1b2c3d4e5f6a'
const MODIFICATION_CHOICE_ID = '8688eb63-550c-4d06-9b50-e1649c442da6'
let SNIPER_ID = ''

// ---------------------------------------------------------------------------
// Store stub — mutable backing entity so get() returns fresh state after update.
// ---------------------------------------------------------------------------

function makePilotStubStore(initial: Pilot, updateSpy?: ReturnType<typeof mock>) {
  let current = initial
  const updateMock =
    updateSpy ??
    mock(async (_type: string, _id: string, patch: Partial<Pilot>) => {
      current = { ...current, ...patch }
      return current
    })

  const store = makeSingleUnitStore('pilot', () => current, { update: updateMock })
  return { store, updateMock }
}

// ---------------------------------------------------------------------------
// Fixture
// ---------------------------------------------------------------------------

function makePilot(overrides?: Partial<Pilot>): Pilot {
  return pilotFixture({
    id: 'pilot-choices-1',
    name: 'Zara Quinn',
    callsign: 'Hex',
    equipment: [SNIPER_ID],
    ...overrides,
  })
}

/**
 * Read is the sheet dashboard: a carried item is a row of its Inventory
 * Ledger, its rules opening under it. The row and, once opened, its rules.
 */
async function readRow(name: string, open = true): Promise<HTMLElement> {
  const inventory = screen
    .getAllByRole('table')
    .find((table) => table.querySelector('.su-rule-head__label')?.textContent === 'Inventory')
  if (!inventory) throw new Error('no Inventory ledger')
  const row = within(inventory)
    .getAllByRole('rowheader')
    .find((cell) => cell.textContent?.includes(name))
    ?.closest<HTMLElement>('tr')
  if (!row) throw new Error(`no ${name} row`)
  const toggle = within(row).queryByRole('button', { name: `${name} rules` })
  if (open && toggle) {
    await act(async () => {
      fireEvent.click(toggle)
    })
  }
  return row
}

/** A row's text with its opened rules. */
function rowText(row: HTMLElement): string {
  const detail = row.nextElementSibling?.classList.contains('su-open__detail')
    ? (row.nextElementSibling.textContent ?? '')
    : ''
  return `${row.textContent ?? ''}${detail}`
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('PilotSheet — equipment choice cards', () => {
  test('renders choice option cards for a choice-bearing equipment', () => {
    const pilot = makePilot()
    const { store } = makePilotStubStore(pilot)
    render(<PilotSheet pilot={pilot} store={store} />)
    expandCards()

    // The Weapon Type options render as toggle buttons.
    expect(screen.getByRole('button', { name: /Ballistic/i })).toBeTruthy()
    expect(screen.getByRole('button', { name: /Energy/i })).toBeTruthy()
  })

  test('toggling a choice persists to equipmentChoices[slug][choiceId]', async () => {
    const pilot = makePilot()
    const { store, updateMock } = makePilotStubStore(pilot)
    render(<PilotSheet pilot={pilot} store={store} />)
    expandCards()

    const ballistic = screen.getByRole('button', { name: /Ballistic/i })
    await act(async () => {
      fireEvent.click(ballistic)
    })

    expect(updateMock).toHaveBeenCalledTimes(1)
    expect(updateMock).toHaveBeenCalledWith(
      'pilot',
      pilot.id,
      {
        equipmentChoices: {
          [SNIPER_ID]: { [WEAPON_TYPE_CHOICE_ID]: ['Ballistic'] },
        },
      },
      LIVE_SHEET_MANUAL
    )
  })

  test('persisted selection renders as chosen (aria-pressed)', () => {
    const pilot = makePilot({
      equipmentChoices: {
        [SNIPER_ID]: { [WEAPON_TYPE_CHOICE_ID]: ['Energy'] },
      },
    })
    const { store } = makePilotStubStore(pilot)
    render(<PilotSheet pilot={pilot} store={store} />)
    expandCards()

    const energy = screen.getByRole('button', { name: /Energy/i })
    expect(energy.getAttribute('aria-pressed')).toBe('true')

    const ballistic = screen.getByRole('button', { name: /Ballistic/i })
    expect(ballistic.getAttribute('aria-pressed')).toBe('false')
  })

  test('readOnly (the Read state): the item is its shortform pill, and nothing is written', async () => {
    // Read prints the inventory as pills: the choice is
    // the card's, shown in Edit. A read-only sheet offers no choice to toggle.
    const pilot = makePilot({
      equipmentChoices: {
        [SNIPER_ID]: { [WEAPON_TYPE_CHOICE_ID]: ['Energy'] },
      },
    })
    const { store, updateMock } = makePilotStubStore(pilot)
    render(<PilotSheet pilot={pilot} store={store} readOnly />)

    expect(screen.getAllByText(SNIPER_NAME).length).toBeGreaterThan(0)
    expect(screen.queryByRole('button', { name: /Ballistic/i })).toBeNull()
    expect(updateMock).not.toHaveBeenCalled()
  })

  test("the item line shows the picks and the crawler's Tech Level, not the book's TL1 rifle", async () => {
    // The line is the player's rifle: its head and its text both read the
    // picks and the Tech Level, as its Details card does.
    const pilot = makePilot({
      crawlerLevel: 3,
      equipmentChoices: {
        [SNIPER_ID]: {
          [WEAPON_TYPE_CHOICE_ID]: ['Energy'],
          [MODIFICATION_CHOICE_ID]: ['Rangefinder', 'High Calibre Rounds'],
        },
      },
    })
    const { store } = makePilotStubStore(pilot)
    render(<PilotSheet pilot={pilot} store={store} readOnly />)
    const text = rowText(await readRow(SNIPER_NAME))
    // 2 SP + 1 per Tech Level after the first + 1 High Calibre = 5 SP.
    expect(text).toContain('5 SP')
    expect(text).toContain('Far')
    expect(text).toContain('Energy')
    // Its marks read the player's rifle: Far, not the book's Long.
    const marks = document.querySelector('.su-open__detail .su-row-rules__marks')?.textContent ?? ''
    expect(marks).toContain('Far')
    expect(marks).not.toContain('Long')
  })

  test('R60: each pick reads as made, a CHOSEN chip naming it', async () => {
    const pilot = makePilot({
      crawlerLevel: 3,
      equipmentChoices: {
        [SNIPER_ID]: {
          [WEAPON_TYPE_CHOICE_ID]: ['Energy'],
          [MODIFICATION_CHOICE_ID]: ['Rangefinder', 'High Calibre Rounds'],
        },
      },
    })
    const { store } = makePilotStubStore(pilot)
    render(<PilotSheet pilot={pilot} store={store} readOnly />)
    const line = await readRow(SNIPER_NAME, false)
    const chosen = [...line.querySelectorAll('.su-stat-cell')]
      .map((cell) => cell.textContent ?? '')
      .filter((text) => text.startsWith('Chosen'))
    expect(chosen).toEqual(['ChosenEnergy', 'ChosenRangefinder', 'ChosenHigh Calibre Rounds'])
  })

  test('R59: gear an ability grants prints its rules once, under the ability', async () => {
    const pilot = makePilot({ abilities: ['custom-sniper-rifle'], equipment: [], crawlerLevel: 4 })
    const { store } = makePilotStubStore(pilot)
    render(<PilotSheet pilot={pilot} store={store} readOnly />)
    const line = await readRow(SNIPER_NAME)
    // The row names it; its rules do not open under it.
    expect(within(line).queryByRole('button', { name: `${SNIPER_NAME} rules` })).toBeNull()
    expect(rowText(line)).not.toContain('You acquire and train')
  })

  test('an item the ability grants is on the sheet, its picks saved, with no Remove of its own', async () => {
    const pilot = makePilot({ abilities: ['custom-sniper-rifle'], equipment: [], crawlerLevel: 4 })
    const { store, updateMock } = makePilotStubStore(pilot)
    const { container } = render(<PilotSheet pilot={pilot} store={store} />)
    const line = container.querySelector('[data-sheet-carried] li')
    expect(line?.textContent ?? '').toContain(SNIPER_NAME)
    expect(line?.textContent ?? '').toContain('5 SP')
    expect(
      screen.queryByRole('button', { name: new RegExp(`remove ${SNIPER_NAME}`, 'i') })
    ).toBeNull()
    expandCards()
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Energy/i }))
    })
    expect(updateMock).toHaveBeenCalledWith(
      'pilot',
      pilot.id,
      { equipmentChoices: { [SNIPER_ID]: { [WEAPON_TYPE_CHOICE_ID]: ['Energy'] } } },
      LIVE_SHEET_MANUAL
    )
  })
})
