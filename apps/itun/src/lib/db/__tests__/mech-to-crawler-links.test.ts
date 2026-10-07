/**
 * The v17 record rewrite: draw each docked mech its own `mech-to-crawler`
 * link (ADR-037).
 *
 * The old model reached a mech's crawler through its pilot; the new one reads
 * only the direct link. Without this, every mech this browser holds leaves its
 * bay the moment the build loads — and a pre-account roster waiting to be
 * claimed would upload without the link it needs.
 */
import { describe, expect, test } from 'bun:test'
import { migrate } from '../migrations/17-mech-to-crawler-links'
import type { UpgradeTransaction } from '../migrations/types'

type Row = Record<string, unknown> & { id: string }

/** A stand-in for the versionchange transaction: `getAll` and `put` over arrays. */
function fakeTx(stores: Record<string, Row[]>): UpgradeTransaction {
  return {
    objectStore(name: string) {
      const rows = stores[name] ?? []
      stores[name] = rows
      return {
        async getAll() {
          return [...rows]
        },
        async put(row: Row) {
          rows.push(row)
        },
      }
    },
  } as unknown as UpgradeTransaction
}

function link(id: string, type: string, from: string, to: string, createdAt: string): Row {
  const ends: Record<string, [string, string]> = {
    'mech-to-pilot': ['mech', 'pilot'],
    'pilot-to-crawler': ['pilot', 'crawler'],
    'mech-to-crawler': ['mech', 'crawler'],
  }
  const [fromType, toType] = ends[type] ?? ['mech', 'pilot']
  return { id, type, from: { type: fromType, id: from }, to: { type: toType, id: to }, createdAt }
}

describe('v17 — mech-to-crawler links', () => {
  test('a mech whose pilot crews a crawler in its container is docked there', async () => {
    const stores: Record<string, Row[]> = {
      mechs: [{ id: 'm1', gameId: null }],
      crawlers: [{ id: 'c1', gameId: null }],
      softLinks: [
        link('l1', 'mech-to-pilot', 'm1', 'p1', '2026-01-01T00:00:00.000Z'),
        link('l2', 'pilot-to-crawler', 'p1', 'c1', '2026-01-01T00:00:00.000Z'),
      ],
    }

    await migrate(fakeTx(stores))

    const added = stores.softLinks?.filter((l) => l.type === 'mech-to-crawler') ?? []
    expect(added).toHaveLength(1)
    expect(added[0]?.from).toEqual({ type: 'mech', id: 'm1' })
    expect(added[0]?.to).toEqual({ type: 'crawler', id: 'c1' })
    expect(typeof added[0]?.id).toBe('string')
  })

  test('the newest crew link wins where the old code allowed two', async () => {
    const stores: Record<string, Row[]> = {
      mechs: [{ id: 'm1', gameId: null }],
      crawlers: [
        { id: 'c-old', gameId: null },
        { id: 'c-new', gameId: null },
      ],
      softLinks: [
        link('l1', 'mech-to-pilot', 'm1', 'p1', '2026-01-01T00:00:00.000Z'),
        link('l2', 'pilot-to-crawler', 'p1', 'c-old', '2026-01-01T00:00:00.000Z'),
        link('l3', 'pilot-to-crawler', 'p1', 'c-new', '2026-02-01T00:00:00.000Z'),
      ],
    }

    await migrate(fakeTx(stores))

    const added = stores.softLinks?.filter((l) => l.type === 'mech-to-crawler') ?? []
    expect(added.map((l) => (l.to as { id: string }).id)).toEqual(['c-new'])
  })

  test('skips a mech already docked, a crawler in another container, and an absent crawler', async () => {
    const stores: Record<string, Row[]> = {
      mechs: [
        { id: 'docked', gameId: null },
        { id: 'across', gameId: null },
        { id: 'orphan', gameId: null },
      ],
      crawlers: [
        { id: 'c1', gameId: null },
        { id: 'c-game', gameId: 'g1' },
      ],
      softLinks: [
        link('a1', 'mech-to-pilot', 'docked', 'p1', '2026-01-01T00:00:00.000Z'),
        link('a2', 'pilot-to-crawler', 'p1', 'c1', '2026-01-01T00:00:00.000Z'),
        link('a3', 'mech-to-crawler', 'docked', 'c1', '2026-01-01T00:00:00.000Z'),
        link('b1', 'mech-to-pilot', 'across', 'p2', '2026-01-01T00:00:00.000Z'),
        link('b2', 'pilot-to-crawler', 'p2', 'c-game', '2026-01-01T00:00:00.000Z'),
        link('c1', 'mech-to-pilot', 'orphan', 'p3', '2026-01-01T00:00:00.000Z'),
        link('c2', 'pilot-to-crawler', 'p3', 'gone', '2026-01-01T00:00:00.000Z'),
      ],
    }

    await migrate(fakeTx(stores))

    expect(stores.softLinks).toHaveLength(7)
  })

  test('is idempotent', async () => {
    const stores: Record<string, Row[]> = {
      mechs: [{ id: 'm1', gameId: null }],
      crawlers: [{ id: 'c1', gameId: null }],
      softLinks: [
        link('l1', 'mech-to-pilot', 'm1', 'p1', '2026-01-01T00:00:00.000Z'),
        link('l2', 'pilot-to-crawler', 'p1', 'c1', '2026-01-01T00:00:00.000Z'),
      ],
    }

    await migrate(fakeTx(stores))
    await migrate(fakeTx(stores))

    expect(stores.softLinks?.filter((l) => l.type === 'mech-to-crawler')).toHaveLength(1)
  })
})
