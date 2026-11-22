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
 * Below `lg`, where the Crew is another tab, a line says who the Mediator
 * gave the turn (r5 A4): "Up now · Razor", or "Up now · You".
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

import { pilotLabel } from 'game-domain/pilotLabel'
import { Slab, Text } from '../components/index'
import { usePilots } from '../lib/entities'
import { playCopy } from '../messages/play'
import { PlayActionsList, PlayActionsTools } from './PlayActionsList'
import { PlayDowntimeColumn } from './PlayDowntimeColumn'
import { PlayScene } from './PlayScene'
import type { PlayColumnProps } from './situation.model'
import type { PlayActionsDeps } from './usePlayActions'
import { usePlayActions } from './usePlayActions'
import { usePlayWide } from './usePlayWide'

export function PlayActionsColumn({ play, ...deps }: PlayColumnProps & PlayActionsDeps) {
  const actions = usePlayActions(play, deps)
  const wide = usePlayWide()
  if (play.situation === 'downtime') return <PlayDowntimeColumn play={play} actions={actions} />
  return (
    <>
      {wide ? null : <UpNowLine upNow={play.scene.upNow} selfId={play.pilot?.id ?? null} />}
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

/** Who is up, on the phone's Act tab (r5 A4); nothing while nobody is. */
function UpNowLine({ upNow, selfId }: { upNow: string | undefined; selfId: string | null }) {
  const up = usePilots().find((pilot) => pilot.id === upNow)
  if (upNow === undefined || (up === undefined && upNow !== selfId)) return null
  return (
    <Text variant="hint" data-up-now="">
      {upNow === selfId
        ? playCopy('upNowYou')
        : playCopy('upNowName', { name: up === undefined ? '' : pilotLabel(up) })}
    </Text>
  )
}
