/**
 * PilotSheet — ability live-play affordances (Slice D)
 *
 * Asserts that:
 *   1. The ability's fixed AP cost is displayed.
 *   2. "Spend AP" decrements the pilot's currentAP by the cost (clamped at 0).
 *   3. "Spend AP" is disabled when the pilot has insufficient AP.
 *   4. The used/recharge toggle persists to usedAbilities and reflects seed state.
 *   5. readOnly suppresses spend + toggle affordances.
 *
 * Uses dep-injected store stubs (no mock.module()). Ability slugs are real
 * salvageunion-reference ability names so resolution exercises the full path.
 */

import { beforeAll, describe, expect, mock, test } from 'bun:test'
import { act, fireEvent, render, screen } from '@testing-library/react'
import type { Pilot } from 'cantina-domain/schemas/pilot'
import type { useEntityStore } from '../../../stores/entityStore'
import { LIVE_SHEET_MANUAL } from '../../../stores/surfaceProvenance'
import { expandCards } from '../../../components/__tests__/expandCards'
import { FIXTURE_NOW } from '../../../components/__tests__/fixtures'
import { hydrateStores } from '../../../components/__tests__/hydrateStores'
import { makeEntityStoreMock } from '../../../components/__tests__/mockEntityStore'
import { EntitySurfaceProvider } from '../../../components/index'
import { PilotSheet } from '../PilotSheet'

beforeAll(hydrateStores)

// "Talk Shop" resolves to a fixed AP cost of 3 in reference data.
const ABILITY_TALK_SHOP = 'talk-shop'

/** Each Row's and Token's chips' text: a cost is the book's pointy box, "3 AP". */
const costChips = () =>
  Array.from(document.querySelectorAll('.su-entity-token__chips, .su-entity-row__head'))
    .map((g) => g.textContent ?? '')
    .join(' ')

function makePilot(overrides: Partial<Pilot> = {}): Pilot {
  return {
    id: 'pilot-ab-1',
    schemaVersion: 1,
    name: 'Yara Voss',
    callsign: 'Ghost',
    classRef: 'scavenger',
    abilities: [ABILITY_TALK_SHOP],
    equipment: [],
    motto: '',
    keepsake: '',
    appearance: '',
    background: '',
    conditions: [],
    currentHP: 10,
    currentAP: 5,
    createdAt: FIXTURE_NOW,
    updatedAt: FIXTURE_NOW,
    ...overrides,
  }
}

function makeStubStore(pilot: Pilot, updateSpy?: ReturnType<typeof mock>): typeof useEntityStore {
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

describe('PilotSheet — ability AP cost (Slice D)', () => {
  test("displays the ability AP cost on the ability's Row", () => {
    render(<PilotSheet pilot={makePilot()} store={makeStubStore(makePilot())} />)
    // The cost comes from the Row's own cost chip ("3 AP"), not from a
    // sheet-added "AP Cost" pair, which printed a bare em-dash for
    // variable-cost abilities where the Token says "X AP".
    expect(costChips()).toContain('3 AP')
    expect(screen.queryByText('AP Cost')).toBeNull()
  })
})

describe('PilotSheet — spend AP (Slice D)', () => {
  test('spending AP decrements currentAP by the cost', async () => {
    const pilot = makePilot({ currentAP: 5 })
    const updateSpy = mock(async () => pilot)
    render(<PilotSheet pilot={pilot} store={makeStubStore(pilot, updateSpy)} />)
    expandCards()

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /spend 3 ap for talk shop/i }))
    })

    // 5 - 3 = 2
    expect(updateSpy).toHaveBeenCalledWith('pilot', pilot.id, { currentAP: 2 }, LIVE_SHEET_MANUAL)
  })

  test('spend clamps currentAP at 0 (never negative)', async () => {
    // Exactly enough: cost 3, AP 3 → 0
    const pilot = makePilot({ currentAP: 3 })
    const updateSpy = mock(async () => pilot)
    render(<PilotSheet pilot={pilot} store={makeStubStore(pilot, updateSpy)} />)
    expandCards()

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /spend 3 ap for talk shop/i }))
    })

    expect(updateSpy).toHaveBeenCalledWith('pilot', pilot.id, { currentAP: 0 }, LIVE_SHEET_MANUAL)
  })

  test('spend button is disabled when AP is insufficient', async () => {
    const pilot = makePilot({ currentAP: 2 }) // cost is 3
    const updateSpy = mock(async () => pilot)
    render(<PilotSheet pilot={pilot} store={makeStubStore(pilot, updateSpy)} />)
    expandCards()

    const spendBtn = screen.getByRole<HTMLButtonElement>('button', {
      name: /spend 3 ap for talk shop/i,
    })
    expect(spendBtn.disabled).toBe(true)

    await act(async () => {
      fireEvent.click(spendBtn)
    })
    expect(updateSpy).not.toHaveBeenCalled()
  })

  test("the sheet's item controls are the shared Button in the sheet skin", () => {
    const pilot = makePilot()
    render(
      <PilotSheet
        pilot={pilot}
        store={makeStubStore(
          pilot,
          mock(async () => pilot)
        )}
      />
    )
    expandCards()

    const spendBtn = screen.getByRole('button', { name: /spend 3 ap for talk shop/i })
    expect(spendBtn.classList.contains('su-btn')).toBe(true)
    expect(spendBtn.classList.contains('su-btn--pencil')).toBe(true)
  })
})

