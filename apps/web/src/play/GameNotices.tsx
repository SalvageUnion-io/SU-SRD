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
 * (`tableStripSlot.model.ts`) at one height while the session is live, so nothing
 * under it moves. Offline it keeps what it last showed, marked Offline (r6
 * A14).
 *
 * Nothing here is a toast but the viewer losing the Mediator's role (r3 A4):
 * a toast is for the viewer's own act (r6 A3). Someone else's act is the
 * Feed's, and the strip's news when it matters to the whole table
 * (`tableNotices.model.ts`, the Feed's own source).
 */

import { cockpitPath, gamePath, mediatePath, sheetPath } from 'game-domain/entityKinds'
import { pilotLabel } from 'game-domain/pilotLabel'
import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { Button, toast } from '../components/index'
import { useServerAction } from '../lib/connection/useServerAction'
import { useOwnUnits, usePilots } from '../lib/entities'
import { playCopy } from '../messages/play'
import { playDoorCopy } from '../messages/play-door'
import { playSafetyCopy } from '../messages/play-safety'
import { playSalvageCopy } from '../messages/play-salvage'
import { holderOf } from '../replica/replica'
import { useSync } from '../replica/syncContext'
import { useTableAct, useTableRead } from '../replica/useTable'
import type { TableEvent } from '../rooms/game/events'
import type { ProposalRead } from '../rooms/game/proposals'
import { gamePilots } from './play.model'
import { acceptedUndo, proposalChange } from './proposalAnswer.model'
import { downtimeWaits, firstSight, onHub } from './sessionNotices.model'
import { STRIP_PINS } from './stripRuling.model'
import type { Notice } from './TableNoticeStack'
import type { Heard } from './tableNotices.model'
import {
  doneToMine,
  downOf,
  endedSession,
  eventsToTell,
  lostRole,
  myTurn,
  newsOver,
  onGamePages,
  passTurnTo,
  pausedTitle,
  pinnedAlert,
  pinnedRole,
  pinnedSays,
  resumedTitle,
  stripLine,
} from './tableNotices.model'
import { focusTheActions, rememberRole, seenRoles } from './tableNoticesDom.model'
import { useGamePresence } from './useGamePresence'
import { useGameSession } from './useGameSession'
import { useStopSign } from './useStopSign'

/** The Mediator's screen, whose Propose dock says every answer (r5 B7). */
const MEDIATE_PATH = /\/mediate\/?$/

// A crewmate's own pick of a wreck's salvage (r7 D8): fetched on Change's press.
const SalvagePickDialog = lazy(() =>
  import('./SalvagePickDialog').then((m) => ({ default: m.SalvagePickDialog }))
)

/** What this tab dismissed: alerts by id, a session's bar by when it started. */
const dismissed = new Set<string>()

/** One Game's notices for the table strip: what its own reads make, reported up to `TableNotices`. */
export function GameNotices({
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
  // The salvage offer whose pick the viewer is changing (r7 D8), while its dialog is open.
  const [changing, setChanging] = useState<ProposalRead | null>(null)
  // The player who is up says they are done (r4 B1): the marker clears for the table.
  const endTurn = useServerAction(useTableAct('scenes.endTurn', gameId), {
    failure: playCopy('turnDidNotEnd'),
    toastId: 'table-end-turn',
  })
  // Who is at the table, for the Mediator: the player who is up going Away (r7 A3).
  const present = useGamePresence(mediator ? gameId : null, 'watch')
  const passTurn = useServerAction(useTableAct('scenes.setUpNow', gameId), {
    failure: playCopy('turnDidNotPass'),
    toastId: 'table-pass-turn',
  })
  // The viewer's own: the replica holds every crewmate's pilot too (LG-02).
  const pilots = gamePilots(useOwnUnits('pilot'), gameId)
  // The viewer's own units, as one value: a change another made to one toasts (r6 A3).
  const ownMechs = useOwnUnits('mech')
  const mineKey = [...pilots, ...ownMechs].map((unit) => unit.id).join('\n')
  const ownIds = useMemo(() => new Set(mineKey.split('\n')), [mineKey])
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

  // Every other member's act that matters to the whole table, as the strip's
  // one news line, the newest replacing the last (r6 A3); never a toast.
  const heard = useRef<Heard | null>(null)
  const [news, setNews] = useState<{ event: TableEvent; text: string } | null>(null)
  useEffect(() => {
    if (events === undefined) return
    // Done to the viewer's own unit by someone else: theirs to see, as a toast (r6 A3).
    const toMine = doneToMine(events, heard.current, viewerId, ownIds)
    if (toMine !== null) toast(toMine.text, { id: `table-mine-${gameId}`, description: gameName })
    const next = eventsToTell(events, heard.current, viewerId, mediator)
    heard.current = next.heard
    // What the strip is already saying is not said twice (r3 H2).
    const now = Date.now()
    const pinned = {
      alertId: pinnedAlert(events, dismissed, viewerId, now)?._id ?? null,
      roleId: mediator
        ? (pinnedRole(events, new Set([...dismissed, ...seenRoles()]), viewerId, now)?._id ?? null)
        : null,
      sessionLive:
        !inPlay && !ownPage && !onHub(pathname) && !dismissed.has(`session:${gameId}:live`),
      sessionEnded: onGamePages(pathname, gamePath(gameId), pilotRoots),
    }
    const told = next.tell.filter(
      (event) =>
        !pinnedSays(event, pinned, viewerId) &&
        // On Mediate the Propose dock's Newest proposal line says a player's answer (r5 B7),
        // but not that it put a unit Down: the Mediator is told that too (r8 A3).
        !(
          event.kind === 'proposal' &&
          mediator &&
          MEDIATE_PATH.test(pathname) &&
          downOf(event) === null
        )
    )
    const newest = told.at(-1)
    if (newest === undefined) return
    // A hand over to the viewer is said to them, not about them.
    const mine = newest.kind === 'role' && newest.about === viewerId
    const text = mine
      ? playCopy('youNowMediate')
      : stripLine(newest, (unit) => playCopy('unitIsDown', { unit }))
    setNews({ event: newest, text })
  }, [events, viewerId, mediator, inPlay, ownPage, pathname, gameId, gameName, pilotRoots, ownIds])

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
  // Every other seat of the Game reads who is up, on its pages (r6 A2).
  const everyPilot = usePilots()
  const upNow = myTurn(scene?.upNow, everyPilot)
  const turnName = upNow === null ? null : pilotLabel(upNow)
  // When this screen saw the turn move: the strip shows the newest first.
  const turnSeen = useRef<{ id: string | null; at: number }>({ id: null, at: 0 })
  if (turnSeen.current.id !== (scene?.upNow ?? null)) {
    turnSeen.current = { id: scene?.upNow ?? null, at: Date.now() }
  }

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
  // Off Play, the Downtime's step this pilot has still to take (r6 C5).
  const downtime =
    useTableRead(
      'downtime.state',
      onePilot === undefined ? 'skip' : { gameId, pilotId: onePilot.id }
    ) ?? null
  // One name a door (glossary §9): the Mediator's is Mediate, wherever it is.
  const door = mediator
    ? { href: mediatePath(gameId), label: playCopy('mediate') }
    : onePilot !== undefined
      ? { href: cockpitPath(onePilot.id), label: playDoorCopy('joinSession') }
      : { href: gamePath(gameId), label: playDoorCopy('joinSession') }

  const notices: Notice[] = []
  // The Stop Sign leads the strip (r6 A1): the table's state, never folded.
  if (sign !== null && paused) {
    notices.push({
      key: `stop:${gameId}`,
      kind: 'stop',
      rank: 'stop',
      ts: 0,
      dismissible: false,
      tone: 'bad',
      title: playCopy('pausedIn', { game: gameName }),
      body: sign.mine ? playSafetyCopy('pausedYours') : playSafetyCopy('pausedBody'),
      actions: sign.mayLift ? (
        <Button size="compact" disabled={!sign.canWrite || sign.pending} onClick={sign.lift}>
          {playSafetyCopy('resume')}
        </Button>
      ) : undefined,
      sig: `stop:${gameId}:${sign.mine}:${sign.mayLift}:${sign.canWrite}:${sign.pending}`,
    })
  }
  // The player who is up has gone Away: the Mediator is told, and passes the turn on (r7 A3).
  const upHolder = upNow === null ? null : holderOf('pilot', upNow.id)
  const away = mediator && present !== null && upHolder != null && !present.has(upHolder)
  if (turn === null && upNow !== null && here && away) {
    const title = playCopy('nameIsAway', { name: turnName ?? '' })
    const next = passTurnTo(
      gamePilots(everyPilot, gameId).map((pilot) => ({
        id: pilot.id,
        holder: holderOf('pilot', pilot.id),
      })),
      upNow.id,
      present
    )
    notices.push({
      key: `turn:${gameId}`,
      kind: 'turn',
      rank: 'answer',
      ts: turnSeen.current.at,
      dismissible: false,
      tone: 'ink',
      title,
      actions: (
        <Button
          size="compact"
          disabled={!canWrite || passTurn.pending}
          onClick={() => void passTurn.run({ pilotId: next })}
        >
          {playCopy('passTheTurn')}
        </Button>
      ),
      sig: `away:${gameId}:${title}:${next}:${canWrite}:${passTurn.pending}`,
    })
  } else if (turn === null && upNow !== null && here && STRIP_PINS === 'news') {
    // Under the ruling `act` (r8 A2) who is up is the Play bar's, never pinned.
    const title = playCopy('nameIsUp', { name: turnName ?? '' })
    notices.push({
      key: `turn:${gameId}`,
      kind: 'turn',
      rank: 'turn',
      ts: turnSeen.current.at,
      dismissible: false,
      tone: 'ink',
      title,
      sig: `turn:${gameId}:${title}:${turnSeen.current.at}`,
    })
  }
  // News leaves once what it reports is over, and never follows the Mediator
  // onto the Game's page (r7 A1).
  const newsId = news?.event._id ?? ''
  if (
    news !== null &&
    here &&
    !(mediator && ownPage) &&
    !dismissed.has(newsId) &&
    !newsOver(news.event, events ?? [])
  ) {
    notices.push({
      key: `event:${newsId}`,
      kind: 'event',
      rank: 'news',
      ts: news.event.ts,
      dismissible: true,
      tone: 'ink',
      title: news.text,
      dismiss: () => dismiss(newsId),
      sig: `event:${newsId}:${news.text}`,
    })
  }
  if (turn !== null) {
    const title = playCopy('yourTurnNamed', { name: turnName ?? '' })
    const end = (
      <Button
        variant="primary"
        size="compact"
        // E presses it, from anywhere on a Play screen (r6 A13).
        data-end-turn=""
        disabled={!canWrite || endTurn.pending}
        onClick={() =>
          void endTurn.run({}).then((result) => {
            if (result.ok) focusTheActions()
          })
        }
      >
        {playCopy('endMyTurn')}
      </Button>
    )
    notices.push({
      key: `turn:${gameId}`,
      kind: 'turn',
      // Mine leads every notice but the Stop Sign, End my turn beside it (r8 A2).
      rank: 'yours',
      ts: turnSeen.current.at,
      dismissible: false,
      tone: 'pilot',
      title,
      // On its own pages the strip is the Game's: no need to name it.
      body: here ? undefined : playCopy('yourTurnIn', { game: gameName }),
      actions: (
        <>
          {/* Seen off this Game's pages, the way to its table (r5 A4). */}
          {here ? null : (
            <Button size="compact" href={cockpitPath(turn.id)}>
              {playDoorCopy('openTable')}
            </Button>
          )}
          {end}
        </>
      ),
      // End my turn stays on the strip whatever leads it (r6 A13).
      carry: end,
      sig: `turn:${gameId}:${title}:${canWrite}:${endTurn.pending}:${here}:${turnSeen.current.at}`,
    })
  }
  for (const p of pending ?? []) {
    // From and to: the size of it, before they answer (r2 C7).
    const what = `${p.targetName ?? p.entityType} ${proposalChange(p)}`
    // Who sent it, by name, as the Feed says it (r8 A4).
    const by = p.byName ?? playCopy('feedMediator')
    const body = `${playCopy('mediatorProposes', { name: by, what })}${p.reason === null ? '' : ` · “${p.reason}”`}`
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
                  if (!result.ok) return
                  acceptedUndo(p)
                  focusTheActions()
                })
            }
          >
            {playCopy('accept')}
          </Button>
          {p.offer !== undefined && (
            <Button
              size="compact"
              disabled={!canWrite}
              aria-label={playSalvageCopy('change2', { text: what })}
              onClick={() => setChanging(p)}
            >
              {playSalvageCopy('change')}
            </Button>
          )}
          <Button
            size="compact"
            disabled={!canWrite}
            aria-label={playCopy('decline2', { text: what })}
            onClick={() =>
              void reply
                .run(() => decline({ opId: p._id }))
                .then((result) => {
                  if (result.ok) focusTheActions()
                })
            }
          >
            {playCopy('decline')}
          </Button>
        </>
      ),
      sig: `proposal:${p._id}:${body}:${canWrite}`,
    })
  }
  if (alert !== null) {
    // "Mara · Rad storm rolls in": the sender is the title's, by name (r8 A4).
    const at = alert.text.indexOf(' · ')
    const from = at > 0 ? alert.text.slice(0, at) : playCopy('feedMediator')
    const body = at > 0 ? alert.text.slice(at + 3) : alert.text
    notices.push({
      key: `alert:${alert._id}`,
      kind: 'alert',
      rank: 'alert',
      ts: alert.ts,
      dismissible: true,
      tone: 'ink',
      title: playCopy('fromTheMediatorIn', { name: from, game: gameName }),
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
      // Who runs the table leads the strip, behind the Stop Sign alone (r7 A1).
      rank: 'role',
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
  if (live && !inPlay && !ownPage && !onHub(pathname) && !dismissed.has(`${sessionKey}:live`)) {
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
  // A Downtime step waiting on the viewer reaches them off the Play screen (r6 C5).
  if (!mediator && !inPlay && onePilot !== undefined && downtimeWaits(downtime)) {
    const title = playCopy('downtimeHasBegunIn', { game: gameName })
    notices.push({
      key: `downtime:${gameId}:${downtime?.runId ?? ''}:${downtime?.stepIndex ?? 0}`,
      kind: 'downtime',
      rank: 'answer',
      ts: downtime?.startedAt ?? 0,
      dismissible: false,
      tone: 'pilot',
      title,
      actions: (
        <Button variant="primary" size="compact" href={cockpitPath(onePilot.id)}>
          {playCopy('yourStep')}
        </Button>
      ),
      sig: `downtime:${gameId}:${downtime?.stepIndex ?? 0}:${onePilot.id}:${title}`,
    })
  }
  // Said once (r6 C1): the Game's page leads with the recap, so the strip never pins it for days.
  const endedKey = `${sessionKey}:ended:${endedAt}`
  if (
    !live &&
    endedAt !== null &&
    !(mediator && ownPage) &&
    !dismissed.has(endedKey) &&
    firstSight(endedKey)
  ) {
    notices.push({
      key: `${sessionKey}:ended:${endedAt}`,
      kind: 'session-ended',
      rank: 'news',
      ts: endedAt,
      dismissible: true,
      tone: 'ink',
      title: playCopy('sessionEndedIn', { game: gameName }),
      dismiss: () => dismiss(endedKey),
      sig: `${sessionKey}:ended:${endedAt}:${gameName}`,
    })
  }
  // After every render: the strip redraws only when a notice's `sig` changed.
  useEffect(() => {
    report(gameId, notices)
  })
  useEffect(() => () => report(gameId, []), [gameId, report])

  const offer = changing?.offer
  if (changing === null || offer === undefined) return null
  return (
    <Suspense fallback={null}>
      <SalvagePickDialog
        offer={offer}
        open
        onOpenChange={(open) => {
          if (!open) setChanging(null)
        }}
        onTake={async (picked) => {
          const result = await reply.run(() => apply({ opId: changing._id, picked }))
          if (!result.ok) throw new Error(playCopy('answerDidNotLand'))
          focusTheActions()
        }}
      />
    </Suspense>
  )
}
