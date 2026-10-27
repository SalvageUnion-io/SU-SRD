/**
 * The Actions column outside Downtime (play.md §5), with the deck's and the
 * Resolve tab's tests ported to the one list: every action is a level-1 Compact
 * under On hand or Not on hand, the type filter and Find narrow it, Use opens
 * the resolve in the Compact itself (Activate, Roll, Push?, Apply), each step is
 * written to the seat's `resolving` (so a reload keeps it), and every roll is
 * recorded on Play's roll log (`playRolls.model`). The Reactor and Mount are rows too.
 *
 * The real ORM supplies the actions: a system with an EP cost, an `EP or AP`
 * module and a pilot ability with visible actions are picked from it.
 */

import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import type { Mech } from 'game-domain/schemas/mech'
import type { Pilot } from 'game-domain/schemas/pilot'
import type { SeatResolving } from 'game-domain/schemas/seat'
import { getEntitySlug, SalvageUnionReference } from 'salvageunion-reference'
import { mechMaxHeat, pilotMaxAP, resolveChassisRef } from 'salvageunion-reference/rules'
import { mechFixture, pilotFixture } from '../../components/__tests__/fixtures'
import { installServerMocks, setQueryAnswers } from '../../components/__tests__/serverMock'
import { buildMechActions, hasCurrencyChoice, VENT_PATCH } from '../../lib/rules/actionPatches'
import { itemEconomy, resolveModule, resolveSystem } from '../../lib/rules/mechItems'
import { PLAY_TXN } from '../../replica/provenance'
import type { PlayRoll } from '../playRolls.model'
import type { Write } from './playActionsHarness'
import { stubStore } from './stubStore'

const serverMocks = await installServerMocks()
setQueryAnswers({ 'account.me': null })

const { hydrateStores } = await import('../../components/__tests__/hydrateStores')
const { Harness } = await import('./playActionsHarness')
const { onPlayRoll } = await import('../playRolls.model')

let costedSystem = ''
let epApModule: { id: string; actionName: string } | null = null
let pilotAbility: { id: string; actionNames: string[] } | null = null

beforeAll(async () => {
  await hydrateStores()
  for (const sys of SalvageUnionReference.Systems.all()) {
    const resolved = resolveSystem(getEntitySlug(sys))
    if (resolved && itemEconomy(resolved).epCost > 0) {
      costedSystem = getEntitySlug(sys)
      break
    }
  }
  for (const mod of SalvageUnionReference.Modules.all()) {
    const resolved = resolveModule(getEntitySlug(mod))
    const acts = resolved ? (SalvageUnionReference.resolveActions(resolved) ?? []) : []
    const hit = acts.find((a) => !a.hidden && hasCurrencyChoice(a) && a.activationCost === 1)
    if (hit) {
      epApModule = { id: getEntitySlug(mod), actionName: hit.name }
      break
    }
  }
  for (const ability of SalvageUnionReference.Abilities.all()) {
    const acts = (SalvageUnionReference.resolveActions(ability) ?? []).filter(
      (a) => !a.hidden && a.actionType !== 'DownTime'
    )
    if (acts.length > 0) {
      pilotAbility = { id: getEntitySlug(ability), actionNames: acts.map((a) => a.name) }
      break
    }
  }
})

afterAll(() => serverMocks.restore())

/** The costed system's primary (EP-costed) action, and its cost. */
function primary(): { name: string; epCost: number } {
  const item = resolveSystem(costedSystem)
  if (!item) throw new Error(`unresolved system ${costedSystem}`)
  const actions = (SalvageUnionReference.resolveActions(item) ?? []).filter((a) => !a.hidden)
  const p = actions.find((a) => typeof a.activationCost === 'number') ?? actions[0]
  return {
    name: p?.name ?? '',
    epCost: typeof p?.activationCost === 'number' ? p.activationCost : 0,
  }
}

/** The primary action's list key, as the mech's actions name it. */
function primaryKey(): string {
  const found = buildMechActions(makeMech()).find((a) => a.name === primary().name)
  if (!found) throw new Error('no primary action')
  return found.key
}

function makeMech(overrides: Partial<Mech> = {}): Mech {
  return mechFixture({
    id: 'm1',
    name: 'Buzzard',
    chassisRef: 'unknown-chassis',
    systems: [costedSystem],
    currentEP: 6,
    currentHeat: 0,
    ...overrides,
  })
}

