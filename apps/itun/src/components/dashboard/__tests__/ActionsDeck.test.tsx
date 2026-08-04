/**
 * Tests for ActionsDeck — the D1 actions instrument on the light display.
 * Verifies the deck renders from the real ORM as ONE flat grid (no per-source
 * headings), selecting an action opens the resolve panel, Activate writes the
 * EP/uses patch through the store, the timing tabs filter by actionType, and the
 * mount decides the roster: boarded lists the mech's actions AND the pilot's,
 * on foot only the pilot's (on the AP economy).
 *
 * Reference content needs the ORM, so preload('all') runs once. A system with a
 * real EP cost is picked from the loaded set so the Activate write is exercised.
 */

import { beforeAll, describe, expect, test } from 'bun:test'
import { fireEvent, render, screen } from '@testing-library/react'
import { EntityHrefProvider } from 'component-lib'
import { SalvageUnionReference } from 'salvageunion-reference'
import { resolveChassisRef } from 'salvageunion-reference/rules'
import { mechMaxEP, mechMaxHeat, mechMaxSP, pilotMaxAP } from '../../../lib/rules/derivedStats'
import type { Mech } from '../../../lib/schemas/mech'
import type { Pilot } from '../../../lib/schemas/pilot'
import { mechFixture, pilotFixture } from '../../__tests__/fixtures'
import { makeEntityStoreMock } from '../../__tests__/mockEntityStore'
import { itemEconomy, resolveModule, resolveSystem } from '../../sheet/mechItemRules'
import { ActionsDeck } from '../ActionsDeck'
import type { PlayStore } from '../ActiveItemBand'
import { hasCurrencyChoice, hasVariableHot, hotHeatFor } from '../dashboardRules'

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
/** An ability carrying visible actions → drives the pilot-deck tests. */
let pilotAbility: { id: string; actionNames: string[] } | null = null
/** A module whose visible action carries a ROLL TABLE → the nested-control guard. */
let tableModule: { id: string; actionName: string } | null = null

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
  // A module whose visible action carries its own roll table. The catalog extent
  // keeps roll tables (they ARE the content on an SRD index page), so the deck
  // has to suppress them — their Show/Roll buttons can't nest in a clickable tile.
  for (const mod of SalvageUnionReference.Modules.all()) {
    if (!mod.id) continue
    const resolved = resolveModule(mod.id)
    const acts = resolved ? (SalvageUnionReference.resolveActions(resolved) ?? []) : []
    const hit = acts.find((a) => !a.hidden && (a.table != null || a.tableName != null))
    if (hit) {
      tableModule = { id: mod.id, actionName: hit.name }
      break
    }
  }
  // A pilot ability with at least one visible action (the on-foot / cockpit deck).
  for (const ability of SalvageUnionReference.Abilities.all()) {
    if (!ability.id) continue
    const acts = (SalvageUnionReference.resolveActions(ability) ?? []).filter((a) => !a.hidden)
    if (acts.length > 0) {
      pilotAbility = { id: ability.id, actionNames: acts.map((a) => a.name) }
      break
    }
  }
})

/** The visible action names the costed system contributes to the mech deck. */
function mechActionNames(): string[] {
  const item = resolveSystem(costedSystemId)
  if (!item) throw new Error(`unresolved system ${costedSystemId}`)
  return (SalvageUnionReference.resolveActions(item) ?? [])
    .filter((a) => !a.hidden)
    .map((a) => a.name)
}

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

/** The deck cards are catalog-extent `ReferenceEntityCard` tiles laid out as one
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
  test('renders ONE flat grid — no per-source headings above the cards', () => {
    expect(costedSystemId).toBeTruthy()
    const mech = makeMech()
    const { store } = stubStore(mech)
    const { container } = renderDeck(mech, store)
    // Every card lives in a single grid; the deck files none of them under a
    // heading of its own name (the source names survive only as filter chips).
    expect(container.querySelectorAll('.pc-deck-grid')).toHaveLength(1)
    expect(container.querySelector('.pc-deck h1, .pc-deck h2, .pc-deck h3')).toBeNull()
    expect(deckCards(container).length).toBeGreaterThan(0)
  })

  test('a catalog tile nests no control inside its own clickable card', () => {
    const mod = tableModule as { id: string; actionName: string }
    expect(mod).toBeTruthy()
    const mech = mechFixture({
      id: 'm1',
      name: 'Rig',
      chassisRef: 'unknown-chassis',
      modules: [mod.id],
      currentEP: 6,
      currentHeat: 0,
    })
    const { store } = stubStore(mech)
    const { container } = renderDeck(mech, store)
    const card = deckCards(container).find((el) => el.getAttribute('aria-label') === mod.actionName)
    expect(card).toBeTruthy()
    // The tile's roll table (Show toggle + Roll button) is suppressed: a control
    // inside the card would be invalid markup and its click would bubble into
    // `onOpen`. The table is still one click away, in the resolve panel.
    expect(card?.querySelectorAll('button, [role="button"]')).toHaveLength(0)
    // …and the resolve panel DOES render it.
    fireEvent.click(card as Element)
    expect(screen.getByText('Roll the Die')).toBeTruthy()
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

  test('boarded deck (mount=mech) lists the pilot actions alongside the mech ones', () => {
    const ability = pilotAbility as { id: string; actionNames: string[] }
    expect(ability).toBeTruthy()
    const mech = makeMech()
    const pilot = pilotFixture({ id: 'p1', name: 'Vex', abilities: [ability.id], currentAP: 5 })
    const { store } = stubStore(mech)
    const { container } = render(
      <EntityHrefProvider value={() => undefined}>
        <ActionsDeck mech={mech} pilot={pilot} mount="mech" store={store} />
      </EntityHrefProvider>
    )
    const labels = deckCards(container).map((el) => el.getAttribute('aria-label'))
    // The mech's own system actions are there…
    expect(mechActionNames().some((n) => labels.includes(n))).toBe(true)
    // …and so is the pilot's ability action — the pilot is in the cockpit.
    expect(ability.actionNames.some((n) => labels.includes(n))).toBe(true)
  })

  test('on-foot deck (mount=pilot) lists ONLY pilot actions', () => {
    const ability = pilotAbility as { id: string; actionNames: string[] }
    const pilot = pilotFixture({ id: 'p1', name: 'Vex', abilities: [ability.id], currentAP: 5 })
    const { store } = stubStore(pilot)
    const { container } = render(
      <EntityHrefProvider value={() => undefined}>
        <ActionsDeck mech={makeMech()} pilot={pilot} mount="pilot" store={store} />
      </EntityHrefProvider>
    )
    const labels = deckCards(container).map((el) => el.getAttribute('aria-label'))
    expect(ability.actionNames.some((n) => labels.includes(n))).toBe(true)
    // The mech is left behind — none of its actions are reachable on foot.
    expect(mechActionNames().some((n) => labels.includes(n))).toBe(false)
  })
})

/**
 * An UNRECORDED live stat means unspent/undamaged, not empty. The deck's three
 * write paths each defaulted the missing value to 0, so the first Activate or
 * Push on a mech (or pilot) that had never had the field written banked the
 * spend against an empty pool and stored EP 0 / AP 0 / SP 0 — a record that
 * displayed full everywhere else, because every read path defaults to the max.
 *
 * These use a REAL chassis: `unknown-chassis` (used above) derives a max of 0,
 * which would make the assertions pass under the old behaviour too.
 */
