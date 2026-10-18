/**
 * PlayActionRow — one action in the Actions list (play.md §5): the action's
 * Row (`form="row"`), its chips in the shared stat order with the cost last.
 * On hand it carries Use, which opens the resolve in place, in the Row's own
 * body (`PlayResolveSteps`), with Cancel in its head; not on hand it is
 * dashed and dimmed, and says what it needs ("needs Boarded").
 *
 * The Row is level 1 in the column; the resolve inside it is plain content
 * (the Nested Frames Audit, play.md §12). While open, the Row shows the
 * action's own text, the one thing the deck's full card added.
 */

import { useMemo } from 'react'
import { toEntityModel } from 'salvageunion-reference'
import { Row } from '../entity/forms/Row'
import { Button } from '../index'
import { PlayResolveSteps } from './PlayResolveSteps'
import type { ListEntry } from './playActions.model'
import { NEED_TEXT } from './playActions.model'
import type { ResolveModel } from './useActionsDeck'

type ActionEntry = Extract<ListEntry, { kind: 'action' }>

type PlayActionRowProps = {
  entry: ActionEntry
  /** The seat's resolve, when it is this action's; null otherwise. */
  resolve: Extract<ResolveModel, { kind: 'resolve' }> | null
  onUse: () => void
  canWrite: boolean
  /** Why it cannot run as it stands (out of range, over the Heat Cap), or null. */
  locked: string | null
}

export function PlayActionRow({ entry, resolve, onUse, canWrite, locked }: PlayActionRowProps) {
  const model = useMemo(() => toEntityModel(entry.action.action), [entry.action.action])
  const open = resolve !== null
  const away = entry.need !== null
  const controls = away ? (
    <span className="su-play-act__need">{NEED_TEXT[entry.need ?? 'boarded']}</span>
  ) : open ? (
    <Button size="mini" onClick={resolve.onBack} aria-label={`Cancel ${entry.name}`}>
      Cancel
    </Button>
  ) : (
    <Button
      size="mini"
      onClick={onUse}
      disabled={!canWrite}
      aria-label={`Use ${entry.name}`}
      title={locked ?? undefined}
    >
      Use
    </Button>
  )
  return (
    <li
      className="su-play-act"
      data-away={away || undefined}
      data-open={open || undefined}
      data-locked={(!away && locked !== null) || undefined}
      data-action-key={entry.key}
    >
      <Row
        model={model}
        instance={entry.action.condition === 'destroyed' ? { condition: 'destroyed' } : undefined}
        lead={open}
        omit={['art']}
        slots={{
          controls,
          ...(open ? { leading: <PlayResolveSteps view={resolve} canWrite={canWrite} /> } : {}),
        }}
      />
    </li>
  )
}
