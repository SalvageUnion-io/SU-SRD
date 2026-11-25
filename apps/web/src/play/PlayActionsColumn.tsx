/**
 * PlayActionsColumn — the Cockpit's centre column (play.md §5, §6).
 *
 * Outside Downtime it is one flattened Actions list (`PlayActionsList`): every
 * action of the pilot, the mech and their companions, the Reactor and Mount,
 * grouped by action type (Turn, Short, Long, Reaction, Free, Passive), with a
 * type filter and Find on the "Actions" heading line; what is on hand first,
 * what is not collapsed below with its reason. Every line is a Mini (ruleset
 * §1.3); Use opens the action in place as its Mini's contentful body:
 * Activate, Roll, Push?, Apply, on the seat's `resolving`. Below `lg` the
 * pane's tab is its heading, so the type filter leads it.
 *
 * Whose turn it is is the table's strip's, on every seat (r6 A2), and so is
 * the boarded Mech's Heat Check at its Heat Capacity (r6 A6).
 *
 * Over it, the Scene's conditions when the Mediator has put it under any
 * (`PlayScene`): what scales the Heat a Push and a Hot action make.
 *
 * In Downtime it becomes the Downtime track and the current step
 * (`PlayDowntimeColumn`), the Downtime actions under it.
 *
 * Its headings are Slabs, never a `TitledBox`, so each line is level 1 and
 * what sits inside one is plain content (the Nested Frames Audit, play.md §12).
 * Every roll made here goes on Play's one roll log (`playRolls.model.ts`).
 */

