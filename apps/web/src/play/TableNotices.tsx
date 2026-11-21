/**
 * TableNotices — what a member's Games tell them wherever they are in the
 * app (play.md §19): mounted once, in the root route, above every screen,
 * Play's panes and tabs and the sheets alike.
 *
 * Per Game (the rooms' sockets are open site-wide, `RoomFeed`):
 *
 *  - **Pinned**, until answered or dismissed: the Stop Sign (which also
 *    renames the tab, and turns Play's band, `PlayBar`), each proposal
 *    awaiting this player with Accept and Decline, "Your turn" while the
 *    Mediator has one of the viewer's pilots up, the Mediator's newest alert, and "Session live" with its door, then "Session ended"; and
 *    a Game the viewer was removed from, which would otherwise just vanish.
 *  - **Toasts**: what needs a look, off the table's event stream
 *    (`tableNotices.model.ts`, the Feed's own source): a proposal, an alert,
 *    the session and Downtime starting and ending, the Mediator's roll, and
 *    "Your turn". A crewmate's vitals and acts are the Feed's alone.
 */

import { cockpitPath, gamePath, mediatePath, sheetPath } from 'game-domain/entityKinds'
import { pilotLabel } from 'game-domain/pilotLabel'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Button, Callout, Text, toast, tokens } from '../components/index'
import { useServerAction } from '../lib/connection/useServerAction'
import { useOwnUnits } from '../lib/entities'
import { playCopy } from '../messages/play'
import { playSafetyCopy } from '../messages/play-safety'
import { useGamesQuery, useViewerId } from '../replica/roomCalls'
import { useSync } from '../replica/syncContext'
import { useTableAct, useTableRead } from '../replica/useTable'
import { hidesUnionBar } from '../shell/unionSlots'
import { gamePilots } from './play.model'
import { acceptedUndo, proposalChange } from './proposalAnswer.model'
import type { Heard, KnownGame } from './tableNotices.model'
import {
  endedSession,
  eventsToToast,
  gamesGone,
  myTurn,
  NOTICES_RESIZED,
  onGamePages,
  pausedTitle,
  pinnedAlert,
  resumedTitle,
} from './tableNotices.model'
import { useGameSession } from './useGameSession'
import { useStopSign } from './useStopSign'

const STRONG = { fontWeight: tokens.weight.bold } satisfies React.CSSProperties

/** What this tab dismissed: alerts by id, a session's bar by when it started. */
const dismissed = new Set<string>()

/**
 * The notices' height, published as `--su-table-notices-h` on the document:
 * under the Union bar a page's band starts behind the header's rail, so from
 * `lg` the notices take no room of their own and the band makes it for them
 * (`screens.css`), which keeps the rail on its band.
 */
function useNoticesHeight() {
  const observer = useRef<ResizeObserver | null>(null)
  return useCallback((node: HTMLElement | null) => {
    observer.current?.disconnect()
    observer.current = null
    const root = document.documentElement
    if (node === null || typeof ResizeObserver === 'undefined') {
      root.style.removeProperty('--su-table-notices-h')
      window.dispatchEvent(new Event(NOTICES_RESIZED))
      return
    }
    const publish = () => {
      root.style.setProperty('--su-table-notices-h', `${node.getBoundingClientRect().height}px`)
      // Play's frame sits under the notices and fills the window below them.
      window.dispatchEvent(new Event(NOTICES_RESIZED))
    }
    observer.current = new ResizeObserver(publish)
    observer.current.observe(node)
    publish()
  }, [])
}

export function TableNotices({ pathname }: { pathname: string }) {
  const measured = useNoticesHeight()
  const { status } = useSync()
  const person = useViewerId()
  const games = useGamesQuery('games.listMine', status === 'live' && person !== null ? {} : 'skip')
  // A Game the viewer was in and is in no longer, not by their own doing (r2 B4).
  const known = useRef<readonly KnownGame[] | null>(null)
  const [gone, setGone] = useState<readonly KnownGame[]>([])
  useEffect(() => {
    if (games === undefined) return
    const now = games.map((game) => ({ _id: game._id, name: game.name }))
    const lost = known.current === null ? [] : gamesGone(known.current, now)
    known.current = now
    if (lost.length > 0) setGone((prev) => [...prev, ...lost])
  }, [games])
  if (person === null || games === undefined || (games.length === 0 && gone.length === 0)) {
    return null
  }
  const inPlay = hidesUnionBar(pathname)
  return (
    <section
      ref={measured}
      className="su-table-notices"
      data-under-bar={inPlay ? undefined : ''}
      aria-label={playCopy('tableNotices')}
    >
      {gone.map((game) => (
        <div key={game._id} role="status" data-table-notice="removed">
          <Callout tone="ink">
            <div className="su-table-notice">
              <div className="su-table-notice__text">
                <Text style={STRONG}>{playCopy('noLongerIn', { game: game.name })}</Text>
                <Text>{playCopy('noLongerInBody')}</Text>
              </div>
              <Button
                size="compact"
                aria-label={playCopy('dismissWhat', {
                  what: playCopy('noLongerIn', { game: game.name }),
                })}
                onClick={() => setGone((prev) => prev.filter((g) => g._id !== game._id))}
              >
                {playCopy('dismiss')}
              </Button>
            </div>
          </Callout>
        </div>
      ))}
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
        />
      ))}
    </section>
  )
}

