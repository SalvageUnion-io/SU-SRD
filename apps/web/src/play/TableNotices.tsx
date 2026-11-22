/**
 * TableNotices — what a member's Games tell them wherever they are in the
 * app (play.md §19): mounted once, in the root route, above every screen,
 * Play's panes and tabs and the sheets alike.
 *
 * Per Game (the rooms' sockets are open site-wide, `RoomFeed`):
 *
 *  - **Pinned**, until answered or dismissed: the Stop Sign on a strip of its
 *    own (which also renames the tab, and turns Play's band, `PlayBar`); and
 *    one strip for everything else (r3 H1, `TableNoticeStack.tsx`): each proposal
 *    awaiting this player with Accept and Decline, "Your turn" while the
 *    Mediator has one of the viewer's pilots up, the Mediator's newest alert,
 *    "You now mediate" after a hand over with its door, "Session live" with
 *    its door, then "Session ended"; and a Game the viewer was removed from,
 *    which would otherwise just vanish. The strip shows one (what waits on an
 *    answer first, then the newest), counts the rest behind a button that
 *    lists them, and offers Dismiss all. The Mediator's alert is never one
 *    of the counted: it is a strip of its own above that one, for the player
 *    who is up too (r4 B2). "Your turn" carries End my turn (r4 B1,
 *    `scenes.endTurn`).
 *  - **Toasts**: what needs a look, off the table's event stream
 *    (`tableNotices.model.ts`, the Feed's own source): a proposal, an alert,
 *    the session and Downtime starting and ending, the Mediator's role
 *    moving and the Mediator's roll. A crewmate's vitals and acts are the
 *    Feed's alone, and nothing the pinned strip is already saying is toasted
 *    too (`pinnedSays`, r3 H2).
 */

import { cockpitPath, gamePath, mediatePath, sheetPath } from 'game-domain/entityKinds'
import { pilotLabel } from 'game-domain/pilotLabel'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
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
import type { Notice } from './TableNoticeStack'
import { NoticeStack } from './TableNoticeStack'
import type { Heard, KnownGame } from './tableNotices.model'
import {
  endedSession,
  eventsToToast,
  gameOfPage,
  gamesGone,
  lostRole,
  myTurn,
  NOTICES_RESIZED,
  onGamePages,
  pausedTitle,
  pinnedAlert,
  pinnedRole,
  pinnedSays,
  resumedTitle,
} from './tableNotices.model'
import { useGameSession } from './useGameSession'
import { useStopSign } from './useStopSign'

const STRONG = { fontWeight: tokens.weight.bold } satisfies React.CSSProperties

/** What this tab dismissed: alerts by id, a session's bar by when it started. */
const dismissed = new Set<string>()

/** Where a dismissed hand over is remembered: it stays news for days, a tab does not. */
const ROLE_SEEN = 'su-role-notice-seen'

/** The hand overs this browser has dismissed, by event id. */
function seenRoles(): string[] {
  try {
    const kept: unknown = JSON.parse(localStorage.getItem(ROLE_SEEN) ?? '[]')
    return Array.isArray(kept) ? kept.filter((id) => typeof id === 'string') : []
  } catch {
    return []
  }
}

function rememberRole(id: string): void {
  try {
    localStorage.setItem(ROLE_SEEN, JSON.stringify([...seenRoles(), id].slice(-20)))
  } catch {
    // Storage is off: the notice is dismissed for this tab alone.
  }
}

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

/** A Game the viewer was removed from, with when this screen learned of it. */
type GoneGame = KnownGame & { at: number }

