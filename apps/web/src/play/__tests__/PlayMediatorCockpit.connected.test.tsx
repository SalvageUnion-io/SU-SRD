/**
 * The Mediator's Play screen (`PlayMediatorCockpit`, play.md §10) against answered queries: the bar
 * (MEDIATOR, "3 of 4 here", Scene / Downtime, Tell the table), the table's
 * seats (presence, mount, every vital, ▲, what they are doing) and the live
 * crawler, the Opposition (HP / SP, Morale, Rename, Remove, + Add, the chosen
 * NPC's actions), Downtime (the track, who is done, Back, Advance, End,
 * Upkeep), and the right column (Tables private by default, the Feed, the
 * Propose dock aimed by a seat).
 *
 * The last block walks every capability the Mediator holds to where it lives
 * here, one test each.
 *
 * The Game room's records are served from what each read answers
 * (`fakeRooms.ts`), the Games reads by name (`serverMock.ts`); every act is
 * recorded by name, and so is every server commit the store makes (the Game's log
 * included), so a Mediator roll can be shown to stay off it.
 */

import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  mock,
  spyOn,
  test,
} from 'bun:test'
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { CRAFT_STEP_NAME, downtimeStepNames } from 'game-domain/rules/downtime'
import { crawlerFixture } from '../../components/__tests__/fixtures'
import type { QueryAnswers } from '../../components/__tests__/serverMock'
import { installServerMocks, setQueryAnswers } from '../../components/__tests__/serverMock'
import {
  acts,
  answerActs,
  closeRooms,
  openRooms,
  serveReads,
} from '../../replica/__tests__/fakeRooms'
import { MEDIATOR_MEMBERS, MEDIATOR_SEATS, mediatorCrewAt, TABLE_HERE } from './mediatorFixture'
import { narrowViewport } from './narrowViewport'

const LOG = 'changeLog.appendChangeLog'
/** Every act the Game's room was sent, its name and args; a roll's log row is `logged()`'s. */
const sent = () => acts.filter((a) => a.name !== LOG).map(({ name, args }) => ({ name, args }))
/** The rows this screen's rolls put on the Game's log. */
const logged = () =>
  acts
    .filter((a) => a.name === LOG)
    .flatMap(
      (a) =>
        (
          a.args as {
            entries: {
              field: string
              after: { description: string; private?: true; veiled?: string }
            }[]
          }
        ).entries
    )
const postRoll = mock(async (_args: unknown) => ({
  kind: 'posted',
  channelId: 'c-1',
  messageId: 'm-1',
}))

/** What the room answers each act this screen sends. */
function answerAct({ name }: { name: string }): unknown {
  if (name === 'mediator.runEncounter') return { added: 1 }
  if (name === 'scenes.passHour') return 3
  return name === 'downtime.claim' ? true : null
}

const serverMocks = await installServerMocks({
  call: (name, args) => (name === 'channelBindings.postRoll' ? postRoll(args) : undefined),
  also: { '../../play/useGamePresence': () => ({ useGamePresence: () => TABLE_HERE }) },
})

const { PlayMediatorCockpit } = await import('../PlayMediatorCockpit')
const { SyncContext } = await import('../../replica/syncContext')
const { hydrateStores } = await import('../../components/__tests__/hydrateStores')
const { useUnits } = await import('../../replica/units')
const { clearPlayRolls } = await import('../playRolls.model')
const { useEncounters } = await import('../../replica/collections')
const { withSignedInBackend } = await import('../../replica/__tests__/signedInBackend')
const { PLAY_TXN } = await import('../../replica/provenance')

withSignedInBackend()

afterAll(serverMocks.restore)
beforeEach(() => {
  openRooms(GAME)
  answerActs(answerAct)
})
afterEach(() => {
  cleanup()
  closeRooms()
  clearPlayRolls()
  postRoll.mockClear()
})

const NOW = Date.now()
const GAME = 'g-rust'
const UPKEEP_STEP = 1
const tenacity = crawlerFixture({
  id: 'med-tenacity',
  name: 'Tenacity',
  techLevel: 2,
  currentSP: 18,
  scrapPool: { tl2: 7 },
})

beforeAll(async () => {
  await hydrateStores()
  await useUnits.getState().adopt('crawler', tenacity)
})

const NPCS = [
  {
    _id: 'n-strike',
    body: {
      name: 'Strikebreaker',
      refSchema: 'npcs',
      refSlug: 'super-android-strikebreaker',
      currentHp: 10,
      maxHp: 15,
      statKind: 'hp',
    },
  },
  {
    _id: 'n-scylla',
    body: {
      name: 'Scylla',
      refSchema: 'bio-titans',
      refSlug: 'scylla',
      currentHp: 30,
      maxHp: 39,
      statKind: 'sp',
    },
  },
  {
    _id: 'n-raider',
    body: { name: 'Raider', refSchema: 'npcs', refSlug: 'raider', currentHp: 0, maxHp: 3 },
  },
]

const HAULER = {
  _id: 'n-hauler',
  body: {
    name: 'Hauler',
    refSchema: 'chassis',
    refSlug: 'mule',
    currentHp: 12,
    maxHp: 12,
    statKind: 'sp',
    important: true,
    currentEp: 4,
    maxEp: 4,
    currentHeat: 2,
    heatCap: 6,
  },
}

const HAULER_CRITICAL = {
  ...HAULER,
  body: {
    ...HAULER.body,
    currentHp: 0,
    lastImportantRoll: {
      table: 'critical-damage',
      roll: 12,
      label: 'Core Damage',
      value: 'The chassis is damaged.',
      rolledAt: new Date(0).toISOString(),
    },
  },
}

const SENT_PROPOSAL = {
  _id: 'p-1',
  ts: NOW - 60_000,
  targetName: 'Rook',
  field: 'currentHP',
  after: 6,
  reason: null,
  state: 'pending',
  mine: true,
  actorName: 'GM',
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
      crawlers: [{ _id: 'c-ten', appId: 'med-tenacity', body: tenacity }],
      primaryCrawlerId: 'c-ten',
    },
    'scenes.current': { conditions: [], hours: 0 },
    'downtime.state': { running: false, stepIndex: null, completedBy: [], upkeepSpent: false },
    'mediator.npcs': NPCS,
    'mediator.amMediator': true,
    'mediator.patterns': [],
    'mediator.running': null,
    'salvageAreas.here': null,
    'ops.sent': [SENT_PROPOSAL],
    'changeLog.alerts': [{ _id: 'a-1', message: 'Contact front', ts: NOW - 30_000 }],
    'changeLog.rolls': [
      {
        _id: 'r-1',
        ts: NOW - 20_000,
        description: 'Mags · Core Mechanic · 20 · Nailed it',
        actorName: 'Mags',
        source: 'play',
      },
    ],
    'channelBindings.current': { channelId: 'c-1', boundAt: 1 },
    'games.listMine': [],
    'safety.stopSign': null,
    'account.me': { _id: 'u-gm', displayName: 'GM', avatarUrl: null, email: null },
    ...over,
  }
}

