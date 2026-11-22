/**
 * Downtime in Play (play.md §6): the Actions column becomes the guide's steps
 * as a track, the current step as one box listing what it will apply (each
 * line untickable, ADR-007), then the Downtime actions and the field actions
 * collapsed. A full solo Downtime runs end to end here, and a Game's step is
 * the Game's: the Mediator advances it, a player marks themselves done.
 */

import { afterAll, beforeAll, describe, expect, spyOn, test } from 'bun:test'
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { downtimeStepNames } from 'game-domain/rules/downtime'
import type { Crawler } from 'game-domain/schemas/crawler'
import type { Mech } from 'game-domain/schemas/mech'
import type { Pilot } from 'game-domain/schemas/pilot'
import {
  crawlerFixture,
  mechFixture,
  pilotFixture,
  softLinkFixture,
} from '../../components/__tests__/fixtures'
import { installServerMocks, setQueryAnswers } from '../../components/__tests__/serverMock'
import type { PlayRoll } from '../playRolls.model'
import { rumourRowText } from '../rumours.model'
import type { Write } from './playActionsHarness'
import { stubStore } from './stubStore'

const serverMocks = await installServerMocks()
setQueryAnswers({ 'account.me': { _id: 'u-me', displayName: 'Me', avatarUrl: null, email: null } })

const { hydrateStores } = await import('../../components/__tests__/hydrateStores')
const { useUnits } = await import('../../replica/units')
const { resetSync } = await import('../../replica/sync')
const { Harness } = await import('./playActionsHarness')
const { onPlayRoll } = await import('../playRolls.model')

const LINK = 'dt-link'
const MECH_LINK = 'dt-mech-link'

beforeAll(async () => {
  await hydrateStores()
  resetSync()
  await useUnits
    .getState()
    .adopt('softLink', softLinkFixture('pilot-to-crawler', 'dt-p', 'dt-c', LINK))
  // The pilot's assigned mech: on foot, Downtime restores it.
  await useUnits
    .getState()
    .adopt('softLink', softLinkFixture('mech-to-pilot', 'dt-m', 'dt-p', MECH_LINK))
})

afterAll(async () => {
  await useUnits.getState().forget('softLink', LINK)
  await useUnits.getState().forget('softLink', MECH_LINK)
  serverMocks.restore()
})

function units() {
  const pilot: Pilot = pilotFixture({
    id: 'dt-p',
    name: 'Bonesaw',
    callsign: 'Bonesaw',
    currentHP: 3,
    currentAP: 1,
    trainingPoints: 2,
  })
  const mech: Mech = mechFixture({
    id: 'dt-m',
    name: 'Buzzard',
    chassisRef: 'unknown-chassis',
    currentSP: 1,
    currentEP: 0,
    currentHeat: 3,
  })
  const crawler: Crawler = crawlerFixture({
    id: 'dt-c',
    name: 'Tenacity',
    techLevel: 2,
    crawlerBays: [
      { bayRef: 'mech-bay', condition: 'intact' },
      { bayRef: 'med-bay', condition: 'intact' },
    ],
    scrapPool: { tl2: 7 },
    upgradePool: 0,
  })
  return { pilot, mech, crawler }
}

async function click(element: Element) {
  await act(async () => {
    fireEvent.click(element)
  })
}

const STEPS = downtimeStepNames()
const heading = () => screen.getByRole('heading', { level: 2 }).textContent
const stepBox = () => screen.getByRole('region', { name: STEPS[currentStep()] })
function currentStep(): number {
  const match = /Step (\d+) of/.exec(heading() ?? '')
  return Number(match?.[1] ?? 1) - 1
}
const button = (name: string | RegExp) => within(stepBox()).getByRole('button', { name })

