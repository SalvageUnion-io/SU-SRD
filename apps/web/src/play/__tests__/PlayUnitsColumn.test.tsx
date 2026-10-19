/**
 * The Units column (play.md §4, wireframe pin 4) in each Situation: which
 * unit is live (− / +) and which is for reference (dashed, read-only, Board
 * its one control), the hangar's Tokens, the mech's Downtime restore preview,
 * a Game crawler read from the listing, and Sheet ⤢'s overlay.
 *
 * The column is handed a `Play` built here, as `PlayCockpit` hands it the one
 * from `usePlaySituation` (tested in `PlaySituation.connected.test.tsx`).
 * The write path (each − / + one `entityStore.update`, the sheet's patch) is
 * the boxes' own, in `PlayUnits.test.tsx`.
 */

import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { downtimeGuideSteps } from 'game-domain/rules/downtime'
import type { Pilot } from 'game-domain/schemas/pilot'
import { installConvexMocks, setQueryAnswers } from '../../components/__tests__/convexMock'
import {
  crawlerFixture,
  mechFixture,
  pilotFixture,
  softLinkFixture,
} from '../../components/__tests__/fixtures'
import type { BoardOption } from '../boardMenu.model'
import type { Play, Situation } from '../situation.model'
import { RESTORE_STEP_NAME } from '../units.model'
import { fakeSeat } from './seatFixture'

// Module scope, before the imports below — see `convexMock.ts`.
const convexMocks = await installConvexMocks()

const { useEntityStore } = await import('../../stores/entityStore')
const { hydrateStores } = await import('../../components/__tests__/hydrateStores')
const { ConnectionContext } = await import('../../lib/connection/connectionContext')
const { PlayUnitsColumn } = await import('../PlayUnitsColumn')

const PILOT = 'units-bonesaw'
const MECH = 'units-buzzard'
const SPARE = 'units-old-faithful'
const CRAWLER = 'units-tenacity'
const GAME_CRAWLER = 'units-game-crawler'
const RESTORE_STEP = downtimeGuideSteps().findIndex((s) => s.name === RESTORE_STEP_NAME)

const pilot = pilotFixture({ id: PILOT, name: 'Bonesaw', currentHP: 7, currentAP: 3 })

beforeAll(async () => {
  await hydrateStores()
  const store = useEntityStore.getState()
  await store.adopt('pilot', pilot)
  await store.adopt(
    'mech',
    mechFixture({
      id: MECH,
      name: 'Buzzard',
      chassisRef: 'mule',
      currentSP: 5,
      currentEP: 2,
      currentHeat: 3,
    })
  )
  await store.adopt('mech', mechFixture({ id: SPARE, name: 'Old Faithful', chassisRef: 'mule' }))
  await store.adopt(
    'crawler',
    crawlerFixture({
      id: CRAWLER,
      name: 'Tenacity',
      techLevel: 'tech-2',
      crawlerBays: [
        { bayRef: 'mech-bay' },
        { bayRef: 'med-bay' },
        { bayRef: 'pilot-bay', condition: 'damaged' },
        { bayRef: 'storage-bay' },
        { bayRef: 'trading-bay' },
      ],
    })
  )
  await store.adopt('softLink', softLinkFixture('mech-to-pilot', MECH, PILOT, 'units-l1'))
  await store.adopt('softLink', softLinkFixture('pilot-to-crawler', PILOT, CRAWLER, 'units-l2'))
})

afterAll(async () => {
  const store = useEntityStore.getState()
  await store.forget('softLink', 'units-l1')
  await store.forget('softLink', 'units-l2')
  await store.forget('crawler', CRAWLER)
  await store.forget('mech', SPARE)
  await store.forget('mech', MECH)
  await store.forget('pilot', PILOT)
  convexMocks.restore()
})

const yours = (mechId: string, name: string): BoardOption => ({
  mechId,
  serverId: null,
  name,
  state: 'yours',
  note: null,
})

/** A `Play` as `usePlaySituation` would hand it, with its writes recorded. */
function playFor({
  situation,
  gameId = null,
  mediator = false,
  stepIndex = null,
  pilotRecord = pilot,
}: {
  situation: Situation
  gameId?: string | null
  mediator?: boolean
  stepIndex?: number | null
  pilotRecord?: Pilot
}) {
  const boarded = situation === 'boarded'
  const seat = fakeSeat(boarded ? { mount: { kind: 'boarded', mechId: MECH } } : {})
  const boards: string[] = []
  const store = useEntityStore.getState()
  const play: Play = {
    target: {
      pilotId: pilotRecord.id,
      gameId,
      gameName: gameId ? 'The Rust Belt Run' : null,
      mediator,
    },
    pilot: pilotRecord,
    situation,
    boardedMech: boarded ? store.get('mech', MECH) : null,
    boardedMechId: boarded ? MECH : null,
    mechs: [yours(MECH, 'Buzzard'), yours(SPARE, 'Old Faithful')],
    setOnFoot: () => {},
    board: (mechId) => boards.push(mechId),
    claimAndBoard: () => {},
    canChangeDowntime: gameId === null || mediator,
    startDowntime: () => {},
    endDowntime: () => {},
    seat: seat.handle,
    downtime: {
      downtime: {
        running: situation === 'downtime',
        stepIndex,
        completedBy: [],
        upkeepSpent: false,
        members: [],
      },
      locked: gameId !== null && !mediator,
      begin: () => {},
      advance: () => {},
      setStep: gameId === null ? () => {} : null,
      end: () => {},
      markDone: gameId === null ? null : () => {},
      doneSteps: gameId === null ? [] : null,
      markStepDone: gameId === null ? async () => true : null,
      spendUpkeep: async () => true,
    },
    canWrite: true,
    readOnly: null,
  }
  return { play, seatCalls: seat.calls, boards }
}

