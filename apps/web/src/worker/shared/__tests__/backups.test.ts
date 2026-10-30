import { describe, expect, it } from 'bun:test'
import type { RoomDump } from '../../../rooms/dump'
import type { ArchiveBucket, BackupRooms, RoomKind } from '../backups'
import { backUpRooms, backupKey, restoreRoom, roomNames } from '../backups'
import { testDb } from './d1'

/** The nightly room backup (ADR-064 decision 4) and an admin's restore. */

const NOW = Date.UTC(2026, 9, 30, 4, 43)
const FULL: RoomDump = { format: 1, schema: 3, tables: { units: [{ id: 'u-1' }] } }
const EMPTY: RoomDump = { format: 1, schema: 3, tables: { units: [] } }

function archive(): ArchiveBucket & { objects: Map<string, string> } {
  const objects = new Map<string, string>()
  return {
    objects,
    put: async (key, value) => {
      objects.set(key, value)
    },
    get: async (key) => {
      const value = objects.get(key)
      return value === undefined ? null : { text: async () => value }
    },
  }
}

function seeded() {
  const db = testDb()
  db.sqlite.exec(`
    insert into accounts (account_id, discord_id, created_at, updated_at) values ('a-1', 'd-1', 1, 1);
    insert into accounts (account_id, test_email, created_at, updated_at) values ('a-2', 't@x', 1, 1);
    insert into games (game_id, name, updated_at) values ('g-1', 'Wastes', 1);
    insert into memberships (game_id, discord_id, mediator, organizer) values ('g-2', 'd-2', 0, 1);
  `)
  return db
}

describe('which rooms are backed up', () => {
  it('are every signed-in or seated Discord id, and every listed or joined Game', async () => {
    expect(await roomNames(seeded())).toEqual({ account: ['d-1', 'd-2'], game: ['g-1', 'g-2'] })
  })
})

describe('the nightly backup', () => {
  it('writes one dump per room that keeps rows, and a manifest', async () => {
    const bucket = archive()
    const rooms: BackupRooms = {
      dump: async (_kind, name) => (name === 'd-2' ? EMPTY : FULL),
      restore: async () => {},
    }
    const manifest = await backUpRooms(seeded(), bucket, rooms, NOW)
    expect(manifest).toEqual({
      takenAt: '2026-10-30T04:43:00.000Z',
      written: 3,
      empty: 1,
      failed: [],
    })
    expect([...bucket.objects.keys()].sort()).toEqual([
      'rooms/2026-10-30/account/d-1.json',
      'rooms/2026-10-30/game/g-1.json',
      'rooms/2026-10-30/game/g-2.json',
      'rooms/2026-10-30/manifest.json',
    ])
    expect(JSON.parse(bucket.objects.get('rooms/2026-10-30/game/g-1.json') ?? '')).toEqual(FULL)
  })

  it('backs up the other rooms when one fails, then throws naming it', async () => {
    const bucket = archive()
    const rooms: BackupRooms = {
      dump: async (kind, name) => {
        if (kind === 'game' && name === 'g-1') throw new Error('room down')
        return FULL
      },
      restore: async () => {},
    }
    await expect(backUpRooms(seeded(), bucket, rooms, NOW)).rejects.toThrow('game/g-1')
    const manifest = JSON.parse(bucket.objects.get('rooms/2026-10-30/manifest.json') ?? '')
    expect(manifest.written).toBe(3)
    expect(manifest.failed).toEqual([{ kind: 'game', name: 'g-1' }])
  })

  it('files a name a path cannot carry under its encoding', () => {
    expect(backupKey('2026-10-30', 'game', 'a/b')).toBe('rooms/2026-10-30/game/a%2Fb.json')
  })
})

describe('restoring a room', () => {
  it('loads the dump that day holds into its room', async () => {
    const bucket = archive()
    await bucket.put(backupKey('2026-10-29', 'account', 'd-1'), JSON.stringify(FULL), {
      httpMetadata: { contentType: 'application/json' },
    })
    const loaded: [RoomKind, string, RoomDump][] = []
    const rooms: BackupRooms = {
      dump: async () => EMPTY,
      restore: async (kind, name, dump) => {
        loaded.push([kind, name, dump])
      },
    }
    expect(
      await restoreRoom(bucket, rooms, { day: '2026-10-29', kind: 'account', name: 'd-1' })
    ).toBe('restored')
    expect(loaded).toEqual([['account', 'd-1', FULL]])
    expect(
      await restoreRoom(bucket, rooms, { day: '2026-10-28', kind: 'account', name: 'd-1' })
    ).toBe('missing')
    await expect(
      restoreRoom(bucket, rooms, { day: '../x', kind: 'account', name: 'd-1' })
    ).rejects.toThrow('not a backup day')
  })
})