function downtimeAt(stepIndex: number, upkeepSpent = false): QueryAnswers {
  return {
    'downtime.state': {
      running: true,
      stepIndex,
      completedBy: [
        { userId: 'u-mags', displayName: 'Mags' },
        { userId: 'u-rook', displayName: 'Teo' },
      ],
      upkeepSpent,
    },
  }
}

async function renderCockpit(over: QueryAnswers = {}, canWrite = true, die = 14) {
  const all = answers(over)
  setQueryAnswers(all)
  serveReads(GAME, all)
  await act(async () => {
    render(
      <SyncContext.Provider
        value={{
          status: canWrite ? 'live' : 'offline',
          canWrite,
          outdated: false,
        }}
      >
        <PlayMediatorCockpit
          gameId={GAME}
          gameName="The Rust Belt Run"
          rollFor={async () => () => die}
        />
      </SyncContext.Provider>
    )
  })
}

/** Put the crawler back as the fixture had it, after a test hauls salvage into it. */
async function restoreCrawler() {
  await act(async () => {
    useUnits.getState().update(
      'crawler',
      tenacity.id,
      {
        cargoLots: tenacity.cargoLots ?? [],
        scrapPool: tenacity.scrapPool,
      },
      PLAY_TXN
    )
  })
}

async function click(el: HTMLElement) {
  await act(async () => {
    fireEvent.click(el)
  })
}

const named = (name: string | RegExp) => screen.getByRole('button', { name })
const region = (name: string) => within(screen.getByRole('region', { name }))
const names = () => sent().map((s) => s.name)
const feedLines = () =>
  within(screen.getByRole('list', { name: 'Feed' }))
    .getAllByRole('listitem')
    .map((li) => li.textContent ?? '')

describe('the bar', () => {
  test('the Mediator stamp, the Game’s name, and LIVE "3 of 4 here"', async () => {
    await renderCockpit()
    const bar = within(screen.getByRole('banner'))
    expect(bar.getByRole('heading', { name: 'The Rust Belt Run' })).toBeTruthy()
    expect(bar.getByText('Mediator')).toBeTruthy()
    expect(bar.getByText('● Online · 3 of 4 here')).toBeTruthy()
    expect(bar.getByRole('button', { name: 'Game channel: where rolls post' })).toBeTruthy()
  })

  test('Begin Downtime asks once, then starts it for the whole table (r2 E2)', async () => {
    await renderCockpit()
    const state = within(screen.getByRole('group', { name: 'Game state' }))
    expect(state.getByRole('button', { name: 'Scene' }).getAttribute('aria-pressed')).toBe('true')
    await click(state.getByRole('button', { name: 'Begin Downtime' }))
    expect(names()).toEqual([])
    const ask = within(screen.getByRole('alertdialog', { name: 'Begin Downtime?' }))
    await click(ask.getByRole('button', { name: 'Begin Downtime' }))
    expect(names()).toEqual(['downtime.begin'])
  })

  test('while Downtime runs no seat reads Boarded: a seat aboard is in the Mech Bay (r2 E2)', async () => {
    await renderCockpit(downtimeAt(2))
    const seats = within(screen.getByRole('list', { name: 'Seats' }))
    expect(seats.queryByText(/Boarded · /)).toBeNull()
    expect(seats.getAllByText(/^In the Mech Bay · /).length).toBeGreaterThan(0)
  })

  test('running, it names the step; Scene ends it, asking first before the last step', async () => {
    await renderCockpit(downtimeAt(2))
    const state = within(screen.getByRole('group', { name: 'Game state' }))
    expect(state.getByRole('button', { name: 'Downtime · Step 3' })).toBeTruthy()
    await click(state.getByRole('button', { name: 'Scene' }))
    expect(names()).toEqual([])
    await click(
      within(screen.getByRole('alertdialog')).getByRole('button', { name: 'End Downtime' })
    )
    expect(names()).toEqual(['downtime.end'])
  })

  test('Tell the table sends one word to every player', async () => {
    await renderCockpit()
    // The dialog focuses on the next frame; the frame is run here, so the
    // test waits on no timer.
    const frame = spyOn(globalThis, 'requestAnimationFrame').mockImplementation((run) => {
      run(0)
      return 0
    })
    await click(named('Tell the table'))
    frame.mockRestore()
    const dialog = within(screen.getByRole('dialog', { name: 'Tell the table' }))
    expect(dialog.getByText('Contact front')).toBeTruthy()
    // Typing starts in the alert, not on Close (MD2-04).
    expect(document.activeElement === dialog.getByLabelText('Alert')).toBe(true)
    await act(async () => {
      fireEvent.change(dialog.getByLabelText('Alert'), { target: { value: 'Two squads east' } })
    })
    await click(dialog.getByRole('button', { name: 'Send' }))
    expect(sent()).toEqual([{ name: 'changeLog.broadcast', args: { message: 'Two squads east' } }])
  })
})

describe('the Scene', () => {
  const STORM = { 'scenes.current': { conditions: ['radiation-storm'], hours: 2 } }

  test('every condition is a toggle; pressing one puts the Scene under it', async () => {
    await renderCockpit()
    const storm = named('The Scene is under Radiation Storm')
    expect(storm.getAttribute('aria-pressed')).toBe('false')
    expect(named('An hour passes').hasAttribute('disabled')).toBe(true)
    await click(storm)
    expect(sent()).toEqual([
      { name: 'scenes.setConditions', args: { conditions: ['radiation-storm'] } },
    ])
  })

  test('pressed again, it lifts', async () => {
    await renderCockpit(STORM)
    const storm = named('The Scene is under Radiation Storm')
    expect(storm.getAttribute('aria-pressed')).toBe('true')
    await click(storm)
    expect(sent()).toEqual([{ name: 'scenes.setConditions', args: { conditions: [] } }])
  })

  test('an hour passes: each exposed unit is proposed its cost, and the table is told the rest', async () => {
    await renderCockpit(STORM)
    await click(named('An hour passes'))
    const dialog = within(screen.getByRole('alertdialog'))
    expect(screen.getByRole('alertdialog', { name: 'Pass hour 3?' })).toBeTruthy()
    // Wren sheltered in the crawler: untick them.
    await click(dialog.getByLabelText('Wren’s Mule · Radiation Storm'))
    await click(dialog.getByRole('button', { name: 'An hour passes' }))
    expect(names()[0]).toBe('scenes.passHour')
    const proposals = sent()
      .filter((s) => s.name === 'ops.propose')
      .map((s) => s.args)
    expect(proposals).toContainEqual({
      entityId: 'row-buzzard',
      entityType: 'mech',
      field: 'currentSP',
      after: 12,
      reason: 'Radiation Storm, hour 3',
    })
    expect(proposals).toContainEqual({
      entityId: 'row-buzzard',
      entityType: 'mech',
      field: 'currentHeat',
      after: 5,
      reason: 'Radiation Storm, hour 3',
    })
    // Rook on foot takes no SP and no HP: a Major Injury is theirs to mark.
    expect(proposals.some((p) => p.entityId === 'row-rook')).toBe(false)
    expect(proposals.some((p) => p.entityId === 'row-mule')).toBe(false)
    const alert = sent().find((s) => s.name === 'changeLog.broadcast')?.args.message
    expect(alert).toBe(
      'Hour 3 under Radiation Storm. Bonesaw’s Buzzard: make a Heat Check. Mags’s Atlas: make a Heat Check. Rook: suffer a Major Injury.'
    )
  })

  test('Freezing rolls each exposed Mech’s table; cold erosion is proposed as SP', async () => {
    await renderCockpit({ 'scenes.current': { conditions: ['freezing'], hours: 0 } })
    await click(named('An hour passes'))
    await click(
      within(screen.getByRole('alertdialog')).getByRole('button', { name: 'An hour passes' })
    )
    // The dice read 14: 11–19, 1 SP from cold erosion.
    const sp = sent()
      .filter((s) => s.name === 'ops.propose' && s.args.entityId === 'row-buzzard')
      .map((s) => [s.args.field, s.args.after])
    expect(sp).toEqual([['currentSP', 13]])
    const alert = String(sent().find((s) => s.name === 'changeLog.broadcast')?.args.message)
    expect(alert).toContain(
      'Bonesaw’s Buzzard: Freezing 14: The Mech takes 1 SP damage from cold erosion.'
    )
  })
})

