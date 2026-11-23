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

// r6 D1 (LG6-12): Tally Salvage asked players to note their Scrap down.
describe('Tally Salvage moves the Scrap', () => {
  test('the carried Scrap by Tech Level, one press into the crawler, and the step taken', async () => {
    const { pilot, mech, crawler } = units()
    const carrying: Pilot = {
      ...pilot,
      genericInventory: [{ id: 's', name: 'Tech 1 Scrap', slotCost: 3, qty: 2 }],
    }
    const writes: Write[] = []
    render(
      <Harness
        pilot={carrying}
        mech={mech}
        situation="downtime"
        store={stubStore(carrying, mech, crawler).store}
        writes={writes}
        downtime={{ stepIndex: 0 }}
      />
    )
    const line = within(within(stepBox()).getByRole('list', { name: 'Carried Scrap' }))
    expect(line.getByText('T1')).toBeTruthy()
    expect(line.getByText('2')).toBeTruthy()
    // The book's 'note it down' gives way to the move.
    expect(within(stepBox()).queryByText(/note these down/i)).toBeNull()
    await click(button('Move to the crawler'))
    expect(writes).toContainEqual({
      name: 'downtime.moveScrap',
      args: { pilotId: 'dt-p', mechId: 'dt-m', crawlerId: 'dt-c' },
    })
    // What moved, and where, by Tech Level: never "You carry no Scrap home" (r8 D2).
    const into = within(within(stepBox()).getByRole('list', { name: 'Scrap moved' }))
    expect(into.getByText('Into Tenacity’s Scrap Pool')).toBeTruthy()
    expect(into.getByText('T1')).toBeTruthy()
    expect(within(stepBox()).queryByRole('list', { name: 'Carried Scrap' })).toBeNull()
    expect(within(stepBox()).queryByText(/carry no Scrap/)).toBeNull()
    expect(within(stepBox()).queryByRole('button', { name: 'Move to the crawler' })).toBeNull()
  })

  test('taken already with nothing carried, the step says Done, never "no Scrap home" (r8 D2)', () => {
    const { pilot, mech, crawler } = units()
    render(
      <Harness
        pilot={pilot}
        mech={mech}
        situation="downtime"
        store={stubStore(pilot, mech, crawler).store}
        writes={[]}
        downtime={{ stepIndex: 0, doneSteps: [0] }}
      />
    )
    expect(within(stepBox()).queryByText(/carry no Scrap/)).toBeNull()
    expect(within(stepBox()).getByText('Done ✓')).toBeTruthy()
  })
})

