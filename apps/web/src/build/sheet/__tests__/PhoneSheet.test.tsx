/**
 * A phone's Live Sheet in Read (`PhoneSheet`, hard rule R11): the numbers
 * first (`PhoneVitals`), then one row of tabs, the lists each a Ledger
 * (`SheetLedger`, L9). From `sm`, and in Edit, each sheet keeps its columns.
 */

import { afterEach, beforeAll, describe, expect, mock, test } from 'bun:test'
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { crawlerFixture, mechFixture, pilotFixture } from '../../../components/__tests__/fixtures'
import { hydrateStores } from '../../../components/__tests__/hydrateStores'
import {
  makeEntityLookupMock,
  makeSingleUnitStore,
  makeSoftLinkStoreMock,
} from '../../../components/__tests__/mockEntityStore'
import { ToasterMount, toast } from '../../../components/index'
import { narrowViewport } from '../../../play/__tests__/narrowViewport'
import { MechSheet } from '../MechSheet'
import { PilotSheet } from '../PilotSheet'
import { Sheet } from '../Sheet'
import { SheetModeContext } from '../sheetMode.model'

beforeAll(hydrateStores)

let restore: (() => void) | undefined
afterEach(async () => {
  await act(async () => {
    toast.dismiss()
  })
  cleanup()
  restore?.()
  restore = undefined
})

const mech = mechFixture({
  id: 'm-phone',
  name: 'Buzzard',
  chassisRef: 'mule',
  systems: ['automated-weapon-turret', 'no-such-system'],
  modules: [],
  systemConditions: { 'automated-weapon-turret': 'damaged' },
  itemUses: { 'automated-weapon-turret': 2 },
  conditions: ['Shutdown'],
  currentSP: 5,
  currentEP: 4,
  currentHeat: 1,
})

const pilot = pilotFixture({
  id: 'p-phone',
  name: 'Yara Voss',
  classRef: 'engineer',
  abilities: ['talk-shop', 'tip-top-shape'],
  usedAbilities: ['talk-shop'],
  equipment: ['first-aid-kit', 'rifle'],
  equipmentConditions: { rifle: 'damaged' },
  equipmentUses: { 'first-aid-kit': 1 },
  genericInventory: [{ id: 'g1', name: 'Rope', slotCost: 1, qty: 2 }],
  conditions: ['Bleeding'],
  currentHP: 7,
  currentAP: 3,
  trainingPoints: 2,
})

const crawler = crawlerFixture({
  id: 'c-phone',
  name: '#430 Tenacity',
  techLevel: 2,
  crawlerBays: [
    { bayRef: 'med-bay', npcName: 'Old Mags', npcCurrentHP: 3, condition: 'damaged' },
    { bayRef: 'command-bay', npcName: 'Ilsa Varn' },
    { bayRef: 'no-such-bay' },
  ],
  systems: ['no-such-weapon'],
})

const tabNames = () => screen.getAllByRole('tab').map((tab) => tab.textContent)
const openTab = (name: RegExp) => fireEvent.click(screen.getByRole('tab', { name }))
const ledger = (title: string) => screen.getByRole('table', { name: title })

function renderMech(props: { readOnly: boolean; live?: boolean }) {
  const update = mock(async () => null)
  render(
    <>
      <MechSheet mech={mech} store={makeSingleUnitStore('mech', mech, { update })} {...props} />
      <ToasterMount />
    </>
  )
  return update
}

function renderPilot(props: { readOnly: boolean; live?: boolean }) {
  const update = mock(async () => null)
  render(
    <>
      <PilotSheet
        pilot={pilot}
        store={makeSingleUnitStore('pilot', pilot, { update })}
        {...props}
      />
      <ToasterMount />
    </>
  )
  return update
}