describe('a solo Downtime, end to end', () => {
  test('every step in turn: Upkeep paid once, Restore and Train applied, then End', async () => {
    const { pilot, mech, crawler } = units()
    const { store, calls } = stubStore(pilot, mech, crawler)
    const writes: Write[] = []
    let upkeepClaims = 0
    render(
      <Harness
        pilot={pilot}
        mech={mech}
        situation="downtime"
        store={store}
        writes={writes}
        downtime={{ stepIndex: 0 }}
        payUpkeep={async () => {
          upkeepClaims += 1
          return upkeepClaims === 1
        }}
      />
    )

    // The track: every guide step, the first the one the pilot is on.
    const track = within(screen.getByRole('list', { name: 'Downtime steps' }))
    expect(track.getAllByRole('button')).toHaveLength(STEPS.length)
    expect(
      track.getByRole('button', { name: `Step 1: ${STEPS[0]}` }).getAttribute('aria-current')
    ).toBe('true')
    expect(heading()).toBe(`Downtime · Step 1 of ${STEPS.length}`)

    // Tally Salvage applies nothing: the guide's text, and Next step. Solo
    // the player runs it (player-solo-downtime.png draws the Game's
    // "Mediator advances" here, swapped with player-downtime.png).
    expect(within(stepBox()).getByText('You run it')).toBeTruthy()
    expect(within(stepBox()).queryByText(/Mediator advances/)).toBeNull()
    expect(within(stepBox()).queryByRole('button', { name: 'Skip' })).toBeNull()
    await click(button(/^Next: Step \d+$/))

    // Upkeep & Upgrade: one line, paid on Apply.
    expect(STEPS[currentStep()]).toBe('Upkeep & Upgrade')
    expect(
      within(stepBox()).getByText(
        'Applies, each line can be unticked if your table rules it differently.'
      )
    ).toBeTruthy()
    // Skip, Apply & mark done and Next step.
    expect(
      within(stepBox())
        .getAllByRole('button')
        .map((b) => b.textContent)
    ).toEqual(['Skip', 'Apply & mark done', 'Next: Step 3'])
    expect(within(stepBox()).getByText('5 Scrap · T2')).toBeTruthy()
    await click(button('Apply & mark done'))
    expect(upkeepClaims).toBe(1)
    // The Scrap rides on the Upkeep op, not a store write.
    expect(calls.filter((c) => c.type === 'crawler')).toEqual([])
    expect(writes).toContainEqual({
      name: 'downtime.claim',
      args: {
        claim: 'upkeep',
        crawlerId: crawler.id,
        patch: { scrapPool: { tl2: 2 }, upgradePool: 5 },
      },
    })
    expect(within(stepBox()).getByText('Done ✓')).toBeTruthy()
    await click(button(/^Next: Step \d+$/))

    // Restore: the mech's and the pilot's lines; untick the pilot's.
    expect(STEPS[currentStep()]).toBe('Restore your Mech & Pilot')
    const lines = within(within(stepBox()).getByRole('list', { name: 'Will apply' }))
    expect(lines.getByText('Buzzard')).toBeTruthy()
    expect(lines.getByText('Bonesaw')).toBeTruthy()
    await click(lines.getByRole('checkbox', { name: 'Bonesaw' }))
    calls.length = 0
    await click(button('Apply & mark done'))
    // The mech's share rides in the step's batch, beside the pilot's op.
    expect(calls).toEqual([])
    expect(writes.filter((w) => w.name === 'downtime.markStepDone').at(-1)).toMatchObject({
      args: { patch: {}, mech: { id: mech.id, patch: { currentHeat: 0 } } },
    })
    await click(button(/^Next: Step \d+$/))

    // On to Train your Pilot.
    while (STEPS[currentStep()] !== 'Train your Pilot') await click(button(/^Next: Step \d+$/))
    expect(within(stepBox()).getByText('2→3')).toBeTruthy()
    calls.length = 0
    await click(button('Apply & mark done'))
    // The pilot's share rides on the step's op, not a store write.
    expect(calls).toEqual([])
    expect(writes).toContainEqual({
      name: 'downtime.markStepDone',
      args: { stepIndex: currentStep(), patch: { trainingPoints: 3 } },
    })

    // The last step ends Downtime.
    while (currentStep() < STEPS.length - 1) await click(button(/^Next: Step \d+$/))
    await click(button('End Downtime'))
    expect(writes).toContainEqual({ name: 'endDowntime' })
    expect(writes.filter((w) => w.name === 'downtime.advance')).toHaveLength(STEPS.length - 1)
  })

  test('Upkeep is paid once: an Upkeep op already landed says so', async () => {
    const { pilot, mech, crawler } = units()
    const { store, calls } = stubStore(pilot, mech, crawler)
    render(
      <Harness
        pilot={pilot}
        mech={mech}
        situation="downtime"
        store={store}
        writes={[]}
        downtime={{ stepIndex: STEPS.indexOf('Upkeep & Upgrade') }}
        payUpkeep={async () => false}
      />
    )
    await click(button('Apply & mark done'))
    expect(calls.filter((c) => c.type === 'crawler')).toHaveLength(0)
    expect(within(stepBox()).getByText('Upkeep is already paid this Downtime.')).toBeTruthy()
  })

  test('the Craft step processes Nanites: every Inert pile spent, a 20 an Active one', async () => {
    const { pilot, mech, crawler: base } = units()
    const crawler: Crawler = {
      ...base,
      crawlerBays: [...(base.crawlerBays ?? []), { bayRef: 'nanite-processing-bay' }],
      scrapPool: { tl2: 7, inertNanites: 3 },
    }
    const { store } = stubStore(pilot, mech, crawler)
    const writes: Write[] = []
    render(
      <Harness
        pilot={pilot}
        mech={mech}
        situation="downtime"
        store={store}
        writes={writes}
        downtime={{ stepIndex: STEPS.indexOf('Craft Mech Chassis, Systems, and Modules') }}
      />
    )
    expect(within(stepBox()).getByText('Process Nanites')).toBeTruthy()
    await click(button('Apply & mark done'))
    const write = writes.find((w) => w.name === 'downtime.claim')?.args as
      | { claim: string; patch: Partial<Crawler> }
      | undefined
    expect(write?.claim).toBe('nanites')
    const pool = write?.patch.scrapPool
    expect(pool?.inertNanites).toBe(0)
    expect(pool?.activeNanites).toBeGreaterThanOrEqual(0)
    expect(pool?.activeNanites).toBeLessThanOrEqual(3)
    expect(within(stepBox()).getByText(/Processed 3 Inert Meld Nanite piles/)).toBeTruthy()
  })

  test('a step done before a reload is not applied again: Train’s +1 TP lands once', async () => {
    const { pilot, mech, crawler } = units()
    const train = STEPS.indexOf('Train your Pilot')
    const { store, calls } = stubStore(pilot, mech, crawler)
    const writes: Write[] = []
    render(
      <Harness
        pilot={pilot}
        mech={mech}
        situation="downtime"
        store={store}
        writes={writes}
        downtime={{ stepIndex: train }}
      />
    )
    await click(button('Apply & mark done'))
    expect(writes).toContainEqual({
      name: 'downtime.markStepDone',
      args: { stepIndex: train, patch: { trainingPoints: 3 } },
    })
    expect(calls).toEqual([])

    // The reload: the seat says the step is done, so the box offers no Apply.
    cleanup()
    calls.length = 0
    render(
      <Harness
        pilot={pilot}
        mech={mech}
        situation="downtime"
        store={store}
        writes={[]}
        downtime={{ stepIndex: train, doneSteps: [train] }}
      />
    )
    expect(within(stepBox()).getByText('Done ✓')).toBeTruthy()
    expect(within(stepBox()).queryByRole('button', { name: 'Apply & mark done' })).toBeNull()
    expect(calls).toHaveLength(0)
  })

  test('a taken step shows the change that was made, never the next one', async () => {
    const { pilot, mech, crawler } = units()
    const train = STEPS.indexOf('Train your Pilot')
    const { store } = stubStore(pilot, mech, crawler)
    const view = render(
      <Harness
        pilot={pilot}
        mech={mech}
        situation="downtime"
        store={store}
        writes={[]}
        downtime={{ stepIndex: train }}
      />
    )
    expect(within(stepBox()).getByText('2→3')).toBeTruthy()
    await click(button('Apply & mark done'))
    // The pilot now has 3 TP: the line still reads what was applied.
    const trained = { ...pilot, trainingPoints: 3 }
    view.rerender(
      <Harness
        pilot={trained}
        mech={mech}
        situation="downtime"
        store={stubStore(trained, mech, crawler).store}
        writes={[]}
        downtime={{ stepIndex: train }}
      />
    )
    const applied = within(within(stepBox()).getByRole('list', { name: 'Applied' }))
    expect(applied.getByText('2→3')).toBeTruthy()
    expect(within(stepBox()).queryByText('3→4')).toBeNull()
    expect(within(stepBox()).queryByText(/each line can be unticked/)).toBeNull()

    // After a reload the step says Done and predicts nothing.
    cleanup()
    render(
      <Harness
        pilot={trained}
        mech={mech}
        situation="downtime"
        store={stubStore(trained, mech, crawler).store}
        writes={[]}
        downtime={{ stepIndex: train, doneSteps: [train] }}
      />
    )
    expect(within(stepBox()).getByText('Done ✓')).toBeTruthy()
    expect(within(stepBox()).queryByText('3→4')).toBeNull()
  })

  // r4 A6 (SB4-02): walking past Restore and Train greyed them as done, and End Downtime did not warn.
  test('steps walked past unapplied read Skipped, and End Downtime lists them and asks', async () => {
    const { pilot, mech, crawler } = units()
    const { store } = stubStore(pilot, mech, crawler)
    const writes: Write[] = []
    render(
      <Harness
        pilot={pilot}
        mech={mech}
        situation="downtime"
        store={store}
        writes={writes}
        downtime={{ stepIndex: STEPS.indexOf('Restore your Mech & Pilot') }}
      />
    )
    const restore = STEPS.indexOf('Restore your Mech & Pilot')
    const train = STEPS.indexOf('Train your Pilot')
    while (currentStep() < STEPS.length - 1) await click(button(/^Next: Step \d+$/))
    const track = within(screen.getByRole('list', { name: 'Downtime steps' }))
    expect(
      track.getByRole('button', { name: `Step ${restore + 1}: ${STEPS[restore]}, skipped` })
    ).toBeTruthy()
    expect(
      track.getByRole('button', { name: `Step ${train + 1}: ${STEPS[train]}, skipped` })
    ).toBeTruthy()
    // A step that previews nothing is done, as before.
    expect(
      track.getByRole('button', { name: `Step ${train}: ${STEPS[train - 1]}, done` })
    ).toBeTruthy()
    expect(screen.getByText(/^Skipped, nothing applied: /).textContent).toContain(
      `${train + 1} ${STEPS[train]}`
    )

    await click(button('End Downtime'))
    const dialog = within(screen.getByRole('alertdialog'))
    expect(writes).not.toContainEqual({ name: 'endDowntime' })
    expect(dialog.getByText(/Nothing was applied for these steps/).textContent).toContain(
      `${restore + 1} ${STEPS[restore]}`
    )
    await click(dialog.getByRole('button', { name: 'Go back' }))
    expect(writes).not.toContainEqual({ name: 'endDowntime' })
    await click(button('End Downtime'))
    await click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'End anyway' }))
    expect(writes).toContainEqual({ name: 'endDowntime' })
  })

  test('Skip marks the step done and writes nothing; the track moves to any step', async () => {
    const { pilot, mech, crawler } = units()
    const { store, calls } = stubStore(pilot, mech, crawler)
    const writes: Write[] = []
    render(
      <Harness
        pilot={pilot}
        mech={mech}
        situation="downtime"
        store={store}
        writes={writes}
        downtime={{ stepIndex: STEPS.indexOf('Restore your Mech & Pilot') }}
      />
    )
    await click(button('Skip'))
    expect(calls).toHaveLength(0)
    expect(within(stepBox()).getByText('Done ✓')).toBeTruthy()
    const track = within(screen.getByRole('list', { name: 'Downtime steps' }))
    await click(track.getByRole('button', { name: `Step 5: ${STEPS[4]}` }))
    expect(writes).toContainEqual({ name: 'downtime.setStep', args: 4 })
    expect(heading()).toBe(`Downtime · Step 5 of ${STEPS.length}`)
  })

  test('the Downtime actions are on hand; the field actions wait, collapsed', async () => {
    const heard: PlayRoll[] = []
    const stop = onPlayRoll((roll) => heard.push(roll))
    try {
      const { pilot, mech, crawler } = units()
      const { store } = stubStore(pilot, mech, crawler)
      render(
        <Harness
          pilot={pilot}
          mech={mech}
          situation="downtime"
          store={store}
          writes={[]}
          downtime={{ stepIndex: 0 }}
        />
      )
      const onHand = within(screen.getByRole('list', { name: 'Downtime actions' }))
      // Crafting opens the crawler's sheet in Build (r5 A14); Spend TP opens the
      // pilot's Manage Abilities, where Training Points are spent.
      expect(onHand.getByRole('button', { name: 'Spend TP' })).toBeTruthy()
      expect(onHand.getByRole('button', { name: 'Open' })).toBeTruthy()
      expect(onHand.queryByRole('link')).toBeNull()
      await click(onHand.getByRole('button', { name: 'Spend TP' }))
      const picker = screen.getByRole('dialog', { name: 'Manage Abilities' })
      await click(within(picker).getByRole('button', { name: /close/i }))
      expect(screen.queryByRole('dialog', { name: 'Manage Abilities' })).toBeNull()
      // Solo the rumour rolls on the Rumour table and says its row (r6 D8).
      await click(onHand.getByRole('button', { name: 'Roll d20' }))
      expect(heard.at(-1)).toMatchObject({ tableName: 'Rumour', rolls: [14] })
      // Solo there is no Mediator to send the player to (r3 L2).
      expect(onHand.queryByText(/Mediator/)).toBeNull()
      expect(onHand.getByText(`14 · ${rumourRowText(14)}`)).toBeTruthy()
      expect(rumourRowText(14).length).toBeGreaterThan(0)
      expect(onHand.getByRole('link', { name: 'Open the table' }).getAttribute('href')).toBe(
        '/roll-tables/rumour/'
      )
      const field = screen.getByRole('button', { name: 'Expand Field actions' })
      expect(field.getAttribute('aria-expanded')).toBe('false')
      await click(field)
      expect(
        within(screen.getByRole('list', { name: 'Field actions' })).getAllByText('after Downtime')
          .length
      ).toBeGreaterThan(0)
    } finally {
      stop()
    }
  })
})

