/**
 * Play's phone form for the player (play.md §11, ADR-051 §10, wireframe
 * phone): `PlayCockpitPhone` over a stand-in `Play` (`useHarnessPlay`).
 *
 *  - The tabs: Act, Units, Tables, Crew, in that order (Crew a Game's only);
 *    a switch opens one panel and keeps the others mounted, hidden.
 *  - Pinned above every tab, per Situation: on foot the pilot's HP and AP,
 *    Boarded the mech's SP, EP and Heat too, in Downtime nothing; the
 *    Situation switch under them.
 *  - Resolve stays inline in Act: Use opens the action's Row in place, and a
 *    full turn (Activate, Roll, Apply) never leaves the tab.
 *  - A Downtime step is played on Act: the track, the step box, Apply.
 *
 * Uses toBeTruthy() not toBeInTheDocument() (jest-dom's matchers are not on
 * bun:test's expect).
 */

import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { act, fireEvent, render, screen, within } from '@testing-library/react'
import type { Mech } from 'game-domain/schemas/mech'
import type { Pilot } from 'game-domain/schemas/pilot'
import { getEntitySlug, SalvageUnionReference } from 'salvageunion-reference'
import { installConvexMocks, setQueryAnswers } from '../../components/__tests__/convexMock'
import { mechFixture, pilotFixture } from '../../components/__tests__/fixtures'
import { resolveSystem } from '../../lib/rules/mechItems'
import type { Situation } from '../situation.model'
import { mechStats } from '../unitStats.model'
import { stubStore } from './stubStore'

// Module scope, before the imports below — see `convexMock.ts`. The side's
// reads (`usePlaySide`) and the Units' (`usePlayUnits`): nothing bound, no
// crew read yet, nothing on the Game's log.
const convexMocks = await installConvexMocks()
setQueryAnswers({
  'account:me': null,
  'seats:forGame': [],
  'games:members': [],
  'entities:listForGame': null,
  'channelBindings:current': null,
  'games:get': null,
  'changeLog:rolls': [],
  'proposals:alerts': [],
  'proposals:pending': [],
  'crew:vitals': null,
})

const { hydrateStores } = await import('../../components/__tests__/hydrateStores')
const { EntityHrefProvider } = await import('../../components/index')
const { rollFourteen, useHarnessPlay } = await import('./playActionsHarness')
const { PlayCockpitPhone } = await import('../PlayCockpitPhone')
const { mediatorPhoneTabs, pinnedUnits, playerPhoneTabs } = await import('../playPhone.model')

/** A system with an action that rolls: the turn's action. */
let system = ''
let actionName = ''

beforeAll(async () => {
  await hydrateStores()
  for (const sys of SalvageUnionReference.Systems.all()) {
    const resolved = resolveSystem(getEntitySlug(sys))
    const acts = resolved ? (SalvageUnionReference.resolveActions(resolved) ?? []) : []
    const hit = acts.find((a) => !a.hidden && a.actionType !== 'DownTime')
    if (hit) {
      system = getEntitySlug(sys)
      actionName = hit.name
      break
    }
  }
})

afterAll(() => convexMocks.restore())

function makePilot(): Pilot {
  return pilotFixture({ id: 'p-phone', name: 'Bonesaw', currentHP: 7, currentAP: 3 })
}

function makeMech(): Mech {
  return mechFixture({
    id: 'm-phone',
    name: 'Buzzard',
    chassisRef: 'unknown-chassis',
    systems: [system],
    currentSP: 4,
    currentEP: 4,
    currentHeat: 3,
  })
}

function Phone({
  situation,
  solo = false,
  stepIndex = 0,
}: {
  situation: Situation
  solo?: boolean
  stepIndex?: number
}) {
  const pilot = makePilot()
  const mech = makeMech()
  const play = useHarnessPlay({
    pilot,
    mech,
    situation,
    gameId: solo ? null : 'g-phone',
    writes: [],
    downtime: { stepIndex },
  })
  return (
    <EntityHrefProvider value={() => undefined}>
      <PlayCockpitPhone
        target={play.target}
        play={play}
        bar={<header>bar</header>}
        actions={{ store: stubStore(pilot, mech).store, rollFor: rollFourteen }}
      />
    </EntityHrefProvider>
  )
}

async function renderPhone(props: Parameters<typeof Phone>[0]) {
  await act(async () => {
    render(<Phone {...props} />)
  })
}

async function click(el: Element) {
  await act(async () => {
    fireEvent.click(el)
  })
}