describe('the table', () => {
  test('a seat per player: presence, mount Mini, every vital, ▲ on what needs the Mediator', async () => {
    await renderCockpit()
    const seats = within(screen.getByRole('list', { name: 'Seats' }))
    const items = seats.getAllByRole('listitem').filter((li) => li.className === 'su-play-seat')
    expect(items).toHaveLength(4)
    const bonesaw = within(items[0] as HTMLElement)
    expect(bonesaw.getByText('Buzzard')).toBeTruthy()
    // SP is on the mount Mini too.
    for (const chip of ['HP', 'AP', 'SP', 'EP', 'Heat']) {
      expect(bonesaw.getAllByText(chip).length).toBeGreaterThan(0)
    }
    expect(bonesaw.getByText('Bonesaw is resolving 120mm Cannon: activated')).toBeTruthy()
    const rook = items[2] as HTMLElement
    expect(rook.dataset.attention).toBe('true')
    // The ▲ vital is a chip on the seat's Mini, and again among every vital in its body.
    expect(within(rook).getAllByText('▲ HP')).toHaveLength(2)
    expect(within(rook).getByText('Injured')).toBeTruthy()
  })

  test('a seat that stopped beating is away, and says where it was last seen', async () => {
    await renderCockpit()
    const wren = screen
      .getByRole('button', { name: /^Wren \(Pilot\), away/ })
      .closest('li') as HTMLElement
    expect(wren.dataset.away).toBe('true')
    expect(within(wren).getByText('Last seen Boarded · Mule')).toBeTruthy()
  })

  test('tapping a seat aims Propose at that pilot and focuses its number; Change opens on Take, so a typed 3 is 3 damage (r4 D2)', async () => {
    await renderCockpit()
    await click(screen.getByRole('button', { name: /^Rook \(Pilot\), here/ }))
    const dock = region('Propose')
    expect((dock.getByLabelText('Target') as HTMLSelectElement).value).toBe('row-rook')
    expect((dock.getByLabelText('Change') as HTMLSelectElement).value).toBe('take')
    expect(document.activeElement).toBe(dock.getByLabelText('Amount'))
    await act(async () => {
      fireEvent.change(dock.getByLabelText('Amount'), { target: { value: '3' } })
    })
    await click(dock.getByRole('button', { name: 'Propose' }))
    // Rook is at 4 HP: taking 3 leaves 1, never "HP set to 3".
    expect(sent()).toEqual([
      {
        name: 'ops.propose',
        args: { entityId: 'row-rook', entityType: 'pilot', field: 'currentHP', after: 1 },
      },
    ])
  })

  test('Set to still proposes the value itself', async () => {
    await renderCockpit()
    await click(screen.getByRole('button', { name: /^Rook \(Pilot\), here/ }))
    const dock = region('Propose')
    await act(async () => {
      fireEvent.change(dock.getByLabelText('Change'), { target: { value: 'set' } })
    })
    await act(async () => {
      fireEvent.change(dock.getByLabelText('To'), { target: { value: '6' } })
    })
    await click(dock.getByRole('button', { name: 'Propose' }))
    expect(sent()[0]?.args).toMatchObject({ field: 'currentHP', after: 6 })
  })

  test('a Mech target can be proposed EP, between SP and Heat (r4 D2)', async () => {
    await renderCockpit()
    const dock = region('Propose')
    const target = dock.getByLabelText('Target') as HTMLSelectElement
    const atlas = [...target.options].find((o) => o.textContent === "Mags's Atlas")
    await act(async () => {
      fireEvent.change(target, { target: { value: atlas?.value } })
    })
    const field = dock.getByLabelText('Field') as HTMLSelectElement
    expect([...field.options].map((o) => o.textContent)).toEqual(['SP', 'EP', 'Heat'])
    await act(async () => {
      fireEvent.change(field, { target: { value: 'currentEP' } })
    })
    await act(async () => {
      fireEvent.change(dock.getByLabelText('Amount'), { target: { value: '2' } })
    })
    await click(dock.getByRole('button', { name: 'Propose' }))
    // Atlas holds 5 of 5 EP.
    expect(sent()[0]?.args).toMatchObject({ entityType: 'mech', field: 'currentEP', after: 3 })
  })

  test('Setbacks fills Propose with the book’s 2 HP default for the pilot aimed at', async () => {
    await renderCockpit()
    await click(screen.getByRole('button', { name: /^Rook \(Pilot\), here/ }))
    const dock = region('Propose')
    await click(dock.getByRole('button', { name: 'Setbacks' }))
    const dialog = within(screen.getByRole('dialog'))
    expect(dialog.getByRole('button', { name: '+2 Heat' }).hasAttribute('disabled')).toBe(true)
    await click(dialog.getByRole('button', { name: '2 HP damage' }))
    expect((dock.getByLabelText('Field') as HTMLSelectElement).value).toBe('currentHP')
    expect((dock.getByLabelText('Reason (optional)') as HTMLInputElement).value).toBe(
      'Setback: 2 HP damage'
    )
    expect((dock.getByLabelText('To') as HTMLInputElement).value).not.toBe('')
  })

  test('the crawler is the Units column’s box, live for the Mediator', async () => {
    await renderCockpit()
    const crawler = within(screen.getByRole('region', { name: 'Crawler: Tenacity' }))
    await click(crawler.getByRole('button', { name: 'Decrease SP' }))
    await waitFor(() => expect(useUnits.getState().get('crawler', tenacity.id)?.currentSP).toBe(17))
    expect(crawler.getByRole('button', { name: 'Open Tenacity’s sheet' })).toBeTruthy()
  })
})

