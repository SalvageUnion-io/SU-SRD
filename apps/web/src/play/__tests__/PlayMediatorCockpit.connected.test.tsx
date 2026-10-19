/**
 * The Mediator's Play screen (`PlayMediatorCockpit`, play.md §10, wireframes
 * mediator-scene and mediator-downtime) against answered queries: the bar
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
 * Queries are answered by name (`convexMock.ts`); every mutation is recorded
 * by name, and so is every server commit the store makes (the Game's log
 * included), so a Mediator roll can be shown to stay off it.
 */

import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, mock, test } from 'bun:test'
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import type { FunctionReference } from 'convex/server'
import { getFunctionName } from 'convex/server'
import type { QueryAnswers } from '../../components/__tests__/convexMock'
import { installConvexMocks, setQueryAnswers } from '../../components/__tests__/convexMock'
import { crawlerFixture } from '../../components/__tests__/fixtures'
import { MEDIATOR_MEMBERS, MEDIATOR_SEATS, mediatorCrewAt } from './mediatorFixture'
import { phoneViewport } from './phoneViewport'

type Sent = { name: string; args: Record<string, unknown> }
const sent: Sent[] = []
const commits: string[] = []
const postRoll = mock(async (_args: unknown) => ({
  kind: 'posted',
  channelId: 'c-1',
  messageId: 'm-1',
}))

function useMutation(ref: unknown) {
  const name = getFunctionName(ref as FunctionReference<'mutation'>)
  const mutate = async (args: Record<string, unknown>) => {
    sent.push({ name, args })
    return name === 'downtime:spendUpkeep' ? true : null
  }
  return Object.assign(mutate, { withOptimisticUpdate: () => mutate })
}

const convexMocks = await installConvexMocks({
  convexReact: { useMutation, useAction: () => postRoll },
  convexClient: {
    mutation: async (ref: unknown) => {
      commits.push(getFunctionName(ref as FunctionReference<'mutation'>))
      return { updatedAt: 1 }
    },
  },
})

const { PlayMediatorCockpit } = await import('../PlayMediatorCockpit')
const { ConnectionContext } = await import('../../lib/connection/connectionContext')
const { hydrateStores } = await import('../../components/__tests__/hydrateStores')
const { useEntityStore } = await import('../../stores/entityStore')
const { clearPlayRolls } = await import('../playRolls.model')
const { withSignedInBackend } = await import('../../stores/__tests__/signedInBackend')

withSignedInBackend()

afterAll(convexMocks.restore)
afterEach(() => {
  cleanup()
  clearPlayRolls()
  sent.length = 0
  commits.length = 0
  postRoll.mockClear()
})

const NOW = Date.now()
const GAME = 'g-rust'
const UPKEEP_STEP = 1
const tenacity = crawlerFixture({
  id: 'med-tenacity',
  name: 'Tenacity',
  techLevel: 'tech-2',
  currentSP: 18,
  scrapPool: { tl2: 7 },
})

beforeAll(async () => {
  await hydrateStores()
  await useEntityStore.getState().adopt('crawler', tenacity)
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
    'games:members': MEDIATOR_MEMBERS,
    'crew:vitals': mediatorCrewAt(NOW),
    'seats:forGame': MEDIATOR_SEATS,
    'entities:listForGame': {
      pilots: [],
      mechs: [],
      npcs: [],
      softLinks: [],
      crawlers: [{ _id: 'c-ten', appId: 'med-tenacity', body: tenacity }],
      primaryCrawlerId: 'c-ten',
    },
    'downtime:state': { running: false, stepIndex: null, completedBy: [], upkeepSpent: false },
    'mediator:npcs': NPCS,
    'mediator:patterns': [],
    'proposals:sent': [SENT_PROPOSAL],
    'proposals:alerts': [{ _id: 'a-1', message: 'Contact front', ts: NOW - 30_000 }],
    'changeLog:rolls': [
      {
        _id: 'r-1',
        ts: NOW - 20_000,
        description: 'Mags · Core Mechanic · 20 · Nailed it',
        actorName: 'Mags',
        source: 'play',
      },
    ],
    'channelBindings:current': { channelId: 'c-1', boundAt: 1 },
    'account:me': { _id: 'u-gm', displayName: 'GM', avatarUrl: null, email: null },
    ...over,
  }
}

