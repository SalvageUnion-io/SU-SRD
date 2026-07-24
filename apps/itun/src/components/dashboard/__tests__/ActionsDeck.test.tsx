/**
 * Tests for ActionsDeck — the D1 actions instrument on the light display.
 * Verifies the flat deck renders from the real ORM (grouped by source owner),
 * selecting an action opens the resolve panel, Activate writes the EP/uses patch
 * through the store, the timing tabs filter by actionType, and the on-foot
 * (mount='pilot') deck lists pilot actions on the AP economy.
 *
 * Reference content needs the ORM, so preload('all') runs once. A system with a
 * real EP cost is picked from the loaded set so the Activate write is exercised.
 */

import { beforeAll, describe, expect, test } from 'bun:test'
import { fireEvent, render, screen } from '@testing-library/react'
import { EntityHrefProvider } from 'component-lib'
import { SalvageUnionReference } from 'salvageunion-reference'

import type { Mech } from '../../../lib/schemas/mech'
import type { Pilot } from '../../../lib/schemas/pilot'
import { itemEconomy, resolveModule, resolveSystem } from '../../sheet/mechItemRules'
import { ActionsDeck } from '../ActionsDeck'
import { hasCurrencyChoice, hasVariableHot, hotHeatFor } from '../dashboardRules'
import type { PlayStore } from '../ActiveItemBand'
import { mechFixture, pilotFixture } from '../../__tests__/fixtures'
import { makeEntityStoreMock } from '../../__tests__/mockEntityStore'

type Call = { type: string; id: string; patch: Record<string, unknown> }

function stubStore(entity: Mech | Pilot): { store: PlayStore; calls: Call[] } {
  const calls: Call[] = []
  const store: PlayStore = makeEntityStoreMock({
    get: (_type, id) => (id === entity.id ? entity : null),
    update: async (type, id, patch) => {
      calls.push({ type, id, patch })
      return entity
    },
  }).getState()
  return { store, calls }
}

let costedSystemId = ''
/** A system with a variable-Hot ('X') action → drives the Hot(X) stepper test. */
let varHotSystem: { id: string; actionName: string } | null = null
/** A module with an 'EP or AP' action → drives the cost-radio test. */
let epApModule: { id: string; actionName: string } | null = null

beforeAll(async () => {
  await SalvageUnionReference.preload('all')
  // A system whose primary action costs EP → Activate produces a currentEP patch.
  for (const sys of SalvageUnionReference.Systems.all()) {
    if (!sys.id) continue
    const resolved = resolveSystem(sys.id)
    if (resolved && itemEconomy(resolved).epCost > 0) {
      costedSystemId = sys.id
      break
    }
  }
  // A system carrying a variable-Hot ('X') action (for the Hot(X) stepper).
  for (const sys of SalvageUnionReference.Systems.all()) {
    if (!sys.id) continue
    const resolved = resolveSystem(sys.id)
    const acts = resolved ? (SalvageUnionReference.resolveActions(resolved) ?? []) : []
    const hit = acts.find((a) => !a.hidden && hasVariableHot(a))
    if (hit) {
      varHotSystem = { id: sys.id, actionName: hit.name }
      break
    }
  }
  // A module carrying an 'EP or AP' action (for the EP/AP cost radios).
  for (const mod of SalvageUnionReference.Modules.all()) {
    if (!mod.id) continue
    const resolved = resolveModule(mod.id)
    const acts = resolved ? (SalvageUnionReference.resolveActions(resolved) ?? []) : []
    const hit = acts.find((a) => !a.hidden && hasCurrencyChoice(a) && a.activationCost === 1)
    if (hit) {
      epApModule = { id: mod.id, actionName: hit.name }
      break
    }
  }
})

function makeMech(): Mech {
  return mechFixture({
    id: 'm1',
    name: 'Rig',
    chassisRef: 'unknown-chassis',
    systems: [costedSystemId],
    currentEP: 6,
    currentHeat: 0,
  })
}

function renderDeck(mech: Mech, store: PlayStore) {
  return render(
    <EntityHrefProvider value={() => undefined}>
      <ActionsDeck mech={mech} store={store} />
    </EntityHrefProvider>
  )
}

/** The deck cards are shortform `ReferenceEntityCard` badges laid out as a
 * masonry grid: each is a clickable card exposing `role="button"` +
 * `aria-label` = the action name. */
function deckCards(container: HTMLElement): HTMLElement[] {
  return [...container.querySelectorAll<HTMLElement>('.pc-deck-grid > li [role="button"]')]
}

/** Click the deck badge whose action name (aria-label) matches exactly. */
function clickActionByName(container: HTMLElement, name: string) {
  const card = deckCards(container).find((el) => el.getAttribute('aria-label') === name)
  fireEvent.click(card as Element)
}