// r5 A14 (SB5-08): Open showed the crawler read-only, with nothing to craft or trade with.
test('solo, Craft · Trade opens the crawler’s sheet in Build, in Edit', async () => {
  const { useSheetModeStore } = await import('../../build/sheet/sheetMode.model')
  useSheetModeStore.getState().setEditing(false)
  const { pilot, mech, crawler } = units()
  const assigned: string[] = []
  const assign = spyOn(window.location, 'assign').mockImplementation((to: string | URL) => {
    assigned.push(String(to))
  })
  try {
    render(
      <Harness
        pilot={pilot}
        mech={mech}
        situation="downtime"
        store={stubStore(pilot, mech, crawler).store}
        writes={[]}
        downtime={{ stepIndex: 0 }}
      />
    )
    const onHand = within(screen.getByRole('list', { name: 'Downtime actions' }))
    await click(onHand.getByRole('button', { name: 'Open' }))
    expect(assigned).toEqual(['/crawlers/dt-c'])
    expect(useSheetModeStore.getState().editing).toBe(true)
  } finally {
    assign.mockRestore()
    useSheetModeStore.getState().setEditing(false)
  }
})

// r3 L2 (SB3-06): a greyed Open said nothing about why, or what to make first.
describe('Downtime’s dead ends say why', () => {
  test('solo with no crawler: Craft · Trade needs a Union Crawler, and links to making one', () => {
    const { pilot, mech } = units()
    const { store } = stubStore(pilot, mech)
    render(
      <Harness
        pilot={pilot}
        mech={mech}
        situation="downtime"
        store={store}
        writes={[]}
        downtime={{ stepIndex: 0 }}
      />
    )
    const onHand = within(screen.getByRole('list', { name: 'Downtime actions' }))
    expect(onHand.queryByRole('button', { name: 'Open' })).toBeNull()
    expect(onHand.getByText('Needs a Union Crawler')).toBeTruthy()
    expect(onHand.getByRole('link', { name: 'Make a Union Crawler' }).getAttribute('href')).toBe(
      '/crawlers/new?pilot=dt-p&back=play'
    )
  })

  // r5 A12 (SB5-02): Restore with no crawler left the pilot at 0 HP without a word.
  test('solo Restore with no Med Bay says the HP stays, then heals once a crawler has one', async () => {
    const { pilot, mech, crawler } = units()
    const restore = STEPS.indexOf('Restore your Mech & Pilot')
    render(
      <Harness
        pilot={pilot}
        mech={mech}
        situation="downtime"
        store={stubStore(pilot, mech).store}
        writes={[]}
        downtime={{ stepIndex: restore, doneSteps: [restore] }}
      />
    )
    expect(within(stepBox()).getByText('HP stays 3')).toBeTruthy()
    // The reason, with its page, comes first (r6 D7).
    expect(
      within(stepBox()).getByText(
        'Healing in Downtime needs your crawler’s Med Bay (Core Book p.242).'
      )
    ).toBeTruthy()
    expect(
      within(stepBox()).getByRole('link', { name: 'Make a Union Crawler' }).getAttribute('href')
    ).toBe('/crawlers/new?pilot=dt-p&back=play')
    expect(within(stepBox()).queryByRole('button', { name: 'Heal at the Med Bay' })).toBeNull()

    cleanup()
    const writes: Write[] = []
    render(
      <Harness
        pilot={pilot}
        mech={mech}
        situation="downtime"
        store={stubStore(pilot, mech, crawler).store}
        writes={writes}
        downtime={{ stepIndex: restore, doneSteps: [restore] }}
      />
    )
    await click(button('Heal at the Med Bay'))
    const heal = writes.find((w) => w.name === 'downtime.healAgain')
    expect(heal?.args).toMatchObject({ stepIndex: restore, patch: { currentHP: 12 } })
    expect(within(stepBox()).queryByRole('button', { name: 'Heal at the Med Bay' })).toBeNull()
  })

  test('in a Game the rumour is the Mediator’s to answer, and a missing crawler offers no wizard', async () => {
    const { pilot, mech } = units()
    const { store } = stubStore(pilot, mech)
    render(
      <Harness
        pilot={pilot}
        mech={mech}
        situation="downtime"
        gameId="g1"
        store={store}
        writes={[]}
        downtime={{ stepIndex: 0 }}
      />
    )
    const onHand = within(screen.getByRole('list', { name: 'Downtime actions' }))
    expect(onHand.getByText('Needs a Union Crawler')).toBeTruthy()
    expect(onHand.queryByRole('link')).toBeNull()
    await click(onHand.getByRole('button', { name: 'Roll d20' }))
    expect(onHand.getByText('14 · The Mediator says what you hear.')).toBeTruthy()
    expect(onHand.queryByRole('link', { name: 'Open the table' })).toBeNull()
  })
})

