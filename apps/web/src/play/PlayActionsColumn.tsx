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
import { resolveGauge } from 'salvageunion-reference/rules'
import { Button, Slab } from '../components/index'
import { playCopy } from '../messages/play'
import { PlayActionsList, PlayActionsTools } from './PlayActionsList'
import { PlayDowntimeColumn } from './PlayDowntimeColumn'
import { PlayScene } from './PlayScene'
import type { PlayColumnProps } from './situation.model'
import { setScreenNotices } from './tableStripSlot.model'
import type { PlayActions, PlayActionsDeps } from './usePlayActions'
import { usePlayActions } from './usePlayActions'
import { usePlayWide } from './usePlayWide'

export function PlayActionsColumn({
  play,
  onShow,
  ...deps
}: PlayColumnProps & PlayActionsDeps & { onShow?: () => void }) {
  const actions = usePlayActions(play, deps)
  const wide = usePlayWide()
  useHeatCheckDue(actions, play.situation === 'boarded', onShow)
  if (play.situation === 'downtime') return <PlayDowntimeColumn play={play} actions={actions} />
  return (
    <>
      <PlayScene scene={play.scene} />
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
      <PlayActionsList play={play} actions={actions} head={wide ? 'h3' : 'h2'} />
      {actions.dialog}
    </>
  )
}

/**
 * The Heat Check the rules call for (Core Book p.234, p.322; r6 A6): at its
 * Heat Capacity the boarded Mech's due Heat Check is the table's strip's line,
 * on every tab, its Roll right there. The roll is the Reactor row's own (one
 * roll control, R8): the strip's button opens Act, presses it and brings its
 * result into view.
 */
function useHeatCheckDue(actions: PlayActions, boarded: boolean, onShow?: () => void): void {
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
      setCheckedAt(heat)
      latest.current?.()
      const stamp = document.querySelector<HTMLButtonElement>(
        '[data-action-key="reactor"] [data-play-roll="heat"] button.su-roll__roll'
      )
      stamp?.click()
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
}
