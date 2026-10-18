/**
 * Play's pure models: what the Play bar, the foot and the Play landing say,
 * from the store and the connection, with no React and no I/O.
 *
 * Play is the third mode beside Reference and Build: one screen per pilot,
 * in a Game or solo (`/play/$pilotId`), one per Game for its Mediator
 * (`/play/game/$gameId`), and the landing that leads to both (`/play/`).
 */

import { containerOf } from 'cantina-domain/container'
import type { Mech } from 'cantina-domain/schemas/mech'
import type { Pilot } from 'cantina-domain/schemas/pilot'
import type { SoftLink } from 'cantina-domain/schemas/softLink'
import type { ConnectionMode } from '../lib/connection/connectionMode'
import type { EntityState } from '../stores/entityStore'

/** The store surface Play writes through: injectable, so a test can assert the patches. */
export type PlayStore = Pick<EntityState, 'get' | 'update' | 'transfer'>

/**
 * Who the Play screen is for, as the gate (`PlayGate`) settles it: the pilot,
 * the Game it plays in (null solo) and whether the viewer mediates that Game.
 * Every column of the Cockpit is handed this and reads the rest itself.
 */
export type PlayTarget = {
  pilotId: string
  /** The pilot's Game; null when the pilot plays solo, from the shelf. */
  gameId: string | null
  /** The Game's name, once `games.get` has answered; null solo or before then. */
  gameName: string | null
  /** The viewer mediates the pilot's Game (`games.get`'s membership flag). */
  mediator: boolean
}

/** The Play bar's title: the Game's name, or "Solo · <pilot>" from the shelf. */
export function playTitle(target: Pick<PlayTarget, 'gameId' | 'gameName'>, pilotName: string) {
  if (target.gameId === null) return `Solo · ${pilotName}`
  return target.gameName ?? 'Game'
}

/**
 * The foot's connection line, as the wireframes word it: connected, a Game's
 * screen reaches its table live and a solo one shares nothing; offline,
 * nothing does (the Saved indicator beside it says the screen is read-only).
 */
export function connectionLine(mode: ConnectionMode, solo: boolean): string {
  switch (mode) {
    case 'connected':
      return solo ? 'Solo · nothing is shared' : 'Connected · changes reach the table live'
    case 'connecting':
      return 'Connecting…'
    case 'disconnected':
      return 'Not connected · waiting to reconnect'
    case 'solo':
      return 'Signed out'
  }
}

/**
 * Why Play is read-only right now, as it says so (play.md §7): `stamp` for the
 * Play bar, in place of the LIVE stamp, and `says` in full. Null while writes
 * may go. The flag itself is `canWrite` (`Play.canWrite`); this is the words.
 */
export type PlayReadOnly = { stamp: string; says: string }

export function playReadOnly(connection: {
  mode: ConnectionMode
  canWrite: boolean
  outdated?: boolean
}): PlayReadOnly | null {
  if (connection.canWrite) return null
  if (connection.outdated) {
    return {
      stamp: 'Read-only · outdated',
      says: 'Read-only: this tab is updating to the new build. Reload to keep playing.',
    }
  }
  switch (connection.mode) {
    case 'disconnected':
      return {
        stamp: 'Read-only · disconnected',
        says: 'Read-only: disconnected. Play comes back when the connection does.',
      }
    case 'connecting':
      return { stamp: 'Read-only · connecting', says: 'Read-only while the connection settles.' }
    case 'solo':
      return { stamp: 'Read-only · signed out', says: 'Read-only: sign in to play.' }
    case 'connected':
      return { stamp: 'Read-only', says: 'Read-only: the server is not taking changes right now.' }
  }
}

/**
 * The LIVE stamp: "● Live", and in a Game, how many seats are here ("● Live ·
 * 4 here"), or of how many, on the Mediator's screen ("● Live · 3 of 4 here").
 */
export function liveLabel(here: number | null, of: number | null = null): string {
  if (here === null) return '● Live'
  return of === null ? `● Live · ${here} here` : `● Live · ${here} of ${of} here`
}

/** One shelf pilot the landing's Solo section offers, with the mech assigned to it. */
export type SoloPilot = { pilotId: string; name: string; mechName: string | null }

/**
 * The shelf's pilots, each with its assigned mech (`mech-to-pilot`), in the
 * store's order. The store holds only the viewer's own pilots (a crewmate's
 * never reaches this browser), so every shelf pilot is one the viewer may play.
 */
export function soloPilots(
  pilots: readonly Pilot[],
  mechs: readonly Mech[],
  softLinks: readonly SoftLink[]
): SoloPilot[] {
  const mechNames = new Map(mechs.map((m) => [m.id, m.name]))
  return pilots
    .filter((pilot) => containerOf(pilot).kind === 'shelf')
    .map((pilot) => {
      const link = softLinks.find((l) => l.type === 'mech-to-pilot' && l.to.id === pilot.id)
      return {
        pilotId: pilot.id,
        name: pilot.name,
        mechName: (link && mechNames.get(link.from.id)) ?? null,
      }
    })
}

/** The viewer's own pilots in one Game: what its Play buttons open. */
export function gamePilots(pilots: readonly Pilot[], gameId: string): Pilot[] {
  return pilots.filter((pilot) => {
    const container = containerOf(pilot)
    return container.kind === 'game' && container.gameId === gameId
  })
}