function downtimeAt(stepIndex: number, upkeepSpent = false): QueryAnswers {
  return {
    'downtime:state': {
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

async function renderCockpit(over: QueryAnswers = {}, canWrite = true) {
  setQueryAnswers(answers(over))
  await act(async () => {
    render(
      <ConnectionContext.Provider
        value={{
          mode: canWrite ? 'connected' : 'disconnected',
          canWrite,
          showDisconnectedWarning: !canWrite,
          settling: false,
        }}
      >
        <PlayMediatorCockpit
          gameId={GAME}
          gameName="The Rust Belt Run"
          rollFor={async () => () => 14}
        />
      </ConnectionContext.Provider>
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
const names = () => sent.map((s) => s.name)
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
    expect(bar.getByText('● Live · 3 of 4 here')).toBeTruthy()
    expect(bar.getByRole('button', { name: 'Game channel: where rolls post' })).toBeTruthy()
  })

  test('Begin Downtime starts it for the whole table', async () => {
    await renderCockpit()
    const state = within(screen.getByRole('group', { name: 'Game state' }))
    expect(state.getByRole('button', { name: 'Scene' }).getAttribute('aria-pressed')).toBe('true')
    await click(state.getByRole('button', { name: 'Begin Downtime' }))
    expect(names()).toEqual(['downtime:begin'])
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
    expect(names()).toEqual(['downtime:end'])
  })

  test('Tell the table sends one word to every player', async () => {
    await renderCockpit()
    await click(named('Tell the table'))
    const dialog = within(screen.getByRole('dialog', { name: 'Tell the table' }))
    expect(dialog.getByText('Contact front')).toBeTruthy()
    await act(async () => {
      fireEvent.change(dialog.getByLabelText('Alert'), { target: { value: 'Two squads east' } })
    })
    await click(dialog.getByRole('button', { name: 'Send' }))
    expect(sent).toEqual([
      { name: 'proposals:broadcast', args: { gameId: GAME, message: 'Two squads east' } },
    ])
  })
})

describe('the table', () => {
  test('a seat per player: presence, mount Token, every vital, ▲ on what needs the Mediator', async () => {
    await renderCockpit()
    const seats = within(screen.getByRole('list', { name: 'Seats' }))
    const items = seats.getAllByRole('listitem').filter((li) => li.className === 'su-play-seat')
    expect(items).toHaveLength(4)
    const bonesaw = within(items[0] as HTMLElement)
    expect(bonesaw.getByText('Buzzard')).toBeTruthy()
    // SP is on the mount Token too.
    for (const chip of ['HP', 'AP', 'SP', 'EP', 'Heat']) {
      expect(bonesaw.getAllByText(chip).length).toBeGreaterThan(0)
    }
    expect(bonesaw.getByText('Bonesaw is resolving 120mm Cannon: activated')).toBeTruthy()
    const rook = items[2] as HTMLElement
    expect(rook.dataset.attention).toBe('true')
    expect(within(rook).getByText('▲ HP')).toBeTruthy()
    expect(within(rook).getByText('Injured')).toBeTruthy()
  })

  test('a seat that stopped beating is away, and says where it was last seen', async () => {
    await renderCockpit()
    const wren = screen.getByRole('radio', { name: /^Wren, away/ }).closest('li') as HTMLElement
    expect(wren.dataset.away).toBe('true')
    expect(within(wren).getByText('Last seen Boarded · Mule')).toBeTruthy()
  })

  test('tapping a seat aims Propose at that pilot and focuses To; the proposal sends', async () => {
    await renderCockpit()
    await click(screen.getByRole('radio', { name: /^Rook, here/ }))
    const dock = region('Propose')
    expect((dock.getByLabelText('Target') as HTMLSelectElement).value).toBe('row-rook')
    expect(document.activeElement).toBe(dock.getByLabelText('To'))
    await act(async () => {
      fireEvent.change(dock.getByLabelText('To'), { target: { value: '6' } })
    })
    await click(dock.getByRole('button', { name: 'Propose' }))
    expect(sent).toEqual([
      {
        name: 'proposals:propose',
        args: { entityId: 'row-rook', entityType: 'pilot', field: 'currentHP', after: 6 },
      },
    ])
  })

  test('the crawler is the Units column’s box, live for the Mediator', async () => {
    await renderCockpit()
    const crawler = within(screen.getByRole('region', { name: 'Crawler: Tenacity' }))
    await click(crawler.getByRole('button', { name: 'SP −1' }))
    await waitFor(() =>
      expect(useEntityStore.getState().get('crawler', tenacity.id)?.currentSP).toBe(17)
    )
    expect(crawler.getByRole('button', { name: 'Open Tenacity’s sheet' })).toBeTruthy()
  })
})

describe('the Opposition', () => {
  test('each NPC, mech or Bio-Titan with its live HP or SP; − writes the tray', async () => {
    await renderCockpit()
    expect(screen.getByRole('region', { name: 'NPC: Strikebreaker' })).toBeTruthy()
    const scylla = within(screen.getByRole('region', { name: 'Bio-Titan: Scylla' }))
    await click(scylla.getByRole('button', { name: 'SP −1' }))
    expect(sent).toEqual([
      { name: 'mediator:updateNpc', args: { npcId: 'n-scylla', patch: { currentHp: 29 } } },
    ])
  })

  test('a downed NPC is struck and dashed, never removed for you; Delete asks first', async () => {
    await renderCockpit()
    const raider = within(screen.getByRole('region', { name: 'NPC: Raider, down' }))
    expect(raider.getByText('At 0 · down')).toBeTruthy()
    await click(raider.getByRole('button', { name: 'Delete Raider' }))
    expect(names()).toEqual([])
    await click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Delete' }))
    expect(sent).toEqual([{ name: 'mediator:removeNpc', args: { npcId: 'n-raider' } }])
  })

  test('the chosen NPC’s actions, flattened; Use opens the NPC Action table, its roll lands on the Feed, private and off the log', async () => {
    await renderCockpit()
    const list = within(screen.getByRole('list', { name: 'Strikebreaker’s actions' }))
    await click(
      list.getAllByRole('button', { name: /^Use .* for Strikebreaker$/ })[0] as HTMLElement
    )
    // One roll control: the table's stamp (R8).
    await click(list.getByRole('button', { name: 'Roll the die on NPC Action' }))
    await waitFor(() =>
      expect(feedLines().some((l) => /^You · Strikebreaker · .* · 14 · Success/.test(l))).toBe(true)
    )
    expect(postRoll).not.toHaveBeenCalled()
    expect(commits).not.toContain('changeLog:appendChangeLog')
  })

  test('Actions on another NPC lists its actions instead', async () => {
    await renderCockpit()
    await click(named('Scylla’s actions'))
    expect(named('Scylla’s actions').getAttribute('aria-pressed')).toBe('true')
    expect(screen.getByRole('list', { name: 'Scylla’s actions' })).toBeTruthy()
  })

  test('Morale rolls on the Morale table, kept on the NPC and on the Feed', async () => {
    await renderCockpit()
    await click(named('Roll the die on Morale'))
    await waitFor(() => expect(names()).toEqual(['mediator:updateNpc']))
    const patch = sent[0]?.args.patch as { lastMediatorRoll?: { table: string } }
    expect(patch.lastMediatorRoll?.table).toBe('morale')
    await waitFor(() =>
      expect(feedLines().some((l) => l.startsWith('You · Strikebreaker · Morale'))).toBe(true)
    )
  })

  test('+ Add opens the Opposition picker over the reference', async () => {
    await renderCockpit()
    await click(named('Add opposition from the reference'))
    expect(screen.getByRole('dialog', { name: 'Add opposition from the reference' })).toBeTruthy()
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

  test('Back puts the table on the step before; Advance on the next', async () => {
    await renderCockpit(downtimeAt(2))
    await click(named('Back to Step 2'))
    await click(named('Advance ›'))
    expect(sent).toEqual([
      { name: 'downtime:setStep', args: { gameId: GAME, stepIndex: 1 } },
      { name: 'downtime:advance', args: { gameId: GAME } },
    ])
  })

  test('End Downtime before the last step asks first', async () => {
    await renderCockpit(downtimeAt(2))
    await click(named('End Downtime'))
    expect(names()).toEqual([])
    const dialog = within(screen.getByRole('alertdialog'))
    await click(dialog.getByRole('button', { name: 'End Downtime' }))
    expect(names()).toEqual(['downtime:end'])
  })

  test('at the last step, Advance stops and End Downtime simply ends', async () => {
    await renderCockpit(downtimeAt(9))
    expect((named('Advance ›') as HTMLButtonElement).disabled).toBe(true)
    await click(named('End Downtime'))
    expect(names()).toEqual(['downtime:end'])
  })

  test('Upkeep waits for Upkeep & Upgrade: Pay is off in any other step', async () => {
    await renderCockpit(downtimeAt(0))
    expect((named('Pay') as HTMLButtonElement).disabled).toBe(true)
  })

  test('in Upkeep & Upgrade, Pay claims it, then draws the Scrap from the crawler', async () => {
    await renderCockpit(downtimeAt(UPKEEP_STEP))
    await click(named('Pay'))
    await waitFor(() => expect(screen.getByText(/^Paid the Upkeep/)).toBeTruthy())
    expect(names()).toEqual(['downtime:spendUpkeep'])
    expect(useEntityStore.getState().get('crawler', tenacity.id)?.scrapPool?.tl2).toBe(2)
  })

  test('paid, it says so', async () => {
    await renderCockpit(downtimeAt(UPKEEP_STEP, true))
    expect(screen.queryByRole('button', { name: 'Pay' })).toBeNull()
    expect(screen.getByText('Paid')).toBeTruthy()
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
      `/play/games/${GAME}`
    )
  })

  test('the seats needing attention are the seats’ ▲ and rings', async () => {
    await renderCockpit()
    const flagged = document.querySelectorAll('.su-play-seat[data-attention]')
    expect(flagged).toHaveLength(1)
  })

  test('Saved is the foot’s, beside the Opposition reminder', async () => {
    await renderCockpit()
    const foot = within(screen.getByRole('contentinfo'))
    expect(foot.getByText('Players see the Opposition only through what you post')).toBeTruthy()
  })

  test('The table: View a seat’s sheet is its Sheet ⤢', async () => {
    await renderCockpit()
    expect(named('Open Rook’s sheet')).toBeTruthy()
  })

  test('Crawler: no crawler says where to raise one', async () => {
    await renderCockpit({
      'entities:listForGame': {
        pilots: [],
        mechs: [],
        npcs: [],
        softLinks: [],
        crawlers: [],
        primaryCrawlerId: null,
      },
    })
    expect(screen.getByRole('link', { name: 'Raise one from the Game page' })).toBeTruthy()
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
    expect(sent).toEqual([
      { name: 'mediator:updateNpc', args: { npcId: 'n-strike', patch: { name: 'Red Leader' } } },
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

  test('the roll tables are the Tables section, private by default', async () => {
    await renderCockpit()
    const post = screen.getByLabelText('Post rolls to the Game’s channel') as HTMLInputElement
    expect(post.checked).toBe(false)
    expect(screen.getByRole('group', { name: 'Pinned tables' })).toBeTruthy()
  })

  test('the reference is ⋯ › Reference', async () => {
    await renderCockpit()
    await click(named('More'))
    expect(screen.getByRole('menuitem', { name: 'Reference' })).toBeTruthy()
  })

  test('the Game’s rolls and the alerts sent are the Feed', async () => {
    await renderCockpit()
    const lines = feedLines()
    expect(lines.some((l) => l.includes('Mags · Core Mechanic · 20 · Nailed it'))).toBe(true)
    expect(lines.some((l) => l.includes('Mediator · Contact front'))).toBe(true)
  })

  test('offline, every control is withdrawn and the bar says why', async () => {
    await renderCockpit({}, false)
    expect(within(screen.getByRole('banner')).getByText('Read-only · disconnected')).toBeTruthy()
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

describe('on a phone (play.md §11)', () => {
  let restore = () => {}
  beforeEach(() => {
    restore = phoneViewport()
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
    expect(document.querySelector('.su-dash-canvas')).toBeNull()
    const tabs = within(screen.getByRole('tablist', { name: 'Play' })).getAllByRole('tab')
    expect(tabs.map((t) => t.textContent)).toEqual(['Table', 'Opposition', 'Tables', 'Propose'])
    const state = screen.getByRole('group', { name: 'Game state' })
    expect(state.closest('[role="tabpanel"]')).toBeNull()
    expect(openPanel().getByRole('heading', { name: 'The table' })).toBeTruthy()
    await click(phoneTab('Opposition'))
    expect(openPanel().getAllByText('Strikebreaker').length).toBeGreaterThan(0)
    await click(phoneTab('Tables'))
    expect(
      openPanel()
        .getAllByRole('heading', { level: 2 })
        .map((h) => h.textContent)
    ).toEqual(['Tables', 'Feed'])
    await click(phoneTab('Propose'))
    expect(openPanel().getByRole('region', { name: 'Propose' })).toBeTruthy()
  })

  test('tapping a seat opens Propose, aimed at that pilot, with focus in To', async () => {
    await renderCockpit()
    await click(screen.getByRole('radio', { name: /^Rook, here/ }))
    expect(phoneTab('Propose').getAttribute('aria-selected')).toBe('true')
    const dock = within(openPanel().getByRole('region', { name: 'Propose' }))
    expect((dock.getByLabelText('Target') as HTMLSelectElement).value).toBe('row-rook')
    expect(document.activeElement).toBe(dock.getByLabelText('To'))
  })

  test('in Downtime the second tab says so and holds the track', async () => {
    await renderCockpit(downtimeAt(2))
    await click(phoneTab('Downtime'))
    expect(openPanel().getByRole('list', { name: 'Downtime steps' })).toBeTruthy()
  })
})
