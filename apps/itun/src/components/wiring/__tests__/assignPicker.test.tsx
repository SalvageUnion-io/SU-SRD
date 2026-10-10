/**
 * AssignPicker — the one rail picker, with an injected store.
 *
 * What it must get right, and what each block below pins:
 *
 *  - **Where candidates come from.** Only the subject's container — the same
 *    Game, or your shelves — and only when signed in; signed out there is one pile
 *    and nothing is filtered. A pilot in one Game used to be offered every
 *    crawler in every Game, and the server refused the pick.
 *  - **Which way the link points.** The schema decides, not the sheet: the
 *    picked mech is `from` on a pilot sheet, the mech itself is on its own.
 *  - **Refusals land in the dialog,** in player copy — never a raw defect.
 *
 * Replacement and independence run against the real store in
 * `assignPicker-store.test.tsx`; here `create` is a mock, so they would only
 * test the mock.
 */

import { beforeAll, describe, expect, mock, test } from 'bun:test'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { ConvexError } from 'convex/values'
import type { ReactElement } from 'react'
import type { ConnectionState } from '../../../lib/connection/connectionContext'
import { ConnectionContext, SOLO_STATE } from '../../../lib/connection/connectionContext'
import type { Container } from '../../../lib/container'
import { SHELF } from '../../../lib/container'
import { LinkRefused } from '../../../lib/links/linkRefused'
import { CROSS_CONTAINER_REFUSAL } from '../../../lib/links/linkRules'
import type { Crawler } from '../../../lib/schemas/crawler'
import type { Mech } from '../../../lib/schemas/mech'
import type { Pilot } from '../../../lib/schemas/pilot'
import type { SoftLink } from '../../../lib/schemas/softLink'
import { FIXTURE_NOW } from '../../__tests__/fixtures'
import { hydrateStores } from '../../__tests__/hydrateStores'
import type { AssignPickerStore } from '../AssignPicker'
import { AssignPicker } from '../AssignPicker'

beforeAll(hydrateStores)

const CONNECTED: ConnectionState = { ...SOLO_STATE, mode: 'connected' }
const GAME: Container = { kind: 'game', gameId: 'g1' }

function pilot(id: string, name: string, gameId: string | null = null): Pilot {
  return {
    id,
    schemaVersion: 1,
    name,
    callsign: `${id}-callsign`,
    classRef: 'scavenger',
    abilities: [],
    equipment: [],
    motto: '',
    keepsake: '',
    appearance: '',
    background: '',
    conditions: [],
    gameId,
    createdAt: FIXTURE_NOW,
    updatedAt: FIXTURE_NOW,
  }
}

function mech(id: string, name: string, gameId: string | null = null): Mech {
  return {
    id,
    schemaVersion: 1,
    name,
    chassisRef: 'iron-mongrel',
    systems: [],
    modules: [],
    cargoLots: [],
    conditions: [],
    gameId,
    createdAt: FIXTURE_NOW,
    updatedAt: FIXTURE_NOW,
  }
}

function crawler(id: string, name: string, gameId: string | null = null): Crawler {
  return {
    id,
    schemaVersion: 1,
    name,
    techLevel: 'tech-2',
    systems: [],
    gameId,
    createdAt: FIXTURE_NOW,
    updatedAt: FIXTURE_NOW,
  }
}

type CreateFn = (type: 'softLink', input: Omit<SoftLink, 'id' | 'createdAt'>) => Promise<SoftLink>

function makeStore(
  over: Partial<AssignPickerStore> & { create?: CreateFn } = {}
): AssignPickerStore & { create: ReturnType<typeof mock<CreateFn>> } {
  const create = mock<CreateFn>(
    over.create ?? (async (_type, input) => ({ ...input, id: 'link-new', createdAt: FIXTURE_NOW }))
  )
  return {
    softLinks: [],
    pilots: [],
    mechs: [],
    crawlers: [],
    delete: mock(async () => {}),
    ...over,
    create,
  }
}