import { mechMaxima } from 'game-domain/rules/crewStatus'
import { useEffect, useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import { resolveGauge } from 'salvageunion-reference/rules'
import { Button, MiniGrid, Slab } from '../components/index'
import { playCopy } from '../messages/play'
import { momentCopy } from '../messages/play-moment'
import type { TableBeat } from './moment.model'
import { momentOf, tableBeat } from './moment.model'
import { PlayActionEntry } from './PlayActionEntry'
import { PlayActionsList, PlayActionsTools } from './PlayActionsList'
import { PlayDowntimeColumn } from './PlayDowntimeColumn'
import { PlayMoment } from './PlayMoment'
import { PlayScene } from './PlayScene'
import { PlayTableMoment } from './PlayTableMoment'
import type { ListEntry } from './playActions.model'
import type { Play, PlayColumnProps } from './situation.model'
import { setScreenNotices } from './tableStripSlot.model'
import { ROLL_BUTTON } from './useFindKey'
import type { PlayActions, PlayActionsDeps } from './usePlayActions'
import { usePlayActions } from './usePlayActions'
import { usePlayWide } from './usePlayWide'

/** The Reactor's Heat Check stamp, wherever its row is drawn. */
const HEAT_ROLL = '[data-action-key="reactor"] [data-play-roll="heat"] button.su-roll__roll'

/** What the table shares: every seat's beat, and the crew's names for them. */
type PlayTable = {
  seats: Parameters<typeof tableBeat>[0]
  pilots: Parameters<typeof tableBeat>[1]
}

export function PlayActionsColumn({
  play,
  onShow,
  table,
  ...deps
}: PlayColumnProps & PlayActionsDeps & { onShow?: () => void; table?: PlayTable | undefined }) {
  const actions = usePlayActions(play, deps)
  const wide = usePlayWide()
  const heat = useHeatCheckDue(actions, play.situation === 'boarded', onShow)
  const beat = usePlayBeat(actions, heat)
  const again = useAgain(play.target.pilotId, actions.doneKey)
  if (play.situation === 'downtime') return <PlayDowntimeColumn play={play} actions={actions} />
  // With no beat of your own, the one another seat has in play (ADR-068 §3).
  const shared: TableBeat | null =
    beat.entry === null && table !== undefined
      ? tableBeat(table.seats, table.pilots, play.target.pilotId)
      : null
  // Below `lg` the Moment stands in the list's place, the list a tap away
  // and kept mounted under it, so its lines keep their state and the finish
  // is spoken on the line the beat closes into; from `lg` the list runs
  // under it (ADR-068).
  const listed = wide || beat.entry === null || beat.listShown
  return (
    <>
      <PlayScene scene={play.scene} />
      {beat.entry === null || (!wide && beat.listShown) ? null : (
        <PlayBeat beat={beat} play={play} actions={actions} wide={wide} />
      )}
      {shared === null ? null : <PlayTableMoment beat={shared} />}
      <div className="su-play-act-list" hidden={!listed}>
        {!wide && beat.entry !== null && (
          <Button back variant="ghost" size="compact" onClick={() => beat.showList(false)}>
            {beat.title}
          </Button>
        )}
        {wide ? (
          <Slab
            as="h2"
            label={playCopy('actions')}
            className="su-play-act-head"
            flush
            actions={<PlayActionsTools actions={actions} find />}
          />
        ) : (
          <PlayActionsTools actions={actions} find={false} />
        )}
        <PlayActionsList
          play={play}
          actions={actions}
          head={wide ? 'h3' : 'h2'}
          except={beat.entry?.key ?? null}
          again={again}
        />
      </div>
      {actions.dialog}
    </>
  )
}

/** The last action each pilot finished on this screen, while it stays open: Again's. */
const usedLast = new Map<string, string>()

/**
 * Again (ADR-068): the action this pilot last finished heads the Ready list,
 * one tap, since in a fight most turns repeat. It outlives the column (a tab
 * away and back), not the page.
 */
function useAgain(pilotId: string, doneKey: string | null): string | null {
  if (doneKey !== null) usedLast.set(pilotId, doneKey)
  return usedLast.get(pilotId) ?? null
}

/** The Main display's beat as the column holds it (`momentOf`). */
type PlayBeatState = {
  /** The line on the Main display: the action resolving, or the Reactor when a Heat Check is owed. */
  entry: ListEntry | null
  /** What the beat is: the action, or the Heat Check owed. */
  kind: 'action' | 'owed' | null
  title: string
  /** Below `lg`: the list is shown in the beat's place, the beat kept. */
  listShown: boolean
  showList: (shown: boolean) => void
  /** The owed Heat Check, parked ("Not now") or done with. */
  park: () => void
  /** The owed Heat Check was rolled from the Moment. */
  rolled: boolean
  setRolled: (rolled: boolean) => void
}

/**
 * Which line the Main display holds (ADR-068): the action the seat resolves,
 * else the Heat Check the rules say is owed (unless parked), else none: the
 * list is Ready. A new beat brings the Moment back over the list, and the
 * keyboard onto its first step when it was left nowhere.
 */
function usePlayBeat(actions: PlayActions, heat: HeatCheckDue): PlayBeatState {
  const resolving =
    actions.resolve.kind === 'resolve'
      ? (actions.onHand.find(
          (entry) => entry.kind === 'action' && entry.key === actions.resolvingKey
        ) ?? null)
      : null
  const [parkedAt, setParkedAt] = useState<number | null>(null)
  if (parkedAt !== null && !heat.due) setParkedAt(null)
  const reactor = actions.onHand.find((entry) => entry.kind === 'reactor') ?? null
  const owed = heat.due && parkedAt === null && reactor !== null ? ['heat'] : []
  const { beat } = momentOf({ stop: false, action: resolving?.key ?? null, owed })
  const entry = beat.kind === 'action' ? resolving : beat.kind === 'owed' ? reactor : null
  const key = entry?.key ?? null
  const [listShown, setListShown] = useState(false)
  const [rolled, setRolled] = useState(false)
  // The strip's Heat Check brings the owed beat back onto the Moment first.
  // With an action in hand the owed check waits behind it, so its Reactor
  // row is the list's: the list is shown, never hidden under the action.
  heat.toMoment.current = () => {
    setParkedAt(null)
    setListShown(resolving !== null)
  }
  const [shownFor, setShownFor] = useState(key)
  if (shownFor !== key) {
    setShownFor(key)
    setListShown(false)
    setRolled(false)
  }
  // The keyboard follows the beat when the press that moved it took its
  // control away: onto the Moment's Roll as it opens (r6 A13), and back onto
  // the line's Use as it closes into the list (r4 A3).
  const was = useRef<string | null>(key)
  useEffect(() => {
    const left = was.current
    was.current = key
    const active = document.activeElement
    if (active !== null && active !== document.body && active.isConnected) return
    const to =
      key !== null
        ? `[data-play-moment] [data-action-key="${key}"] ${ROLL_BUTTON}`
        : left !== null
          ? `li[data-action-key="${left}"] .su-play-act__use`
          : null
    if (to !== null) document.querySelector<HTMLElement>(to)?.focus()
  }, [key])
  return {
    entry,
    kind: entry === null ? null : beat.kind === 'owed' ? 'owed' : 'action',
    title: beat.kind === 'owed' ? momentCopy('owedHeatCheck') : (entry?.name ?? ''),
    listShown,
    showList: setListShown,
    park: () => {
      if (rolled) heat.checked()
      else setParkedAt(heat.heat)
    },
    rolled,
    setRolled,
  }
}

/** The beat on the Main display: an action as its own Moment, or the Heat Check owed. */
function PlayBeat({
  beat,
  play,
  actions,
  wide,
}: {
  beat: PlayBeatState
  play: Play
  actions: PlayActions
  wide: boolean
}) {
  const { entry } = beat
  if (entry === null) return null
  const onList = wide ? undefined : () => beat.showList(true)
  if (beat.kind === 'action')
    return <PlayActionEntry entry={entry} play={play} actions={actions} moment={{ onList }} />
  return (
    <PlayMoment
      title={beat.title}
      tone="heat"
      onList={onList}
      actionKey="owed-heat"
      dock={
        <Button variant={beat.rolled ? 'primary' : 'default'} size="compact" onClick={beat.park}>
          {beat.rolled ? playCopy('actionDone') : momentCopy('notNow')}
        </Button>
      }
    >
      {/* The Reactor's own row, its Heat Check the one roll control (R8). */}
      <div
        onClickCapture={(event) => {
          if (event.target instanceof Element && event.target.closest(HEAT_ROLL) !== null)
            beat.setRolled(true)
        }}
      >
        <MiniGrid label={beat.title} play>
          <PlayActionEntry entry={entry} play={play} actions={actions} />
        </MiniGrid>
      </div>
    </PlayMoment>
  )
}

/**
 * The Heat Check the rules call for (Core Book p.234, p.322; r6 A6): at its
 * Heat Capacity the boarded Mech's due Heat Check is the table's strip's line,
 * on every tab, its Roll right there. The roll is the Reactor row's own (one
 * roll control, R8): the strip's button opens Act, presses it and brings its
 * result into view.
 */
type HeatCheckDue = {
  due: boolean
  heat: number
  checked: () => void
  /** Set by the beat: puts the owed Heat Check back on the Moment. */
  toMoment: { current: (() => void) | null }
}

function useHeatCheckDue(
  actions: PlayActions,
  boarded: boolean,
  onShow?: () => void
): HeatCheckDue {
  const toMoment = useRef<(() => void) | null>(null)
  const mech =
    actions.mech === null ? null : (actions.store.get('mech', actions.mech.id) ?? actions.mech)
  const cap = mech === null ? 0 : mechMaxima(mech, actions.pilot?.abilities, []).maxHeat
  const heat = mech === null ? 0 : resolveGauge(mech.currentHeat, cap)
  // Due once per reaching it: after a check at this Heat it waits until the Heat drops.
  const [checkedAt, setCheckedAt] = useState<number | null>(null)
  if (checkedAt !== null && heat < cap) setCheckedAt(null)
  const due = boarded && mech !== null && cap > 0 && heat >= cap && checkedAt !== heat
  const latest = useRef(onShow)
  latest.current = onShow
  useEffect(() => {
    if (!due) {
      setScreenNotices('heat', [])
      return
    }
    const title = playCopy('heatCheckDue', { heat, cap })
    const roll = () => {
      latest.current?.()
      // Onto the Moment, or the list while an action holds it, drawn now, so
      // its stamp is there to press and on screen (ADR-068).
      flushSync(() => toMoment.current?.())
      const stamp = document.querySelector<HTMLButtonElement>(HEAT_ROLL)
      stamp?.click()
      // On the Moment the beat stays until its Done; anywhere else the check is made.
      if (stamp?.closest('[data-play-moment]') == null) setCheckedAt(heat)
      requestAnimationFrame(() => stamp?.closest('li')?.scrollIntoView?.({ block: 'nearest' }))
    }
    setScreenNotices('heat', [
      {
        key: 'heat-check',
        kind: 'heat',
        rank: 'answer',
        ts: 0,
        dismissible: false,
        tone: 'bad',
        title,
        actions: (
          <Button variant="primary" size="compact" onClick={roll}>
            {playCopy('makeTheHeatCheck')}
          </Button>
        ),
        sig: title,
      },
    ])
  }, [due, heat, cap])
  useEffect(() => () => setScreenNotices('heat', []), [])
  return { due, heat, checked: () => setCheckedAt(heat), toMoment }
}
