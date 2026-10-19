/**
 * Tests for the resolve — `useActionsDeck` driving `PlayResolveSteps`, the
 * steps an action's Row opens in (play.md §5). Verifies opening an action
 * offers Activate + Roll, Activate writes the EP/uses patch through the store,
 * Roll reads a Core Mechanic band, Apply never auto-writes a destructive
 * outcome, Hot(X) and EP-or-AP drive the activation, unrecorded live stats
 * count as full, Push stops at the Heat Cap, and the resolve in progress is
 * the seat's: every step is written to it, and a seat that already holds a
 * roll reopens on it.
 *
 * Reference content needs the ORM, so preload('all') runs once. A system with a
 * real EP cost is picked from the loaded set so the Activate write is exercised.
 */

import { beforeAll, describe, expect, test } from 'bun:test'
import { act, fireEvent, render, screen } from '@testing-library/react'
import type { Mech } from 'game-domain/schemas/mech'
import type { SeatResolving } from 'game-domain/schemas/seat'
import { useState } from 'react'
import { getEntitySlug, SalvageUnionReference } from 'salvageunion-reference'
import {
  mechMaxEP,
  mechMaxHeat,
  mechMaxSP,
  pilotMaxAP,
  resolveChassisRef,
} from 'salvageunion-reference/rules'
import { mechFixture, pilotFixture } from '../../components/__tests__/fixtures'
import { hydrateStores } from '../../components/__tests__/hydrateStores'
import { makeEntityStoreMock } from '../../components/__tests__/mockEntityStore'
import { EntityHrefProvider } from '../../components/index'
import { itemEconomy, resolveModule, resolveSystem } from '../../lib/rules/mechItems'
import {
  buildMechActions,
  buildPilotActions,
  hasCurrencyChoice,
  hasVariableHot,
  hotHeatFor,
} from '../../lib/rules/playActions'
import { PlayResolveSteps } from '../PlayResolveSteps'
import type { PlayStore } from '../play.model'
import type { ActionsDeckProps, ResolveModel } from '../useActionsDeck'
import { useActionsDeck } from '../useActionsDeck'
import type { StoreCall as Call } from './stubStore'
import { stubStore } from './stubStore'

beforeAll(hydrateStores)

