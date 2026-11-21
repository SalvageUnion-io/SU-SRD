/**
 * `usePlayMediator`, the Mediator's writes to the Game's room: what each sends
 * (the tray's draws, renames and an encounter row's roster fielded line by
 * line), and what happens when the room refuses: the reason is said once, and
 * a write somebody awaits still rejects.
 *
 * Reads are answered by name (`serverMock.ts`) and served to the Game's room
 * (`fakeRooms`), which records every act it was sent.
 */

import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test } from 'bun:test'
import { act, renderHook, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { SalvageUnionReference } from 'salvageunion-reference'
import { crawlerFixture, npcFixture } from '../../../components/__tests__/fixtures'
import type { QueryAnswers } from '../../../components/__tests__/serverMock'
import { installServerMocks, setQueryAnswers } from '../../../components/__tests__/serverMock'
import {
  acts,
  answerActs,
  closeRooms,
  openRooms,
  serveReads,
} from '../../../replica/__tests__/fakeRooms'
import {
  MEDIATOR_MEMBERS,
  MEDIATOR_SEATS,
  mediatorCrewAt,
  TABLE_HERE,
} from '../../__tests__/mediatorFixture'

const serverMocks = await installServerMocks({
  also: { '../../play/useGamePresence': () => ({ useGamePresence: () => TABLE_HERE }) },
})
afterAll(() => serverMocks.restore())

const { usePlayMediator } = await import('../usePlayMediator')
const { readRoster } = await import('../encounterRoster.model')
const { SyncContext } = await import('../../../replica/syncContext')
const { ToasterMount, toast } = await import('../../../components/index')
const { hydrateStores } = await import('../../../components/__tests__/hydrateStores')
const { clearPlayRolls, onPlayRoll } = await import('../../playRolls.model')
const { useUnits } = await import('../../../replica/units')
const { withSignedInBackend } = await import('../../../replica/__tests__/signedInBackend')

withSignedInBackend()

const GAME = 'g-rust'

beforeAll(async () => {
  await hydrateStores()
})

beforeEach(() => {
  openRooms(GAME)
  toast.dismiss()
})

afterEach(() => {
  closeRooms()
  clearPlayRolls()
  toast.dismiss()
})

const RAIDER_ROW = {
  _id: 'n-1',
  body: { name: 'Raider', refSchema: 'npcs', refSlug: 'raider', currentHp: 3, maxHp: 3 },
}

function answers(over: QueryAnswers = {}): QueryAnswers {
  return {
    'games.members': MEDIATOR_MEMBERS,
    'crew.vitals': mediatorCrewAt(),
    'seats.forGame': MEDIATOR_SEATS,
    'games.listing': {
      pilots: [],
      mechs: [],
      npcs: [],
      softLinks: [],
      crawlers: [],
      primaryCrawlerId: null,
    },
    'scenes.current': { conditions: [], hours: 0 },
    'downtime.state': { running: false, stepIndex: null, completedBy: [], upkeepSpent: false },
    'mediator.npcs': [RAIDER_ROW],
    'mediator.amMediator': true,
    'mediator.patterns': [],
    'mediator.running': null,
    'salvageAreas.here': null,
    'ops.sent': [],
    'changeLog.alerts': [],
    'changeLog.rolls': [],
    'channelBindings.current': null,
    'safety.stopSign': null,
    'account.me': { _id: 'u-gm', displayName: 'GM', avatarUrl: null, email: null },
    ...over,
  }
}

async function mediator(over: QueryAnswers = {}) {
  const all = answers(over)
  setQueryAnswers(all)
  serveReads(GAME, all)
  const wrapper = ({ children }: { children: ReactNode }) => (
    <SyncContext.Provider value={{ status: 'live', canWrite: true, outdated: false }}>
      <ToasterMount />
      {children}
    </SyncContext.Provider>
  )
  let hook!: ReturnType<typeof renderHook<ReturnType<typeof usePlayMediator>, unknown>>
  await act(async () => {
    hook = renderHook(() => usePlayMediator(GAME, 'The Rust Belt Run'), { wrapper })
  })
  return () => hook.result.current
}

/** Let a toast land. */
async function said(text: string | RegExp): Promise<HTMLElement> {
  for (let i = 0; i < 40 && screen.queryByText(text) === null; i++) {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 5))
    })
  }
  return screen.getByText(text)
}