function GameNotices({
  gameId,
  gameName,
  mediator,
  viewerId,
  inPlay,
  pathname,
  ownPage,
}: {
  gameId: string
  gameName: string
  mediator: boolean
  viewerId: string
  /** A Play screen is open: it is the session's own place, so no door to it. */
  inPlay: boolean
  /** Where the viewer is: "Session ended" is said on this Game's pages alone. */
  pathname: string
  /** The Game's own page is open: its band says the session is live, and has the door. */
  ownPage: boolean
}) {
  const { canWrite } = useSync()
  const sign = useStopSign(gameId)
  const session = useGameSession(gameId)
  const events = useTableRead('changeLog.events', { gameId })
  const pending = useTableRead('ops.pending', { gameId })
  const apply = useTableAct('ops.accept', gameId)
  const decline = useTableAct('ops.decline', gameId)
  const reply = useServerAction((send: () => Promise<unknown>) => send(), {
    failure: playCopy('answerDidNotLand'),
    toastId: 'table-proposal-answer',
  })
  // The viewer's own: the replica holds every crewmate's pilot too (LG-02).
  const pilots = gamePilots(useOwnUnits('pilot'), gameId)
  const [, redraw] = useState(0)
  const dismiss = (key: string) => {
    dismissed.add(key)
    redraw((n) => n + 1)
  }

  // Every other member's act, as a toast: one per event, a merged repeat in place.
  const heard = useRef<Heard | null>(null)
  useEffect(() => {
    if (events === undefined) return
    const next = eventsToToast(events, heard.current, viewerId)
    heard.current = next.heard
    for (const event of next.toast) {
      toast(event.text, { id: `table-event-${event._id}`, description: gameName })
    }
  }, [events, viewerId, gameName])

  // Whose turn the Mediator marked (r2 E1): mine is pinned on every screen
  // (every Play tab, my sheet), and said once as it becomes mine.
  const scene = useTableRead('scenes.current', { gameId })
  const turn = myTurn(scene?.upNow, pilots)
  const turnId = turn?.id ?? null
  const turnName = turn === null ? null : pilotLabel(turn)
  const toldTurn = useRef<string | null | undefined>(undefined)
  useEffect(() => {
    // The first reading is history: a screen opened mid-turn has the strip, no toast.
    if (scene === undefined) return
    const before = toldTurn.current
    toldTurn.current = turnId
    if (before === undefined || turnId === null || turnId === before) return
    toast(playCopy('yourTurnNamed', { name: turnName ?? '' }), {
      id: `table-turn-${gameId}`,
      description: gameName,
    })
  }, [scene, turnId, turnName, gameId, gameName])

  // The Stop Sign names the tab, whatever screen set its title.
  const paused = sign?.shown === true
  useEffect(() => {
    if (!paused) return
    const prefix = playCopy('pausedTitlePrefix')
    const wear = () => {
      const next = pausedTitle(document.title, prefix)
      if (next !== document.title) document.title = next
    }
    wear()
    const title = document.querySelector('title')
    const watch = typeof MutationObserver === 'undefined' ? null : new MutationObserver(wear)
    if (title !== null)
      watch?.observe(title, { childList: true, characterData: true, subtree: true })
    watch?.observe(document.head, { childList: true })
    return () => {
      watch?.disconnect()
      document.title = resumedTitle(document.title, prefix)
    }
  }, [paused])

  // A session that just ended says so (the events' own record), until dismissed.
  const live = session?.live === true
  // Said to the other members, on this Game's pages alone (r2 C5).
  const here = onGamePages(
    pathname,
    gamePath(gameId),
    pilots.map((pilot) => sheetPath('pilot', pilot.id))
  )
  const endedAt = here ? endedSession(events ?? [], Date.now(), viewerId) : null

  const alert = pinnedAlert(events ?? [], dismissed, viewerId, Date.now())
  const sessionKey = `session:${gameId}`
  const onePilot = pilots.length === 1 ? pilots[0] : undefined
  const door = mediator
    ? { href: mediatePath(gameId), label: playCopy('openTable') }
    : onePilot !== undefined
      ? { href: cockpitPath(onePilot.id), label: playCopy('joinSession') }
      : { href: gamePath(gameId), label: playCopy('joinSession') }

  return (
    <>
      {sign !== null && paused && (
        <div role="status" data-table-notice="stop">
          <Callout tone="bad">
            <div className="su-table-notice">
              <div className="su-table-notice__text">
                <Text style={STRONG}>{playCopy('pausedIn', { game: gameName })}</Text>
                <Text>
                  {sign.mine ? playSafetyCopy('pausedYours') : playSafetyCopy('pausedBody')}
                </Text>
              </div>
              {sign.mayLift && (
                <Button
                  size="compact"
                  disabled={!sign.canWrite || sign.pending}
                  onClick={sign.lift}
                >
                  {playSafetyCopy('resume')}
                </Button>
              )}
            </div>
          </Callout>
        </div>
      )}
      {turn !== null && (
        <div role="status" data-table-notice="turn">
          <Callout tone="pilot">
            <div className="su-table-notice">
              <div className="su-table-notice__text">
                <Text style={STRONG}>{playCopy('yourTurnNamed', { name: turnName ?? '' })}</Text>
                <Text>{playCopy('yourTurnIn', { game: gameName })}</Text>
              </div>
            </div>
          </Callout>
        </div>
      )}
      {(pending ?? []).map((p) => {
        // From and to: the size of it, before they answer (r2 C7).
        const what = `${p.targetName ?? p.entityType} ${proposalChange(p)}`
        return (
          <div key={p._id} role="status" data-table-notice="proposal">
            <Callout tone="pilot">
              <div className="su-table-notice">
                <div className="su-table-notice__text">
                  <Text style={STRONG}>{playCopy('proposalIn', { game: gameName })}</Text>
                  <Text>
                    {playCopy('mediatorProposes', { what })}
                    {p.reason !== null && ` · “${p.reason}”`}
                  </Text>
                </div>
                <span className="su-table-notice__actions">
                  <Button
                    variant="primary"
                    size="compact"
                    disabled={!canWrite}
                    aria-label={playCopy('accept2', { text: what })}
                    onClick={() =>
                      void reply
                        .run(() => apply({ opId: p._id }))
                        .then((result) => {
                          if (result.ok) acceptedUndo(p)
                        })
                    }
                  >
                    {playCopy('accept')}
                  </Button>
                  <Button
                    size="compact"
                    disabled={!canWrite}
                    aria-label={playCopy('decline2', { text: what })}
                    onClick={() => void reply.run(() => decline({ opId: p._id }))}
                  >
                    {playCopy('decline')}
                  </Button>
                </span>
              </div>
            </Callout>
          </div>
        )
      })}
      {alert !== null && (
        <div role="status" data-table-notice="alert">
          <Callout tone="ink">
            <div className="su-table-notice">
              <div className="su-table-notice__text">
                <Text style={STRONG}>{playCopy('fromTheMediatorIn', { game: gameName })}</Text>
                <Text>{alert.text.replace(/^Mediator · /, '')}</Text>
              </div>
              <Button
                size="compact"
                aria-label={playCopy('dismissWhat', { what: alert.text })}
                onClick={() => dismiss(alert._id)}
              >
                {playCopy('dismiss')}
              </Button>
            </div>
          </Callout>
        </div>
      )}
      {live && !inPlay && !ownPage && !dismissed.has(`${sessionKey}:live`) && (
        <div role="status" data-table-notice="session">
          <Callout tone="crawler">
            <div className="su-table-notice">
              <Text style={STRONG}>{playCopy('sessionLiveIn', { game: gameName })}</Text>
              <span className="su-table-notice__actions">
                <Button variant="primary" size="compact" href={door.href}>
                  {door.label}
                </Button>
                <Button
                  size="compact"
                  aria-label={playCopy('dismissWhat', {
                    what: playCopy('sessionLiveIn', { game: gameName }),
                  })}
                  onClick={() => dismiss(`${sessionKey}:live`)}
                >
                  {playCopy('dismiss')}
                </Button>
              </span>
            </div>
          </Callout>
        </div>
      )}
      {!live && endedAt !== null && !dismissed.has(`${sessionKey}:ended:${endedAt}`) && (
        <div role="status" data-table-notice="session-ended">
          <Callout tone="ink">
            <div className="su-table-notice">
              <Text style={STRONG}>{playCopy('sessionEndedIn', { game: gameName })}</Text>
              <Button
                size="compact"
                aria-label={playCopy('dismissWhat', {
                  what: playCopy('sessionEndedIn', { game: gameName }),
                })}
                onClick={() => dismiss(`${sessionKey}:ended:${endedAt}`)}
              >
                {playCopy('dismiss')}
              </Button>
            </div>
          </Callout>
        </div>
      )}
    </>
  )
}
