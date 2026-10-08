/**
 * A cargo move the server refuses on the crawler side leaves BOTH server rows
 * as they were.
 *
 * In a Game only the table runner writes the crawler (ADR-038 §5). A stow or a
 * load is two server mutations, one per record, and `transfer` used to commit
 * them in the order the caller pushed them: the mech first, then the crawler.
 * For a player the mech write landed and the crawler write was refused, so a
 * stow lost the lot (gone from the mech, never in the Bay) and a load
 * duplicated it. `transfer` now commits the crawler first, so its refusal
 * aborts before anything else lands.
 *
 * These run the store and `useCargo` for real against the real Convex
 * functions (convex-test): only the commit seam is redirected, from the Convex
 * client this build does not have to the test deployment, acting as one member
 * at a time. The same reason `entityStore-transfer-commit.test.ts` gives.
 */

import { afterAll, beforeEach, describe, expect, mock, test } from 'bun:test'
import { act, renderHook } from '@testing-library/react'
import { api } from '../../../convex/_generated/api'
import type { Id } from '../../../convex/_generated/dataModel'
import type { Ctx, User } from '../../../test/convex/assignmentFixtures'
import {
  addCrawler,
  crawlerBody,
  mechBody,
  seedTable,
} from '../../../test/convex/assignmentFixtures'
import { testConvex } from '../../../test/convex/harness'
import { _resetDbSingleton, clearCache } from '../../lib/db/index'
import type { CargoLot } from '../../lib/schemas/cargoLot'
import { makeUnitLot } from '../../lib/schemas/cargoLot'
import type { Crawler } from '../../lib/schemas/crawler'
import type { Mech } from '../../lib/schemas/mech'
import { withSignedInBackend } from './signedInBackend'

// Building and editing need an account (ADR-034 as amended), so these writes run signed in.
withSignedInBackend()

// Captured with a SPREAD before mocking: a module namespace is a live view.
const realBackend = { ...(await import('../entityBackend')) }

type Commit = Parameters<typeof realBackend.commitEntityWrite>[1]

/** Who the commit seam acts as, and which deployment it writes to. */
let seam: { t: Ctx; as: User['as'] } | null = null
/** The records the seam committed, in order. */
const committed: string[] = []

mock.module('../entityBackend', () => ({
  ...realBackend,
  commitEntityWrite: async (type: string, op: Commit) => {
    if (seam === null) return
    committed.push(`${type}:${op.appId}`)
    if (type === 'crawler' && op.kind === 'patch') {
      await seam.as.mutation(
        api.entities.patchCrawlerByAppId,
        realBackend.crawlerPatchArgs(op.appId, op.patch)
      )
      return
    }
    if (type === 'mech' && op.kind === 'upsert') {
      await seam.as.mutation(api.entities.upsertByAppId, {
        table: 'mechs',
        appId: op.appId,
        gameId: op.gameId as Id<'games'> | null,
        body: op.body,
      })
      return
    }
    throw new Error(`unexpected commit: ${type} ${op.kind}`)
  },
}))

afterAll(() => {
  mock.module('../entityBackend', () => realBackend)
})

const { useEntityStore } = await import('../entityStore')
const { useCargo } = await import('../../lib/cargo/useCargo')

beforeEach(async () => {
  _resetDbSingleton()
  await clearCache()
  useEntityStore.setState({
    pilots: [],
    mechs: [],
    crawlers: [],
    softLinks: [],
    hydrated: { pilots: false, mechs: false, crawlers: false, softLinks: false },
  })
  seam = null
  committed.length = 0
})

/**
 * A Game with its crawler, raised by the Organizer (who runs the table while
 * there is no Mediator), and a mech for `holder` carrying `lots`. The same
 * bodies go to the server and into this browser's cache, as `ShelfSync` and
 * `WiringSync` would leave them.
 */
