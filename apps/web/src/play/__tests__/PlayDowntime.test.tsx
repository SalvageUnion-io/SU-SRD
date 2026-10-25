/**
 * Downtime in Play (play.md §6): the Actions column becomes the guide's steps
 * as a track, the current step as one box listing what it will apply (each
 * line untickable, ADR-007), then the Downtime actions and the field actions
 * collapsed. A full solo Downtime runs end to end here, and a Game's step is
 * the Game's: the Mediator advances it, a player marks themselves done.
 */

import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { downtimeStepNames } from 'game-domain/rules/downtime'
import type { Crawler } from 'game-domain/schemas/crawler'
import type { Mech } from 'game-domain/schemas/mech'
import type { Pilot } from 'game-domain/schemas/pilot'
import { installConvexMocks, setQueryAnswers } from '../../components/__tests__/convexMock'
import {
  crawlerFixture,
  mechFixture,
  pilotFixture,
  softLinkFixture,
} from '../../components/__tests__/fixtures'
import { PLAY_TXN } from '../../stores/surfaceProvenance'
import type { PlayRoll } from '../playRolls.model'
import type { Write } from './playActionsHarness'
import { stubStore } from './stubStore'

const convexMocks = await installConvexMocks()
setQueryAnswers({ 'account:me': { _id: 'u-me', displayName: 'Me', avatarUrl: null, email: null } })

const { hydrateStores } = await import('../../components/__tests__/hydrateStores')
const { useEntityStore } = await import('../../stores/entityStore')
const { setEntityBackendAuthState } = await import('../../stores/entityBackend')
const { Harness } = await import('./playActionsHarness')
const { onPlayRoll } = await import('../playRolls.model')

const LINK = 'dt-link'

beforeAll(async () => {
  await hydrateStores()
  setEntityBackendAuthState({ signedIn: false, online: true, authSettled: true })
  await useEntityStore
    .getState()
    .adopt('softLink', softLinkFixture('pilot-to-crawler', 'dt-p', 'dt-c', LINK))
})

afterAll(async () => {
  await useEntityStore.getState().forget('softLink', LINK)
  convexMocks.restore()
})

