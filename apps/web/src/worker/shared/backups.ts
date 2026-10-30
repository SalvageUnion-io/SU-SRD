/**
 * The nightly backup of every room (ADR-064 decision 4): each room's storage
 * as one JSON dump in the private R2 bucket `su-archive`, under
 * `rooms/<day>/<kind>/<name>.json`, with a manifest beside them. Durable
 * Objects keep 30 days of point-in-time recovery of their own; these outlast
 * it, and an admin's restore loads one into its room again
 * (`../accountRoutes.ts`, `docs/ops/room-backups.md`).
 *
 * Which rooms exist is the shared database's to say: an account room for
 * every Discord id that signed in or sits in a Game, a Game room for every
 * Game it lists or that has a member.
 */

import type { RoomDump } from '../../rooms/dump'
import { isEmptyDump } from '../../rooms/dump'
import { reportError } from '../errorReports'
import type { SharedDb } from './db'

export type RoomKind = 'account' | 'game'

/** The slice of an R2 binding the backup uses. */
export type ArchiveBucket = {
  put(
    key: string,
    value: string,
    options: { httpMetadata: { contentType: string } }
  ): Promise<unknown>
  get(key: string): Promise<{ text(): Promise<string> } | null>
}

/** How the backup reaches a room (`../roomStubs.ts` `backupRooms`). */
export type BackupRooms = {
  dump(kind: RoomKind, name: string): Promise<RoomDump>
  restore(kind: RoomKind, name: string, dump: RoomDump): Promise<void>
}

/** What one night's run wrote, kept beside the dumps as `manifest.json`. */
export type BackupManifest = {
  takenAt: string
  written: number
  empty: number
  /** Each room that failed; its error went to Workers Issues (`reportError`). */
  failed: { kind: RoomKind; name: string }[]
}

/** Rooms dumped at once: enough to finish quickly, few enough to stay polite. */
const AT_ONCE = 6

const DAY = /^\d{4}-\d{2}-\d{2}$/

/** The UTC day a run at `now` files its dumps under. */
const backupDay = (now: number): string => new Date(now).toISOString().slice(0, 10)

export const backupKey = (day: string, kind: RoomKind, name: string): string =>
  `rooms/${day}/${kind}/${encodeURIComponent(name)}.json`

/** Every room the shared database knows of, by kind. */
export async function roomNames(db: SharedDb): Promise<Record<RoomKind, string[]>> {
  const names = async (query: string) =>
    (await db.prepare(query).all<{ name: string }>()).results.map((row) => row.name)
  return {
    account: await names(
      `select discord_id as name from accounts where discord_id is not null
       union select discord_id from memberships order by name`
    ),
    game: await names(
      'select game_id as name from games union select game_id from memberships order by name'
    ),
  }
}

/**
 * Dump every room into the archive. A room that fails is listed in the
 * manifest and the others still run; the run then throws, so a failure
 * reaches Workers Issues, as does each room's own error.
 */
export async function backUpRooms(
  db: SharedDb,
  archive: ArchiveBucket,
  rooms: BackupRooms,
  now: number
): Promise<BackupManifest> {
  const day = backupDay(now)
  const names = await roomNames(db)
  const queue = (['account', 'game'] as const).flatMap((kind) =>
    names[kind].map((name) => ({ kind, name }))
  )
  const manifest: BackupManifest = {
    takenAt: new Date(now).toISOString(),
    written: 0,
    empty: 0,
    failed: [],
  }
  const json = { httpMetadata: { contentType: 'application/json' } }
  const next = async (): Promise<void> => {
    const room = queue.shift()
    if (room === undefined) return
    try {
      const dump = await rooms.dump(room.kind, room.name)
      if (isEmptyDump(dump)) manifest.empty++
      else {
        await archive.put(backupKey(day, room.kind, room.name), JSON.stringify(dump), json)
        manifest.written++
      }
    } catch (error) {
      reportError(error, { where: 'room.backup', ...room })
      manifest.failed.push(room)
    }
    await next()
  }
  await Promise.all(Array.from({ length: AT_ONCE }, next))
  await archive.put(`rooms/${day}/manifest.json`, JSON.stringify(manifest), json)
  if (manifest.failed.length > 0) {
    throw new Error(
      `room backup: ${manifest.failed.length} room(s) failed (${manifest.failed.map((f) => `${f.kind}/${f.name}`).join(', ')})`
    )
  }
  return manifest
}

/** Load the dump `day` holds for one room back into it; `missing` when there is none. */
export async function restoreRoom(
  archive: ArchiveBucket,
  rooms: BackupRooms,
  room: { day: string; kind: RoomKind; name: string }
): Promise<'restored' | 'missing'> {
  if (!DAY.test(room.day)) throw new Error(`not a backup day: ${room.day}`)
  const object = await archive.get(backupKey(room.day, room.kind, room.name))
  if (object === null) return 'missing'
  await rooms.restore(room.kind, room.name, JSON.parse(await object.text()) as RoomDump)
  return 'restored'
}