describe('the Opposition', () => {
  test('each NPC, mech or Bio-Titan with its live HP or SP; − writes the tray', async () => {
    await renderCockpit()
    expect(screen.getByRole('region', { name: 'NPC: Strikebreaker' })).toBeTruthy()
    const scylla = within(screen.getByRole('region', { name: 'Bio-Titan: Scylla' }))
    await click(scylla.getByRole('button', { name: 'Decrease SP' }))
    expect(sent()).toEqual([
      { name: 'mediator.updateNpc', args: { npcId: 'n-scylla', patch: { currentHp: 29 } } },
    ])
  })

  test('a downed NPC is struck and dashed, never removed for you; Delete asks first', async () => {
    await renderCockpit()
    const raider = within(screen.getByRole('region', { name: 'NPC: Raider, down' }))
    expect(raider.getByText('At 0 · down')).toBeTruthy()
    await click(raider.getByRole('button', { name: 'Delete Raider' }))
    expect(names()).toEqual([])
    await click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Delete' }))
    expect(sent()).toEqual([{ name: 'mediator.removeNpc', args: { npcId: 'n-raider' } }])
  })

  test('a downed Vehicle breaks down for its Scrap into the crawler, claimed once', async () => {
    const tank = {
      _id: 'n-tank',
      body: {
        name: 'Tank',
        refSchema: 'vehicles',
        refSlug: 'tank',
        currentHp: 0,
        maxHp: 6,
        statKind: 'sp',
      },
    }
    await renderCockpit({ 'mediator.npcs': [tank] })
    const box = within(screen.getByRole('region', { name: 'Vehicle: Tank, down' }))
    await click(box.getByRole('button', { name: 'Break it down: 4 Tech 3 Scrap to the crawler' }))
    await waitFor(() =>
      expect(useUnits.getState().get('crawler', tenacity.id)?.scrapPool?.tl3).toBe(4)
    )
    expect(sent()).toEqual([
      { name: 'mediator.updateNpc', args: { npcId: 'n-tank', patch: { salvaged: true } } },
    ])
    await restoreCrawler()
  })

  test('a downed Mech rolls Mech Salvage; what the band allows goes to the crawler’s hold', async () => {
    const mule = {
      _id: 'n-mule',
      body: {
        name: 'Mule',
        refSchema: 'chassis',
        refSlug: 'mule',
        currentHp: 0,
        maxHp: 12,
        statKind: 'sp',
      },
    }
    await renderCockpit({ 'mediator.npcs': [mule] })
    const box = within(screen.getByRole('region', { name: /^Mech: Mule, down/ }))
    await click(box.getByRole('button', { name: /Roll/ }))
    await click(box.getByRole('button', { name: 'Mule · T1 · 7 Slots' }))
    await click(box.getByRole('button', { name: 'Take to the crawler' }))
    await waitFor(() =>
      expect(
        useUnits
          .getState()
          .get('crawler', tenacity.id)
          ?.cargoLots?.some((c) => c.name === 'Mule (Damaged)')
      ).toBe(true)
    )
    expect(names()).toEqual(['mediator.updateNpc'])
    await restoreCrawler()
  })

  test('a salvaged wreck says nothing is left to take', async () => {
    const tank = {
      _id: 'n-tank',
      body: {
        name: 'Tank',
        refSchema: 'vehicles',
        refSlug: 'tank',
        currentHp: 0,
        maxHp: 6,
        statKind: 'sp',
        salvaged: true,
      },
    }
    await renderCockpit({ 'mediator.npcs': [tank] })
    expect(screen.getByText('Salvaged: nothing is left to take.')).toBeTruthy()
  })

  test('Area sets the area being salvaged; its line names it and Clear clears it', async () => {
    await renderCockpit({ 'salvageAreas.here': { name: 'Raider Camp', techLevel: 2, supply: 4 } })
    expect(screen.getByText('Raider Camp · T2 · Supply 4')).toBeTruthy()
    await click(named('Clear the area being salvaged'))
    expect(sent()).toEqual([{ name: 'salvageAreas.set', args: { area: null } }])
    acts.length = 0
    await click(named('Set the area being salvaged'))
    await click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Set' }))
    expect(names()).toEqual(['salvageAreas.set'])
  })

  test('Actions opens a unit’s actions inside its own card, each on its own; none is open until asked for (r4 D1)', async () => {
    await renderCockpit()
    expect(screen.queryByRole('list', { name: /’s actions$/ })).toBeNull()
    await click(named('Scylla’s actions'))
    expect(named('Scylla’s actions').getAttribute('aria-pressed')).toBe('true')
    const scylla = screen.getByRole('list', { name: 'Scylla’s actions' })
    // In the card: the unit's own list item holds its box and its actions.
    const card = scylla.closest('.su-play-npc') as HTMLElement
    expect(within(card).getByRole('region', { name: /Scylla/ })).toBeTruthy()
    // Another unit's opens beside it; Scylla's stays where it was.
    await click(named('Strikebreaker’s actions'))
    expect(screen.getByRole('list', { name: 'Scylla’s actions' })).toBe(scylla)
    expect(
      screen.getByRole('list', { name: 'Strikebreaker’s actions' }).closest('.su-play-npc')
    ).not.toBe(card)
    // Pressed again, it shuts.
    await click(named('Scylla’s actions'))
    expect(screen.queryByRole('list', { name: 'Scylla’s actions' })).toBeNull()
    expect(named('Scylla’s actions').getAttribute('aria-pressed')).toBe('false')
  })

  test('a weapon’s roll offers its hit: Propose 3 HP to…, the Pilots listed, and a seat pressed is proposed it (r4 D2)', async () => {
    await renderCockpit({
      'mediator.npcs': [
        {
          _id: 'n-raider',
          body: { name: 'Raider', refSchema: 'npcs', refSlug: 'raider', currentHp: 3, maxHp: 3 },
        },
      ],
    })
    await click(named('Raider’s actions'))
    const list = within(screen.getByRole('list', { name: 'Raider’s actions' }))
    // Nothing is offered before the roll.
    await click(list.getByRole('button', { name: /^Use Improvised Firearm.* for Raider$/ }))
    expect(screen.queryByRole('button', { name: /^Propose 3 HP/ })).toBeNull()
    await click(list.getByRole('button', { name: 'Roll the die on NPC Action' }))
    const offer = await screen.findByRole('button', { name: 'Propose 3 HP from Raider to…' })
    expect(offer.textContent).toContain('Propose 3 HP to…')
    acts.length = 0
    await click(offer)
    // HP damage goes to Pilots, never to a Mech; each says what it is left with.
    const seats = screen.getAllByRole('menuitem').map((item) => item.textContent)
    expect(seats.some((s) => s?.startsWith('Rook') && s.includes('HP 4 → 1'))).toBe(true)
    expect(seats.some((s) => s?.includes('Buzzard'))).toBe(false)
    await click(screen.getByRole('menuitem', { name: /^Rook/ }))
    await waitFor(() =>
      expect(sent()).toEqual([
        {
          name: 'ops.propose',
          args: {
            entityId: 'row-rook',
            entityType: 'pilot',
            field: 'currentHP',
            after: 1,
            reason: 'Raider · Improvised Firearm (Raider)',
          },
        },
      ])
    )
  })

  test('a miss offers no hit: the table’s Failure rows propose nothing (r4 D2)', async () => {
    await renderCockpit(
      {
        'mediator.npcs': [
          {
            _id: 'n-raider',
            body: { name: 'Raider', refSchema: 'npcs', refSlug: 'raider', currentHp: 3, maxHp: 3 },
          },
        ],
      },
      true,
      3
    )
    await click(named('Raider’s actions'))
    const list = within(screen.getByRole('list', { name: 'Raider’s actions' }))
    await click(list.getByRole('button', { name: /^Use Improvised Firearm.* for Raider$/ }))
    await click(list.getByRole('button', { name: 'Roll the die on NPC Action' }))
    await waitFor(() => expect(list.getByText('3 · Failure')).toBeTruthy())
    expect(screen.queryByRole('button', { name: /^Propose 3 HP/ })).toBeNull()
  })

  test('a unit’s actions, flattened; Use opens the NPC Action table, its roll lands on the Feed, the Game’s log and Discord', async () => {
    await renderCockpit()
    await click(named('Strikebreaker’s actions'))
    const list = within(screen.getByRole('list', { name: 'Strikebreaker’s actions' }))
    await click(
      list.getAllByRole('button', { name: /^Use .* for Strikebreaker$/ })[0] as HTMLElement
    )
    // One roll control: the table's stamp (R8).
    await click(list.getByRole('button', { name: 'Roll the die on NPC Action' }))
    await waitFor(() =>
      expect(feedLines().some((l) => /^You · Strikebreaker · .* · 14 · Success/.test(l))).toBe(true)
    )
    expect(postRoll).toHaveBeenCalledTimes(1)
    // On the Game's log, so the players' Feeds show it and a reload keeps it (B8).
    await waitFor(() => expect(logged()).toHaveLength(1))
    expect(logged()[0]?.field).toBe('roll')
    expect(logged()[0]?.after.description).toMatch(/^Mediator · Strikebreaker · /)
    expect(logged()[0]?.after).not.toHaveProperty('private')
    // The players' line names neither the NPC nor its weapon (r2 B1).
    expect(logged()[0]?.after.veiled).toBe('Mediator rolled · 14 · Success')
    // Nor does the bot's card: the Mediator's carries its table alone.
    expect(JSON.stringify(postRoll.mock.calls[0])).not.toContain('Strikebreaker')
  })

  test('a veiled roll says the players miss its names, and Reveal shows the table the whole line (r2 B1)', async () => {
    await renderCockpit({
      'changeLog.events': [
        {
          _id: 'e-veiled',
          ts: NOW - 1000,
          kind: 'roll',
          text: 'Mediator · Strikebreaker · Fists · 9 · Tough Choice',
          actorId: 'u-gm',
          veiled: true,
        },
      ],
    })
    expect(feedLines().some((l) => l.includes('Players see the result, not the names'))).toBe(true)
    await click(named(/^Reveal to the table: /))
    expect(sent()).toEqual([{ name: 'changeLog.reveal', args: { rollId: 'e-veiled' } }])
  })

  test('a private roll says only the Mediator sees it, never that players saw the result, and Reveal sends it (r3 A1)', async () => {
    await renderCockpit({
      'changeLog.events': [
        {
          _id: 'e-private',
          ts: NOW - 1000,
          kind: 'roll',
          text: 'Mediator · Strikebreaker · Fists · 15 · Success',
          actorId: 'u-gm',
          private: true,
          veiled: true,
        },
      ],
    })
    const line = feedLines().find((l) => l.includes('Strikebreaker · Fists')) ?? ''
    expect(line).toContain('· Private')
    expect(line).toContain('Only the Mediator sees this roll')
    expect(line).not.toContain('Players see the result')
    await click(named(/^Reveal to the table: /))
    expect(sent()).toEqual([{ name: 'changeLog.reveal', args: { rollId: 'e-private' } }])
  })

  test('Private rolls on: the roll is logged private, reads Private on the Feed and never reaches Discord', async () => {
    await renderCockpit()
    await click(named('Private rolls'))
    expect(named('Private rolls').getAttribute('aria-pressed')).toBe('true')
    await click(named('Strikebreaker’s actions'))
    await click(named('Roll the die on Morale'))
    await waitFor(() =>
      expect(feedLines().some((l) => /^You · Strikebreaker · Morale · .* · Private/.test(l))).toBe(
        true
      )
    )
    await waitFor(() => expect(logged()).toHaveLength(1))
    expect(logged()[0]?.after.private).toBe(true)
    expect(postRoll).not.toHaveBeenCalled()
  })

  test('Private rolls is remembered for the Game across a reload, and sits in the Rolls head (r2 B2)', async () => {
    await renderCockpit()
    await click(named('Private rolls'))
    cleanup()
    await renderCockpit()
    const again = named('Private rolls')
    expect(again.getAttribute('aria-pressed')).toBe('true')
    expect(again.closest('section')?.querySelector('h2')?.textContent).toBe('Rolls')
    // And the next roll after the reload is private at once.
    await click(named('Strikebreaker’s actions'))
    await click(named('Roll the die on Morale'))
    await waitFor(() => expect(logged()).toHaveLength(1))
    expect(logged()[0]?.after.private).toBe(true)
    await click(again)
    cleanup()
    await renderCockpit()
    expect(named('Private rolls').getAttribute('aria-pressed')).toBe('false')
  })

  test('a roll made before a reload is on the Feed from the Game’s log', async () => {
    await renderCockpit({
      'changeLog.rolls': [
        {
          _id: 'r1',
          ts: NOW - 1000,
          source: 'play',
          description: 'Mediator · Strikebreaker · Morale · 4 · Holds',
          actorName: 'Med',
          private: true,
        },
      ],
    })
    expect(
      feedLines().some((l) => l.startsWith('You · Strikebreaker · Morale · 4 · Holds · Private'))
    ).toBe(true)
  })

  test('Up now marks a seat for the table, and pressing it again clears it', async () => {
    await renderCockpit()
    const first = screen.getAllByRole('button', { name: /^Mark up now: / })[0] as HTMLElement
    expect(first.getAttribute('aria-pressed')).toBe('false')
    await click(first)
    expect(sent()).toHaveLength(1)
    expect(sent()[0]?.name).toBe('scenes.setUpNow')
    const marked = String(sent()[0]?.args.pilotId)
    cleanup()
    acts.length = 0
    await renderCockpit({ 'scenes.current': { conditions: [], hours: 0, upNow: marked } })
    const again = screen.getAllByRole('button', { name: /^Mark up now: / })[0] as HTMLElement
    expect(again.getAttribute('aria-pressed')).toBe('true')
    await click(again)
    expect(sent()).toEqual([{ name: 'scenes.setUpNow', args: { pilotId: null } }])
  })

  test('Morale rolls on the Morale table, kept on the NPC and on the Feed', async () => {
    await renderCockpit()
    await click(named('Strikebreaker’s actions'))
    await click(named('Roll the die on Morale'))
    await waitFor(() => expect(names()).toEqual(['mediator.updateNpc']))
    const patch = sent()[0]?.args.patch as { lastMediatorRoll?: { table: string } }
    expect(patch.lastMediatorRoll?.table).toBe('morale')
    await waitFor(() =>
      expect(feedLines().some((l) => l.startsWith('You · Strikebreaker · Morale'))).toBe(true)
    )
  })

  test('Mark important is the NPC’s ⋯ menu; a Bio-Titan keeps its own rules', async () => {
    await renderCockpit()
    await click(named('More for Strikebreaker'))
    await click(screen.getByRole('menuitem', { name: 'Mark important' }))
    expect(sent()).toEqual([
      { name: 'mediator.updateNpc', args: { npcId: 'n-strike', patch: { important: true } } },
    ])
    await click(named('More for Scylla'))
    expect(screen.queryByRole('menuitem', { name: 'Mark important' })).toBeNull()
  })

  test('an important mech tracks EP and Heat, and its Heat Check lands on the NPC and the Feed', async () => {
    await renderCockpit({ 'mediator.npcs': [...NPCS, HAULER] })
    const hauler = within(screen.getByRole('region', { name: 'Mech: Hauler' }))
    expect(hauler.getByText('Mech · important')).toBeTruthy()
    await click(hauler.getByRole('button', { name: 'Increase Heat' }))
    expect(sent()).toEqual([
      { name: 'mediator.updateNpc', args: { npcId: 'n-hauler', patch: { currentHeat: 3 } } },
    ])
    acts.length = 0
    await click(hauler.getByRole('button', { name: 'Heat Check for Hauler' }))
    await waitFor(() => expect(names()).toEqual(['mediator.updateNpc']))
    const patch = sent()[0]?.args.patch as { lastImportantRoll?: { table: string } }
    expect(patch.lastImportantRoll?.table).toBe('heat-check')
    await waitFor(() =>
      expect(feedLines().some((l) => l.startsWith('You · Hauler · Heat Check'))).toBe(true)
    )
  })

  test('an important NPC at 0 rolls its Critical table, and the row reads on its box', async () => {
    const raider = NPCS[2] as (typeof NPCS)[number]
    const fallen = { ...raider, body: { ...raider.body, important: true } }
    await renderCockpit({ 'mediator.npcs': [fallen, HAULER_CRITICAL] })
    await click(named('Roll Critical Injury for Raider'))
    await waitFor(() => expect(names()).toEqual(['mediator.updateNpc']))
    const patch = sent()[0]?.args.patch as { lastImportantRoll?: { table: string } }
    expect(patch.lastImportantRoll?.table).toBe('critical-injury')
    const hauler = within(screen.getByRole('region', { name: 'Mech: Hauler, down' }))
    expect(hauler.getByText('Critical Damage 12 · Core Damage')).toBeTruthy()
  })

  test('+ Add opens the Opposition picker over the reference', async () => {
    await renderCockpit()
    await click(named('Add opposition from the reference'))
    expect(screen.getByRole('dialog', { name: 'Add opposition from the reference' })).toBeTruthy()
  })

  test('Run an encounter copies one of yours in, clearing the tray only when asked', async () => {
    useEncounters.setState({
      encounters: [
        {
          id: 'enc-1',
          schemaVersion: 1,
          name: 'Ambush',
          opposition: [],
          tables: ['Morale'],
          notes: '',
          createdAt: '2026-10-22T00:00:00.000Z',
          updatedAt: '2026-10-22T00:00:00.000Z',
        },
      ],
    })
    await renderCockpit()
    await click(named('Run an encounter'))
    const dialog = within(screen.getByRole('alertdialog', { name: 'Run an encounter' }))
    expect(dialog.getByText('0 opposition · 1 table')).toBeTruthy()
    await click(dialog.getByRole('radio', { name: /^Clear it first/ }))
    await click(dialog.getByRole('button', { name: 'Run Ambush' }))
    expect(sent().find((s) => s.name === 'mediator.runEncounter')?.args).toMatchObject({
      encounter: { id: 'enc-1', name: 'Ambush' },
      clear: true,
    })
    act(() => useEncounters.setState({ encounters: [] }))
  })

  test('with nothing prepped, Run an encounter points to the Mediator’s Kit', async () => {
    await renderCockpit()
    await click(named('Run an encounter'))
    const dialog = within(screen.getByRole('alertdialog', { name: 'Run an encounter' }))
    expect(dialog.getByRole('link', { name: 'Mediator’s Kit' })).toBeTruthy()
    await click(dialog.getAllByRole('button', { name: 'Close' }).at(-1) as HTMLElement)
    expect(sent().some((s) => s.name === 'mediator.runEncounter')).toBe(false)
  })

  test('a running encounter names itself, shows its notes, and End stops it', async () => {
    await renderCockpit({
      'mediator.running': {
        encounterId: 'enc-1',
        name: 'Ambush',
        tables: ['Morale'],
        notes: 'Behind the crusher.',
        startedAt: '2026-10-22T00:00:00.000Z',
      },
    })
    expect(screen.getByText('Behind the crusher.')).toBeTruthy()
    expect(screen.getByRole('list', { name: "This encounter's tables" })).toBeTruthy()
    await click(named('End Ambush'))
    // With opposition still out, End asks whether to clear it (ADR-007: never for you).
    await click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'End' }))
    expect(sent()).toContainEqual({ name: 'mediator.endEncounter', args: {} })
  })

  test('a briefing stays behind its flag, off in a production build', async () => {
    await renderCockpit({
      'mediator.running': {
        encounterId: 'enc-1',
        name: 'Ambush',
        tables: [],
        notes: '',
        briefing: 'Smoke rises from the crusher.',
        startedAt: '2026-10-22T00:00:00.000Z',
      },
    })
    expect(screen.queryByText('Smoke rises from the crusher.')).toBeNull()
  })
})