/** The acts the room was sent under `name`, as their args. */
const sent = (name: string) => acts.filter((a) => a.name === name).map((a) => a.args)
const bodies = () => sent('mediator.addNpc').map((a) => a.body as { name: string })

describe('the tray’s writes', () => {
  test('a draw from the reference joins the tray, numbered past the names already on it', async () => {
    const m = await mediator()
    const raider = SalvageUnionReference.NPCs.getBySlug('raider')
    if (raider === undefined) throw new Error('no Raider')
    await act(async () => {
      await m().tray.add('npcs', raider)
    })
    expect(bodies()).toHaveLength(1)
    expect(bodies()[0]).toMatchObject({ refSchema: 'npcs', refSlug: 'raider', name: 'Raider 2' })
  })

  test('one of the Mediator’s own NPCs is fielded as a snapshot, under the name given', async () => {
    const m = await mediator()
    const kessler = npcFixture({ id: 'npc-k', name: 'Sergeant Kessler', hitPoints: 9 })
    await act(async () => {
      await m().tray.addBuilt(kessler, 'The Sergeant')
    })
    expect(bodies()[0]).toMatchObject({ name: 'The Sergeant', maxHp: 9, currentHp: 9 })
  })

  test('a rename is sent for that NPC alone', async () => {
    const m = await mediator()
    const [npc] = m().npcs ?? []
    if (npc === undefined) throw new Error('no tray')
    await act(async () => {
      await m().tray.rename(npc, 'Scar')
    })
    expect(sent('mediator.updateNpc')).toEqual([{ npcId: 'n-1', patch: { name: 'Scar' } }])
  })

  test('marking a mech important gives it its reactor; unmarking sends the mark alone', async () => {
    const mule = {
      _id: 'n-mule',
      body: {
        name: 'Mule',
        refSchema: 'chassis',
        refSlug: 'mule',
        currentHp: 12,
        maxHp: 12,
        statKind: 'sp',
      },
    }
    const m = await mediator({ 'mediator.npcs': [mule] })
    const [npc] = m().npcs ?? []
    if (npc === undefined || npc.track?.reactor == null) throw new Error('no mech on the tray')
    await act(async () => {
      await m().tray.setImportant(npc, true)
      await m().tray.setImportant(npc, false)
    })
    expect(sent('mediator.updateNpc')).toEqual([
      {
        npcId: 'n-mule',
        patch: {
          important: true,
          maxEp: npc.track.reactor.maxEp,
          heatCap: npc.track.reactor.heatCap,
        },
      },
      { npcId: 'n-mule', patch: { important: false } },
    ])
  })
})

describe('fielding an encounter row’s roster', () => {
  test('each line is fielded as many times as it says, every one numbered; weather is skipped', async () => {
    const m = await mediator({ 'mediator.npcs': [] })
    const lines = readRoster(['2 × Contour Pattern Drop Bear', '1 × Radiation Storm'])
    let added = 0
    await act(async () => {
      added = await m().tray.field(lines)
    })
    expect(added).toBe(2)
    expect(bodies().map((b) => b.name)).toHaveLength(2)
    expect(new Set(bodies().map((b) => b.name)).size).toBe(2)
    expect(bodies()[0]).toMatchObject({ refSchema: 'chassis' })
  })

  test('a d20 line rolls how many, in the open, and fields that many', async () => {
    const m = await mediator({ 'mediator.npcs': [] })
    const [line] = readRoster(['2 × Contour Pattern Drop Bear'])
    if (line === undefined) throw new Error('no line')
    const rolled: { tableName?: string; label?: string; rolls: number[] }[] = []
    const stop = onPlayRoll((roll) => rolled.push(roll))
    let added = 0
    await act(async () => {
      added = await m().tray.field([{ ...line, count: 'd20' }])
    })
    stop()
    const [roll] = rolled
    expect(roll).toMatchObject({ tableName: 'd20', label: line.text })
    expect(added).toBe(roll?.rolls[0] ?? Number.NaN)
    expect(bodies()).toHaveLength(added)
  })
})