const tab = (name: string) =>
  within(screen.getByRole('tablist', { name: 'Play' })).getByRole('tab', { name })

/** The open panel: the one tabpanel not hidden. */
function openPanel(): HTMLElement {
  const open = screen.getAllByRole('tabpanel').filter((p) => !p.hidden)
  expect(open).toHaveLength(1)
  return open[0] as HTMLElement
}

/** The pinned vitals, by unit: "Bonesaw: HP 7/10 · AP 3/5". */
function pinned(): string[] {
  const section = screen.queryByRole('region', { name: 'Pinned vitals' })
  if (section === null) return []
  return within(section)
    .getAllByRole('list')
    .map((list) => list.getAttribute('aria-label') ?? '')
}

describe('the model', () => {
  test('the player’s four tabs in a fixed order; solo has no Crew', () => {
    expect(playerPhoneTabs(false).map((t) => t.label)).toEqual(['Act', 'Units', 'Tables', 'Crew'])
    expect(playerPhoneTabs(true).map((t) => t.label)).toEqual(['Act', 'Units', 'Tables'])
  })

  test('the Mediator’s four; in Downtime the second says so, in its place', () => {
    expect(mediatorPhoneTabs(false).map((t) => t.label)).toEqual([
      'Table',
      'Opposition',
      'Tables',
      'Propose',
    ])
    expect(mediatorPhoneTabs(true).map((t) => [t.value, t.label])).toEqual([
      ['table', 'Table'],
      ['opposition', 'Downtime'],
      ['tables', 'Tables'],
      ['propose', 'Propose'],
    ])
  })

  test('pinned per Situation: on foot the pilot, Boarded the mech too, Downtime nothing', () => {
    const args = {
      pilot: makePilot(),
      crawler: null,
      boardedMech: makeMech(),
      activeEffects: [],
    }
    const onFoot = pinnedUnits({ ...args, situation: 'onFoot' })
    expect(onFoot.map((u) => [u.name, u.vitals.map((v) => v.label)])).toEqual([
      ['Bonesaw', ['HP', 'AP']],
    ])
    expect(onFoot[0]?.vitals.map((v) => v.value)).toEqual([7, 3])
    const boarded = pinnedUnits({ ...args, situation: 'boarded' })
    expect(boarded.map((u) => [u.name, u.vitals.map((v) => v.label)])).toEqual([
      ['Bonesaw', ['HP', 'AP']],
      ['Buzzard', ['SP', 'EP', 'Heat']],
    ])
    // The mech's numbers are the Units box's (`mechStats`), its maxima included.
    const s = mechStats(args.boardedMech, args.pilot.abilities, [])
    expect(boarded[1]?.vitals).toEqual([
      { label: 'SP', value: s.sp, max: s.maxSP },
      { label: 'EP', value: s.ep, max: s.maxEP },
      { label: 'Heat', value: s.heat, max: s.maxHeat },
    ])
    expect(pinnedUnits({ ...args, situation: 'downtime' })).toEqual([])
    // Boarded with no mech in the store yet: the pilot alone.
    expect(pinnedUnits({ ...args, boardedMech: null, situation: 'boarded' })).toHaveLength(1)
  })
})

describe('the tabs', () => {
  test('Act, Units, Tables, Crew along the foot; Act opens first', async () => {
    await renderPhone({ situation: 'boarded' })
    const tabs = within(screen.getByRole('tablist', { name: 'Play' })).getAllByRole('tab')
    expect(tabs.map((t) => t.textContent)).toEqual(['Act', 'Units', 'Tables', 'Crew'])
    expect(tab('Act').getAttribute('aria-selected')).toBe('true')
    expect(within(openPanel()).getByRole('heading', { name: 'Actions' })).toBeTruthy()
  })

  test('a tab opens its panel; the others stay mounted, hidden', async () => {
    await renderPhone({ situation: 'boarded' })
    await click(tab('Units'))
    expect(tab('Units').getAttribute('aria-selected')).toBe('true')
    expect(within(openPanel()).getByRole('heading', { name: 'Units' })).toBeTruthy()
    // The Act panel is still there, hidden: its Find and filters survive.
    expect(screen.getAllByRole('tabpanel', { hidden: true })).toHaveLength(4)

    await click(tab('Tables'))
    expect(
      within(openPanel())
        .getAllByRole('heading', { level: 2 })
        .map((h) => h.textContent)
    ).toEqual(['Tables', 'Feed'])

    await click(tab('Crew'))
    expect(within(openPanel()).getByRole('heading', { name: 'Crew' })).toBeTruthy()

    await click(tab('Act'))
    expect(within(openPanel()).getByRole('heading', { name: 'Actions' })).toBeTruthy()
  })

  test('solo: no Crew tab', async () => {
    await renderPhone({ situation: 'onFoot', solo: true })
    const tabs = within(screen.getByRole('tablist', { name: 'Play' })).getAllByRole('tab')
    expect(tabs.map((t) => t.textContent)).toEqual(['Act', 'Units', 'Tables'])
  })
})

