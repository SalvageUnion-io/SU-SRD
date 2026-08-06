/**
 * Unit tests for the v14 record rewrite (Starter Set → `seedRef`).
 *
 * Seeding now mints a fresh UUID per row and records the template slug in
 * `seedRef`, because the old fixed ids (`starter-pilot-bonesaw`, …) were
 * identical in every player's browser — and a seeded row's id becomes its
 * `appId` on the server of record, where rows are looked up with `.unique()`.
 *
 * This migration exists so that change does not cost anyone a duplicate
 * roster: without it, a browser that seeded the old way has no `seedRef`
 * anywhere, the "already seeded?" check answers no, and the next visit to the
 * Roster lays a whole second crew down beside the first.
 *
 * The classifier is deliberately narrow, and both halves are pinned here: a row
 * sitting under a known template id is stamped, and nothing else is touched.
 */
import { describe, expect, test } from 'bun:test'
import { migrate } from '../migrations/14-starter-set-seed-ref'

/**
 * A stand-in for the versionchange transaction.
 *
 * The migration only ever opens a cursor and updates through it, so a cursor
 * over a plain array is a faithful double — and it keeps these cases about the
 * rewrite rule rather than about IndexedDB. The full ladder against a real
 * database is `migration-ladder.test.ts`'s job.
 */
/** A raw stored row, exactly as it sits on disk — no Zod involved. */
type Row = Record<string, unknown>

/** The three stores this migration walks. Named, not indexed, so `[0]` narrows. */
type Fixture = { pilots: Row[]; mechs: Row[]; crawlers: Row[] }

function fakeTx(stores: Record<string, Row[]>) {
  return {
    objectStore(name: string) {
      const rows = stores[name] ?? []
      let i = 0
      const cursorAt = (index: number): unknown => {
        if (index >= rows.length) return null
        return {
          value: rows[index],
          async update(next: Record<string, unknown>) {
            rows[index] = next
          },
          async continue() {
            i = index + 1
            return cursorAt(i)
          },
        }
      }
      return {
        async openCursor() {
          i = 0
          return cursorAt(0)
        },
      }
    },
  }
}

describe('v14 starter-set seedRef backfill', () => {
  test('stamps a row still sitting under a template id', async () => {
    const stores: Fixture = {
      pilots: [{ id: 'starter-pilot-bonesaw', name: 'Bonesaw' }],
      mechs: [{ id: 'starter-mech-scrapper', name: 'Scrapper' }],
      crawlers: [{ id: 'starter-crawler-tenacity', name: '#430' }],
    }

    await migrate(fakeTx(stores) as never)

    expect(stores.pilots[0]?.seedRef).toBe('starter-pilot-bonesaw')
    expect(stores.mechs[0]?.seedRef).toBe('starter-mech-scrapper')
    expect(stores.crawlers[0]?.seedRef).toBe('starter-crawler-tenacity')
    // The id is deliberately left alone: re-minting it here would strand any
    // server row already mirrored under the old appId, turning a collision that
    // is merely declined into duplicated data.
    expect(stores.pilots[0]?.id).toBe('starter-pilot-bonesaw')
  })

  test("leaves a player's own build untouched", async () => {
    const stores: Fixture = {
      pilots: [{ id: 'b1e4c0de-0000-4000-8000-000000000000', name: 'Mine' }],
      mechs: [],
      crawlers: [],
    }

    await migrate(fakeTx(stores) as never)

    expect(stores.pilots[0]).toEqual({
      id: 'b1e4c0de-0000-4000-8000-000000000000',
      name: 'Mine',
    })
  })

  test('is idempotent — an existing seedRef is never rewritten', async () => {
    const stores: Fixture = {
      pilots: [{ id: 'starter-pilot-pickle', seedRef: 'something-deliberate' }],
      mechs: [],
      crawlers: [],
    }

    await migrate(fakeTx(stores) as never)

    expect(stores.pilots[0]?.seedRef).toBe('something-deliberate')
  })

  test('stamps every row of a fully seeded legacy roster', async () => {
    const stores: Fixture = {
      pilots: [
        { id: 'starter-pilot-bonesaw' },
        { id: 'starter-pilot-pickle' },
        { id: 'starter-pilot-judge' },
        { id: 'starter-pilot-driftwood' },
        { id: 'starter-pilot-hotdog' },
        { id: 'starter-pilot-razor' },
      ],
      mechs: [],
      crawlers: [],
    }

    await migrate(fakeTx(stores) as never)

    // One unstamped row is enough to make the roster read as absent and trigger
    // a second seed, so "most of them" is not good enough here.
    expect(stores.pilots.every((p) => typeof p.seedRef === 'string')).toBe(true)
  })
})
