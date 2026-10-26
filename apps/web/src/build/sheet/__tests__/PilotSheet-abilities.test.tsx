/**
 * PilotSheet — ability live-play affordances (Slice D)
 *
 * Asserts that:
 *   1. The ability's fixed AP cost is displayed.
 *   2. "Spend AP" (in the ability's "⋯", its chip group's last slot) decrements
 *      the pilot's currentAP by the cost (clamped at 0).
 *   3. "Spend AP" is disabled when the pilot has insufficient AP.
 *   4. The used/recharge toggle persists to usedAbilities and reflects seed state.
 *   5. readOnly suppresses spend + toggle affordances.
 *
 * Uses dep-injected store stubs (no mock.module()). Ability slugs are real
 * salvageunion-reference ability names so resolution exercises the full path.
 */

import { beforeAll, describe, expect, mock, test } from 'bun:test'
import { act, fireEvent, render, screen, within } from '@testing-library/react'
import type { Pilot } from 'game-domain/schemas/pilot'
import { expandCards } from '../../../components/__tests__/expandCards'
import { FIXTURE_NOW } from '../../../components/__tests__/fixtures'
import { hydrateStores } from '../../../components/__tests__/hydrateStores'
import { makeSingleUnitStore } from '../../../components/__tests__/mockEntityStore'
import { EntitySurfaceProvider } from '../../../components/index'
import { LIVE_SHEET_MANUAL } from '../../../replica/provenance'
import { PilotSheet } from '../PilotSheet'

beforeAll(hydrateStores)

/** Open an ability's "⋯" (its chip group's last slot, C8) and pick an item. */
async function choose(ability: string, item: string | RegExp) {
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: `More for ${ability}` }))
  })
  const menu = screen.getByRole('menu')
  await act(async () => {
    fireEvent.click(within(menu).getByRole('menuitem', { name: item }))
  })
}

// "Talk Shop" resolves to a fixed AP cost of 3 in reference data.
const ABILITY_TALK_SHOP = 'talk-shop'

/** Each Compact's and Mini's chips' text: a cost is the book's pointy box, "3 AP". */
const costChips = () =>
  Array.from(document.querySelectorAll('.su-entity-mini__chips, .su-entity-compact__head'))
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

function makeStubStore(pilot: Pilot, update?: ReturnType<typeof mock>) {
  return makeSingleUnitStore('pilot', pilot, { update })
}

describe('PilotSheet — ability AP cost (Slice D)', () => {
  test("displays the ability AP cost on the ability's Compact", () => {
    render(<PilotSheet pilot={makePilot()} store={makeStubStore(makePilot())} />)
    // The cost comes from the Compact's own cost chip ("3 AP"), not from a
    // sheet-added "AP Cost" pair, which printed a bare em-dash for
    // variable-cost abilities where the Mini says "X AP".
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

    await choose('Talk Shop', /spend 3 ap/i)

    // 5 - 3 = 2
    expect(updateSpy).toHaveBeenCalledWith('pilot', pilot.id, { currentAP: 2 }, LIVE_SHEET_MANUAL)
  })

  test('spend clamps currentAP at 0 (never negative)', async () => {
    // Exactly enough: cost 3, AP 3 → 0
    const pilot = makePilot({ currentAP: 3 })
    const updateSpy = mock(async () => pilot)
    render(<PilotSheet pilot={pilot} store={makeStubStore(pilot, updateSpy)} />)
    expandCards()

    await choose('Talk Shop', /spend 3 ap/i)

    expect(updateSpy).toHaveBeenCalledWith('pilot', pilot.id, { currentAP: 0 }, LIVE_SHEET_MANUAL)
  })

  test('spend button is disabled when AP is insufficient', async () => {
    const pilot = makePilot({ currentAP: 2 }) // cost is 3
    const updateSpy = mock(async () => pilot)
    render(<PilotSheet pilot={pilot} store={makeStubStore(pilot, updateSpy)} />)
    expandCards()

    await choose('Talk Shop', /spend 3 ap/i)
    expect(updateSpy).not.toHaveBeenCalled()
  })

  test("an ability's controls are one ⋯ in its Mini's chip group (R6)", () => {
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

    const more = screen.getByRole('button', { name: 'More for Talk Shop' })
    expect(more.closest('[data-chip-group]')).toBeTruthy()
  })
})