describe('a mech on a phone in Read', () => {
  test('the numbers, then the tabs Loadout, Hold, About', () => {
    restore = narrowViewport()
    renderMech({ readOnly: true })
    const vitals = screen.getByRole('group', { name: 'Buzzard vitals' })
    expect(
      [...vitals.querySelectorAll('[data-vital]')].map((row) => row.getAttribute('data-vital'))
    ).toEqual(['sp', 'ep', 'heat'])
    // A read-out: no slider, no − | +.
    expect(within(vitals).queryByRole('slider')).toBeNull()
    expect(within(vitals).getByText('Shutdown')).toBeTruthy()
    expect(tabNames().map((name) => name?.replace(/[\d/]+$/, ''))).toEqual([
      'Loadout',
      'Hold',
      'About',
    ])
  })

  test('Loadout is a Ledger a collection: a damaged item says so, an unknown one keeps its slug', () => {
    restore = narrowViewport()
    renderMech({ readOnly: true })
    openTab(/^Loadout/)
    const systems = ledger('Systems')
    expect(within(systems).getByText('damaged')).toBeTruthy()
    expect(within(systems).getByText('no-such-system')).toBeTruthy()
  })

  test('an empty hold says so; About holds the hero and the chassis', () => {
    restore = narrowViewport()
    renderMech({ readOnly: true })
    openTab(/^Hold/)
    expect(screen.getByText('Nothing in the hold.')).toBeTruthy()
    openTab(/^About/)
    expect(screen.getAllByText(/Mule/).length).toBeGreaterThan(0)
  })

  test('live, a row steps: − | +, the arrow keys, a tap on a segment', async () => {
    restore = narrowViewport()
    const update = renderMech({ readOnly: true, live: true })
    const vitals = screen.getByRole('group', { name: 'Buzzard vitals' })
    const sp = within(vitals).getByRole('slider', { name: 'Structure Points' })
    expect(sp.getAttribute('aria-valuenow')).toBe('5')
    await act(async () => {
      fireEvent.keyDown(sp, { key: 'ArrowLeft' })
    })
    expect(update).toHaveBeenLastCalledWith('mech', 'm-phone', { currentSP: 4 }, expect.anything())
    await act(async () => {
      fireEvent.keyDown(sp, { key: 'Home' })
    })
    expect(update).toHaveBeenLastCalledWith('mech', 'm-phone', { currentSP: 0 }, expect.anything())
    await act(async () => {
      fireEvent.keyDown(sp, { key: 'Tab' })
    })
    const calls = update.mock.calls.length
    const second = sp.querySelector('[data-pip-index="1"]') as HTMLElement
    await act(async () => {
      fireEvent.click(second)
    })
    expect(update.mock.calls.length).toBe(calls + 1)
    const row = sp.closest('[data-vital]') as HTMLElement
    const [less, more] = within(row).getAllByRole('button')
    await act(async () => {
      fireEvent.click(more as HTMLElement)
    })
    expect(update).toHaveBeenLastCalledWith('mech', 'm-phone', { currentSP: 6 }, expect.anything())
    // A hold that never repeats is one press.
    await act(async () => {
      fireEvent.pointerDown(less as HTMLElement)
      fireEvent.pointerUp(less as HTMLElement)
      fireEvent.click(less as HTMLElement)
    })
    expect(update.mock.calls.length).toBe(calls + 3)
  })

  test('from `sm`, and in Edit, the sheet keeps its columns', () => {
    renderMech({ readOnly: true })
    expect(screen.queryByRole('tablist')).toBeNull()
    cleanup()
    restore = narrowViewport()
    renderMech({ readOnly: false })
    expect(screen.queryByRole('tablist')).toBeNull()
  })
})