describe('when the room refuses', () => {
  const refuse = () =>
    answerActs(() => {
      throw new Error('Only the Mediator sets the Scene.')
    })

  test('setting the Scene says the room’s reason and still rejects', async () => {
    const m = await mediator()
    refuse()
    let failure: unknown = null
    await act(async () => {
      failure = await m()
        .scene.set(['darkness' as never])
        .then(
          () => null,
          (err: unknown) => err
        )
    })
    expect(failure).toBeInstanceOf(Error)
    expect(sent('scenes.setConditions')).toEqual([{ conditions: ['darkness'] }])
    expect(await said('Only the Mediator sets the Scene.')).toBeTruthy()
  })

  test('passing an hour says why and rejects, so no hour is announced', async () => {
    const m = await mediator()
    refuse()
    let failure: unknown = null
    await act(async () => {
      failure = await m()
        .scene.passHour()
        .then(
          () => null,
          (err: unknown) => err
        )
    })
    expect(failure).toBeInstanceOf(Error)
    expect(await said('Only the Mediator sets the Scene.')).toBeTruthy()
  })

  test('marking whose turn it is says why, and nothing waits on it', async () => {
    const m = await mediator()
    refuse()
    await act(async () => {
      await m().scene.setUpNow('bonesaw')
    })
    expect(sent('scenes.setUpNow')).toEqual([{ pilotId: 'bonesaw' }])
    expect(await said('Only the Mediator sets the Scene.')).toBeTruthy()
  })

  test('accepted, the Scene’s writes resolve and say nothing', async () => {
    const m = await mediator()
    answerActs(({ name }) => (name === 'scenes.passHour' ? 3 : null))
    let hour = 0
    await act(async () => {
      await m().scene.set([])
      await m().scene.setUpNow(null)
      hour = await m().scene.passHour()
    })
    expect(hour).toBe(3)
    expect(screen.queryByText(/did not reach|Only the Mediator/)).toBeNull()
  })
})

describe('the Game’s crawler', () => {
  const listingWith = (body: unknown, appId: string | null = 'c-1') => ({
    pilots: [],
    mechs: [],
    npcs: [],
    softLinks: [],
    crawlers: [{ _id: 's-c1', appId, ownerId: 'u-rook', body }],
    primaryCrawlerId: 's-c1',
  })

  test('one the Mediator does not hold is read from the Game’s listing, and may not be written', async () => {
    const m = await mediator({
      'games.listing': listingWith(crawlerFixture({ id: 'c-1', name: 'The Long Haul' })),
    })
    expect(m().crawler).toMatchObject({
      held: false,
      crawler: { id: 'c-1', name: 'The Long Haul' },
    })
  })

  test('one the Mediator holds is their own copy, which they may write', async () => {
    await act(async () => {
      await useUnits.getState().adopt('crawler', crawlerFixture({ id: 'c-1', name: 'Held' }))
    })
    const m = await mediator({
      'games.listing': listingWith(crawlerFixture({ id: 'c-1', name: 'Stale' })),
    })
    expect(m().crawler).toMatchObject({ held: true, crawler: { name: 'Held' } })
    await act(async () => {
      await useUnits.getState().forget('crawler', 'c-1')
    })
  })

  test('a listing whose crawler does not read is no crawler', async () => {
    const m = await mediator({ 'games.listing': listingWith({ nonsense: true }) })
    expect(m().crawler).toBeNull()
  })
})