// r7 D3 (LG7-22): a seat with no Scrap read four paragraphs about a paper Crawler Sheet.
test('in a Game, a seat carrying no Scrap reads one line in Tally Salvage, and nothing to press', () => {
  const { pilot, mech, crawler } = units()
  render(
    <Harness
      pilot={pilot}
      mech={mech}
      situation="downtime"
      store={stubStore(pilot, mech, crawler).store}
      writes={[]}
      gameId="g1"
      downtime={{ stepIndex: 0, members: [{ userId: 'u-me', displayName: 'Me' }] }}
    />
  )
  expect(within(stepBox()).getByText('You carry no Scrap home: nothing to tally.')).toBeTruthy()
  expect(within(stepBox()).queryByText(/Crawler Sheet/i)).toBeNull()
  expect(within(stepBox()).queryByRole('button')).toBeNull()
})

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
    // r7 D1 (SB7-10): the way on applies the step; skipping is the small link.
    expect(
      within(stepBox())
        .getAllByRole('button')
        .map((b) => b.textContent)
    ).toEqual(['Skip this step', 'Apply and go on'])
    expect(within(stepBox()).getByText('5 Scrap · T2')).toBeTruthy()
    await click(button('Apply and go on'))
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

    // Restore: the mech's and the pilot's lines; untick the pilot's.
    expect(STEPS[currentStep()]).toBe('Restore your Mech & Pilot')
    const lines = within(within(stepBox()).getByRole('list', { name: 'Will apply' }))
    expect(lines.getByText('Buzzard')).toBeTruthy()
    expect(lines.getByText('Bonesaw')).toBeTruthy()
    await click(lines.getByRole('checkbox', { name: 'Bonesaw' }))
    calls.length = 0
    await click(button('Apply and go on'))
    // The mech's share rides in the step's batch, beside the pilot's op.
    expect(calls).toEqual([])
    expect(writes.filter((w) => w.name === 'downtime.markStepDone').at(-1)).toMatchObject({
      args: { patch: {}, mech: { id: mech.id, patch: { currentHeat: 0 } } },
    })
    expect(STEPS[currentStep()]).toBe('Trade')

    // On to Train your Pilot.
    while (STEPS[currentStep()] !== 'Train your Pilot') await click(button(/^Next: Step \d+$/))
    expect(within(stepBox()).getByText('2→3')).toBeTruthy()
    calls.length = 0
    await click(button('Apply and go on'))
    // The pilot's share rides on the step's op, not a store write.
    expect(calls).toEqual([])
    expect(writes).toContainEqual({
      name: 'downtime.markStepDone',
      args: { stepIndex: STEPS.indexOf('Train your Pilot'), patch: { trainingPoints: 3 } },
    })

    // The last step ends Downtime.
    while (currentStep() < STEPS.length - 1) await click(button(/^Next: Step \d+$/))
    await click(button('End Downtime'))
    expect(writes).toContainEqual({ name: 'endDowntime' })
    expect(writes.filter((w) => w.name === 'downtime.advance')).toHaveLength(STEPS.length - 1)
  })

  // r7 D1 (SB7-10): the way on applies, and what it applied says itself with Undo.
  test('Apply and go on applies the step and moves on; its Undo writes the numbers back', async () => {
    const { ToasterMount, toast } = await import('../../components/index')
    toast.dismiss()
    const { pilot, mech, crawler } = units()
    const train = STEPS.indexOf('Train your Pilot')
    const { store, calls, metas } = stubStore(pilot, mech, crawler)
    const writes: Write[] = []
    try {
      await act(async () => {
        render(
          <>
            <ToasterMount />
            <Harness
              pilot={pilot}
              mech={mech}
              situation="downtime"
              store={store}
              writes={writes}
              downtime={{ stepIndex: train }}
            />
          </>
        )
      })
      await click(button('Apply and go on'))
      expect(writes).toContainEqual({
        name: 'downtime.markStepDone',
        args: { stepIndex: train, patch: { trainingPoints: 3 } },
      })
      expect(writes.filter((w) => w.name === 'downtime.advance')).toHaveLength(1)
      expect(currentStep()).toBe(train + 1)
      expect(await screen.findByText('Applied: Train your Pilot')).toBeTruthy()
      await click(screen.getByRole('button', { name: 'Undo' }))
      expect(calls).toContainEqual({ type: 'pilot', id: pilot.id, patch: { trainingPoints: 2 } })
      expect(metas.at(-1)?.source).toBe('play-undo')
    } finally {
      toast.dismiss()
    }
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
    await click(button('Apply and go on'))
    expect(calls.filter((c) => c.type === 'crawler')).toHaveLength(0)
    expect(STEPS[currentStep()]).toBe('Restore your Mech & Pilot')
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
    await click(button('Apply and go on'))
    const write = writes.find((w) => w.name === 'downtime.claim')?.args as
      | { claim: string; patch: Partial<Crawler> }
      | undefined
    expect(write?.claim).toBe('nanites')
    const pool = write?.patch.scrapPool
    expect(pool?.inertNanites).toBe(0)
    expect(pool?.activeNanites).toBeGreaterThanOrEqual(0)
    expect(pool?.activeNanites).toBeLessThanOrEqual(3)
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
    await click(button('Apply and go on'))
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
    expect(within(stepBox()).queryByRole('button', { name: 'Apply and go on' })).toBeNull()
    expect(calls).toHaveLength(0)
  })

  test('a taken step shows the change that was made, never the next one (in a Game, where it stays)', async () => {
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
        gameId="g1"
        downtime={{ stepIndex: train, members: [{ userId: 'u-me', displayName: 'Me' }] }}
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
        gameId="g1"
        downtime={{ stepIndex: train, members: [{ userId: 'u-me', displayName: 'Me' }] }}
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
        gameId="g1"
        downtime={{
          stepIndex: train,
          doneSteps: [train],
          members: [{ userId: 'u-me', displayName: 'Me' }],
        }}
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
    // The way on applies now (r7 D1): a jump by the track is what walks past.
    const track = within(screen.getByRole('list', { name: 'Downtime steps' }))
    await click(
      track.getByRole('button', { name: `Step ${STEPS.length}: ${STEPS[STEPS.length - 1]}` })
    )
    expect(
      track.getByRole('button', { name: `Step ${restore + 1}: ${STEPS[restore]}, skipped` })
    ).toBeTruthy()
    expect(
      track.getByRole('button', { name: `Step ${train + 1}: ${STEPS[train]}, skipped` })
    ).toBeTruthy()
    // A step jumped over, though it previews nothing, is skipped, never done (r8 B9, SB8-16).
    expect(
      track.getByRole('button', { name: `Step ${train}: ${STEPS[train - 1]}, skipped` })
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

  test('Skip this step takes it, writes nothing, and goes on; the track moves to any step', async () => {
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
    await click(button('Skip this step'))
    expect(calls).toHaveLength(0)
    expect(writes).toContainEqual({
      name: 'downtime.markStepDone',
      args: { stepIndex: STEPS.indexOf('Restore your Mech & Pilot'), patch: {} },
    })
    expect(STEPS[currentStep()]).toBe('Trade')
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
      // Craft · Trade opens its bays here (r6 D4); Spend TP opens the
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

// r6 D4, D5 (SB6-07, SB6-08): Open threw the player into an Edit sheet, and crafting spent nothing.
test('solo, Craft · Trade opens its bays inside Downtime, and crafting spends Scrap', async () => {
  const { useSheetModeStore } = await import('../../build/sheet/sheetMode.model')
  useSheetModeStore.getState().setEditing(false)
  const { pilot, mech, crawler } = units()
  const assigned: string[] = []
  const assign = spyOn(window.location, 'assign').mockImplementation((to: string | URL) => {
    assigned.push(String(to))
  })
  try {
    const { store, calls, metas } = stubStore(pilot, mech, crawler)
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
    await click(onHand.getByRole('button', { name: 'Open' }))
    const find = await onHand.findByRole('searchbox', { name: 'Find a System or Module to craft' })
    // No trip to the sheet, and no Edit mode left on for the next one.
    expect(assigned).toEqual([])
    expect(useSheetModeStore.getState().editing).toBe(false)
    expect(onHand.getByRole('button', { name: 'Back to the step' })).toBeTruthy()
    // Open, the row's own button reads Close, and the panel heads with the Scrap Pool (r8 D1).
    expect(onHand.getByRole('button', { name: 'Close' })).toBeTruthy()
    const pool = within(onHand.getByRole('list', { name: 'Scrap Pool' }))
    expect(pool.getByText('T2')).toBeTruthy()
    await act(async () => {
      fireEvent.change(find, { target: { value: 'Armour Plating' } })
    })
    const craftable = within(onHand.getByRole('list', { name: 'Craftable' }))
    await click(craftable.getAllByRole('button', { name: 'Craft onto Buzzard' })[0] as Element)
    await act(async () => {})
    const spent = calls.find((c) => c.type === 'crawler' && 'scrapPool' in c.patch)
    expect(spent?.patch.scrapPool).toMatchObject({ tl2: 6 })
    const mounted = calls.find((c) => c.type === 'mech' && 'systems' in c.patch)
    expect(mounted?.patch.systems).toContain('armour-plating')
    // One change, the Scrap and the item together (r7 D6).
    expect(metas).toHaveLength(1)
    expect(
      onHand.getByText(/Crafted Armour Plating for 1 Tech 1\+ Scrap, into Buzzard\./)
    ).toBeTruthy()

    // r6 D6 (SB6-09): the availability roll says what is for sale, each with Choose instead and Buy.
    await click(onHand.getByRole('button', { name: 'Roll availability' }))
    const forSale = within(onHand.getByRole('list', { name: 'For sale' }))
    expect(forSale.getAllByRole('button', { name: 'Choose instead' })).toHaveLength(2)
    // A Tech 2 crawler's wares are Tech 3; Tenacity holds Tech 2 Scrap alone,
    // so each Buy is off before the press and says the shortfall (r8 D1).
    const buys = forSale.getAllByRole('button', { name: /^Buy · \d+ T3\+$/ })
    for (const buy of buys) expect(buy).toHaveProperty('disabled', true)
    expect(forSale.getAllByText(/^Short \d+ T3\+$/)).toHaveLength(buys.length)
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
    // The link says it: no second chip crowding the title (r8 D3, SB8-09).
    expect(onHand.queryByText('Needs a Union Crawler')).toBeNull()
    expect(onHand.getByRole('link', { name: 'Make a Union Crawler' }).getAttribute('href')).toBe(
      '/crawlers/new?pilot=dt-p&back=play'
    )
  })

  // r8 D3 (SB8-09): the Trade step said Roll and offered none, and no crawler was a dead end.
  test('solo with no crawler, the Trade step says what a Crawler adds and links to making one', () => {
    const { pilot, mech } = units()
    render(
      <Harness
        pilot={pilot}
        mech={mech}
        situation="downtime"
        store={stubStore(pilot, mech).store}
        writes={[]}
        downtime={{ stepIndex: STEPS.indexOf('Trade') }}
      />
    )
    expect(within(stepBox()).getByText(/Trading Bay: it rolls what is for sale/)).toBeTruthy()
    expect(
      within(stepBox()).getByRole('link', { name: 'Make a Union Crawler' }).getAttribute('href')
    ).toBe('/crawlers/new?pilot=dt-p&back=play')
  })

  test('solo with a crawler, the Trade step offers its roll, the one Craft · Trade shows', async () => {
    const { pilot, mech, crawler } = units()
    render(
      <Harness
        pilot={pilot}
        mech={mech}
        situation="downtime"
        store={stubStore(pilot, mech, crawler).store}
        writes={[]}
        downtime={{ stepIndex: STEPS.indexOf('Trade') }}
      />
    )
    const roll = await within(stepBox()).findByRole('button', { name: 'Roll availability' })
    expect(within(stepBox()).getByRole('list', { name: 'Scrap Pool' })).toBeTruthy()
    await click(roll)
    expect(within(stepBox()).queryByRole('button', { name: 'Roll availability' })).toBeNull()
    // Craft · Trade shows the same roll: it is made once a Downtime (p.223).
    const onHand = within(screen.getByRole('list', { name: 'Downtime actions' }))
    await click(onHand.getByRole('button', { name: 'Open' }))
    await onHand.findByRole('searchbox', { name: 'Find a System or Module to craft' })
    expect(onHand.queryByRole('button', { name: 'Roll availability' })).toBeNull()
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
        'Healing in Downtime needs your crawler’s Med Bay (Workshop Manual · p.242).'
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