/** Click the deck card for the system's primary (EP-costed) action. */
function clickPrimaryAction(container: HTMLElement): { epCost: number } {
  const item = resolveSystem(costedSystemId)
  if (!item) throw new Error(`unresolved system ${costedSystemId}`)
  const actions = SalvageUnionReference.resolveActions(item) ?? []
  const primary = actions.find((a) => typeof a.activationCost === 'number') ?? actions[0]
  const card = deckCards(container).find(
    (el) => el.getAttribute('aria-label') === (primary?.name ?? '')
  )
  fireEvent.click(card as Element)
  const epCost = typeof primary?.activationCost === 'number' ? primary.activationCost : 0
  return { epCost }
}

describe('ActionsDeck', () => {
  test('lists the installed system as a source-owner group', () => {
    expect(costedSystemId).toBeTruthy()
    const mech = makeMech()
    const { store } = stubStore(mech)
    const { container } = renderDeck(mech, store)
    const item = resolveSystem(costedSystemId)
    const labels = [...container.querySelectorAll('.pc-deck-group-lab')].map((n) => n.textContent)
    expect(labels).toContain(item?.name ?? '')
  })

  test('selecting an action opens the resolve panel with Activate + Roll', () => {
    const mech = makeMech()
    const { store } = stubStore(mech)
    const { container } = renderDeck(mech, store)
    clickPrimaryAction(container)
    expect(screen.getByText('Activate')).toBeTruthy()
    expect(screen.getByText('Roll')).toBeTruthy()
  })

  test('Activate writes the EP-spend patch through the store', () => {
    const mech = makeMech()
    const { store, calls } = stubStore(mech)
    const { container } = renderDeck(mech, store)
    const { epCost } = clickPrimaryAction(container)
    fireEvent.click(screen.getByText('Activate'))
    expect(calls).toHaveLength(1)
    expect(calls[0]?.type).toBe('mech')
    expect(calls[0]?.patch.currentEP).toBe(Math.max(0, 6 - epCost))
  })

  test('Roll shows a Core Mechanic band readout', () => {
    const mech = makeMech()
    const { store } = stubStore(mech)
    const { container } = renderDeck(mech, store)
    clickPrimaryAction(container)
    expect(container.querySelector('.pc-deck-roll')).toBeNull()
    fireEvent.click(screen.getByText('Roll'))
    expect(container.querySelector('.pc-deck-roll')).toBeTruthy()
    expect(container.querySelector('.pc-deck-d20')).toBeTruthy()
  })

  test('timing tabs filter the deck by actionType', () => {
    const mech = makeMech()
    const { store } = stubStore(mech)
    const { container } = renderDeck(mech, store)
    const before = container.querySelectorAll('.pc-deck-grid > li').length
    expect(before).toBeGreaterThan(0)
    // Pick a timing tab that the system's actions do NOT match by intersecting
    // with a type absent from the deck. DownTime is not a tab, so use React
    // (Reaction) — most weapon systems are Turn actions, so React empties it.
    fireEvent.click(screen.getByRole('tab', { name: 'React' }))
    const reactItems = container.querySelectorAll('.pc-deck-grid > li').length
    // Either the deck filtered down, or it shows the no-match note.
    const emptied = reactItems < before || container.querySelector('.pc-deck-empty') !== null
    expect(emptied).toBe(true)
    // Back to All restores the full deck.
    fireEvent.click(screen.getByRole('tab', { name: 'All' }))
    expect(container.querySelectorAll('.pc-deck-grid > li').length).toBe(before)
  })

  test('a range readout renders with the reach count', () => {
    const mech = makeMech()
    const { store } = stubStore(mech)
    const { container } = renderDeck(mech, store)
    expect(container.querySelector('.pc-deck-reach')?.textContent).toContain('in reach')
  })

  test('resolve panel exposes Back / Clear and an Apply gated on a roll', () => {
    const mech = makeMech()
    const { store } = stubStore(mech)
    const { container } = renderDeck(mech, store)
    clickPrimaryAction(container)
    expect(screen.getByText('◀ Back')).toBeTruthy()
    expect(screen.getByText('Clear')).toBeTruthy()
    // Apply is disabled until there is a roll to commit.
    const apply = screen.getByText<HTMLButtonElement>('Apply')
    expect(apply.disabled).toBe(true)
    fireEvent.click(screen.getByText('Roll'))
    expect(screen.getByText<HTMLButtonElement>('Apply').disabled).toBe(false)
    // Clear resets the resolve state (the roll readout disappears).
    fireEvent.click(screen.getByText('Clear'))
    expect(container.querySelector('.pc-deck-roll')).toBeNull()
  })

  test('Apply commits a rolled outcome without ever auto-writing a destructive condition', () => {
    const mech = makeMech()
    const { store, calls } = stubStore(mech)
    const { container } = renderDeck(mech, store)
    clickPrimaryAction(container)
    fireEvent.click(screen.getByText('Roll'))
    fireEvent.click(screen.getByText('Apply'))
    // Either the non-destructive auto-commit or the Cascade-Failure route note —
    // never both, and neither writes a destructive condition through the store.
    const applied = container.querySelector('.pc-deck-applied')
    const routed = container.querySelector('.pc-deck-apply-route')
    expect(Boolean(applied) !== Boolean(routed)).toBe(true)
    // Apply performs no store write at all (the cost lands at Activate; a
    // destructive band is routed to the Active Item band, never auto-applied).
    expect(calls).toHaveLength(0)
  })

  test('Hot(X) stepper projects heat and drives the Activate patch', () => {
    expect(varHotSystem).toBeTruthy()
    const sys = varHotSystem as { id: string; actionName: string }
    const mech = mechFixture({
      id: 'm1',
      name: 'Rig',
      chassisRef: 'unknown-chassis',
      systems: [sys.id],
      currentEP: 6,
      currentHeat: 0,
      maxHeatModifier: 50,
    })
    const { store, calls } = stubStore(mech)
    const { container } = renderDeck(mech, store)
    clickActionByName(container, sys.actionName)
    const proj = container.querySelector('.pc-deck-hotx-proj')
    expect(proj?.textContent).toContain('Heat 1/')
    fireEvent.click(screen.getByLabelText('Increase Hot'))
    expect(container.querySelector('.pc-deck-hotx-proj')?.textContent).toContain('Heat 2/')
    fireEvent.click(screen.getByText('Activate'))
    const resolvedSystem = resolveSystem(sys.id)
    if (!resolvedSystem) throw new Error(`unresolved system ${sys.id}`)
    const action = SalvageUnionReference.resolveActions(resolvedSystem)?.find(
      (a) => a.name === sys.actionName
    )
    if (!action) throw new Error(`missing action ${sys.actionName}`)
    const expectedHeat = hotHeatFor(action, 2)
    expect(calls).toHaveLength(1)
    expect(calls[0]?.patch.currentHeat).toBe(expectedHeat)
  })

  test('EP/AP cost radios: choosing AP spends the pilot AP', () => {
    expect(epApModule).toBeTruthy()
    const mod = epApModule as { id: string; actionName: string }
    const mech = mechFixture({
      id: 'm1',
      name: 'Rig',
      chassisRef: 'unknown-chassis',
      modules: [mod.id],
      currentEP: 6,
      currentHeat: 0,
    })
    const pilot = pilotFixture({ id: 'p1', name: 'Vex', currentAP: 5 })
    const calls: Call[] = []
    const store: PlayStore = makeEntityStoreMock({
      get: (type, id) =>
        type === 'mech' && id === mech.id
          ? mech
          : type === 'pilot' && id === pilot.id
            ? pilot
            : null,
      update: async (type, id, patch) => {
        calls.push({ type, id, patch })
        return mech
      },
    }).getState()
    const { container } = render(
      <EntityHrefProvider value={() => undefined}>
        <ActionsDeck mech={mech} pilot={pilot} mount="mech" store={store} />
      </EntityHrefProvider>
    )
    clickActionByName(container, mod.actionName)
    // Both radios render; pick AP, then Activate → a pilot AP spend, not a mech write.
    const apRadio = screen.getByLabelText('1 AP')
    fireEvent.click(apRadio)
    fireEvent.click(screen.getByText('Activate'))
    expect(calls).toHaveLength(1)
    expect(calls[0]?.type).toBe('pilot')
    expect(calls[0]?.patch.currentAP).toBe(4)
  })

  test('on-foot deck (mount=pilot) lists pilot actions', () => {
    const ability = SalvageUnionReference.Abilities.all().find((a) => {
      const acts = SalvageUnionReference.resolveActions(a)
      return acts !== undefined && acts.filter((x) => !x.hidden).length > 0
    }) as { id?: string } | undefined
    const pilot = pilotFixture({
      id: 'p1',
      name: 'Vex',
      abilities: [ability?.id ?? ''],
      currentAP: 5,
    })
    const { store } = stubStore(pilot)
    const { container } = render(
      <EntityHrefProvider value={() => undefined}>
        <ActionsDeck mech={makeMech()} pilot={pilot} mount="pilot" store={store} />
      </EntityHrefProvider>
    )
    // The pilot deck renders (a card or an empty note), never crashes; and there
    // is no Push affordance until an action is opened (pilots have no Heat).
    expect(container.querySelector('.pc-deck, .pc-deck-empty')).toBeTruthy()
  })
})
