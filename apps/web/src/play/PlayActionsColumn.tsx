/**
 * PlayActionsColumn — the Cockpit's centre column (play.md §5, §6).
 *
 * Outside Downtime it is one flattened Actions list (`PlayActionsList`): every
 * action of the pilot and the mech, the Reactor and Mount, sorted by action
 * type (Turn, Short, Long, Reaction, Free, Downtime), with a type filter and
 * Find on the "Actions" heading line (wireframe pin 5); what is on hand first, what is not collapsed below with its reason.
 * Every line is a Token (ruleset §1.3); Use opens the action in place as its
 * Token's contentful body: Activate, Roll, Push?, Apply, on the seat's
 * `resolving`.
 *
 * In Downtime it becomes the Downtime track and the current step
 * (`PlayDowntimeColumn`), the Downtime actions under it.
 *
 * Its headings are Slabs, never a `TitledBox`, so each line is level 1 and
 * what sits inside one is plain content (the Nested Frames Audit, play.md §12).
 * Every roll made here goes on Play's one roll log (`playRolls.model.ts`).
 */

import { Slab } from '../components/index'
import { PlayActionsList, PlayActionsTools } from './PlayActionsList'
import { PlayDowntimeColumn } from './PlayDowntimeColumn'
import type { PlayColumnProps } from './situation.model'
import type { PlayActionsDeps } from './usePlayActions'
import { usePlayActions } from './usePlayActions'

export function PlayActionsColumn({ play, ...deps }: PlayColumnProps & PlayActionsDeps) {
  const actions = usePlayActions(play, deps)
  if (play.situation === 'downtime') return <PlayDowntimeColumn play={play} actions={actions} />
  return (
    <>
      <Slab
        as="h2"
        label="Actions"
        className="su-play-act-head"
        actions={<PlayActionsTools actions={actions} />}
      />
      <PlayActionsList play={play} actions={actions} />
    </>
  )
}