function units() {
  const pilot: Pilot = pilotFixture({
    id: 'dt-p',
    name: 'Bonesaw',
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
    techLevel: 'tech-2',
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
        spendUpkeep={async () => {
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
    const paid = calls.find((c) => c.type === 'crawler')
    expect(paid?.patch).toEqual({ scrapPool: { tl2: 2 }, upgradePool: 5 })
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
    expect(calls.map((c) => c.type)).toEqual(['mech'])
    expect(calls[0]?.patch).toMatchObject({ currentHeat: 0 })
    await click(button(/^Next: Step \d+$/))

    // On to Train your Pilot.
    while (STEPS[currentStep()] !== 'Train your Pilot') await click(button(/^Next: Step \d+$/))
    expect(within(stepBox()).getByText('2→3')).toBeTruthy()
    calls.length = 0
    await click(button('Apply & mark done'))
    expect(calls).toEqual([{ type: 'pilot', id: 'dt-p', patch: { trainingPoints: 3 } }])

    // The last step ends Downtime.
    while (currentStep() < STEPS.length - 1) await click(button(/^Next: Step \d+$/))
    await click(button('End Downtime'))
    expect(writes).toContainEqual({ name: 'endDowntime' })
    expect(writes.filter((w) => w.name === 'downtime.advance')).toHaveLength(STEPS.length - 1)
  })

  test('Upkeep is spent once: a second claim draws no Scrap', async () => {
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
        spendUpkeep={async () => false}
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
    const { store, calls } = stubStore(pilot, mech, crawler)
    render(
      <Harness
        pilot={pilot}
        mech={mech}
        situation="downtime"
        store={store}
        writes={[]}
        downtime={{ stepIndex: STEPS.indexOf('Craft Mech Chassis, Systems, and Modules') }}
      />
    )
    expect(within(stepBox()).getByText('Process Nanites')).toBeTruthy()
    await click(button('Apply & mark done'))
    const write = calls.find((c) => c.type === 'crawler')
    const pool = (write?.patch as Partial<Crawler> | undefined)?.scrapPool
    expect(pool?.inertNanites).toBe(0)
    expect(pool?.activeNanites).toBeGreaterThanOrEqual(0)
    expect(pool?.activeNanites).toBeLessThanOrEqual(3)
    expect(within(stepBox()).getByText(/Processed 3 Inert Meld Nanite piles/)).toBeTruthy()
  })

  test('a step done before a reload is not applied again: Train’s +1 TP lands once', async () => {
    const { pilot, mech, crawler } = units()
    const train = STEPS.indexOf('Train your Pilot')
    const { store, calls, metas } = stubStore(pilot, mech, crawler)
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
    expect(writes).toContainEqual({ name: 'downtime.markStepDone', args: train })
    expect(calls).toEqual([{ type: 'pilot', id: 'dt-p', patch: { trainingPoints: 3 } }])
    // Logged as Play's.
    expect(metas).toEqual([PLAY_TXN])

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
    expect(within(stepBox()).queryByRole('button', { name: 'Undo' })).toBeNull()
    expect(calls).toHaveLength(0)
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
      // Training and crafting open the unit's sheet over Play, never leave it.
      expect(onHand.getByRole('button', { name: 'Spend TP' })).toBeTruthy()
      expect(onHand.getByRole('button', { name: 'Open' })).toBeTruthy()
      expect(onHand.queryByRole('link')).toBeNull()
      await click(onHand.getByRole('button', { name: 'Roll the die on Rumour' }))
      expect(heard.at(-1)).toMatchObject({ tableName: 'Rumour', rolls: [14] })
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
    expect(calls.map((c) => c.type).sort()).toEqual(['mech', 'pilot'])
    expect(writes).toContainEqual({ name: 'downtime.markDone', args: true })
    expect(within(stepBox()).getByText('Mediator advances · 2 of 4 done')).toBeTruthy()
    await click(button('Undo'))
    expect(writes).toContainEqual({ name: 'downtime.markDone', args: false })
  })

  test('a claimed step never applies twice: not after Undo, not after the Mediator’s Back', async () => {
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
    expect(writes).toContainEqual({ name: 'downtime.markStepDone', args: train })
    expect(calls).toEqual([{ type: 'pilot', id: 'dt-p', patch: { trainingPoints: 3 } }])

    // Undo unticks "done" only: the step stays applied, and Apply is not offered.
    await click(button('Undo'))
    expect(writes).toContainEqual({ name: 'downtime.markDone', args: false })
    expect(within(stepBox()).getByText('Applied ✓')).toBeTruthy()
    expect(within(stepBox()).queryByRole('button', { name: 'Apply & mark done' })).toBeNull()
    expect(within(stepBox()).queryByRole('button', { name: 'Skip' })).toBeNull()
    await click(button('Mark done'))
    expect(within(stepBox()).getByText('Done ✓')).toBeTruthy()
    expect(calls).toHaveLength(1)

    // The Mediator goes Back to the step: `completedBy` is cleared, the claim is not.
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
    expect(within(stepBox()).getByText('Applied ✓')).toBeTruthy()
    expect(within(stepBox()).queryByRole('button', { name: 'Apply & mark done' })).toBeNull()
    expect(calls).toHaveLength(1)
  })

  test('done is per member, the claim per pilot: a second pilot still applies its step', async () => {
    const { pilot, mech, crawler } = units()
    const train = STEPS.indexOf('Train your Pilot')
    const { store, calls } = stubStore(pilot, mech, crawler)
    const me = MEMBERS[0] as (typeof MEMBERS)[number]
    render(
      <Harness
        pilot={pilot}
        mech={mech}
        situation="downtime"
        store={store}
        writes={[]}
        gameId="g1"
        // This member is done (for their other pilot); this pilot has claimed nothing.
        downtime={{ stepIndex: train, members: MEMBERS, done: [me] }}
      />
    )
    expect(within(stepBox()).queryByText('Done ✓')).toBeNull()
    await click(button('Apply & mark done'))
    expect(calls).toEqual([{ type: 'pilot', id: 'dt-p', patch: { trainingPoints: 3 } }])
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

  test('Upkeep in a Game is the Mediator’s: read, not ticked; the player marks done', async () => {
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
    await click(button('Mark done'))
    expect(writes).toContainEqual({ name: 'downtime.markDone', args: true })
    expect(writes.some((w) => w.name === 'downtime.spendUpkeep')).toBe(false)
    expect(calls).toHaveLength(0)
  })
})