describe('pinned above every tab', () => {
  test('on foot: the pilot’s HP and AP, then the Situation switch', async () => {
    await renderPhone({ situation: 'onFoot' })
    expect(pinned()).toEqual(['Bonesaw’s vitals'])
    const vitals = screen.getByRole('list', { name: 'Bonesaw’s vitals' })
    expect(vitals.textContent).toContain('HP')
    expect(vitals.textContent).toContain('AP')
    expect(screen.getByRole('group', { name: 'Situation' })).toBeTruthy()
  })

  test('Boarded: the mech’s SP, EP and Heat too; the option says Boarded, its name still read', async () => {
    await renderPhone({ situation: 'boarded' })
    expect(pinned()).toEqual(['Bonesaw’s vitals', 'Buzzard’s vitals'])
    const mech = screen.getByRole('list', { name: 'Buzzard’s vitals' })
    for (const label of ['SP', 'EP', 'Heat']) expect(mech.textContent).toContain(label)
    const option = within(screen.getByRole('group', { name: 'Situation' })).getByRole('button', {
      name: 'Boarded · Buzzard',
    })
    expect(option.textContent).toBe('Boarded')
  })

  test('in Downtime nothing is pinned but the switch', async () => {
    await renderPhone({ situation: 'downtime', solo: true })
    expect(pinned()).toEqual([])
    expect(screen.getByRole('group', { name: 'Situation' })).toBeTruthy()
  })

  test('the pinned row sits outside every panel, so it shows on each tab', async () => {
    await renderPhone({ situation: 'boarded' })
    const section = screen.getByRole('region', { name: 'Pinned vitals' })
    expect(section.closest('[role="tabpanel"]')).toBeNull()
    await click(tab('Tables'))
    expect(screen.getByRole('region', { name: 'Pinned vitals' })).toBe(section)
  })
})

describe('Act: resolve stays inline', () => {
  test('Use opens the Row in place, in the Act panel', async () => {
    await renderPhone({ situation: 'boarded' })
    await click(screen.getByRole('button', { name: `Use ${actionName}` }))
    const panel = openPanel()
    const row = within(panel)
      .getByRole('button', { name: `Cancel ${actionName}` })
      .closest('li') as HTMLElement
    expect(row.getAttribute('data-open')).toBe('true')
    expect(within(row).getByRole('button', { name: 'Roll the die on Core Mechanic' })).toBeTruthy()
    expect(tab('Act').getAttribute('aria-selected')).toBe('true')
  })

  test('a full turn: Activate, Roll and Apply, all in the Row, never leaving Act', async () => {
    await renderPhone({ situation: 'boarded' })
    await click(screen.getByRole('button', { name: `Use ${actionName}` }))
    const row = () =>
      screen.getByRole('button', { name: `Cancel ${actionName}` }).closest('li') as HTMLElement
    await click(within(row()).getByRole('button', { name: /^Activate/ }))
    await click(within(row()).getByRole('button', { name: 'Roll the die on Core Mechanic' }))
    expect(row().querySelector('.su-roll__tag')?.textContent).toBe('Rolled 14')
    await click(within(row()).getByRole('button', { name: /^Apply/ }))
    expect(within(row()).getByText('Result applied ✓')).toBeTruthy()
    expect(tab('Act').getAttribute('aria-selected')).toBe('true')
    expect(openPanel().contains(row())).toBe(true)
  })

  test('a Downtime step on Act: the track, the step box and Apply & mark done', async () => {
    // Solo, on Restore your Mech & Pilot: the step box lists what it restores.
    await renderPhone({ situation: 'downtime', solo: true, stepIndex: 2 })
    const panel = within(openPanel())
    expect(panel.getByRole('list', { name: 'Downtime steps' })).toBeTruthy()
    const apply = panel.getByRole('button', { name: /^Apply/ })
    await click(apply)
    expect(panel.getByRole('button', { name: /Next step/ })).toBeTruthy()
  })
})