describe('Downtime', () => {
  test('the track, the step and who is done ("2 of 4 done")', async () => {
    await renderCockpit(downtimeAt(2))
    const track = within(screen.getByRole('list', { name: 'Downtime steps' }))
    expect(track.getByRole('button', { name: /^Step 3:/ }).getAttribute('aria-current')).toBe(
      'true'
    )
    expect(screen.getByText('2 of 4 done')).toBeTruthy()
    const who = within(screen.getByRole('list', { name: 'Who is done' }))
    expect(who.getAllByText('Done')).toHaveLength(2)
    expect(who.getByText('Away')).toBeTruthy()
    expect(
      within(screen.getByRole('list', { name: 'Seats' })).getAllByText('Step 3 · done ✓')
    ).toHaveLength(2)
  })

  test('Back puts the table on the step before; Next on the next', async () => {
    await renderCockpit(downtimeAt(2))
    await click(named('Back to Step 2'))
    await click(named('Next: Step 4'))
    expect(sent()).toEqual([
      { name: 'downtime.setStep', args: { stepIndex: 1 } },
      { name: 'downtime.advance', args: {} },
    ])
  })

  test('End Downtime before the last step asks first', async () => {
    await renderCockpit(downtimeAt(2))
    await click(named('End Downtime'))
    expect(names()).toEqual([])
    const dialog = within(screen.getByRole('alertdialog'))
    await click(dialog.getByRole('button', { name: 'End Downtime' }))
    expect(names()).toEqual(['downtime.end'])
  })

  test('at the last step, End Downtime is the way on and simply ends', async () => {
    await renderCockpit(downtimeAt(9))
    expect(screen.queryByRole('button', { name: /^Next: / })).toBeNull()
    await click(named('End Downtime'))
    expect(names()).toEqual(['downtime.end'])
  })

  test('Upkeep waits for Upkeep & Upgrade: Pay is off in any other step', async () => {
    await renderCockpit(downtimeAt(0))
    expect((named('Pay') as HTMLButtonElement).disabled).toBe(true)
  })

  test('in Upkeep & Upgrade, Pay sends the Scrap as the run’s one Upkeep op', async () => {
    await renderCockpit(downtimeAt(UPKEEP_STEP))
    await click(named('Pay'))
    await waitFor(() => expect(screen.getByText(/^Paid the Upkeep/)).toBeTruthy())
    expect(sent()).toMatchObject([
      {
        name: 'downtime.claim',
        args: {
          claim: 'upkeep',
          op: { unitId: tenacity.id, patch: { scrapPool: expect.objectContaining({ tl2: 2 }) } },
        },
      },
    ])
  })

  test('paid, it says so', async () => {
    await renderCockpit(downtimeAt(UPKEEP_STEP, true))
    expect(screen.queryByRole('button', { name: 'Pay' })).toBeNull()
    expect(screen.getByText('Paid')).toBeTruthy()
  })

  test('with a Nanite Processing Bay, Process Nanites runs in the Craft step', async () => {
    const store = useUnits.getState()
    const before = store.get('crawler', tenacity.id) ?? tenacity
    await store.adopt('crawler', {
      ...before,
      crawlerBays: [{ bayRef: 'nanite-processing-bay' }],
      scrapPool: { ...before.scrapPool, inertNanites: 2 },
    })
    try {
      await renderCockpit(downtimeAt(0))
      expect((named('Process') as HTMLButtonElement).disabled).toBe(true)
      cleanup()
      await renderCockpit(downtimeAt(downtimeStepNames().indexOf(CRAFT_STEP_NAME)))
      await click(named('Process'))
      await waitFor(() =>
        expect(screen.getByText(/^Processed 2 Inert Meld Nanite piles/)).toBeTruthy()
      )
      expect(sent()).toMatchObject([
        {
          name: 'downtime.claim',
          args: { claim: 'nanites', op: { patch: { scrapPool: { inertNanites: 0 } } } },
        },
      ])
    } finally {
      cleanup()
      await useUnits.getState().adopt('crawler', before)
    }
  })
})