describe('ActionsDeck — unrecorded live stats default to full, not empty', () => {
  const CHASSIS = 'Leviathan'

  test('Activate spends EP from the full pool when EP was never stored', () => {
    const mech = mechFixture({
      id: 'm1',
      name: 'Rig',
      chassisRef: CHASSIS,
      systems: [costedSystemId],
      currentHeat: 0,
    })
    expect(mech.currentEP).toBeUndefined()
    const { store, calls } = stubStore(mech)
    const { container } = renderDeck(mech, store)
    const { epCost } = clickPrimaryAction(container)
    fireEvent.click(screen.getByText('Activate'))

    const epMax = mechMaxEP(mech, resolveChassisRef(CHASSIS))
    expect(epMax).toBeGreaterThan(epCost)
    expect(calls).toHaveLength(1)
    // Previously Math.max(0, 0 - epCost) === 0 — the mech's EP was zeroed.
    expect(calls[0]?.patch.currentEP).toBe(epMax - epCost)
  })

  test('Activate spends AP from the full pool when AP was never stored', () => {
    const mod = epApModule as { id: string; actionName: string }
    expect(mod).toBeTruthy()
    const mech = mechFixture({
      id: 'm1',
      name: 'Rig',
      chassisRef: CHASSIS,
      modules: [mod.id],
      currentHeat: 0,
    })
    const pilot = pilotFixture({ id: 'p1', name: 'Vex' })
    expect(pilot.currentAP).toBeUndefined()
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
    fireEvent.click(screen.getByLabelText('1 AP'))
    fireEvent.click(screen.getByText('Activate'))

    const apMax = pilotMaxAP(pilot)
    expect(apMax).toBeGreaterThan(1)
    expect(calls).toHaveLength(1)
    expect(calls[0]?.type).toBe('pilot')
    // Previously Math.max(0, 0 - 1) === 0 — the pilot's AP was zeroed.
    expect(calls[0]?.patch.currentAP).toBe(apMax - 1)
  })

  test('Push damages SP from the full pool when SP was never stored', () => {
    // Leviathan is SP 76 / Heat Cap 18. Starting at Heat 17 every Push clamps to
    // the cap, so the Heat Check overloads on any d20 except a natural 20 (90%)
    // and the 11-19 Overheat band (45%) then writes SP — ~40% of pushes. Over 80
    // pushes at least one SP write is a certainty for any practical purpose.
    // The damage is Heat-sized, so the expected write is 76 - 18 = 58, never 0.
    const mech = mechFixture({
      id: 'm1',
      name: 'Rig',
      chassisRef: CHASSIS,
      systems: [costedSystemId],
      currentHeat: 17,
    })
    expect(mech.currentSP).toBeUndefined()
    const chassis = resolveChassisRef(CHASSIS)
    const spMax = mechMaxSP(mech, chassis)
    const heatAtCheck = mechMaxHeat(mech, chassis)
    expect(spMax).toBeGreaterThan(heatAtCheck)

    const { store, calls } = stubStore(mech)
    const { container } = renderDeck(mech, store)
    clickPrimaryAction(container)
    fireEvent.click(screen.getByText('Roll')) // Push stays disabled until a roll exists
    for (let i = 0; i < 80; i += 1) fireEvent.click(screen.getByText('Push'))

    const spWrites = calls
      .map((c) => c.patch.currentSP)
      .filter((v): v is number => typeof v === 'number')
    expect(spWrites.length).toBeGreaterThan(0)
    // Previously every one of these was Math.max(0, 0 - heat) === 0: an undamaged
    // mech recorded at SP 0, one hit from destroyed.
    for (const v of spWrites) expect(v).toBe(spMax - heatAtCheck)
  })
})
