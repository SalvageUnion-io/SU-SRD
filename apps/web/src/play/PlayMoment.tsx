/**
 * PlayMoment — the Main display's one beat (ADR-068, play.md §19): a titled
 * card in the colour of who is acting, its step track across the top
 * (`BeatTrack`), the beat's content, and its verbs docked at the foot
 * (`.su-play-moment__dock`, under the card: a frame's clipped edge would
 * hold it), in the same place whatever the step. Its
 * root is `[data-play-moment]`, where Play's keys find the open action's
 * Roll and Apply (`useFindKey`); another seat's, the Table's Moment, is
 * `[data-table-moment]` and holds no control.
 *
 * It holds exactly one beat (`moment.model.ts`): an action resolving, lifted
 * out of the Actions list, or what the rules say is owed. The list is a tap
 * away (`onList`), and the beat keeps its step meanwhile: nothing is locked.
 *
 * A level-1 card (N1–N8): what sits in it is plain content, or a Mini.
 */

import type { ReactNode } from 'react'
import { Button, TitledBox } from '../components/index'
import { momentCopy } from '../messages/play-moment'
import type { TrackStep } from './moment.model'

/** What each step of a beat's track is called. */
const STEP_WORDS = {
  activate: momentCopy('activate'),
  roll: momentCopy('roll'),
  push: momentCopy('push'),
  apply: momentCopy('apply'),
} as const

/** A beat's steps: done inked, the current one underlined, the rest to come. */
function BeatTrack({ steps }: { steps: readonly TrackStep[] }) {
  if (steps.length === 0) return null
  return (
    <ol className="su-play-moment__track" aria-label={momentCopy('steps')}>
      {steps.map((step) => (
        <li
          key={step.key}
          data-state={step.state}
          aria-current={step.state === 'on' ? 'true' : undefined}
        >
          {STEP_WORDS[step.key]}
        </li>
      ))}
    </ol>
  )
}

export function PlayMoment({
  title,
  tone,
  chips,
  track,
  dock,
  onList,
  actionKey,
  table = false,
  children,
}: {
  /** The beat's name: the action, or what is owed. */
  title: string
  /** Who acts: the band's tone token (pilot, mech, a companion's, heat). */
  tone: string
  /** The band's chips beside the name. */
  chips?: ReactNode
  /** The beat's steps, where it has them. */
  track?: readonly TrackStep[]
  /** The beat's own verbs, after "‹ List". */
  dock?: ReactNode
  /** Back to the list, the beat kept; omitted where the list is beside it. */
  onList?: (() => void) | undefined
  /** The Actions list's key for what is in the beat, so a control finds its roll here. */
  actionKey: string
  /**
   * Another seat's beat (the Table's Moment), read-only: its root is
   * `[data-table-moment]`, so Play's keys never look in it for a roll.
   */
  table?: boolean
  children: ReactNode
}) {
  return (
    <div {...(table ? { 'data-table-moment': '' } : { 'data-play-moment': '' })}>
      <TitledBox
        as="section"
        title={title}
        tone={tone}
        chips={chips}
        className="su-play-moment"
        bodyClassName="su-play-moment__body"
        body="flush"
      >
        {track === undefined ? null : <BeatTrack steps={track} />}
        <div
          className="su-play-moment__content"
          data-action-key={actionKey}
          data-open={table ? undefined : ''}
        >
          {children}
        </div>
      </TitledBox>
      {onList === undefined && dock === undefined ? null : (
        <div className="su-play-moment__dock">
          {onList === undefined ? null : (
            <Button back variant="ghost" size="compact" onClick={onList}>
              {momentCopy('list')}
            </Button>
          )}
          {dock}
        </div>
      )}
    </div>
  )
}