let costedSystemId = ''
/** A system with a variable-Hot ('X') action → drives the Hot(X) stepper test. */
let varHotSystem: { id: string; actionName: string } | null = null
/** A module with an 'EP or AP' action → drives the cost-radio test. */
let epApModule: { id: string; actionName: string } | null = null
beforeAll(async () => {
  // A system whose primary action costs EP → Activate produces a currentEP patch.
  for (const sys of SalvageUnionReference.Systems.all()) {
    if (!sys.id) continue
    const resolved = resolveSystem(getEntitySlug(sys))
    if (resolved && itemEconomy(resolved).epCost > 0) {
      costedSystemId = getEntitySlug(sys)
      break
    }
  }
  // A system carrying a variable-Hot ('X') action (for the Hot(X) stepper).
  for (const sys of SalvageUnionReference.Systems.all()) {
    if (!sys.id) continue
    const resolved = resolveSystem(getEntitySlug(sys))
    const acts = resolved ? (SalvageUnionReference.resolveActions(resolved) ?? []) : []
    const hit = acts.find((a) => !a.hidden && hasVariableHot(a))
    if (hit) {
      varHotSystem = { id: getEntitySlug(sys), actionName: hit.name }
      break
    }
  }
  // A module carrying an 'EP or AP' action (for the EP/AP cost radios).
  for (const mod of SalvageUnionReference.Modules.all()) {
    if (!mod.id) continue
    const resolved = resolveModule(getEntitySlug(mod))
    const acts = resolved ? (SalvageUnionReference.resolveActions(resolved) ?? []) : []
    const hit = acts.find((a) => !a.hidden && hasCurrencyChoice(a) && a.activationCost === 1)
    if (hit) {
      epApModule = { id: getEntitySlug(mod), actionName: hit.name }
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

/**
 * The deck's dice, injected: every die shows 14. A Core Mechanic Success; a
 * Heat Check at Heat 14 or more overloads, and Reactor Overload 14 Overheats.
 */
const rollFourteen: NonNullable<ActionsDeckProps['rollFor']> = async () => () => 14

/** Click a resolve control whose handler rolls, and let the (async) dice land. */
async function clickRolling(text: string): Promise<void> {
  await act(async () => {
    fireEvent.click(screen.getByText(text))
  })
}

/**
 * The resolve as an action's Row opens it: a button per action in the deck
 * (each Row's Use), the steps of the open one under them, with the seat's
 * `resolving` held in component state as `useSeat`'s optimistic update holds
 * it. `written` records every write to the seat.
 */
function ActionsDeck({
  initial = null,
  written = [],
  ...props
}: Omit<ActionsDeckProps, 'resolving' | 'onResolving'> & {
  initial?: SeatResolving | null
  written?: (SeatResolving | null)[]
}) {
  const [resolving, setResolving] = useState<SeatResolving | null>(initial)
  const deck = useActionsDeck({
    rollFor: rollFourteen,
    ...props,
    resolving,
    onResolving: (next) => {
      written.push(next)
      setResolving(next)
    },
  })
  const onFoot = props.mount === 'pilot'
  const actions = [
    ...(onFoot || !props.mech ? [] : buildMechActions(props.mech)),
    ...(props.pilot ? buildPilotActions(props.pilot) : []),
  ]
  const view = deck.resolve
  return (
    <>
      <ul aria-label="Deck">
        {actions.map((a) => (
          <li key={a.key}>
            <button type="button" aria-label={`Resolve ${a.name}`} onClick={() => deck.open(a.key)}>
              {a.name}
            </button>
          </li>
        ))}
      </ul>
      {view.kind === 'resolve' ? (
        <>
          <button type="button" onClick={view.onBack}>
            Cancel
          </button>
          <PlayResolveSteps view={view} canWrite />
        </>
      ) : view.kind === 'orphan' ? (
        <p>
          {view.text}
          <button type="button" onClick={view.onClear}>
            Clear
          </button>
        </p>
      ) : null}
    </>
  )
}

function renderDeck(mech: Mech, store: PlayStore) {
  return render(
    <EntityHrefProvider value={() => undefined}>
      <ActionsDeck mech={mech} store={store} />
    </EntityHrefProvider>
  )
}

/** Each action's Use: the button named "Resolve <action>". */
function deckCards(container: HTMLElement): HTMLElement[] {
  return [...container.querySelectorAll<HTMLElement>('ul[aria-label="Deck"] button')]
}

/** The action a deck button resolves. */
function deckLabel(el: HTMLElement): string | undefined {
  return el.getAttribute('aria-label')?.replace(/^Resolve /, '')
}

/** Use the action whose name matches exactly. */
function clickActionByName(container: HTMLElement, name: string) {
  const card = deckCards(container).find((el) => deckLabel(el) === name)
  fireEvent.click(card as Element)
}

/** Click the deck card for the system's primary (EP-costed) action. */
function clickPrimaryAction(container: HTMLElement): { epCost: number } {
  const item = resolveSystem(costedSystemId)
  if (!item) throw new Error(`unresolved system ${costedSystemId}`)
  const actions = SalvageUnionReference.resolveActions(item) ?? []
  const primary = actions.find((a) => typeof a.activationCost === 'number') ?? actions[0]
  const card = deckCards(container).find((el) => deckLabel(el) === (primary?.name ?? ''))
  fireEvent.click(card as Element)
  const epCost = typeof primary?.activationCost === 'number' ? primary.activationCost : 0
  return { epCost }
}

describe('the resolve', () => {
  test('using an action opens its resolve with Activate + Roll', () => {
    const mech = makeMech()
    const { store } = stubStore(mech)
    const { container } = renderDeck(mech, store)
    clickPrimaryAction(container)
    expect(screen.getByRole('button', { name: /^Activate\b/ })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Roll the die on Core Mechanic' })).toBeTruthy()
  })

  test('Activate writes the EP-spend patch through the store', () => {
    const mech = makeMech()
    const { store, calls } = stubStore(mech)
    const { container } = renderDeck(mech, store)
    const { epCost } = clickPrimaryAction(container)
    fireEvent.click(screen.getByRole('button', { name: /^Activate\b/ }))
    expect(calls).toHaveLength(1)
    expect(calls[0]?.type).toBe('mech')
    expect(calls[0]?.patch.currentEP).toBe(Math.max(0, 6 - epCost))
  })

  test('Roll marks its Core Mechanic band on the table', async () => {
    const mech = makeMech()
    const { store } = stubStore(mech)
    const { container } = renderDeck(mech, store)
    clickPrimaryAction(container)
    expect(container.querySelector('.su-roll [aria-current="true"]')).toBeNull()
    await clickRolling('Roll the Die')
    expect(container.querySelector('.su-roll [aria-current="true"]')).toBeTruthy()
    expect(container.querySelector('.su-roll__tag')?.textContent).toBe('Rolled 14')
  })

  test('the roll and Apply are spoken by a live region mounted before the roll', async () => {
    const mech = makeMech()
    const { store } = stubStore(mech)
    const { container } = renderDeck(mech, store)
    clickPrimaryAction(container)
    const live = container.querySelector('.su-play-resolve > [aria-live="polite"]')
    expect(live?.textContent).toBe('')
    await clickRolling('Roll the Die')
    expect(live?.textContent).toMatch(/^Rolled 14: \S/)
    fireEvent.click(screen.getByText('Apply'))
    expect(live?.textContent).toMatch(/Result applied$/)
  })

  test('the resolve offers Cancel / Clear and an Apply gated on a roll', async () => {
    const mech = makeMech()
    const { store } = stubStore(mech)
    const { container } = renderDeck(mech, store)
    clickPrimaryAction(container)
    expect(screen.getByText('Cancel')).toBeTruthy()
    expect(screen.getByText('Clear')).toBeTruthy()
    // Apply is disabled until there is a roll to commit.
    const apply = screen.getByText<HTMLButtonElement>('Apply')
    expect(apply.disabled).toBe(true)
    await clickRolling('Roll the Die')
    expect(screen.getByText<HTMLButtonElement>('Apply').disabled).toBe(false)
    // Clear resets the resolve state (the roll readout disappears).
    fireEvent.click(screen.getByText('Clear'))
    expect(container.querySelector('.su-roll [aria-current="true"]')).toBeNull()
  })

  test('Apply commits a rolled outcome without ever auto-writing a destructive condition', async () => {
    const mech = makeMech()
    const { store, calls } = stubStore(mech)
    const { container } = renderDeck(mech, store)
    clickPrimaryAction(container)
    await clickRolling('Roll the Die')
    fireEvent.click(screen.getByText('Apply'))
    // Either the non-destructive auto-commit or the Cascade-Failure route note —
    // never both, and neither writes a destructive condition through the store.
    const applied = screen.queryByText('Result applied ✓')
    const routed = screen.queryByText(/^Cascade Failure: a severe/)
    expect(Boolean(applied) !== Boolean(routed)).toBe(true)
    // Apply performs no store write at all (the cost lands at Activate; a
    // destructive band is the player's to take on the gauge, never auto-applied).
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
    const proj = container.querySelector('.su-dash-deck-hotx-proj')
    expect(proj?.textContent).toContain('Heat 1/')
    fireEvent.click(screen.getByLabelText('Increase Hot'))
    expect(container.querySelector('.su-dash-deck-hotx-proj')?.textContent).toContain('Heat 2/')
    fireEvent.click(screen.getByRole('button', { name: /^Activate\b/ }))
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
    fireEvent.click(screen.getByRole('button', { name: /^Activate\b/ }))
    expect(calls).toHaveLength(1)
    expect(calls[0]?.type).toBe('pilot')
    expect(calls[0]?.patch.currentAP).toBe(4)
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
describe('the resolve — unrecorded live stats default to full, not empty', () => {
  const CHASSIS = 'leviathan'

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
    fireEvent.click(screen.getByRole('button', { name: /^Activate\b/ }))

    const epMax = mechMaxEP(mech, resolveChassisRef(CHASSIS))
    expect(epMax).toBeGreaterThan(epCost)
    expect(calls).toHaveLength(1)
    // Not Math.max(0, 0 - epCost) === 0, which zeroes the mech's EP.
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
    fireEvent.click(screen.getByRole('button', { name: /^Activate\b/ }))

    const apMax = pilotMaxAP(pilot)
    expect(apMax).toBeGreaterThan(1)
    expect(calls).toHaveLength(1)
    expect(calls[0]?.type).toBe('pilot')
    // Not Math.max(0, 0 - 1) === 0, which zeroes the pilot's AP.
    expect(calls[0]?.patch.currentAP).toBe(apMax - 1)
  })

  test('Push damages SP from the full pool when SP was never stored', async () => {
    // Leviathan is SP 76 / Heat Cap 18. Starting at Heat 16 the Push lands on
    // the cap exactly (the last Push the cap allows, Quick Ref p.233), so the
    // Heat Check's 14 overloads and Reactor Overload's 14 lands in the 11-19
    // Overheat band, which writes SP. The damage is Heat-sized, so the expected
    // write is 76 - 18 = 58, never 0.
    const mech = mechFixture({
      id: 'm1',
      name: 'Rig',
      chassisRef: CHASSIS,
      systems: [costedSystemId],
      currentHeat: 16,
    })
    expect(mech.currentSP).toBeUndefined()
    const chassis = resolveChassisRef(CHASSIS)
    const spMax = mechMaxSP(mech, chassis)
    const heatAtCheck = mechMaxHeat(mech, chassis)
    expect(mech.currentHeat).toBe(heatAtCheck - 2)
    expect(spMax).toBeGreaterThan(heatAtCheck)

    const { store, calls } = stubStore(mech)
    const { container } = renderDeck(mech, store)
    clickPrimaryAction(container)
    // Push stays disabled until a roll exists (Core Book p.233).
    await clickRolling('Roll the Die')
    await clickRolling('Push')

    const spWrites = calls
      .map((c) => c.patch.currentSP)
      .filter((v): v is number => typeof v === 'number')
    expect(spWrites.length).toBeGreaterThan(0)
    // Not Math.max(0, 0 - heat) === 0, which records an undamaged mech at SP 0,
    // one hit from destroyed.
    for (const v of spWrites) expect(v).toBe(spMax - heatAtCheck)
  })
})

/**
 * Quick Ref p.233: a Push adds 2 Heat, and a mech never exceeds its Heat Cap,
 * so the resolve refuses a Push that would — as the Reactor row does
 * (`PlayReactorRow`), rather than re-rolling and clamping the Heat at the cap.
 */
describe('useActionsDeck — Push and the Heat Cap', () => {
  type Resolving = Extract<ResolveModel, { kind: 'resolve' }>

  /** The hook alone; `seen` holds the resolve model of the latest render. */
  function Harness({
    seen,
    ...props
  }: Omit<ActionsDeckProps, 'resolving' | 'onResolving'> & {
    seen: { view: ResolveModel | null }
  }) {
    const [resolving, setResolving] = useState<SeatResolving | null>(null)
    const deck = useActionsDeck({ ...props, resolving, onResolving: setResolving })
    seen.view = deck.resolve
    const action = props.mech
      ? buildMechActions(props.mech).find((a) => typeof a.action.activationCost === 'number')
      : undefined
    return (
      <button type="button" aria-label="Resolve" onClick={() => action && deck.open(action.key)}>
        Use
      </button>
    )
  }

  /** Open the costed action at `heat` on Leviathan (Heat Cap 18) and roll. */
  async function rolledAt(heat: number) {
    const mech = mechFixture({
      id: 'm1',
      name: 'Rig',
      chassisRef: 'leviathan',
      systems: [costedSystemId],
      currentHeat: heat,
    })
    expect(mechMaxHeat(mech, resolveChassisRef('leviathan'))).toBe(18)
    const { store, calls } = stubStore(mech)
    const seen: { view: ResolveModel | null } = { view: null }
    render(
      <EntityHrefProvider value={() => undefined}>
        <Harness mech={mech} store={store} seen={seen} />
      </EntityHrefProvider>
    )
    fireEvent.click(screen.getByRole('button', { name: 'Resolve' }))
    const resolve = (): Resolving => {
      if (seen.view?.kind !== 'resolve') throw new Error('no resolve open')
      return seen.view
    }
    // The roll is async (Randsum); flush it before reading the model.
    await act(async () => resolve().controls.onRoll())
    return { resolve, calls }
  }

  test("the resolve carries the activation's spend as numbers, for its chips", async () => {
    const { resolve } = await rolledAt(0)
    const { cost, currency } = resolve()
    expect(currency).toBe('EP')
    expect(cost.amount).toBeGreaterThan(0)
    expect(cost.heat).toBeGreaterThanOrEqual(0)
    expect(cost.uses).toBeGreaterThanOrEqual(0)
  })

  test('at Heat 17/18 Push is disabled, says why, and writes nothing', async () => {
    const { resolve, calls } = await rolledAt(17)
    const push = resolve().controls.push
    expect(push?.disabled).toBe(true)
    expect(push?.lockedReason).toBe('No Push at Heat 17/18: +2 Heat would pass the Heat Capacity.')
    await act(async () => push?.onPush())
    expect(calls).toHaveLength(0)
    expect(resolve().pushLog).toBeNull()
  })

  test('at Heat 16/18 Push is offered, and lands the Heat on the cap', async () => {
    const { resolve, calls } = await rolledAt(16)
    const push = resolve().controls.push
    expect(push?.disabled).toBe(false)
    expect(push?.lockedReason).toBeUndefined()
    await act(async () => push?.onPush())
    expect(calls[0]?.patch.currentHeat).toBe(18)
  })
})

/**
 * The resolve in progress is the seat's (ADR-038 §2): every step goes to it, so
 * the crew watches it and a reload — a seat that already holds the roll —
 * reopens on it.
 */
describe('the resolve on the seat', () => {
  test('open, activate, roll and back are each written to the seat', async () => {
    const mech = makeMech()
    const { store } = stubStore(mech)
    const written: (SeatResolving | null)[] = []
    const { container } = render(
      <EntityHrefProvider value={() => undefined}>
        <ActionsDeck mech={mech} store={store} written={written} />
      </EntityHrefProvider>
    )
    clickPrimaryAction(container)
    fireEvent.click(screen.getByRole('button', { name: /^Activate\b/ }))
    await clickRolling('Roll the Die')
    fireEvent.click(screen.getByText('Cancel'))

    const key = buildMechActions(mech)[0]?.key
    expect(written[0]).toMatchObject({ ref: key, activated: false, applied: false })
    expect(written[1]).toMatchObject({ ref: key, activated: true })
    expect(written[2]?.roll?.roll).toBeGreaterThanOrEqual(1)
    expect(written[2]).toMatchObject({ ref: key, activated: true, applied: false })
    expect(written[3]).toBeNull()
    expect(screen.queryByText('Cancel')).toBeNull()
  })

  test('a reload mid-resolve keeps the roll: the seat reopens the action on it', () => {
    const mech = makeMech()
    const { store, calls } = stubStore(mech)
    const action = buildMechActions(mech)[0]
    if (!action) throw new Error('the costed system has no action')
    const { container } = render(
      <EntityHrefProvider value={() => undefined}>
        <ActionsDeck
          mech={mech}
          store={store}
          initial={{
            ref: action.key,
            name: action.name,
            activated: true,
            roll: { roll: 14, band: 'success' },
            applied: false,
          }}
        />
      </EntityHrefProvider>
    )
    expect(container.querySelector('.su-roll__tag')?.textContent).toBe('Rolled 14')
    expect(screen.getByRole('button', { name: /^Activated\b/ })).toBeTruthy()
    expect(screen.getByText<HTMLButtonElement>('Apply').disabled).toBe(false)
    // Restoring rolls nothing and writes nothing.
    expect(calls).toHaveLength(0)
  })

  test('a seat naming an action this deck no longer has says so, and can let it go', () => {
    const mech = makeMech()
    const { store } = stubStore(mech)
    const written: (SeatResolving | null)[] = []
    render(
      <EntityHrefProvider value={() => undefined}>
        <ActionsDeck
          mech={mech}
          store={store}
          written={written}
          initial={{ ref: 'gone', name: 'Crush', activated: false, applied: false }}
        />
      </EntityHrefProvider>
    )
    expect(screen.getByText('Crush is no longer in this deck.')).toBeTruthy()
    fireEvent.click(screen.getByText('Clear'))
    expect(written).toEqual([null])
  })
})