describe('a pilot on a phone in Read', () => {
  test('HP, AP and the Training Points counter, the conditions at the foot', () => {
    restore = narrowViewport()
    renderPilot({ readOnly: true })
    const vitals = screen.getByRole('group', { name: 'Yara Voss vitals' })
    expect(
      [...vitals.querySelectorAll('[data-vital]')].map((row) => row.getAttribute('data-vital'))
    ).toEqual(['hp', 'ap', 'tp'])
    expect(within(vitals).getByText('Bleeding')).toBeTruthy()
    expect(tabNames().map((name) => name?.replace(/[\d/]+$/, ''))).toEqual([
      'Abilities',
      'Gear',
      'About',
    ])
  })

  test('Abilities is a Ledger a tree: a used ability says so', () => {
    restore = narrowViewport()
    renderPilot({ readOnly: true })
    openTab(/^Abilities/)
    const tables = screen.getAllByRole('table')
    expect(tables.length).toBeGreaterThan(1)
    expect(screen.getByText('Used')).toBeTruthy()
    expect(ledger('Generic')).toBeTruthy()
  })

  test('Gear is one Ledger: a damaged item, its Uses, a plain item with its slots', () => {
    restore = narrowViewport()
    renderPilot({ readOnly: true })
    openTab(/^Gear/)
    const gear = ledger('Inventory')
    expect(within(gear).getByText('damaged')).toBeTruthy()
    expect(within(gear).getByText('Rope ×2')).toBeTruthy()
    expect(within(gear).getByText('First Aid Kit')).toBeTruthy()
  })

  test('with nothing carried, Gear says so; About names the class', () => {
    restore = narrowViewport()
    const bare = pilotFixture({ id: 'p-bare', name: 'Bare', classRef: 'engineer' })
    render(<PilotSheet pilot={bare} store={makeSingleUnitStore('pilot', bare)} readOnly />)
    openTab(/^Gear/)
    expect(screen.getByText('Nothing carried.')).toBeTruthy()
    openTab(/^About/)
    expect(screen.getAllByText('Engineer').length).toBeGreaterThan(0)
  })

  test('live, the Training Points counter steps with no meter', async () => {
    restore = narrowViewport()
    const update = renderPilot({ readOnly: true, live: true })
    const row = screen
      .getByRole('group', { name: 'Yara Voss vitals' })
      .querySelector('[data-vital="tp"]') as HTMLElement
    expect(within(row).queryByRole('slider')).toBeNull()
    const [, more] = within(row).getAllByRole('button')
    await act(async () => {
      fireEvent.click(more as HTMLElement)
    })
    expect(update).toHaveBeenLastCalledWith(
      'pilot',
      'p-phone',
      { trainingPoints: 3 },
      expect.anything()
    )
  })
})

describe('a crawler on a phone in Read', () => {
  function renderCrawler() {
    restore = narrowViewport()
    render(
      <SheetModeContext.Provider value={{ editing: false, setEditing: () => undefined }}>
        <Sheet
          kind="crawler"
          id="c-phone"
          entityStore={makeEntityLookupMock([crawler])}
          softLinkStore={makeSoftLinkStoreMock([])}
        />
      </SheetModeContext.Provider>
    )
  }

  test('the numbers, then the tabs Bays, Storage, About', () => {
    renderCrawler()
    const vitals = screen.getByRole('group', { name: '#430 Tenacity vitals' })
    expect(vitals.querySelector('[data-vital="sp"]')).toBeTruthy()
    expect(tabNames().map((name) => name?.replace(/[\d/]+$/, ''))).toEqual([
      'Bays',
      'Storage',
      'About',
    ])
    // Two of three bays intact.
    expect(screen.getByRole('tab', { name: /^Bays/ }).textContent).toContain('2/3')
  })

  test('Bays is one Ledger: a line a bay with its crew lead, a damaged bay saying so', () => {
    renderCrawler()
    const bays = ledger('Bays')
    expect(within(bays).getByText('Old Mags')).toBeTruthy()
    expect(within(bays).getByText('Damaged')).toBeTruthy()
    expect(within(bays).getByText('no-such-bay')).toBeTruthy()
    expect(within(ledger('Weapons')).getByText('no-such-weapon')).toBeTruthy()
  })

  test('Storage says when it holds nothing; About is the identity', () => {
    renderCrawler()
    openTab(/^Storage/)
    expect(screen.getByText('Nothing stored.')).toBeTruthy()
    openTab(/^About/)
    expect(screen.getAllByText('#430 Tenacity').length).toBeGreaterThan(0)
  })
})