/** The three crawlers every scoping test reads: one per container. */
const crawlers = [
  crawler('c-game', 'Game Crawler', 'g1'),
  crawler('c-other', 'Other Game Crawler', 'g2'),
  crawler('c-shelf', 'Shelf Crawler', null),
]

function inMode(state: ConnectionState, ui: ReactElement) {
  return render(<ConnectionContext.Provider value={state}>{ui}</ConnectionContext.Provider>)
}

function open(name: RegExp) {
  fireEvent.click(screen.getByRole('button', { name }))
}

async function confirm(name: RegExp) {
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name }))
  })
}

const offered = () => screen.queryAllByRole('radio').map((r) => r.getAttribute('value'))

describe('AssignPicker — candidates share the subject’s container', () => {
  test('signed in, a pilot in a Game is offered only that Game’s crawlers', () => {
    inMode(
      CONNECTED,
      <AssignPicker
        subject={{ type: 'pilot', id: 'p1' }}
        container={GAME}
        pick="crawler"
        store={makeStore({ crawlers })}
      />
    )
    open(/assign crawler to pilot/i)
    expect(offered()).toEqual(['c-game'])
  })

  test('signed in, a pilot in your shelves is offered only Shelves’s crawlers', () => {
    inMode(
      CONNECTED,
      <AssignPicker
        subject={{ type: 'pilot', id: 'p1' }}
        container={SHELF}
        pick="crawler"
        store={makeStore({ crawlers })}
      />
    )
    open(/assign crawler to pilot/i)
    expect(offered()).toEqual(['c-shelf'])
  })

  test('signed out there is one pile, so nothing is filtered', () => {
    inMode(
      SOLO_STATE,
      <AssignPicker
        subject={{ type: 'pilot', id: 'p1' }}
        container={GAME}
        pick="crawler"
        store={makeStore({ crawlers })}
      />
    )
    open(/assign crawler to pilot/i)
    expect(offered()).toEqual(['c-game', 'c-other', 'c-shelf'])
  })

  test('mechs and pilots are scoped the same way', () => {
    const store = makeStore({
      pilots: [pilot('p-game', 'Yara', 'g1'), pilot('p-shelf', 'Dag', null)],
      mechs: [mech('m-game', 'Iron Fist', 'g1'), mech('m-shelf', 'Rust Bucket', null)],
    })
    const { unmount } = inMode(
      CONNECTED,
      <AssignPicker
        subject={{ type: 'pilot', id: 'p1' }}
        container={GAME}
        pick="mech"
        store={store}
      />
    )
    open(/assign mech to pilot/i)
    expect(offered()).toEqual(['m-game'])
    unmount()

    inMode(
      CONNECTED,
      <AssignPicker
        subject={{ type: 'mech', id: 'm1' }}
        container={SHELF}
        pick="pilot"
        store={store}
      />
    )
    open(/assign pilot to mech/i)
    expect(offered()).toEqual(['p-shelf'])
  })

  test('says where it looked when nothing qualifies', () => {
    const empty = makeStore({ crawlers: [crawler('c-other', 'Elsewhere', 'g2')] })
    const { unmount } = inMode(
      CONNECTED,
      <AssignPicker
        subject={{ type: 'pilot', id: 'p1' }}
        container={GAME}
        pick="crawler"
        store={empty}
      />
    )
    open(/assign crawler to pilot/i)
    expect(screen.getByText('No crawlers in this game yet.')).toBeTruthy()
    expect(
      (screen.getByRole('button', { name: /confirm crawler assignment/i }) as HTMLButtonElement)
        .disabled
    ).toBe(true)
    unmount()

    inMode(
      CONNECTED,
      <AssignPicker
        subject={{ type: 'mech', id: 'm1' }}
        container={SHELF}
        pick="crawler"
        store={empty}
      />
    )
    open(/assign crawler to mech/i)
    // "My Stuff", never "Shelf", in anything a player reads.
    expect(screen.getByText('No crawlers on your shelf.')).toBeTruthy()
  })

  test('the slot’s occupant is not offered back, and the trigger says Change', () => {
    inMode(
      CONNECTED,
      <AssignPicker
        subject={{ type: 'pilot', id: 'p1' }}
        container={GAME}
        pick="crawler"
        filled
        exclude={['c-game']}
        store={makeStore({ crawlers })}
      />
    )
    expect(screen.queryByRole('button', { name: /assign crawler/i })).toBeNull()
    open(/change crawler for this pilot/i)
    // The only crawler here is already this pilot's: "other", not "none".
    expect(offered()).toEqual([])
    expect(screen.getByText('No other crawlers in this game.')).toBeTruthy()
  })

  test('Add Crew leaves out pilots already aboard', () => {
    inMode(
      CONNECTED,
      <AssignPicker
        subject={{ type: 'crawler', id: 'c-game' }}
        container={GAME}
        pick="pilot"
        exclude={['p-aboard']}
        store={makeStore({
          pilots: [pilot('p-aboard', 'Yara', 'g1'), pilot('p-new', 'Dag', 'g1')],
        })}
      />
    )
    open(/add crew/i)
    expect(offered()).toEqual(['p-new'])
  })
})

