import type { z } from 'salvageunion-reference/zod'
import type { ACCOUNT_SOCKET_ACTS, SHELF_ACTS } from '../game/socketActs'
import { entityLog } from '../ops'
import type { AccountRoomLogic } from './accountRoomLogic'

/** The Shelf's own acts are answered apart (`worker/shelfActs.ts`), since one reads the shared database. */
type Acts = Omit<typeof ACCOUNT_SOCKET_ACTS, keyof typeof SHELF_ACTS>
type Args<N extends keyof Acts> = z.infer<Acts[N]>
type Context = { room: AccountRoomLogic; actor: string; at: number }

/** A solo Downtime names its Pilot, and one that does not is refused. */
function pilotOf(args: { pilotId?: string }): string {
  if (args.pilotId === undefined) throw new Error('A solo Downtime names its Pilot')
  return args.pilotId
}

/**
 * Every act the player's socket may send their account room
 * (`ACCOUNT_SOCKET_ACTS`): their units and links, and their solo table.
 */
export const ACCOUNT_ACTS: { [N in keyof Acts]: (c: Context, a: Args<N>) => unknown } = {
  createUnit: (c, a) => c.room.shelf.create(c.actor, { ...a, at: c.at }),
  removeUnit: (c, a) => c.room.shelf.remove(c.actor, a.unitId),
  drawLink: (c, a) => c.room.shelf.drawLink(c.actor, a.link),
  removeLink: (c, a) => c.room.shelf.removeLink(c.actor, a.link),
  'salvageAreas.set': (c, a) => c.room.soloArea.set(c.actor, a.area, c.at),
  'salvageAreas.spend': (c, a) => c.room.soloArea.spend(c.actor, a.pilotId, c.at),
  'seats.board': (c, a) => c.room.solo.board(c.actor, a.pilotId, a.mechId, c.at),
  'seats.dismount': (c, a) => c.room.solo.dismount(c.actor, a.pilotId, c.at),
  'seats.eject': (c, a) => c.room.solo.eject(c.actor, a.pilotId, c.at),
  'seats.setRange': (c, a) => c.room.solo.setRange(c.actor, a.pilotId, a.range, c.at),
  'seats.toggleEffect': (c, a) => c.room.solo.toggleEffect(c.actor, a.pilotId, a.ref, c.at),
  'seats.setResolving': (c, a) => c.room.solo.setResolving(c.actor, a.pilotId, a.resolving, c.at),
  'seats.clearResolving': (c, a) => c.room.solo.clearResolving(c.actor, a.pilotId, c.at),
  'downtime.begin': (c, a) => c.room.solo.beginDowntime(c.actor, pilotOf(a), c.at),
  'downtime.advance': (c, a) => c.room.solo.advanceDowntime(c.actor, pilotOf(a)),
  'downtime.setStep': (c, a) => c.room.solo.setDowntimeStep(c.actor, pilotOf(a), a.stepIndex),
  'downtime.end': (c, a) => c.room.solo.endDowntime(c.actor, pilotOf(a)),
  'downtime.spendUpkeep': (c, a) => c.room.solo.spendUpkeep(c.actor, pilotOf(a)),
  'changeLog.forEntity': (c, a) => entityLog(c.room.shelf.history(c.actor, a.entityId)),
}

/** The acts that change nothing a socket carries. */
export const ACCOUNT_READ_ACTS: ReadonlySet<keyof Acts> = new Set(['changeLog.forEntity'])
