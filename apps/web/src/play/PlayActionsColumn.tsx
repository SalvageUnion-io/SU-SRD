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
 * Whose turn it is is the table's strip's, on every seat (r6 A2). At its
 * Heat Capacity the boarded Mech's Heat Check heads the list (r6 A6).
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
import { resolveGauge } from 'salvageunion-reference/rules'
import { Button, Callout, Slab, Text } from '../components/index'
import { playCopy } from '../messages/play'
import { PlayActionsList, PlayActionsTools } from './PlayActionsList'
import { PlayDowntimeColumn } from './PlayDowntimeColumn'
import { PlayScene } from './PlayScene'
import type { PlayColumnProps } from './situation.model'
import type { PlayActions, PlayActionsDeps } from './usePlayActions'
import { usePlayActions } from './usePlayActions'
import { usePlayWide } from './usePlayWide'

export function PlayActionsColumn({ play, ...deps }: PlayColumnProps & PlayActionsDeps) {
  const actions = usePlayActions(play, deps)
  const wide = usePlayWide()
  if (play.situation === 'downtime') return <PlayDowntimeColumn play={play} actions={actions} />
  return (
    <>
      {play.situation === 'boarded' && <HeatCheckDue actions={actions} />}
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
 * The Heat Check the rules call for (Core Book p.234, r6 A6): at its Heat
 * Capacity the boarded Mech's line heads the Actions, its Roll right there.
 * The roll is the Reactor row's own (one roll control, R8): this presses it
 * and brings its result into view.
 */
function HeatCheckDue({ actions }: { actions: PlayActions }) {
  const mech =
    actions.mech === null ? null : (actions.store.get('mech', actions.mech.id) ?? actions.mech)
  if (mech === null) return null
  const cap = mechMaxima(mech, actions.pilot?.abilities, []).maxHeat
  const heat = resolveGauge(mech.currentHeat, cap)
  if (cap <= 0 || heat < cap) return null
  const roll = () => {
    const stamp = document.querySelector<HTMLButtonElement>(
      '[data-action-key="reactor"] .su-play-resolve button[aria-label^="Roll"]'
    )
    stamp?.click()
    stamp?.closest('li')?.scrollIntoView?.({ block: 'nearest' })
  }
  return (
    <Callout tone="bad" role="status">
      <div className="su-table-notice">
        <Text>{playCopy('heatCheckDue', { heat, cap })}</Text>
        <Button variant="primary" size="compact" onClick={roll}>
          {playCopy('makeTheHeatCheck')}
        </Button>
      </div>
    </Callout>
  )
}