describe('every Mediator capability is reachable here', () => {
  test('the way back to the Game page is ⋯ › Game page', async () => {
    await renderCockpit()
    await click(named('More'))
    expect(screen.getByRole('menuitem', { name: /Game page/ })).toBeTruthy()
  })

  test('the bar’s “‹ Game” goes back to the Game’s page (ADR-052 §6)', async () => {
    await renderCockpit()
    const bar = within(screen.getAllByRole('banner')[0] as HTMLElement)
    expect(bar.getByRole('link', { name: 'Back to Game' }).getAttribute('href')).toBe(
      `/games/${GAME}`
    )
  })

  test('the seats needing attention are the seats’ ▲ and rings', async () => {
    await renderCockpit()
    const flagged = document.querySelectorAll('.su-play-seat[data-attention]')
    expect(flagged).toHaveLength(1)
  })

  test('the foot is Play’s own, with no Opposition reminder on it', async () => {
    await renderCockpit()
    const foot = within(screen.getByRole('contentinfo'))
    expect(foot.queryByText(/Players see the Opposition/)).toBeNull()
  })

  test('The table: View a seat’s sheet is its Sheet', async () => {
    await renderCockpit()
    expect(named('Open Rook’s sheet')).toBeTruthy()
  })

  test('Crawler: no crawler says where to raise one', async () => {
    await renderCockpit({
      'games.listing': {
        pilots: [],
        mechs: [],
        npcs: [],
        softLinks: [],
        crawlers: [],
        primaryCrawlerId: null,
      },
    })
    // It points at the Game page's add controls, where a crawler is added.
    expect(
      screen.getByRole('link', { name: 'Add a crawler on the Game page' }).getAttribute('href')
    ).toBe(`/games/${GAME}#add-crew`)
  })

  test('Opposition: Rename is the NPC’s ⋯ menu', async () => {
    await renderCockpit()
    await click(named('More for Strikebreaker'))
    await click(screen.getByRole('menuitem', { name: 'Rename…' }))
    const dialog = within(screen.getByRole('alertdialog'))
    await act(async () => {
      fireEvent.change(dialog.getByLabelText('Name'), { target: { value: 'Red Leader' } })
    })
    await click(dialog.getByRole('button', { name: 'Rename' }))
    expect(sent()).toEqual([
      { name: 'mediator.updateNpc', args: { npcId: 'n-strike', patch: { name: 'Red Leader' } } },
    ])
  })

  test('Opposition: the full reference card is the NPC’s ⋯ › Reference card', async () => {
    await renderCockpit()
    await click(named('More for Strikebreaker'))
    expect(screen.getByRole('menuitem', { name: 'Reference card' })).toBeTruthy()
  })

  test('every proposal sent is Propose’s All proposals', async () => {
    await renderCockpit()
    await click(named('All proposals'))
    const dialog = within(screen.getByRole('dialog', { name: 'Proposals you sent' }))
    expect(dialog.getByText(/^Rook · HP → 6/)).toBeTruthy()
  })

  test('a pending proposal is withdrawn from All proposals; an answered one offers nothing (r2 C7)', async () => {
    await renderCockpit({
      'ops.sent': [
        { ...SENT_PROPOSAL, state: 'proposed' },
        { ...SENT_PROPOSAL, _id: 'p-0', targetName: 'Mags', state: 'applied' },
      ],
    })
    await click(named('All proposals'))
    const dialog = within(screen.getByRole('dialog', { name: 'Proposals you sent' }))
    expect(dialog.queryByRole('button', { name: /^Withdraw: Mags/ })).toBeNull()
    await click(dialog.getByRole('button', { name: /^Withdraw: Rook · HP → 6/ }))
    expect(sent()).toEqual([{ name: 'ops.withdraw', args: { opId: 'p-1' } }])
  })

  test('the roll tables are the Tables section, and its rolls post', async () => {
    await renderCockpit()
    expect(screen.getByText('Rolls post to the Game’s channel')).toBeTruthy()
    expect(screen.getByRole('list', { name: 'Pinned tables' })).toBeTruthy()
  })

  test('the Rules are a pane beside the board, so the ⋯ has no row for them', async () => {
    await renderCockpit()
    const side = within(screen.getByRole('region', { name: 'Rolls, Rules and Propose' }))
    // Shut until asked for, so Propose is on the first screen (r2 I2).
    expect(side.queryByLabelText('Search the Reference')).toBeNull()
    expect(side.getByRole('button', { name: 'Propose' })).toBeTruthy()
    await click(side.getByRole('button', { name: 'Open the Rules' }))
    expect(side.getByLabelText('Search the Reference')).toBeTruthy()
    await click(side.getByRole('button', { name: 'Close the Rules' }))
    expect(side.queryByLabelText('Search the Reference')).toBeNull()
    await click(named('More'))
    expect(screen.queryByRole('menuitem', { name: 'Rules' })).toBeNull()
  })

  test('the Game’s rolls and the alerts sent are the Feed', async () => {
    await renderCockpit()
    const lines = feedLines()
    expect(lines.some((l) => l.includes('Mags · Core Mechanic · 20 · Nailed it'))).toBe(true)
    expect(lines.some((l) => l.includes('Mediator · Contact front'))).toBe(true)
  })

  test('offline, every control is withdrawn and the bar says why', async () => {
    await renderCockpit({}, false)
    expect(within(screen.getByRole('banner')).getByText('Offline · read-only')).toBeTruthy()
    expect((named('Add opposition from the reference') as HTMLButtonElement).disabled).toBe(true)
    expect(
      (
        within(screen.getByRole('group', { name: 'Game state' })).getByRole('button', {
          name: 'Begin Downtime',
        }) as HTMLButtonElement
      ).disabled
    ).toBe(true)
  })
})