async function seedHold(holder: 'organizer' | 'player', mechLots: CargoLot[], bayLots: CargoLot[]) {
  const t = testConvex()
  const table = await seedTable(t)
  const user = table[holder]
  const { gameId } = table
  await addCrawler(table.organizer, 'c1', gameId)
  const crawler = { ...crawlerBody('c1', gameId), cargoLots: bayLots } as Crawler
  if (bayLots.length > 0) {
    await table.organizer.as.mutation(api.entities.patchCrawlerByAppId, {
      appId: 'c1',
      patch: { cargoLots: bayLots },
    })
  }
  // Room in the hold for a load, whatever the fixture chassis carries.
  const mech = { ...mechBody('m1', gameId), cargoLots: mechLots, maxCargoModifier: 6 } as Mech
  await user.as.mutation(api.entities.upsertByAppId, {
    table: 'mechs',
    appId: 'm1',
    gameId,
    body: mech,
  })
  await useEntityStore.getState().adopt('crawler', crawler)
  await useEntityStore.getState().adopt('mech', mech)
  seam = { t, as: user.as }
  return { t, mech, crawler }
}

/** The cargo on each server row, by lot name. */
async function serverHolds(t: Ctx) {
  const rows = await t.run(async (ctx) => ({
    mechs: await ctx.db.query('mechs').collect(),
    crawlers: await ctx.db.query('crawlers').collect(),
  }))
  const names = (body: unknown) =>
    ((body as { cargoLots?: CargoLot[] }).cargoLots ?? []).map((lot) => lot.name)
  return {
    mech: names(rows.mechs.find((r) => r.appId === 'm1')?.body),
    bay: names(rows.crawlers.find((r) => r.appId === 'c1')?.body),
  }
}

function localHolds() {
  const state = useEntityStore.getState()
  return {
    mech: (state.get('mech', 'm1')?.cargoLots ?? []).map((lot) => lot.name),
    bay: (state.get('crawler', 'c1')?.cargoLots ?? []).map((lot) => lot.name),
  }
}

describe("a player's crawler-side cargo move", () => {
  test('a refused stow leaves the mech and the crawler as they were, here and on the server', async () => {
    const crate = makeUnitLot('Crate')
    const { t, mech, crawler } = await seedHold('player', [crate], [])
    const { result } = renderHook(() => useCargo({ mech, crawler }))

    let outcome: Awaited<ReturnType<typeof result.current.stow>> | undefined
    await act(async () => {
      outcome = await result.current.stow(crate.id)
    })

    expect(outcome?.ok).toBe(false)
    expect(outcome?.ok === false && outcome.reason).toMatch(/mediator/i)
    // The lot is still on the mech, and nowhere else: not lost, not doubled.
    expect(await serverHolds(t)).toEqual({ mech: ['Crate'], bay: [] })
    expect(localHolds()).toEqual({ mech: ['Crate'], bay: [] })
    // The crawler was asked first, so the mech write was never sent.
    expect(committed).toEqual(['crawler:c1'])
  })

  test('a refused load does not duplicate the lot', async () => {
    const crate = makeUnitLot('Crate')
    const { t, mech, crawler } = await seedHold('player', [], [crate])
    const { result } = renderHook(() => useCargo({ mech, crawler }))

    let outcome: Awaited<ReturnType<typeof result.current.load>> | undefined
    await act(async () => {
      outcome = await result.current.load(crate.id)
    })

    expect(outcome?.ok).toBe(false)
    expect(outcome?.ok === false && outcome.reason).toMatch(/mediator/i)
    expect(await serverHolds(t)).toEqual({ mech: [], bay: ['Crate'] })
    expect(localHolds()).toEqual({ mech: [], bay: ['Crate'] })
  })

  test('the table runner stows the same lot, and both rows move', async () => {
    // Control: the crawler-first order is not what refuses the move.
    const crate = makeUnitLot('Crate')
    const { t, mech, crawler } = await seedHold('organizer', [crate], [])
    const { result } = renderHook(() => useCargo({ mech, crawler }))

    let outcome: Awaited<ReturnType<typeof result.current.stow>> | undefined
    await act(async () => {
      outcome = await result.current.stow(crate.id)
    })

    expect(outcome?.ok).toBe(true)
    expect(await serverHolds(t)).toEqual({ mech: [], bay: ['Crate'] })
    expect(localHolds()).toEqual({ mech: [], bay: ['Crate'] })
    expect(committed).toEqual(['crawler:c1', 'mech:m1'])
  })
})