describe('PilotSheet — used/recharge toggle (Slice D)', () => {
  test('marking used persists the ability slug to usedAbilities', async () => {
    const pilot = makePilot()
    const updateSpy = mock(async () => pilot)
    render(<PilotSheet pilot={pilot} store={makeStubStore(pilot, updateSpy)} />)
    expandCards()

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /mark talk shop used/i }))
    })

    expect(updateSpy).toHaveBeenCalledWith(
      'pilot',
      pilot.id,
      {
        usedAbilities: [ABILITY_TALK_SHOP],
      },
      LIVE_SHEET_MANUAL
    )
  })

  test('recharging removes the slug from usedAbilities', async () => {
    const pilot = makePilot({ usedAbilities: [ABILITY_TALK_SHOP] })
    const updateSpy = mock(async () => pilot)
    render(<PilotSheet pilot={pilot} store={makeStubStore(pilot, updateSpy)} />)
    expandCards()

    // Seeded as used → button recharges
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /recharge talk shop/i }))
    })

    expect(updateSpy).toHaveBeenCalledWith(
      'pilot',
      pilot.id,
      {
        usedAbilities: [],
      },
      LIVE_SHEET_MANUAL
    )
  })
})

describe('PilotSheet — abilities readOnly (Slice D)', () => {
  test('no spend / toggle buttons when readOnly', () => {
    const pilot = makePilot({ usedAbilities: [ABILITY_TALK_SHOP] })
    render(<PilotSheet pilot={pilot} store={makeStubStore(pilot)} readOnly />)
    expandCards()

    expect(screen.queryByRole('button', { name: /spend/i })).toBeNull()
    expect(screen.queryByRole('button', { name: /mark .* used/i })).toBeNull()
    expect(screen.queryByRole('button', { name: /recharge/i })).toBeNull()
    // AP cost still shown read-only (the Row's own cost chip), plus a
    // static Used stamp.
    expect(costChips()).toContain('3 AP')
    expect(screen.getByText('Used')).toBeTruthy()
  })
})

describe('PilotSheet — the Generic tree is intrinsic', () => {
  test('a pilot with no stored abilities still shows the Generic Tokens', () => {
    const pilot = makePilot({ abilities: [] })
    render(<PilotSheet pilot={pilot} store={makeStubStore(pilot)} />)
    expandCards()

    // Never stored, never picked: every pilot carries the whole tree (board 10
    // prints Bonesaw's Generic cards beside his one stored ability), in its own
    // section under the trees the pilot chose, which say none are learned.
    const generic = screen.getByRole('list', { name: 'Generic Abilities' })
    const names = Array.from(generic.querySelectorAll('.su-entity-token__name')).map(
      (n) => n.textContent ?? ''
    )
    for (const name of ['Repair', 'Area Salvage', 'Mech Salvage', 'Patch Up']) {
      expect(names.some((n) => n.startsWith(name))).toBe(true)
    }
    expect(screen.getByText('No abilities learned yet.')).toBeTruthy()
    // …with the same live-play toggle as any other ability.
    expect(screen.getByRole('button', { name: /mark repair used/i })).toBeTruthy()
  })

  test('a stored ability prints beside the Generic tree, not instead of it', () => {
    const pilot = makePilot()
    render(<PilotSheet pilot={pilot} store={makeStubStore(pilot)} />)
    expandCards()
    expect(screen.getByRole('button', { name: /mark repair used/i })).toBeTruthy()
    expect(screen.getByRole('button', { name: /mark talk shop used/i })).toBeTruthy()
  })
})

/** The section the sheet draws one tree in. */
const treeSection = (tree: string) => {
  const section = document.querySelector<HTMLElement>(`section[aria-label="${tree} Tree"]`)
  if (!section) throw new Error(`no ${tree} Tree section`)
  return section
}