function makePilot(overrides: Partial<Pilot> = {}): Pilot {
  return pilotFixture({
    id: 'p1',
    name: 'Bonesaw',
    abilities: pilotAbility ? [pilotAbility.id] : [],
    ...overrides,
  })
}

async function click(element: Element) {
  await act(async () => {
    fireEvent.click(element)
  })
}

const onHand = () => screen.getByRole('list', { name: 'On hand' })
/** The `<li>` of the action named `name`: the one whose Use or Cancel names it. */
function rowFor(name: string): HTMLElement {
  const button =
    screen.queryByRole('button', { name: `Use ${name}` }) ??
    screen.getByRole('button', { name: `Cancel ${name}` })
  const li = button.closest('li')
  if (!li) throw new Error(`no row for ${name}`)
  return li
}
const use = (name: string) => screen.getByRole('button', { name: `Use ${name}` })

function renderBoarded(
  opts: { initialResolving?: SeatResolving | null; writes?: Write[]; mech?: Mech } = {}
) {
  const mech = opts.mech ?? makeMech()
  const pilot = makePilot()
  const { store, calls, metas } = stubStore(mech, pilot)
  const writes = opts.writes ?? []
  render(
    <Harness
      pilot={pilot}
      mech={mech}
      situation="boarded"
      store={store}
      writes={writes}
      initialResolving={opts.initialResolving ?? null}
    />
  )
  return { calls, metas, writes, mech, pilot }
}

describe('under the Scene’s conditions', () => {
  test('a clear Scene draws nothing over the Actions', () => {
    renderBoarded()
    expect(screen.queryByRole('list', { name: 'Scene conditions' })).toBeNull()
  })

  test('a Radiation Storm: its Mini says Heat ×2, and Push makes 4', () => {
    // A Mule's Heat Capacity is 6: room for the storm's Push.
    const mech = makeMech({ chassisRef: 'mule' })
    const pilot = makePilot()
    const { store } = stubStore(mech, pilot)
    render(
      <Harness
        pilot={pilot}
        mech={mech}
        situation="boarded"
        store={store}
        writes={[]}
        scene={{ conditions: ['radiation-storm'], hours: 1 }}
      />
    )
    const scene = within(screen.getByRole('list', { name: 'Scene conditions' }))
    expect(scene.getByText('radiation storm')).toBeTruthy()
    expect(scene.getByText('×2')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Push' }).getAttribute('title')).toBe(
      '+4 Heat, then the Heat Check'
    )
  })
})