describe('PilotSheet — used/recharge toggle (Slice D)', () => {
  test('marking used persists the ability slug to usedAbilities', async () => {
    const pilot = makePilot()
    const updateSpy = mock(async () => pilot)
    render(<PilotSheet pilot={pilot} store={makeStubStore(pilot, updateSpy)} />)
    expandCards()

    await choose('Talk Shop', 'Mark used')

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
    await choose('Talk Shop', 'Recharge')

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

    expect(screen.queryByRole('button', { name: /^More for / })).toBeNull()
    // AP cost still shown read-only (the Compact's own cost chip), plus a
    // static Used stamp.
    expect(costChips()).toContain('3 AP')
    expect(screen.getByText('Used')).toBeTruthy()
  })
})

/** Open the folded Generic Abilities section (`expandCards` may have); returns it. */
async function openGeneric(): Promise<HTMLElement> {
  const fold = screen.getByRole('button', { name: /^(Expand|Collapse) Generic Abilities$/ })
  if (fold.getAttribute('aria-expanded') !== 'true') {
    await act(async () => {
      fireEvent.click(fold)
    })
  }
  const section = fold.closest('section')
  if (!section) throw new Error('no Generic Abilities section')
  return section
}

/** A section's fold, by its title: open or not, and whether its body shows. */
const foldOf = (title: string) => {
  const button = screen.getByRole('button', { name: new RegExp(`^(Collapse|Expand) ${title}$`) })
  const section = button.closest('section')
  const body = section?.querySelector<HTMLElement>(':scope > .su-slab-section__body')
  return {
    section,
    open: button.getAttribute('aria-expanded') === 'true',
    shown: body !== null && body !== undefined && !body.hidden,
    grid: body?.querySelector<HTMLElement>(':scope > ul.su-mini-grid') ?? null,
    trees: body?.querySelector<HTMLElement>(':scope > .su-pilot-trees') ?? null,
  }
}

/** The class's trees: each on its track, the trees side by side. */
const treesOf = (): HTMLElement => {
  const trees = document.querySelector<HTMLElement>('.su-pilot-trees')
  if (!trees) throw new Error('no pilot trees')
  return trees
}

describe('PilotSheet — the abilities fold: the trees on their tracks, the Generic a masonry grid', () => {
  for (const readOnly of [false, true]) {
    test(`tree abilities on top and open, Generic abilities under them and folded (${readOnly ? 'Read' : 'Edit'})`, () => {
      const pilot = makePilot({ abilities: ['mech-acquisition', 'tip-top-shape'] })
      render(<PilotSheet pilot={pilot} store={makeStubStore(pilot)} readOnly={readOnly} />)

      const trees = foldOf('Abilities')
      const generic = foldOf('Generic Abilities')
      // Two sections, in this order.
      expect(trees.section).toBeTruthy()
      expect(generic.section).toBeTruthy()
      expect(
        (trees.section as HTMLElement).compareDocumentPosition(generic.section as HTMLElement) &
          Node.DOCUMENT_POSITION_FOLLOWING
      ).toBeTruthy()
      // Their default folds: the trees open, the Generic tree shut.
      expect(trees.open).toBe(true)
      expect(trees.shown).toBe(true)
      expect(generic.open).toBe(false)
      expect(generic.shown).toBe(false)
      // The trees each a track of contentful Minis, one ability a tier; the
      // Generic tree a masonry grid of them, one a cell.
      const tiers = Array.from(trees.trees?.querySelectorAll('.su-ability-track__tier') ?? [])
      const cells = Array.from(generic.grid?.children ?? [])
      for (const group of [tiers, cells]) {
        expect(group.length).toBeGreaterThan(0)
        for (const cell of group) {
          expect(cell.tagName).toBe('LI')
          expect(cell.querySelector('.su-entity-mini[data-contentful]')).toBeTruthy()
        }
      }
    })
  }
})