const CONNECTED = {
  mode: 'connected',
  canWrite: true,
  showDisconnectedWarning: false,
  settling: false,
} as const

async function renderColumn(play: Play) {
  await act(async () => {
    render(
      <ConnectionContext.Provider value={CONNECTED}>
        <PlayUnitsColumn target={play.target} play={play} />
      </ConnectionContext.Provider>
    )
  })
}

/** A unit's box, by its landmark ("Pilot: Bonesaw"). */
function box(name: string) {
  return screen.getByRole('region', { name })
}

const isReference = (el: HTMLElement) => el.querySelector(':scope > [data-reference]') !== null

describe('the Units column (play.md §4)', () => {
  test('its heading is a Slab, and each unit is its own box (play.md §12)', async () => {
    setQueryAnswers({})
    await renderColumn(playFor({ situation: 'onFoot' }).play)
    expect(screen.getByRole('heading', { level: 2, name: 'Units' })).toBeTruthy()
    expect(screen.getAllByRole('region').map((r) => r.getAttribute('aria-label'))).toEqual([
      'Pilot: Bonesaw',
      'Mech: Buzzard',
      'Crawler: Tenacity',
    ])
  })

  test('on foot: the pilot is live; the mech is for reference, Board its one control', async () => {
    setQueryAnswers({})
    const { play, boards } = playFor({ situation: 'onFoot' })
    await renderColumn(play)

    const pilotBox = box('Pilot: Bonesaw')
    expect(isReference(pilotBox)).toBe(false)
    expect(within(pilotBox).getByText('Live')).toBeTruthy()
    expect(within(pilotBox).getByRole('button', { name: 'HP −1' })).toBeTruthy()
    expect(within(pilotBox).getByRole('button', { name: 'AP +1' })).toBeTruthy()
    expect(within(pilotBox).getByRole('slider', { name: 'HP' })).toBeTruthy()
    expect(within(pilotBox).getByText('No injuries')).toBeTruthy()

    const mechBox = box('Mech: Buzzard')
    expect(isReference(mechBox)).toBe(true)
    expect(within(mechBox).getByText('Parked')).toBeTruthy()
    expect(within(mechBox).queryByRole('button', { name: /[−+]1$/ })).toBeNull()
    expect(within(mechBox).queryByRole('slider')).toBeNull()
    expect(within(mechBox).getByRole('img', { name: 'SP 5 of 12' })).toBeTruthy()
    // Parked, no range band and no Heat: those are a pilot aboard's.
    expect(within(mechBox).queryByRole('group', { name: 'Range' })).toBeNull()
    expect(
      within(mechBox)
        .getAllByRole('button')
        .map((b) => b.textContent)
    ).toEqual(['Board'])

    fireEvent.click(within(mechBox).getByRole('button', { name: 'Board Buzzard' }))
    expect(boards).toEqual([MECH])
  })

  test('the other mechs are hangar Tokens, one per line, not boxes', async () => {
    setQueryAnswers({})
    await renderColumn(playFor({ situation: 'onFoot' }).play)
    const hangar = document.querySelectorAll('.su-play-unit__hangar')
    expect(hangar.length).toBe(1)
    const token = hangar[0] as HTMLElement
    expect(token.textContent).toContain('Old Faithful')
    expect(token.textContent).toContain('In hangar')
    expect(token.querySelector('.su-entity-token')).not.toBeNull()
    expect(within(token).queryByRole('region')).toBeNull()
  })

  test('boarded: the mech is live, with Heat and the range band', async () => {
    setQueryAnswers({})
    const { play, seatCalls } = playFor({ situation: 'boarded' })
    await renderColumn(play)

    const mechBox = box('Mech: Buzzard')
    expect(isReference(mechBox)).toBe(false)
    expect(within(mechBox).getByText('Boarded')).toBeTruthy()
    for (const name of ['SP −1', 'SP +1', 'EP +1', 'Heat −1']) {
      expect(within(mechBox).getByRole('button', { name })).toBeTruthy()
    }
    expect(within(mechBox).getByRole('slider', { name: 'Heat' })).toBeTruthy()

    const range = within(mechBox).getByRole('group', { name: 'Range' })
    expect(within(range).getByRole('button', { name: 'Close' }).getAttribute('aria-pressed')).toBe(
      'true'
    )
    fireEvent.click(within(range).getByRole('button', { name: 'Medium' }))
    expect(seatCalls).toEqual([{ write: 'setRange', args: ['Medium'] }])
  })

  test('solo Downtime: the mech says what the step restores; the crawler is live', async () => {
    setQueryAnswers({})
    await renderColumn(playFor({ situation: 'downtime', stepIndex: RESTORE_STEP }).play)

    const mechBox = box('Mech: Buzzard')
    expect(isReference(mechBox)).toBe(true)
    expect(within(mechBox).getByText('Mech Bay')).toBeTruthy()
    expect(within(mechBox).queryByRole('button', { name: /[−+]1$/ })).toBeNull()
    expect(within(mechBox).getByRole('note', { name: 'SP restores to 12' }).textContent).toBe(
      '→ 12'
    )
    expect(within(mechBox).getByRole('note', { name: 'EP restores to 4' })).toBeTruthy()
    expect(within(mechBox).getByRole('note', { name: 'Heat restores to 0' })).toBeTruthy()

    const crawlerBox = box('Crawler: Tenacity')
    expect(isReference(crawlerBox)).toBe(false)
    expect(within(crawlerBox).getByText('Downtime')).toBeTruthy()
    expect(within(crawlerBox).getByRole('button', { name: 'SP −1' })).toBeTruthy()
    expect(within(crawlerBox).getByText('Upkeep')).toBeTruthy()
    expect(within(crawlerBox).getByRole('button', { name: 'Open Tenacity’s sheet' })).toBeTruthy()
  })

  test('another Downtime step restores nothing, so no preview', async () => {
    setQueryAnswers({})
    await renderColumn(playFor({ situation: 'downtime', stepIndex: RESTORE_STEP + 1 }).play)
    expect(within(box('Mech: Buzzard')).queryByRole('note')).toBeNull()
  })

  test('the crawler out of Downtime: dashed, read-only, every bay a chip, damage first', async () => {
    setQueryAnswers({})
    await renderColumn(playFor({ situation: 'onFoot' }).play)
    const crawlerBox = box('Crawler: Tenacity')
    expect(isReference(crawlerBox)).toBe(true)
    expect(within(crawlerBox).queryByRole('button')).toBeNull()
    const bays = within(crawlerBox).getByRole('list', { name: 'Tenacity’s bays' })
    expect(
      within(bays)
        .getAllByRole('listitem')
        .map((li) => li.textContent)
    ).toEqual(['Pilot Bay · damaged', 'Mech Bay', 'Med Bay', 'Storage Bay', 'Trading Bay'])
  })
})