describe('the list', () => {
  test('Boarded: the mech’s and the pilot’s actions on hand, then the Reactor and Mount', () => {
    renderBoarded()
    const list = within(onHand())
    expect(list.getByRole('button', { name: `Use ${primary().name}` })).toBeTruthy()
    for (const name of pilotAbility?.actionNames ?? []) {
      expect(list.getByRole('button', { name: `Use ${name}` })).toBeTruthy()
    }
    expect(list.getByRole('button', { name: 'Vent' })).toBeTruthy()
    expect(list.getByRole('button', { name: 'Dismount' })).toBeTruthy()
    expect(screen.getByText('On hand · In Buzzard')).toBeTruthy()
  })

  test('Boarded in a mech that is gone: no mech’s actions, never another mech’s', () => {
    const mech = makeMech()
    const pilot = makePilot()
    const { store } = stubStore(mech, pilot)
    // The seat names a mech no longer at hand; `mech` is another of the pilot's.
    render(
      <Harness
        pilot={pilot}
        mech={mech}
        situation="boarded"
        boardedMechId="m-gone"
        store={store}
        writes={[]}
      />
    )
    expect(screen.queryByRole('button', { name: `Use ${primary().name}` })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Vent' })).toBeNull()
  })

  test('on foot: the mech’s actions wait, collapsed, each saying it needs Boarded', async () => {
    const mech = makeMech()
    const pilot = makePilot()
    const { store } = stubStore(mech, pilot)
    render(<Harness pilot={pilot} mech={mech} situation="onFoot" store={store} writes={[]} />)
    expect(screen.queryByRole('button', { name: `Use ${primary().name}` })).toBeNull()
    expect(screen.getByText('On hand · On foot')).toBeTruthy()
    const toggle = screen.getByRole('button', { name: 'Expand Not on hand' })
    expect(toggle.getAttribute('aria-expanded')).toBe('false')
    await click(toggle)
    const away = within(screen.getByRole('list', { name: 'Not on hand' }))
    const row = away
      .getAllByRole('listitem')
      .find((li) => li.getAttribute('data-action-key')?.startsWith('system:'))
    expect(row?.getAttribute('data-away')).toBe('true')
    expect(within(row as HTMLElement).getByText('needs Boarded')).toBeTruthy()
    // Not on hand carries no Use.
    expect(within(row as HTMLElement).queryByRole('button')).toBeNull()
    expect(away.getAllByText('needs Downtime').length).toBeGreaterThan(0)
  })

  test('the type filter and Find sit on the "Actions" heading line', () => {
    renderBoarded()
    const head = screen.getByRole('heading', { level: 2, name: 'Actions' }).parentElement
    expect(head?.classList.contains('su-play-act-head')).toBe(true)
    const line = within(head as HTMLElement)
    expect(line.getByRole('group', { name: 'Filter actions by type' })).toBeTruthy()
    expect(line.getByRole('textbox', { name: 'Find an action' })).toBeTruthy()
  })

  test('the type filter is pressed toggles, and narrows by action type', async () => {
    renderBoarded()
    const filter = within(screen.getByRole('group', { name: 'Filter actions by type' }))
    expect(filter.getByRole('button', { name: 'All' }).getAttribute('aria-pressed')).toBe('true')
    const before = within(onHand()).getAllByRole('listitem').length
    await click(filter.getByRole('button', { name: 'Reaction' }))
    expect(filter.getByRole('button', { name: 'Reaction' }).getAttribute('aria-pressed')).toBe(
      'true'
    )
    const reaction = screen.queryByRole('list', { name: 'On hand' })
    const after = reaction ? within(reaction).getAllByRole('listitem').length : 0
    expect(after).toBeLessThan(before)
    await click(filter.getByRole('button', { name: 'All' }))
    expect(within(onHand()).getAllByRole('listitem').length).toBe(before)
  })

  test('Find narrows to the matching action', async () => {
    renderBoarded()
    await act(async () => {
      fireEvent.change(screen.getByRole('textbox', { name: 'Find an action' }), {
        target: { value: primary().name },
      })
    })
    const names = within(onHand())
      .getAllByRole('button', { name: /^Use / })
      .map((b) => b.getAttribute('aria-label'))
    expect(names).toEqual([`Use ${primary().name}`])
  })

  test('each action is a contentful Mini in the Mini grid, its text under its head', () => {
    renderBoarded()
    const list = onHand()
    expect(list.classList.contains('su-mini-grid')).toBe(true)
    expect(list.hasAttribute('data-play-list')).toBe(true)
    const token = rowFor(primary().name).querySelector('[data-contentful]')
    expect(token?.querySelector('.su-entity-mini__body')?.textContent?.trim()).not.toBe('')
    // Use rides the head's chip group, at the chips' Mini Size (C8).
    const useButton = use(primary().name)
    expect(useButton.closest('[data-chip-group]')).not.toBeNull()
    expect(useButton.classList.contains('su-btn--mini')).toBe(true)
  })

  test('nesting: no titled box, Compact or Card head sits inside another', () => {
    renderBoarded()
    expect(document.querySelector('.su-entity-compact .su-entity-compact')).toBeNull()
  })
})

describe('Use: the resolve, in the Compact', () => {
  test('Use opens the Compact in place with Activate and Roll, and Cancel in its head', async () => {
    const { writes } = renderBoarded()
    await click(use(primary().name))
    const row = rowFor(primary().name)
    expect(row.getAttribute('data-open')).toBe('true')
    expect(within(row).getByRole('button', { name: /^Activate/ })).toBeTruthy()
    expect(within(row).getByRole('button', { name: 'Roll the die on Core Mechanic' })).toBeTruthy()
    expect(writes.filter((w) => w.name === 'seat.setResolving')).toHaveLength(1)
    await click(within(row).getByRole('button', { name: `Cancel ${primary().name}` }))
    expect(writes.at(-1)).toEqual({ name: 'seat.clearResolving' })
    expect(row.getAttribute('data-open')).toBeNull()
  })

  test('Activate writes the EP spend through the store', async () => {
    const { calls, metas } = renderBoarded()
    await click(use(primary().name))
    await click(screen.getByRole('button', { name: /^Activate/ }))
    expect(calls).toHaveLength(1)
    expect(calls[0]?.type).toBe('mech')
    expect(calls[0]?.patch.currentEP).toBe(Math.max(0, 6 - primary().epCost))
    // Play's own Change Log tag.
    expect(metas[0]).toEqual(PLAY_TXN)
    expect(screen.getByRole('button', { name: 'Activated ✓' })).toBeTruthy()
  })

  test('Roll reads the Core Mechanic, shows the band, and reports the roll', async () => {
    const heard: PlayRoll[] = []
    const stop = onPlayRoll((roll) => heard.push(roll))
    try {
      renderBoarded()
      await click(use(primary().name))
      await click(screen.getByRole('button', { name: 'Roll the die on Core Mechanic' }))
      const row = rowFor(primary().name)
      expect(row.querySelector('.su-roll__tag')?.textContent).toBe('Rolled 14')
      // The result is its marked row (R8), the band's own words.
      expect(row.querySelector('[aria-current="true"] .su-roll__label')?.textContent).toBe(
        'Success'
      )
      expect(heard).toHaveLength(1)
      expect(heard[0]).toMatchObject({
        tableName: 'Core Mechanic',
        rolls: [14],
        label: primary().name,
        outcome: 'Success',
      })
    } finally {
      stop()
    }
  })

  test('Apply is gated on a roll, commits without a store write, and Clear resets', async () => {
    const { calls } = renderBoarded()
    await click(use(primary().name))
    const apply = () => screen.getByRole<HTMLButtonElement>('button', { name: 'Apply' })
    expect(apply().disabled).toBe(true)
    await click(screen.getByRole('button', { name: 'Roll the die on Core Mechanic' }))
    expect(apply().disabled).toBe(false)
    await click(apply())
    expect(screen.getByText('Result applied ✓')).toBeTruthy()
    expect(calls).toHaveLength(0)
    await click(screen.getByRole('button', { name: 'Clear' }))
    expect(document.querySelector('.su-roll [aria-current="true"]')).toBeNull()
  })

  test('the roll and Apply are spoken by a live region mounted before the roll', async () => {
    renderBoarded()
    await click(use(primary().name))
    const live = rowFor(primary().name).querySelector('[aria-live="polite"]')
    expect(live?.textContent).toBe('')
    await click(screen.getByRole('button', { name: 'Roll the die on Core Mechanic' }))
    expect(live?.textContent).toMatch(/^Rolled 14: \S/)
    await click(screen.getByRole('button', { name: 'Apply' }))
    expect(live?.textContent).toMatch(/Result applied$/)
  })

  test('every step is written to the seat: open, activate, roll, back', async () => {
    const { writes } = renderBoarded()
    await click(use(primary().name))
    await click(screen.getByRole('button', { name: /^Activate/ }))
    await click(screen.getByRole('button', { name: 'Roll the die on Core Mechanic' }))
    await click(screen.getByRole('button', { name: `Cancel ${primary().name}` }))
    const steps = writes
      .filter((w) => w.name.startsWith('seat.'))
      .map((w) =>
        w.name === 'seat.clearResolving'
          ? 'clear'
          : (() => {
              const r = w.args as SeatResolving
              return r.roll ? `roll ${r.roll.roll}` : r.activated ? 'activated' : 'open'
            })()
      )
    expect(steps).toEqual(['open', 'activated', 'roll 14', 'clear'])
  })

  test('a reload mid-resolve keeps the roll: the seat reopens the Compact on it', () => {
    const p = primary()
    const key = primaryKey()
    renderBoarded({
      initialResolving: {
        ref: key,
        name: p.name,
        activated: true,
        applied: false,
        roll: { roll: 14, band: 'success' } as SeatResolving['roll'],
      },
    })
    const row = rowFor(p.name)
    expect(row.getAttribute('data-open')).toBe('true')
    expect(row.querySelector('.su-roll__tag')?.textContent).toBe('Rolled 14')
    expect(within(row).getByRole('button', { name: 'Activated ✓' })).toBeTruthy()
  })

  test('resolving an action Downtime puts off hand: a note, and a way to let it go', async () => {
    const mech = makeMech()
    const pilot = makePilot()
    const { store } = stubStore(mech, pilot)
    const writes: Write[] = []
    render(
      <Harness
        pilot={pilot}
        mech={mech}
        situation="downtime"
        store={store}
        writes={writes}
        downtime={{ stepIndex: 0 }}
        initialResolving={{
          ref: primaryKey(),
          name: primary().name,
          activated: false,
          applied: false,
        }}
      />
    )
    expect(screen.getByText(`${primary().name} is not on hand now.`)).toBeTruthy()
    await click(screen.getByRole('button', { name: 'Clear' }))
    expect(writes.at(-1)).toEqual({ name: 'seat.clearResolving' })
  })

  test('a seat naming an action the list no longer has says so, and can let it go', async () => {
    const { writes } = renderBoarded({
      initialResolving: {
        ref: 'system:gone:0',
        name: 'Old Laser',
        activated: false,
        applied: false,
      },
    })
    expect(screen.getByText(/Old Laser is no longer in this deck/)).toBeTruthy()
    await click(screen.getByRole('button', { name: 'Clear' }))
    expect(writes.at(-1)).toEqual({ name: 'seat.clearResolving' })
  })

  test('at Heat 17/18 Push is refused, says why, and writes nothing', async () => {
    const mech = makeMech({ currentHeat: 17 })
    const cap = mechMaxHeat(mech, resolveChassisRef(mech.chassisRef))
    const { calls } = renderBoarded({ mech: { ...mech, currentHeat: cap - 1 } })
    await click(use(primary().name))
    await click(screen.getByRole('button', { name: 'Roll the die on Core Mechanic' }))
    // No Push on the stamp: it stays Roll the Die.
    expect(screen.queryByRole('button', { name: 'Push on Core Mechanic' })).toBeNull()
    expect(screen.getAllByText(/No Push at Heat/).length).toBeGreaterThan(0)
    expect(calls).toHaveLength(0)
  })

  test('EP or AP: choosing AP spends the pilot’s AP, from a full pool when never stored', async () => {
    const mod = epApModule as { id: string; actionName: string }
    expect(mod).toBeTruthy()
    const mech = makeMech({ systems: [], modules: [mod.id] })
    const pilot = makePilot({ currentAP: undefined })
    const { store, calls } = stubStore(mech, pilot)
    render(<Harness pilot={pilot} mech={mech} situation="boarded" store={store} writes={[]} />)
    await click(use(mod.actionName))
    await click(screen.getByRole('radio', { name: /AP$/ }))
    await click(screen.getByRole('button', { name: /^Activate/ }))
    expect(calls).toHaveLength(1)
    expect(calls[0]?.type).toBe('pilot')
    expect(calls[0]?.patch.currentAP).toBe(pilotMaxAP(pilot) - 1)
  })

  test('offline, Use is off', () => {
    const mech = makeMech()
    const pilot = makePilot()
    const { store } = stubStore(mech, pilot)
    render(
      <Harness
        pilot={pilot}
        mech={mech}
        situation="boarded"
        store={store}
        writes={[]}
        canWrite={false}
      />
    )
    expect(use(primary().name).hasAttribute('disabled')).toBe(true)
  })
})

describe('the Reactor and Mount rows', () => {
  /** A chassis with a Heat Capacity: the fixture's unknown chassis has none, so it never Pushes. */
  const REACTOR_CHASSIS = 'mule'

  test('Vent writes the Vent patch; a Heat Check is reported', async () => {
    const heard: PlayRoll[] = []
    const stop = onPlayRoll((roll) => heard.push(roll))
    try {
      const { calls } = renderBoarded()
      await click(screen.getByRole('button', { name: 'Vent' }))
      expect(calls.at(-1)?.patch).toEqual(VENT_PATCH)
      await click(screen.getByRole('button', { name: 'Heat check on Reactor Overload' }))
      expect(heard.at(-1)).toMatchObject({ tableName: 'Reactor Overload', label: 'Heat Check' })
      expect(screen.getByText(/^Heat Check 14/)).toBeTruthy()
    } finally {
      stop()
    }
  })

  test('Push pressed makes the stamp a Push: +2 Heat, then the Heat Check, on the log', async () => {
    const heard: PlayRoll[] = []
    const stop = onPlayRoll((roll) => heard.push(roll))
    try {
      const { calls } = renderBoarded({ mech: makeMech({ chassisRef: REACTOR_CHASSIS }) })
      await click(screen.getByRole('button', { name: 'Push' }))
      await click(screen.getByRole('button', { name: 'Push on Reactor Overload' }))
      expect(heard.at(-1)).toMatchObject({ tableName: 'Reactor Overload', label: 'Push' })
      expect(calls.at(-1)?.patch.currentHeat).toBe(2)
      // One Push: the stamp is the Heat Check again.
      expect(screen.getByRole('button', { name: 'Heat check on Reactor Overload' })).toBeTruthy()
    } finally {
      stop()
    }
  })

  test('a Push past the Heat Capacity is refused before the roll, and says why', async () => {
    const mech = makeMech({ chassisRef: REACTOR_CHASSIS })
    const cap = mechMaxHeat(mech, resolveChassisRef(mech.chassisRef))
    const { calls } = renderBoarded({ mech: { ...mech, currentHeat: cap - 1 } })
    await click(screen.getByRole('button', { name: 'Push' }))
    expect(screen.getByText(new RegExp(`^No Push at Heat ${cap - 1}/${cap}`))).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Push on Reactor Overload' })).toBeNull()
    expect(calls).toHaveLength(0)
  })

  test('Shut down and Restart toggle the reactor flag', async () => {
    const { calls } = renderBoarded()
    await click(screen.getByRole('button', { name: 'Shut down' }))
    expect(calls.at(-1)?.patch).toEqual({ shutdown: true })
    cleanup()
    const down = renderBoarded({ mech: makeMech({ shutdown: true }) })
    await click(screen.getByRole('button', { name: 'Restart' }))
    expect(down.calls.at(-1)?.patch).toEqual({ shutdown: false })
  })

  test('a Meltdown destroys the mech only on its own confirm (ADR-007)', async () => {
    const mech = makeMech({ chassisRef: REACTOR_CHASSIS, currentHeat: 6 })
    const pilot = makePilot()
    const { store, calls } = stubStore(mech, pilot)
    // Every die a 1: the check overloads, and the overload is a Meltdown.
    render(
      <Harness
        pilot={pilot}
        mech={mech}
        situation="boarded"
        store={store}
        writes={[]}
        rollFor={async () => () => 1}
      />
    )
    await click(screen.getByRole('button', { name: 'Heat check on Reactor Overload' }))
    expect(calls.some((c) => c.patch.destroyed === true)).toBe(false)
    await click(screen.getByRole('button', { name: /^Confirm Meltdown/ }))
    expect(calls.at(-1)?.patch).toEqual({ destroyed: true })
    expect(screen.queryByRole('button', { name: /^Confirm Meltdown/ })).toBeNull()
  })

  test('Boarded: Dismount climbs out; Eject waits for its confirm', async () => {
    const { writes } = renderBoarded()
    await click(screen.getByRole('button', { name: 'Eject' }))
    expect(writes.some((w) => w.name === 'seat.eject')).toBe(false)
    const dialog = within(screen.getByRole('alertdialog'))
    await click(dialog.getByRole('button', { name: 'Eject' }))
    expect(writes.some((w) => w.name === 'seat.eject')).toBe(true)
    await click(screen.getByRole('button', { name: 'Dismount' }))
    expect(writes.some((w) => w.name === 'setOnFoot')).toBe(true)
  })

  test('on foot: Board names the pilot’s mech and boards it', async () => {
    const mech = makeMech()
    const pilot = makePilot()
    const { store } = stubStore(mech, pilot)
    const writes: Write[] = []
    render(<Harness pilot={pilot} mech={mech} situation="onFoot" store={store} writes={writes} />)
    await click(screen.getByRole('button', { name: 'Board Buzzard' }))
    expect(writes).toContainEqual({ name: 'board', args: 'm1' })
    // Boarded now: the mech's actions are on hand.
    expect(use(primary().name)).toBeTruthy()
  })
})