describe('below `lg`, on a phone (play.md §11)', () => {
  let restore = () => {}
  beforeEach(() => {
    restore = narrowViewport()
  })
  afterEach(() => restore())

  const phoneTab = (name: string) =>
    within(screen.getByRole('tablist', { name: 'Play' })).getByRole('tab', { name })
  /** The open panel: the one tabpanel not hidden. */
  const openPanel = () => {
    const open = screen.getAllByRole('tabpanel').filter((p) => !p.hidden)
    expect(open).toHaveLength(1)
    return within(open[0] as HTMLElement)
  }

  test('Table, Opposition, Tables, Propose under the pinned Scene / Downtime switch', async () => {
    await renderCockpit()
    expect(screen.queryByRole('region', { name: 'The table' })).toBeNull()
    const tabs = within(screen.getByRole('tablist', { name: 'Play' })).getAllByRole('tab')
    expect(tabs.map((t) => t.textContent)).toEqual(['Table', 'Opposition', 'Rolls', 'Propose'])
    const state = screen.getByRole('group', { name: 'Game state' })
    expect(state.closest('[role="tabpanel"]')).toBeNull()
    expect(openPanel().getByRole('heading', { name: 'The table' })).toBeTruthy()
    // The Feed, the table's log, runs under the Table.
    expect(openPanel().getByRole('heading', { name: 'Feed' })).toBeTruthy()
    await click(phoneTab('Opposition'))
    expect(openPanel().getAllByText('Strikebreaker').length).toBeGreaterThan(0)
    await click(phoneTab('Rolls'))
    expect(
      openPanel()
        .getAllByRole('heading', { level: 2 })
        .map((h) => h.textContent)
    ).toEqual(['Rolls'])
    await click(phoneTab('Propose'))
    expect(openPanel().getByRole('region', { name: 'Propose' })).toBeTruthy()
  })

  test('tapping a seat opens Propose, aimed at that pilot, with focus in To', async () => {
    await renderCockpit()
    await click(screen.getByRole('button', { name: /^Rook \(Pilot\), here/ }))
    expect(phoneTab('Propose').getAttribute('aria-selected')).toBe('true')
    const dock = within(openPanel().getByRole('region', { name: 'Propose' }))
    expect((dock.getByLabelText('Target') as HTMLSelectElement).value).toBe('row-rook')
    expect(document.activeElement).toBe(dock.getByLabelText('Amount'))
  })

  test('the running encounter’s Notes sit on the Opposition tab, under its name, not on Rolls (r4 D3)', async () => {
    await renderCockpit({
      'mediator.running': {
        encounterId: 'enc-1',
        name: 'Ambush',
        tables: [],
        notes: 'The gantry gives way on a Cascade Failure.',
        startedAt: '2026-10-22T00:00:00.000Z',
      },
    })
    await click(phoneTab('Opposition'))
    const panel = openPanel()
    const notes = panel.getByRole('heading', { name: 'Notes' })
    const name = panel.getByText('Ambush')
    expect(name.compareDocumentPosition(notes) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(panel.getByText('The gantry gives way on a Cascade Failure.')).toBeTruthy()
    await click(phoneTab('Rolls'))
    expect(openPanel().queryByRole('heading', { name: 'Notes' })).toBeNull()
  })

  test('skip links lead the screen: each opens its tab and moves focus into its pane (r4 D6)', async () => {
    await renderCockpit()
    const jumps = within(screen.getByRole('navigation', { name: 'Jump to' })).getAllByRole('link')
    expect(jumps.map((j) => j.textContent)).toEqual([
      'Skip to The table',
      'Skip to Opposition',
      'Skip to Rolls',
      'Skip to Propose a change',
    ])
    await click(jumps[1] as HTMLElement)
    expect(phoneTab('Opposition').getAttribute('aria-selected')).toBe('true')
    expect(document.activeElement?.getAttribute('role')).toBe('tabpanel')
    expect(within(document.activeElement as HTMLElement).getAllByText('Strikebreaker').length).toBe(
      1
    )
    await click(jumps[3] as HTMLElement)
    expect(phoneTab('Propose').getAttribute('aria-selected')).toBe('true')
    expect(
      within(document.activeElement as HTMLElement).getByRole('region', { name: 'Propose' })
    ).toBeTruthy()
  })

  test('in Downtime the second tab says so and holds the track', async () => {
    await renderCockpit(downtimeAt(2))
    await click(phoneTab('Downtime'))
    expect(openPanel().getByRole('list', { name: 'Downtime steps' })).toBeTruthy()
  })
})

describe('from `lg`: the Mediator’s jumps and notes', () => {
  test('the skip links come before everything else on the screen, and Notes head the end column', async () => {
    await renderCockpit({
      'mediator.running': {
        encounterId: 'enc-1',
        name: 'Ambush',
        tables: [],
        notes: 'Hold fire.',
        startedAt: '2026-10-22T00:00:00.000Z',
      },
    })
    const main = screen.getByRole('main')
    const first = main.querySelector('a, button') as HTMLElement
    expect(first.textContent).toBe('Skip to The table')
    await click(screen.getByRole('link', { name: 'Skip to Rolls' }))
    const pane = document.activeElement as HTMLElement
    expect(within(pane).getByRole('heading', { name: 'Rolls' })).toBeTruthy()
    // From `lg` the Notes stay in the end column, above the Rolls.
    expect(within(pane).getByRole('heading', { name: 'Notes' })).toBeTruthy()
    expect(
      within(screen.getByRole('region', { name: 'Opposition' })).queryByRole('heading', {
        name: 'Notes',
      })
    ).toBeNull()
  })
})
