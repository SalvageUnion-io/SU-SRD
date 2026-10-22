/**
 * PlayActionRow — one action in the Actions list (play.md §5): the action's
 * contentful Mini, its text under its head, in the list's Mini grid
 * (ruleset §1.3: Play's lists are Minis), its Mini chips in the
 * shared stat order with the cost last. On hand it carries Use, after the cost
 * in its chip group (C8, ruleset §1.4), which opens the resolve in place in
 * the Mini's body (N3: the action's own text, then `PlayResolveSteps`), with
 * Cancel in Use's slot; not on hand it is dimmed, and says what it needs as a
 * chip ("needs Boarded"). Its band is its source unit's tone dulled (pilot or
 * mech, never black), and Use is a filled button; an action
 * it cannot use now (locked, or read-only) is faded too.
 *
 * A Mini nests nothing (E6): the resolve inside it, its roll instrument (R8)
 * and its steps, is plain content, never an entity of its own (play.md §12).
 */

import { useMemo } from 'react'
import { toEntityModel } from 'salvageunion-reference'
import { Button, Entity, Stat } from '../components/index'
import { playCopy } from '../messages/play'
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

/** Why a line is not on hand ("needs Boarded"), as its state chip (C8). */
export function NeedChip({ need }: { need: string }) {
  return <Stat size="mini" label={need} />
}

export function PlayActionRow({ entry, resolve, onUse, canWrite, locked }: PlayActionRowProps) {
  const model = useMemo(() => toEntityModel(entry.action.action), [entry.action.action])
  const open = resolve !== null
  const away = entry.need !== null
  const controls = away ? undefined : open ? (
    <Button
      size="mini"
      onClick={resolve.onBack}
      aria-label={playCopy('cancel2', { name: entry.name })}
    >
      {playCopy('cancel')}
    </Button>
  ) : (
    <Button
      size="mini"
      variant="ink"
      onClick={onUse}
      disabled={!canWrite}
      aria-label={playCopy('use2', { name: entry.name })}
      title={locked ?? undefined}
    >
      {playCopy('use')}
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
      <Entity
        size="mini"
        context="play"
        model={model}
        instance={entry.action.condition === 'destroyed' ? { condition: 'destroyed' } : undefined}
        tint={entry.source}
        dim={away || locked !== null || !canWrite}
        {...(away ? { state: <NeedChip need={NEED_TEXT[entry.need ?? 'boarded']} /> } : {})}
        {...(controls ? { controls } : {})}
        // Contentful (N3): the action's own text, then, while it resolves, its steps.
        body={open ? { children: <PlayResolveSteps view={resolve} canWrite={canWrite} /> } : {}}
      />
    </li>
  )
}