export function TableNotices({ pathname }: { pathname: string }) {
  const measured = useNoticesHeight()
  const { status } = useSync()
  const person = useViewerId()
  const games = useGamesQuery('games.listMine', status === 'live' && person !== null ? {} : 'skip')
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
  if (person === null || games === undefined || (games.length === 0 && gone.length === 0)) {
    return null
  }
  const inPlay = hidesUnionBar(pathname)
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
  return (
    <section
      ref={measured}
      className="su-table-notices"
      data-under-bar={inPlay ? undefined : ''}
      aria-label={playCopy('tableNotices')}
    >
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
      <NoticeStack notices={[...removed, ...theirs]} />
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
  elsewhere,
  report,
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
  /** One of another Game's pages is open: this Game's alert is not pinned over it (r3 H1). */
  elsewhere: boolean
  /** Hand the strip this Game's notices (`TableNotices`). */
  report: (gameId: string, notices: readonly Notice[]) => void
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
  // The player who is up says they are done (r4 B1): the marker clears for the table.
  const endTurn = useServerAction(useTableAct('scenes.endTurn', gameId), {
    failure: playCopy('turnDidNotEnd'),
    toastId: 'table-end-turn',
  })
  // The viewer's own: the replica holds every crewmate's pilot too (LG-02).
  const pilots = gamePilots(useOwnUnits('pilot'), gameId)
  // The viewer's pilots' pages, as one value: an effect below reads them.
  const pilotRootsKey = pilots.map((pilot) => sheetPath('pilot', pilot.id)).join('\n')
  const pilotRoots = useMemo(
    () => (pilotRootsKey === '' ? [] : pilotRootsKey.split('\n')),
    [pilotRootsKey]
  )
  const [, redraw] = useState(0)
  const dismiss = (key: string) => {
    dismissed.add(key)
    redraw((n) => n + 1)
  }

  // Every other member's act, as a toast: one per event, a merged repeat in place.
  const heard = useRef<Heard | null>(null)
  useEffect(() => {
    if (events === undefined) return
    const next = eventsToToast(events, heard.current, viewerId, mediator)
    heard.current = next.heard
    // What the pinned strip is saying is not toasted too (r3 H2).
    const now = Date.now()
    const pinned = {
      alertId: pinnedAlert(events, dismissed, viewerId, now)?._id ?? null,
      roleId: mediator
        ? (pinnedRole(events, new Set([...dismissed, ...seenRoles()]), viewerId, now)?._id ?? null)
        : null,
      sessionLive: !inPlay && !ownPage && !dismissed.has(`session:${gameId}:live`),
      sessionEnded: onGamePages(pathname, gamePath(gameId), pilotRoots),
    }
    for (const event of next.toast) {
      if (pinnedSays(event, pinned, viewerId)) continue
      // A hand over to the viewer is said to them, not about them.
      const mine = event.kind === 'role' && event.about === viewerId
      toast(mine ? playCopy('youNowMediate') : event.text, {
        id: `table-event-${event._id}`,
        description: gameName,
      })
    }
  }, [events, viewerId, gameName, mediator, inPlay, ownPage, pathname, gameId, pilotRoots])

  // The role taken from the viewer, by the Organiser (r3 A4): said once, as it happens.
  const mediated = useRef<boolean | null>(null)
  useEffect(() => {
    const before = mediated.current
    mediated.current = mediator
    if (!lostRole(before, mediator, gameId)) return
    toast(playCopy('youNoLongerMediate'), { id: `table-role-${gameId}`, description: gameName })
  }, [mediator, gameId, gameName])

  // Whose turn the Mediator marked (r2 E1): mine is pinned on every screen
  // (every Play tab, my sheet). The strip is a live region and says it as it
  // becomes mine, so no toast repeats it (r3 H2).
  const scene = useTableRead('scenes.current', { gameId })
  const turn = myTurn(scene?.upNow, pilots)
  const turnName = turn === null ? null : pilotLabel(turn)

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
  const here = onGamePages(pathname, gamePath(gameId), pilotRoots)
  const endedAt = here ? endedSession(events ?? [], Date.now(), viewerId) : null

  // Never over another Game's pages (r3 H1).
  const alert = elsewhere ? null : pinnedAlert(events ?? [], dismissed, viewerId, Date.now())
  // A hand over made the viewer the Mediator: pinned while they still are.
  const role = mediator
    ? pinnedRole(events ?? [], new Set([...dismissed, ...seenRoles()]), viewerId, Date.now())
    : null
  const sessionKey = `session:${gameId}`
  const onePilot = pilots.length === 1 ? pilots[0] : undefined
  // One name a door (glossary §9): the Mediator's is Mediate, wherever it is.
  const door = mediator
    ? { href: mediatePath(gameId), label: playCopy('mediate') }
    : onePilot !== undefined
      ? { href: cockpitPath(onePilot.id), label: playCopy('joinSession') }
      : { href: gamePath(gameId), label: playCopy('joinSession') }

  const notices: Notice[] = []
  if (turn !== null) {
    const title = playCopy('yourTurnNamed', { name: turnName ?? '' })
    notices.push({
      key: `turn:${gameId}`,
      kind: 'turn',
      rank: 'turn',
      ts: 0,
      dismissible: false,
      tone: 'pilot',
      title,
      body: playCopy('yourTurnIn', { game: gameName }),
      actions: (
        <Button
          variant="primary"
          size="compact"
          disabled={!canWrite || endTurn.pending}
          onClick={() => void endTurn.run({})}
        >
          {playCopy('endMyTurn')}
        </Button>
      ),
      sig: `turn:${gameId}:${title}:${canWrite}:${endTurn.pending}`,
    })
  }
  for (const p of pending ?? []) {
    // From and to: the size of it, before they answer (r2 C7).
    const what = `${p.targetName ?? p.entityType} ${proposalChange(p)}`
    const body = `${playCopy('mediatorProposes', { what })}${p.reason === null ? '' : ` · “${p.reason}”`}`
    notices.push({
      key: `proposal:${p._id}`,
      kind: 'proposal',
      rank: 'answer',
      ts: p.ts,
      dismissible: false,
      tone: 'pilot',
      title: playCopy('proposalIn', { game: gameName }),
      body,
      actions: (
        <>
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
        </>
      ),
      sig: `proposal:${p._id}:${body}:${canWrite}`,
    })
  }
  if (alert !== null) {
    const body = alert.text.replace(/^Mediator · /, '')
    notices.push({
      key: `alert:${alert._id}`,
      kind: 'alert',
      rank: 'alert',
      ts: alert.ts,
      dismissible: true,
      tone: 'ink',
      title: playCopy('fromTheMediatorIn', { game: gameName }),
      body,
      dismiss: () => dismiss(alert._id),
      sig: `alert:${alert._id}:${body}`,
    })
  }
  if (role !== null) {
    // The screen it is about, one press away (r3 A4); not on that screen itself.
    const there = pathname.replace(/\/$/, '') === mediatePath(gameId)
    notices.push({
      key: `role:${role._id}`,
      kind: 'role',
      rank: 'news',
      ts: role.ts,
      dismissible: true,
      tone: 'ink',
      title: playCopy('youNowMediateIn', { game: gameName }),
      body: playCopy('youNowMediateBody'),
      actions: there ? undefined : (
        <Button variant="primary" size="compact" href={mediatePath(gameId)}>
          {playCopy('mediate')}
        </Button>
      ),
      dismiss: () => {
        rememberRole(role._id)
        dismiss(role._id)
      },
      sig: `role:${role._id}:${there}`,
    })
  }
  if (live && !inPlay && !ownPage && !dismissed.has(`${sessionKey}:live`)) {
    notices.push({
      key: `${sessionKey}:live`,
      kind: 'session',
      rank: 'news',
      ts: Math.max(0, ...(events ?? []).filter((e) => e.session === 'start').map((e) => e.ts)),
      dismissible: true,
      tone: 'crawler',
      title: playCopy('sessionLiveIn', { game: gameName }),
      actions: (
        <Button variant="primary" size="compact" href={door.href}>
          {door.label}
        </Button>
      ),
      dismiss: () => dismiss(`${sessionKey}:live`),
      sig: `${sessionKey}:live:${door.href}:${gameName}`,
    })
  }
  if (!live && endedAt !== null && !dismissed.has(`${sessionKey}:ended:${endedAt}`)) {
    notices.push({
      key: `${sessionKey}:ended:${endedAt}`,
      kind: 'session-ended',
      rank: 'news',
      ts: endedAt,
      dismissible: true,
      tone: 'ink',
      title: playCopy('sessionEndedIn', { game: gameName }),
      dismiss: () => dismiss(`${sessionKey}:ended:${endedAt}`),
      sig: `${sessionKey}:ended:${endedAt}:${gameName}`,
    })
  }
  // After every render: the strip redraws only when a notice's `sig` changed.
  useEffect(() => {
    report(gameId, notices)
  })
  useEffect(() => () => report(gameId, []), [gameId, report])

  // The Stop Sign keeps a strip of its own: it is the table's state, never one of the stack.
  if (sign === null || !paused) return null
  return (
    <div role="status" data-table-notice="stop">
      <Callout tone="bad">
        <div className="su-table-notice">
          <div className="su-table-notice__text">
            <Text style={STRONG}>{playCopy('pausedIn', { game: gameName })}</Text>
            <Text>{sign.mine ? playSafetyCopy('pausedYours') : playSafetyCopy('pausedBody')}</Text>
          </div>
          {sign.mayLift && (
            <Button size="compact" disabled={!sign.canWrite || sign.pending} onClick={sign.lift}>
              {playSafetyCopy('resume')}
            </Button>
          )}
        </div>
      </Callout>
    </div>
  )
}