describe('PilotSheet — the Generic tree is intrinsic', () => {
  test('a pilot with no stored abilities still shows the Generic Minis', async () => {
    const pilot = makePilot({ abilities: [] })
    render(<PilotSheet pilot={pilot} store={makeStubStore(pilot)} />)
    expandCards()

    // Never stored, never picked: every pilot carries the whole tree (Bonesaw
    // reads his Generic cards beside his one stored ability), in its own
    // section under the trees the pilot chose, which say none are learned.
    const generic = await openGeneric()
    const names = Array.from(generic.querySelectorAll('.su-entity-mini__name')).map(
      (n) => n.textContent ?? ''
    )
    for (const name of ['Repair', 'Area Salvage', 'Mech Salvage', 'Patch Up']) {
      expect(names.some((n) => n.startsWith(name))).toBe(true)
    }
    expect(screen.getByText('No abilities learned yet.')).toBeTruthy()
    // …with the same live-play toggle as any other ability.
    expect(screen.getByRole('button', { name: 'More for Repair' })).toBeTruthy()
  })

  test('a stored ability prints beside the Generic tree, not instead of it', async () => {
    const pilot = makePilot()
    render(<PilotSheet pilot={pilot} store={makeStubStore(pilot)} />)
    expandCards()
    await openGeneric()
    expect(screen.getByRole('button', { name: 'More for Repair' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'More for Talk Shop' })).toBeTruthy()
  })
})

/** The tree abilities' names, tree by tree, each tree's in its order. */
const treeAbilityNames = () =>
  Array.from(treesOf().querySelectorAll('.su-ability-track__tier .su-entity-mini__name')).map(
    (name) => name.textContent ?? ''
  )

