/**
 * TableNotices — what a member's Games tell them wherever they are in the
 * app (play.md §19): mounted once, in the root route, above every screen,
 * Play's panes and tabs and the sheets alike.
 *
 * Per Game (the rooms' sockets are open site-wide, `RoomFeed`):
 *
 *  - **Pinned**, until answered or dismissed: the Stop Sign (which also
 *    renames the tab, and turns Play's band, `PlayBar`), each proposal
 *    awaiting this player with Accept and Decline, the Mediator's newest
 *    alert, and "Session live" with its door, then "Session ended".
 *  - **Toasts**: every other member's act, off the table's event stream
 *    (`tableNotices.model.ts`), the Feed's own source.
 */

import { cockpitPath, gamePath, mediatePath } from 'game-domain/entityKinds'
import { fieldLabel } from 'game-domain/games/proposals'
import { useEffect, useRef, useState } from 'react'
import { Button, Callout, Text, toast, tokens } from '../components/index'
import { useServerAction } from '../lib/connection/useServerAction'
import { usePilots } from '../lib/entities'
import { playCopy } from '../messages/play'
import { playSafetyCopy } from '../messages/play-safety'
import { useGamesQuery, useViewerId } from '../replica/roomCalls'
import { useSync } from '../replica/syncContext'
import { useTableAct, useTableRead } from '../replica/useTable'
import { hidesUnionBar } from '../shell/unionSlots'
import { gamePilots } from './play.model'
import type { Heard } from './tableNotices.model'
import { eventsToToast, pausedTitle, pinnedAlert, resumedTitle } from './tableNotices.model'
import { useGameSession } from './useGameSession'
import { useStopSign } from './useStopSign'

const STRONG = { fontWeight: tokens.weight.bold } satisfies React.CSSProperties

/** What this tab dismissed: alerts by id, a session's bar by when it started. */
const dismissed = new Set<string>()

export function TableNotices({ pathname }: { pathname: string }) {
  const { status } = useSync()
  const person = useViewerId()
  const games = useGamesQuery('games.listMine', status === 'live' && person !== null ? {} : 'skip')
  if (person === null || games === undefined || games.length === 0) return null
  return (
    <section className="su-table-notices" aria-label={playCopy('tableNotices')}>
      {games.map((game) => (
        <GameNotices
          key={game._id}
          gameId={game._id}
          gameName={game.name}
          mediator={game.mediator}
          viewerId={person}
          inPlay={hidesUnionBar(pathname)}
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
}: {
  gameId: string
  gameName: string
  mediator: boolean
  viewerId: string
  /** A Play screen is open: it is the session's own place, so no door to it. */
  inPlay: boolean
}) {
  const { canWrite } = useSync()
  const sign = useStopSign(gameId)
  const session = useGameSession(gameId)
  const events = useTableRead('changeLog.events', { gameId })
  const pending = useTableRead('ops.pending', { gameId })
  const apply = useTableAct('ops.accept', gameId)
  const decline = useTableAct('ops.decline', gameId)
  const reply = useServerAction((send: () => Promise<unknown>) => send(), {
    failure: 'Your answer did not land. Try again.',
    toastId: 'table-proposal-answer',
  })
  const pilots = gamePilots(usePilots(), gameId)
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

  // A session that ended while this tab watched says so, until dismissed.
  const live = session?.live === true
  const wasLive = useRef(false)
  const [endedAt, setEndedAt] = useState<number | null>(null)
  useEffect(() => {
    if (session === null) return
    if (wasLive.current && !live) setEndedAt(Date.now())
    if (live) setEndedAt(null)
    wasLive.current = live
  }, [session, live])

  const alert = pinnedAlert(events ?? [], dismissed, viewerId, Date.now())
  const sessionKey = `session:${gameId}`
  const onePilot = pilots.length === 1 ? pilots[0] : undefined
  const door = mediator
    ? { href: mediatePath(gameId), label: playCopy('openTable') }
    : onePilot !== undefined
      ? { href: cockpitPath(onePilot.id), label: playCopy('joinSession') }
      : { href: gamePath(gameId), label: playCopy('joinSession') }
  const show = (value: unknown) => (value === null || value === undefined ? '—' : String(value))

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
      {(pending ?? []).map((p) => {
        const what = `${p.targetName ?? p.entityType} ${fieldLabel(p.field)} → ${show(p.after)}`
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
                    onClick={() => void reply.run(() => apply({ opId: p._id }))}
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
      {live && !inPlay && !dismissed.has(`${sessionKey}:live`) && (
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
