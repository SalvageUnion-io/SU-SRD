/**
 * TableNotices — what a member's Games tell them wherever they are in the
 * app (play.md §19): mounted once, in the root route, above every screen,
 * Play's panes and tabs and the sheets alike.
 *
 * Per Game (the rooms' sockets are open site-wide, `RoomFeed`), one strip
 * (`TableNoticeStack.tsx`, r6 A1): the Stop Sign (which also renames the tab,
 * and turns Play's band, `PlayBar`), each proposal awaiting this player with
 * Accept and Decline, whose turn it is ("Your turn" with End my turn on the
 * seat that is up, "Razor is up" on every other seat of the Game, r6 A2), the
 * Mediator's newest alert, the table's news (a unit Down, a session or
 * Downtime starting, a Mediator's roll, r6 A3), "You now mediate" after a hand
 * over with its door, "Session live" with its door, then "Session ended"; and
 * a Game the viewer was removed from, which would otherwise just vanish. It
 * shows one and counts the rest. On a Play screen it stands under the bar
 * (`tableStripSlot.model.ts`) at one height, so nothing under it moves while it
 * speaks; with nothing to say it takes no room (r7 A2). Offline it keeps what it last showed, marked Offline (r6
 * A14).
 *
 * Nothing here is a toast but the viewer losing the Mediator's role (r3 A4):
 * a toast is for the viewer's own act (r6 A3). Someone else's act is the
 * Feed's, and the strip's news when it matters to the whole table
 * (`tableNotices.model.ts`, the Feed's own source).
 */

import { gamePath, sheetPath } from 'game-domain/entityKinds'
import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { SkipLink } from '../components/app'
import { useOwnUnits } from '../lib/entities'
import { playCopy } from '../messages/play'
import { useGamesQuery, useViewerId } from '../replica/roomCalls'
import { useSync } from '../replica/syncContext'
import { hidesUnionBar } from '../shell/unionSlots'
/** The Mediator's screen, whose Propose dock says every answer (r5 B7). */
import { GameNotices } from './GameNotices'
import { gamePilots } from './play.model'
import type { Notice } from './TableNoticeStack'
import { NoticeStack } from './TableNoticeStack'
import type { KnownGame } from './tableNotices.model'
import { gameOfPage, gamesGone, YOUR_TURN_ID } from './tableNotices.model'
import { focusYourTurn, useNoticesHeight } from './tableNoticesDom.model'
import { useScreenNotices, useTableStripSlot } from './tableStripSlot.model'

/** A Game the viewer was removed from, with when this screen learned of it. */
type GoneGame = KnownGame & { at: number }

export function TableNotices({ pathname }: { pathname: string }) {
  const measured = useNoticesHeight()
  const { status } = useSync()
  const person = useViewerId()
  const served = useGamesQuery('games.listMine', status === 'live' && person !== null ? {} : 'skip')
  // Offline the strip keeps the Games it last read (r6 A14).
  const lastGames = useRef(served)
  if (served !== undefined) lastGames.current = served
  const games = served ?? (status === 'offline' ? lastGames.current : undefined)
  const slot = useTableStripSlot()
  const screen = useScreenNotices()
  // A Game the viewer was in and is in no longer, not by their own doing (r2 B4).
  const known = useRef<readonly KnownGame[] | null>(null)
  const [gone, setGone] = useState<readonly GoneGame[]>([])
  useEffect(() => {
    if (games === undefined) return
    const now = games.map((game) => ({ _id: game._id, name: game.name }))
    const lost = known.current === null ? [] : gamesGone(known.current, now)
    known.current = now
    if (lost.length > 0) {
      const at = Date.now()
      setGone((prev) => [...prev, ...lost.map((game) => ({ ...game, at }))])
    }
  }, [games])
  // Each Game's notices, as its own reads make them (`GameNotices`), for the one strip.
  const reported = useRef(new Map<string, readonly Notice[]>())
  const [, redraw] = useState(0)
  const report = useCallback((gameId: string, notices: readonly Notice[]) => {
    const sig = (list: readonly Notice[]) => list.map((n) => n.sig).join('\n')
    const changed = sig(reported.current.get(gameId) ?? []) !== sig(notices)
    if (notices.length === 0) reported.current.delete(gameId)
    else reported.current.set(gameId, notices)
    if (changed) redraw((n) => n + 1)
  }, [])
  // The viewer's own pilots, to tell which Game's pages this is (the replica holds the crew's too).
  const pilots = useOwnUnits('pilot')
  const inPlay = hidesUnionBar(pathname)
  // On a Play screen the strip stands under its bar, at one height (r6 A1).
  const fixed = inPlay && slot !== null
  // What the Play screen itself says there, solo too: the Heat Check due (r6 A6).
  const own = fixed ? screen : []
  if (own.length > 0 && (person === null || games === undefined || games.length === 0)) {
    return createPortal(
      <section className="su-table-notices" data-in-play="" aria-label={playCopy('tableNotices')}>
        <NoticeStack
          notices={own}
          fixed
          offline={status === 'offline' ? playCopy('stripOffline') : undefined}
        />
      </section>,
      slot as HTMLElement
    )
  }
  if (person === null || games === undefined || (games.length === 0 && gone.length === 0)) {
    return null
  }
  const pageGame = gameOfPage(
    pathname,
    games.map((game) => ({
      id: game._id,
      root: gamePath(game._id),
      pilotRoots: gamePilots(pilots, game._id).map((pilot) => sheetPath('pilot', pilot.id)),
    }))
  )
  const removed = gone.map((game): Notice => {
    const title = playCopy('noLongerIn', { game: game.name })
    return {
      key: `gone:${game._id}`,
      kind: 'removed',
      rank: 'news',
      ts: game.at,
      dismissible: true,
      tone: 'ink',
      title,
      body: playCopy('noLongerInBody'),
      dismiss: () => setGone((prev) => prev.filter((g) => g._id !== game._id)),
      sig: title,
    }
  })
  const still = new Set(games.map((game) => game._id))
  const theirs = [...reported.current].flatMap(([gameId, notices]) =>
    still.has(gameId) ? notices : []
  )
  const offline = status === 'offline'
  const strip = (
    <NoticeStack
      notices={[...removed, ...theirs, ...own]}
      fixed={fixed}
      offline={offline ? playCopy('stripOffline') : undefined}
    />
  )
  return (
    <section
      ref={measured}
      className="su-table-notices"
      data-under-bar={inPlay ? undefined : ''}
      aria-label={fixed ? undefined : playCopy('tableNotices')}
    >
      {/* The first Tab stop while it is the viewer's turn (r5 A17). */}
      {theirs.some((notice) => notice.kind === 'turn') && (
        <SkipLink to={YOUR_TURN_ID} onFollow={focusYourTurn}>
          {playCopy('skipToYourTurn')}
        </SkipLink>
      )}
      {games.map((game) => (
        <GameNotices
          key={game._id}
          gameId={game._id}
          gameName={game.name}
          mediator={game.mediator}
          viewerId={person}
          inPlay={inPlay}
          pathname={pathname}
          ownPage={pathname.replace(/\/$/, '') === gamePath(game._id)}
          elsewhere={pageGame !== null && pageGame !== game._id}
          report={report}
        />
      ))}
      {fixed
        ? createPortal(
            <section
              className="su-table-notices"
              data-in-play=""
              aria-label={playCopy('tableNotices')}
            >
              {strip}
            </section>,
            slot
          )
        : strip}
    </section>
  )
}