describe('PilotSheet — the tree abilities, tree by tree', () => {
  test("only the Abilities taken, each a contentful Mini, in its tree's order", () => {
    const pilot = makePilot({ abilities: ['mech-acquisition', 'engineering-expertise'] })
    render(<PilotSheet pilot={pilot} store={makeStubStore(pilot)} />)

    // In the tree's order, not the order stored; Talk Shop (tier 2) is not taken.
    const names = treeAbilityNames()
    expect(names).toHaveLength(2)
    expect(names[0]).toContain('Engineering Expertise')
    expect(names[1]).toContain('Mech Acquisition')
    // Each its head and then its text.
    expect(
      treesOf().querySelectorAll('.su-entity-mini[data-contentful] .su-entity-mini__body')
    ).toHaveLength(2)
    // The Generic tree is its own grid, never in this one.
    expect(names.some((name) => name.startsWith('Repair'))).toBe(false)
  })

  test('trees run Core, then Advanced, then Legendary', () => {
    const pilot = makePilot({
      abilities: ['tip-top-shape', 'union-engineer', 'mass-field-maintenance', 'talk-shop'],
    })
    render(<PilotSheet pilot={pilot} store={makeStubStore(pilot)} />)

    const names = treeAbilityNames()
    const at = (name: string) => names.findIndex((n) => n.startsWith(name))
    expect(names).toHaveLength(4)
    // The trees in the sheet's order (Mechanical Knowledge, Mech-Tech,
    // Advanced Engineer, Legendary Engineer), one ability from each.
    expect(at('Talk Shop')).toBe(0)
    expect(at('Mass Field Maintenance')).toBe(1)
    expect(at('Union Engineer')).toBe(2)
    expect(at('Tip Top Shape')).toBe(3)
  })

  test('the trees the pilot has taken an Ability from come first', () => {
    // Driftwood's: a Salvager, Squeeze It In from Salvaging, the class's
    // seventh Core tree; every other tree untaken, in its own order after.
    const pilot = makePilot({ classRef: 'salvager', abilities: ['squeeze-it-in'] })
    render(<PilotSheet pilot={pilot} store={makeStubStore(pilot)} readOnly />)

    const trees = Array.from(
      treesOf().querySelectorAll(':scope > .su-ability-tree__group [data-slab] > :first-child')
    ).map((label) => label.textContent)
    expect(trees.length).toBeGreaterThan(2)
    expect(trees[0]).toBe('Salvaging')
    expect(trees[1]).toBe('Mechanical Knowledge')
  })

  test("Edit puts each ability's controls in its Mini's chip group", async () => {
    const pilot = makePilot({ currentAP: 5 })
    const updateSpy = mock(async () => pilot)
    render(<PilotSheet pilot={pilot} store={makeStubStore(pilot, updateSpy)} />)

    const more = within(treesOf()).getByRole('button', { name: 'More for Talk Shop' })
    expect(more.closest('[data-chip-group]')).toBeTruthy()
    await choose('Talk Shop', /spend 3 ap/i)
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

describe("PilotSheet — a read-only sheet's Minis open their entity", () => {
  test('clicking an ability Mini opens its Page (the detail dialog)', () => {
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

describe("PilotSheet — a hybrid's Add Abilities offers its origin's trees", () => {
  // Ranger is reached from Scout or Soldier; with no recorded origin both
  // contribute. Survey Drone is Scout's Recon tree, which Ranger itself lacks.
  const RANGER_ID = '4570fb02-10c4-4f53-8575-e54bd08d47d3'

  async function offered(pilot: Pilot) {
    render(<PilotSheet pilot={pilot} store={makeStubStore(pilot)} />)
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /^Manage abilities$/i }))
    })
    return within(screen.getByRole('dialog'))
  }

  test('a Ranger with no recorded origin is offered Survey Drone', async () => {
    const dialog = await offered(makePilot({ classRef: RANGER_ID, abilities: [] }))
    expect(dialog.queryAllByRole('button', { name: /^Survey Drone$/ })).not.toHaveLength(0)
  })
})

describe("PilotSheet — the class's own trees", () => {
  test('a Core class shows its Core trees whole, the untaken greyed, never its Advanced tree', () => {
    const pilot = makePilot({ classRef: 'Engineer', abilities: ['talk-shop'] })
    render(<PilotSheet pilot={pilot} store={makeStubStore(pilot)} readOnly />)
    const names = treeAbilityNames()
    // Its Core trees whole: Talk Shop's tree-mates are there, greyed.
    expect(names.some((n) => n.startsWith('Engineering Expertise'))).toBe(true)
    expect(names.some((n) => n.startsWith('Union Engineer'))).toBe(false)
    const unlearned = treesOf().querySelectorAll('.su-pilot-ability--unlearned')
    expect(unlearned.length).toBe(names.length - 1)
    // Each tree on its track, under a slab naming it.
    expect(treesOf().querySelectorAll('.su-ability-track').length).toBeGreaterThan(1)
  })
})

describe('PilotSheet — a taken ability reads its full rules', () => {
  test('Talk Shop taken reads its rules; its untaken tree-mates their lead alone', () => {
    const pilot = makePilot({ classRef: 'Engineer', abilities: ['talk-shop'] })
    render(<PilotSheet pilot={pilot} store={makeStubStore(pilot)} readOnly />)
    const rules = treesOf().querySelectorAll('.su-pilot-ability__rules')
    expect(rules.length).toBeGreaterThan(0)
    for (const block of rules) {
      expect(block.closest('.su-pilot-ability--unlearned')).toBeNull()
      expect((block.textContent ?? '').length).toBeGreaterThan(0)
    }
    expect(
      treesOf().querySelector('.su-pilot-ability--unlearned .su-pilot-ability__rules')
    ).toBeNull()
  })
})