const rowTitles = (section: HTMLElement) =>
  Array.from(section.querySelectorAll('.su-ability-track__tier .su-entity-row__head')).map(
    (head) => head.textContent ?? ''
  )

describe('PilotSheet — the trees the pilot trained in, on their tracks', () => {
  test('a tree draws only the Abilities taken, as Rows on its track', () => {
    const pilot = makePilot({ abilities: ['mech-acquisition', 'engineering-expertise'] })
    render(<PilotSheet pilot={pilot} store={makeStubStore(pilot)} />)

    const tree = treeSection('Mechanical Knowledge')
    expect(tree.querySelector('.su-ability-track')?.getAttribute('data-track')).toBe('core')
    // In the tree's order, not the order stored; Talk Shop (tier 2) is not taken.
    const titles = rowTitles(tree)
    expect(titles).toHaveLength(2)
    expect(titles[0]).toContain('Engineering Expertise')
    expect(titles[1]).toContain('Mech Acquisition')
    expect(
      Array.from(tree.querySelectorAll('.su-ability-track__tier .su-entity-row__tier')).map(
        (n) => n.textContent
      )
    ).toEqual(['1', '3'])
    // The Generic tree is never on a track.
    expect(document.querySelector('section[aria-label="Generic Tree"]')).toBeNull()
  })

  test('trees run Core, then Advanced, then Legendary, a Legendary pick with no numeral', () => {
    const pilot = makePilot({
      abilities: ['tip-top-shape', 'union-engineer', 'mass-field-maintenance', 'talk-shop'],
    })
    render(<PilotSheet pilot={pilot} store={makeStubStore(pilot)} />)

    const trees = Array.from(document.querySelectorAll('section[aria-label$=" Tree"]')).map(
      (section) => section.getAttribute('aria-label')
    )
    expect(trees).toEqual([
      'Mechanical Knowledge Tree',
      'Mech-Tech Tree',
      'Advanced Engineer Tree',
      'Legendary Engineer Tree',
    ])
    expect(
      treeSection('Advanced Engineer')
        .querySelector('.su-ability-track')
        ?.getAttribute('data-track')
    ).toBe('advanced')
    const legendary = treeSection('Legendary Engineer')
    expect(legendary.querySelector('.su-ability-track')?.getAttribute('data-track')).toBe(
      'legendary'
    )
    expect(legendary.querySelector('.su-ability-track__tier .su-entity-row__tier')).toBeNull()
    expect(legendary.textContent).toContain('Choose 1')
  })

  test("Edit keeps each Row's controls on its track", async () => {
    const pilot = makePilot({ currentAP: 5 })
    const updateSpy = mock(async () => pilot)
    render(<PilotSheet pilot={pilot} store={makeStubStore(pilot, updateSpy)} />)

    const tree = treeSection('Mechanical Knowledge')
    const spend = Array.from(tree.querySelectorAll('button')).find((b) =>
      /spend 3 ap for talk shop/i.test(b.getAttribute('aria-label') ?? '')
    )
    expect(spend).toBeTruthy()
    await act(async () => {
      if (spend) fireEvent.click(spend)
    })
    expect(updateSpy).toHaveBeenCalledWith('pilot', pilot.id, { currentAP: 2 }, LIVE_SHEET_MANUAL)
  })
})

describe('PilotSheet — the class art stands in for a portrait', () => {
  test('a pilot with no photo opens on their class art', () => {
    const pilot = makePilot({ classRef: 'hacker' })
    render(<PilotSheet pilot={pilot} store={makeStubStore(pilot)} readOnly />)
    const art = screen.getByRole<HTMLImageElement>('img', { name: 'Hacker artwork' })
    expect(art.src).toContain('/classes/hacker.webp')
  })
})

describe("PilotSheet — a read-only sheet's Tokens open their entity", () => {
  test('clicking an ability Token opens its Page (the detail dialog)', () => {
    const pilot = makePilot()
    const openPage = mock((_ref: unknown) => {})
    render(
      <EntitySurfaceProvider value={{ openPage }}>
        <PilotSheet pilot={pilot} store={makeStubStore(pilot)} readOnly />
      </EntitySurfaceProvider>
    )
    fireEvent.click(screen.getByRole('button', { name: 'Talk Shop' }))
    expect(openPage).toHaveBeenCalledTimes(1)
    expect(openPage.mock.calls[0]?.[0]).toMatchObject({
      schemaName: 'abilities',
      name: 'Talk Shop',
    })
  })
})