describe('AssignPicker — the link points the way the schema says', () => {
  const cases = [
    {
      name: 'pilot sheet, Assign Mech: the picked mech flies the pilot',
      subject: { type: 'pilot', id: 'p1' },
      pick: 'mech',
      trigger: /assign mech to pilot/i,
      confirmName: /confirm mech assignment/i,
      store: { mechs: [mech('m1', 'Iron Fist')] },
      expected: { from: { type: 'mech', id: 'm1' }, to: { type: 'pilot', id: 'p1' } },
      type: 'mech-to-pilot',
    },
    {
      name: 'pilot sheet, Assign Crawler: the pilot crews it',
      subject: { type: 'pilot', id: 'p1' },
      pick: 'crawler',
      trigger: /assign crawler to pilot/i,
      confirmName: /confirm crawler assignment/i,
      store: { crawlers: [crawler('c1', 'Iron Tortoise')] },
      expected: { from: { type: 'pilot', id: 'p1' }, to: { type: 'crawler', id: 'c1' } },
      type: 'pilot-to-crawler',
    },
    {
      name: 'mech sheet, Assign Pilot: the mech carries them',
      subject: { type: 'mech', id: 'm1' },
      pick: 'pilot',
      trigger: /assign pilot to mech/i,
      confirmName: /confirm pilot assignment/i,
      store: { pilots: [pilot('p1', 'Yara')] },
      expected: { from: { type: 'mech', id: 'm1' }, to: { type: 'pilot', id: 'p1' } },
      type: 'mech-to-pilot',
    },
    {
      name: 'mech sheet, Assign Crawler: the mech docks by its own link',
      subject: { type: 'mech', id: 'm1' },
      pick: 'crawler',
      trigger: /assign crawler to mech/i,
      confirmName: /confirm crawler assignment/i,
      store: { crawlers: [crawler('c1', 'Iron Tortoise')] },
      expected: { from: { type: 'mech', id: 'm1' }, to: { type: 'crawler', id: 'c1' } },
      type: 'mech-to-crawler',
    },
    {
      name: 'crawler sheet, Add Crew: the picked pilot crews it',
      subject: { type: 'crawler', id: 'c1' },
      pick: 'pilot',
      trigger: /add crew/i,
      confirmName: /confirm crew assignment/i,
      store: { pilots: [pilot('p1', 'Yara')] },
      expected: { from: { type: 'pilot', id: 'p1' }, to: { type: 'crawler', id: 'c1' } },
      type: 'pilot-to-crawler',
    },
    {
      name: 'crawler sheet, Dock Mech: the picked mech docks',
      subject: { type: 'crawler', id: 'c1' },
      pick: 'mech',
      trigger: /dock mech/i,
      confirmName: /confirm mech docking/i,
      store: { mechs: [mech('m1', 'Iron Fist')] },
      expected: { from: { type: 'mech', id: 'm1' }, to: { type: 'crawler', id: 'c1' } },
      type: 'mech-to-crawler',
    },
  ] as const

  for (const c of cases) {
    test(c.name, async () => {
      const store = makeStore(c.store)
      const onAssigned = mock(() => {})
      inMode(
        CONNECTED,
        <AssignPicker
          subject={c.subject}
          container={SHELF}
          pick={c.pick}
          store={store}
          onAssigned={onAssigned}
        />
      )
      open(c.trigger)
      fireEvent.click(screen.getByRole('radio'))
      await confirm(c.confirmName)

      expect(store.create).toHaveBeenCalledWith('softLink', { ...c.expected, type: c.type })
      expect(onAssigned).toHaveBeenCalledTimes(1)
      expect(screen.queryByRole('dialog')).toBeNull()
    })
  }

  test('confirming nothing asks rather than writing', async () => {
    const store = makeStore({ crawlers: [crawler('c1', 'Iron Tortoise')] })
    inMode(
      SOLO_STATE,
      <AssignPicker
        subject={{ type: 'pilot', id: 'p1' }}
        container={SHELF}
        pick="crawler"
        store={store}
      />
    )
    open(/assign crawler to pilot/i)
    await confirm(/confirm crawler assignment/i)
    expect(store.create).not.toHaveBeenCalled()
    expect(screen.getByText('Please select a crawler.')).toBeTruthy()
  })

  test('cancel closes without writing', async () => {
    const store = makeStore({ crawlers: [crawler('c1', 'Iron Tortoise')] })
    inMode(
      SOLO_STATE,
      <AssignPicker
        subject={{ type: 'pilot', id: 'p1' }}
        container={SHELF}
        pick="crawler"
        store={store}
      />
    )
    open(/assign crawler to pilot/i)
    fireEvent.click(screen.getByRole('radio'))
    await confirm(/^cancel$/i)
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(store.create).not.toHaveBeenCalled()
  })
})