describe('a Game’s step', () => {
  const MEMBERS = [
    { userId: 'u-me', displayName: 'Me' },
    { userId: 'u-mags', displayName: 'Mags' },
    { userId: 'u-rook', displayName: 'Rook' },
    { userId: 'u-wren', displayName: 'Wren' },
  ]

  test('the Mediator advances; a player applies and marks themselves done', async () => {
    const { pilot, mech, crawler } = units()
    const { store, calls } = stubStore(pilot, mech, crawler)
    const writes: Write[] = []
    render(
      <Harness
        pilot={pilot}
        mech={mech}
        situation="downtime"
        store={store}
        writes={writes}
        gameId="g1"
        downtime={{
          stepIndex: STEPS.indexOf('Restore your Mech & Pilot'),
          members: MEMBERS,
          done: [MEMBERS[1] as (typeof MEMBERS)[number]],
        }}
      />
    )
    // In a Game the Mediator advances (player-downtime.png draws the solo
    // "You run it" here, swapped with player-solo-downtime.png).
    expect(within(stepBox()).getByText('Mediator advances · 1 of 4 done')).toBeTruthy()
    expect(within(stepBox()).queryByText('You run it')).toBeNull()
    expect(within(stepBox()).queryByRole('button', { name: /^Next: / })).toBeNull()
    expect(
      within(stepBox())
        .getAllByRole('button')
        .map((b) => b.textContent)
    ).toEqual(['Skip', 'Apply & mark done'])
    // The track only shows where the table is.
    expect(
      within(screen.getByRole('list', { name: 'Downtime steps' })).queryByRole('button')
    ).toBeNull()

    await click(button('Apply & mark done'))
    // The pilot's and the mech's shares ride in the step's batch, not a store write.
    expect(calls).toEqual([])
    expect(writes.find((w) => w.name === 'downtime.markStepDone')?.args).toMatchObject({
      patch: { currentHP: expect.any(Number) },
      mech: { id: mech.id },
    })
    // Taking the step is what makes this member done: there is no Undo.
    expect(within(stepBox()).getByText('Mediator advances · 2 of 4 done')).toBeTruthy()
    expect(within(stepBox()).getByText('Done ✓')).toBeTruthy()
    expect(within(stepBox()).queryByRole('button', { name: 'Undo' })).toBeNull()
  })

  test('a taken step never applies twice: not again, not after the Mediator’s Back', async () => {
    const { pilot, mech, crawler } = units()
    const train = STEPS.indexOf('Train your Pilot')
    const { store, calls } = stubStore(pilot, mech, crawler)
    const writes: Write[] = []
    render(
      <Harness
        pilot={pilot}
        mech={mech}
        situation="downtime"
        store={store}
        writes={writes}
        gameId="g1"
        downtime={{ stepIndex: train, members: MEMBERS }}
      />
    )
    await click(button('Apply & mark done'))
    expect(writes).toContainEqual({
      name: 'downtime.markStepDone',
      args: { stepIndex: train, patch: { trainingPoints: 3 } },
    })
    expect(calls).toEqual([])

    // Taken is done: neither Apply nor Skip is offered again.
    expect(within(stepBox()).getByText('Done ✓')).toBeTruthy()
    expect(within(stepBox()).queryByRole('button', { name: 'Apply & mark done' })).toBeNull()
    expect(within(stepBox()).queryByRole('button', { name: 'Skip' })).toBeNull()
    expect(writes.filter((w) => w.name === 'downtime.markStepDone')).toHaveLength(1)

    // The Mediator goes Back to the step: it stays taken.
    cleanup()
    render(
      <Harness
        pilot={pilot}
        mech={mech}
        situation="downtime"
        store={store}
        writes={[]}
        gameId="g1"
        downtime={{ stepIndex: train, members: MEMBERS, doneSteps: [train] }}
      />
    )
    expect(within(stepBox()).getByText('Done ✓')).toBeTruthy()
    expect(within(stepBox()).queryByRole('button', { name: 'Apply & mark done' })).toBeNull()
    expect(calls).toHaveLength(0)
  })

  test('the step is per pilot: a pilot that has not taken it still applies it', async () => {
    const { pilot, mech, crawler } = units()
    const train = STEPS.indexOf('Train your Pilot')
    const { store } = stubStore(pilot, mech, crawler)
    const writes: Write[] = []
    const me = MEMBERS[0] as (typeof MEMBERS)[number]
    render(
      <Harness
        pilot={pilot}
        mech={mech}
        situation="downtime"
        store={store}
        writes={writes}
        gameId="g1"
        // This pilot has taken nothing, whatever the member's other pilots did.
        downtime={{ stepIndex: train, members: MEMBERS, done: [me] }}
      />
    )
    expect(within(stepBox()).queryByText('Done ✓')).toBeNull()
    await click(button('Apply & mark done'))
    expect(writes).toContainEqual({
      name: 'downtime.markStepDone',
      args: { stepIndex: train, patch: { trainingPoints: 3 } },
    })
  })

  test('the Mediator, at a player’s screen, advances the table; never Next step', async () => {
    const { pilot, mech, crawler } = units()
    const { store } = stubStore(pilot, mech, crawler)
    const writes: Write[] = []
    render(
      <Harness
        pilot={pilot}
        mech={mech}
        situation="downtime"
        store={store}
        writes={writes}
        gameId="g1"
        mediator
        downtime={{ stepIndex: 0, members: MEMBERS }}
      />
    )
    expect(within(stepBox()).getByText('Mediator advances · 0 of 4 done')).toBeTruthy()
    await click(button('Next: Step 2'))
    expect(writes).toContainEqual({ name: 'downtime.advance' })
  })

  test('Upkeep in a Game is the Mediator’s: read, not ticked; nothing for the seat (r6 D2)', async () => {
    const { pilot, mech, crawler } = units()
    const { store, calls } = stubStore(pilot, mech, crawler)
    const writes: Write[] = []
    render(
      <Harness
        pilot={pilot}
        mech={mech}
        situation="downtime"
        store={store}
        writes={writes}
        gameId="g1"
        downtime={{ stepIndex: STEPS.indexOf('Upkeep & Upgrade'), members: MEMBERS }}
      />
    )
    expect(within(stepBox()).getByText('The Mediator pays it')).toBeTruthy()
    expect(within(stepBox()).queryByRole('checkbox')).toBeNull()
    // The step has nothing for this seat: it counts as done, with no press and no words promising ticks.
    expect(within(stepBox()).queryByRole('button', { name: 'Mark done' })).toBeNull()
    expect(within(stepBox()).queryByText(/each line can be unticked/)).toBeNull()
    expect(
      within(stepBox()).getByText('Nothing for your seat: the Mediator runs this step')
    ).toBeTruthy()
    expect(writes.some((w) => w.name === 'downtime.markStepDone')).toBe(false)
    expect(writes.some((w) => w.name === 'downtime.claim')).toBe(false)
    expect(calls).toHaveLength(0)
  })
})