describe('in a Game', () => {
  const GAME = 'g-units'
  const listing = {
    pilots: [],
    mechs: [],
    npcs: [],
    crawlers: [
      {
        _id: 'r-crawler',
        appId: GAME_CRAWLER,
        body: crawlerFixture({ id: GAME_CRAWLER, name: 'The Long Haul', techLevel: 'tech-3' }),
      },
    ],
    softLinks: [
      {
        _id: 'r-link',
        _creationTime: 0,
        gameId: GAME,
        type: 'pilot-to-crawler',
        from: { type: 'pilot', id: 'units-rook' },
        to: { type: 'crawler', id: GAME_CRAWLER },
      },
    ],
  }
  const rook = pilotFixture({ id: 'units-rook', name: 'Rook' })

  test('a player’s Game crawler comes from the listing, and is never theirs to write', async () => {
    setQueryAnswers({ 'entities:listForGame': listing })
    await renderColumn(
      playFor({ situation: 'downtime', gameId: GAME, stepIndex: 0, pilotRecord: rook }).play
    )
    const crawlerBox = box('Crawler: The Long Haul')
    // Solid as the Downtime's unit, but with no − / +: the Mediator keeps it.
    expect(isReference(crawlerBox)).toBe(false)
    expect(within(crawlerBox).queryByRole('button')).toBeNull()
    expect(within(crawlerBox).getByRole('img', { name: /^SP / })).toBeTruthy()
  })

  test('for the Mediator, the crawler the store holds is live', async () => {
    setQueryAnswers({ 'entities:listForGame': listing })
    await renderColumn(playFor({ situation: 'onFoot', gameId: GAME, mediator: true }).play)
    expect(within(box('Crawler: Tenacity')).getByRole('button', { name: 'SP +1' })).toBeTruthy()
  })
})

describe('Sheet ⤢', () => {
  test('opens the unit’s sheet over Play, and closes back to it', async () => {
    setQueryAnswers({ 'entities:locate': null, 'games:get': null })
    await renderColumn(playFor({ situation: 'onFoot' }).play)
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Open Bonesaw’s sheet' }))
    })
    const dialog = await screen.findByRole('dialog', { name: 'Bonesaw sheet' })
    expect(within(dialog).getByRole('heading', { level: 2, name: 'Bonesaw' })).toBeTruthy()
    await act(async () => {
      fireEvent.click(within(dialog).getByRole('button', { name: 'Back to Play' }))
    })
    expect(screen.queryByRole('dialog')).toBeNull()
  })
})