describe('AssignPicker — a refusal is shown in the dialog', () => {
  async function pickAndConfirm(create: CreateFn) {
    const store = makeStore({ crawlers: [crawler('c1', 'Iron Tortoise')], create })
    inMode(
      CONNECTED,
      <AssignPicker
        subject={{ type: 'pilot', id: 'p1' }}
        container={SHELF}
        pick="crawler"
        store={store}
      />
    )
    open(/assign crawler to pilot/i)
    fireEvent.click(screen.getByRole('radio'))
    await confirm(/confirm crawler assignment/i)
  }

  test('the store’s cross-container refusal, in its own words', async () => {
    await pickAndConfirm(async () => {
      throw new LinkRefused(CROSS_CONTAINER_REFUSAL)
    })
    expect(screen.getByText(CROSS_CONTAINER_REFUSAL)).toBeTruthy()
    // Still open: the player is told where they asked.
    expect(screen.getByRole('dialog')).toBeTruthy()
  })

  test('a server refusal, in the server’s words', async () => {
    await pickAndConfirm(async () => {
      throw new ConvexError('Only the owner of that mech can reassign it.')
    })
    expect(screen.getByText('Only the owner of that mech can reassign it.')).toBeTruthy()
  })

  test('a defect is not shown raw', async () => {
    const raw = '[CONVEX M(entities:upsertSoftLink)] [Request ID: x] Server Error'
    await pickAndConfirm(async () => {
      throw new Error(raw)
    })
    expect(screen.queryByText(raw)).toBeNull()
    expect(screen.getByText(/could not be saved/i)).toBeTruthy()
  })
})
