/**
 * Play's pure models: what the Play bar, the foot and the Play landing say,
 * from the store and the connection, with no React and no I/O.
 *
 * Play is the third mode beside Reference and Build: one screen per pilot,
 * in a Game or solo (`/pilots/$id/play`), one per Game for its Mediator
 * (`/games/$gameId/mediate`), and the landing that leads to both (`/games/`).
 */

import { containerOf } from 'game-domain/container'
import type { Pilot } from 'game-domain/schemas/pilot'
import type { CSSProperties } from 'react'
import type { ChapterTone } from '../components/index'
import { CHAPTER_BAND_COLOR, tokens } from '../components/index'
import { foregroundOn } from '../design/contrast'
import { sharedCopy } from '../messages/components-shared'
import type { SyncStatus } from '../replica/sync'
import type { UnitsState } from '../replica/units'
import type { Situation } from './situation.model'

/** The store surface Play writes through: injectable, so a test can assert the patches. */
export type PlayStore = Pick<UnitsState, 'get' | 'update' | 'transfer'>

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
  /** The viewer organises the Game: with the Mediator, who may bind its channel. */
  organizer?: boolean
}

/** The Mediator's screen, as the hooks it shares with a player's take it: their Game, no pilot. */
export type MediatorTarget = { gameId: string; pilotId: null; mediator: true }

/** The screen a shared Play hook serves: a pilot's, or the Mediator's (`pilotId` null). */
export type PlayScreen = Pick<PlayTarget, 'gameId' | 'pilotId' | 'mediator'> | MediatorTarget

/** The Mediator's target for their Game. */
export function mediatorTarget(gameId: string): MediatorTarget {
  return { gameId, pilotId: null, mediator: true }
}

/**
 * The Play bar's title: the Game's name, or the pilot's from the shelf (its
 * Solo chip says the rest, `playStamp`).
 */
export function playTitle(target: Pick<PlayTarget, 'gameId' | 'gameName'>, pilotName: string) {
  if (target.gameId === null) return pilotName
  return target.gameName ?? 'Game'
}

/** The player's bar's chip: "Solo" from the shelf, none in a Game. */
export function playStamp(target: Pick<PlayTarget, 'gameId'>): string | undefined {
  return target.gameId === null ? 'Solo' : undefined
}

/** A Play screen's phase: the player's Situation, or the Mediator's Scene. */
export type PlayPhase = Situation | 'scene'

/**
 * The band the bar and foot wear in each phase: the
 * unit the player is running, its chapter's colour, as a sheet's band wears
 * it. On foot the pilot's orange, Boarded the mech's green, Downtime the
 * Cantina's deep crawler pink, solo and in a Game alike; the Mediator's Scene
 * the Denizens navy, the Opposition's chapter. It crossfades between phases
 * (`--dur-phase`, `play/bar.css`).
 */
export const PHASE_TONE = {
  onFoot: 'pilot',
  boarded: 'mech',
  downtime: 'play',
  scene: 'denizen',
} as const satisfies Record<PlayPhase, ChapterTone>

/** The band while the Stop Sign is up (play.md §17): the stop colour, on every phase. */
export function pausedBand() {
  const background = tokens.color.statusBad
  const foreground = foregroundOn(background, 'paper')
  return {
    ground: foreground === 'paper' ? ('ink' as const) : ('paper' as const),
    style: { background, color: `var(--color-${foreground})` } satisfies CSSProperties,
  }
}

/**
 * The foot's connection line: connected, a Game's screen reaches its table
 * live and a solo one shares nothing. Otherwise none: the Play bar's
 * read-only stamp (`playReadOnly`) says why.
 */
export function connectionLine(status: SyncStatus, solo: boolean): string | null {
  if (status !== 'live') return null
  return solo ? 'Solo · nothing is shared' : 'Connected · changes reach the table live'
}

/**
 * Why Play is read-only right now, as it says so (play.md §7): `stamp` for the
 * Play bar, in place of the ONLINE stamp, and `says` in full. Null while writes
 * may go. The flag itself is `canWrite` (`Play.canWrite`); this is the words.
 */
export type PlayReadOnly = { stamp: string; says: string }

export function playReadOnly(connection: {
  status: SyncStatus
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
  switch (connection.status) {
    // The sync badge's words (`SyncBadge`): offline is one wording (chrome K5).
    case 'offline':
      return { stamp: sharedCopy('offlineReadOnly'), says: sharedCopy('notConnectedYourGamesAre') }
    case 'syncing':
      return { stamp: 'Read-only · connecting', says: 'Read-only while the connection settles.' }
    case 'signedOut':
      return { stamp: 'Read-only · signed out', says: 'Read-only: sign in to play.' }
    case 'live':
      return { stamp: 'Read-only', says: 'Read-only: the server is not taking changes right now.' }
  }
}

/**
 * The ONLINE stamp: "● Online", and in a Game, how many seats are here ("● Online ·
 * 4 here"), or of how many, on the Mediator's screen ("● Online · 3 of 4 here").
 * `short` (a phone's bar, one line): the count alone after the dot ("● 3 of 4
 * here"), "● Online" while there is none.
 */
export function liveLabel(here: number | null, of: number | null = null, short = false): string {
  if (here === null) return '● Online'
  const count = of === null ? `${here} here` : `${here} of ${of} here`
  return short ? `● ${count}` : `● Online · ${count}`
}

/** The viewer's own pilots in one Game: what its Play buttons open. */
export function gamePilots(pilots: readonly Pilot[], gameId: string): Pilot[] {
  return pilots.filter((pilot) => {
    const container = containerOf(pilot)
    return container.kind === 'game' && container.gameId === gameId
  })
}

/**
 * A phase's band, which the bar and the foot (`PlayFoot`) both wear: its
 * colour, the foreground that prints on it (ruleset §3.8) and the ground it
 * declares (chrome K1).
 */
export function phaseBand(tone: ChapterTone) {
  const background = CHAPTER_BAND_COLOR[tone]
  const foreground = foregroundOn(background, 'ink')
  return {
    ground: foreground === 'paper' ? ('ink' as const) : ('paper' as const),
    style: { background, color: `var(--color-${foreground})` } satisfies CSSProperties,
  }
}
