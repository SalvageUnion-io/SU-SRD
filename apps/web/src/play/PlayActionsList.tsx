/**
 * PlayActionsList — the Actions column outside Downtime (play.md §5, R65):
 * what is on hand, grouped by action type under Mini Slabs (Turn, Short,
 * Long, Reaction, Free, Passive last), the Reactor and Mount closing the
 * list; then the collapsed Not on hand group, each line saying what it
 * needs. Every line is a contentful Mini (ruleset §1.3, ADR-051 §6) in the
 * Mini grid (`MiniGrid`), its list marked `data-play-list` for the form gate
 * (R35). Under its type's heading a row leaves its type chip out (C10). The
 * type filter and, from `lg`, Find (`PlayActionsTools`) ride the column's
 * "Actions" heading line (pin 5). Every heading here is a Slab, so each line
 * stays level 1 (play.md §12).
 *
 * `PlayAwayGroup` (the collapsed group) and `PlayEntryList` are shared with
 * the Downtime column, where the group is the Field actions.
 */

import { useEffect } from 'react'
import {
  Button,
  Callout,
  EmptyState,
  MiniGrid,
  SearchField,
  Segmented,
  SegmentedOption,
  SlabSection,
} from '../components/index'
import { playCopy } from '../messages/play'
import { PlayActionEntry } from './PlayActionEntry'
import type { ActionTypeKey, ListEntry } from './playActions.model'
import { ACTION_TYPE_ORDER, TYPE_FILTERS } from './playActions.model'
import type { Play } from './situation.model'
import type { PlayActions } from './usePlayActions'

/** A list of entries, one contentful Mini each, in the Mini grid. */
export function PlayEntryList({
  entries,
  play,
  actions,
  label,
  grouped = false,
}: {
  entries: readonly ListEntry[]
  play: Play
  actions: PlayActions
  label: string
  /** The list sits under an action type's heading (C10). */
  grouped?: boolean
}) {
  return (
    <MiniGrid label={label} play>
      {entries.map((entry) => (
        <PlayActionEntry
          key={entry.key}
          entry={entry}
          play={play}
          actions={actions}
          grouped={grouped}
        />
      ))}
    </MiniGrid>
  )
}

/** The collapsed group of what is not on hand: "NOT ON HAND ┄┄┄ 3 ⌄". */
export function PlayAwayGroup({
  title,
  entries,
  play,
  actions,
}: {
  title: string
  entries: readonly ListEntry[]
  play: Play
  actions: PlayActions
}) {
  if (entries.length === 0) return null
  return (
    <SlabSection title={title} count={entries.length} fold="closed">
      <PlayEntryList entries={entries} play={play} actions={actions} label={title} />
    </SlabSection>
  )
}

/** The seat names an action this list no longer has: say so, and let it go. */
export function PlayOrphanResolve({ actions }: { actions: PlayActions }) {
  const { resolve, resolvingKey, resolvingUntouched } = actions
  const entry = actions.entries.find((e) => e.key === resolvingKey)
  // A Use that was only opened, whose action then left the hand (the player
  // switched to Downtime): nothing was rolled or spent, so there is nothing to
  // say. It closes, where a note and a Clear button would stay for no reason.
  const stale = resolve.kind === 'resolve' && entry !== undefined && entry.need !== null
  const onBack = resolve.kind === 'resolve' ? resolve.onBack : undefined
  useEffect(() => {
    if (stale && resolvingUntouched) onBack?.()
  }, [stale, resolvingUntouched, onBack])
  if (resolve.kind === 'idle') return null
  if (resolve.kind === 'orphan') return <OrphanNote text={resolve.text} onClear={resolve.onClear} />
  // Resolving an action this Situation does not put on hand (Downtime began
  // mid-roll): its Mini cannot open, so say so here, and let it go.
  if (entry !== undefined && entry.need === null) return null
  if (stale && resolvingUntouched) return null
  return (
    <OrphanNote
      text={playCopy('isNotOnHandNow', { name: entry?.name ?? playCopy('anAction') })}
      onClear={resolve.onBack}
    />
  )
}

/** An unlabelled note with its one way out. */
function OrphanNote({ text, onClear }: { text: string; onClear: () => void }) {
  return (
    <Callout>
      {text}{' '}
      <Button size="mini" variant="ghost" onClick={onClear}>
        {playCopy('clear')}
      </Button>
    </Callout>
  )
}

/**
 * The type filter and, from `lg`, Find, for the "Actions" Slab's heading
 * line: they wrap under the heading when the column is too narrow for one
 * line (`.su-play-act-head`). Below `lg` the filter leads the pane alone.
 */
export function PlayActionsTools({ actions, find }: { actions: PlayActions; find: boolean }) {
  return (
    <div className="su-play-act-tools">
      <Segmented label={playCopy('filterActionsByType')} size="compact">
        {TYPE_FILTERS.map((type) => (
          <SegmentedOption
            key={type}
            pressed={actions.filter === type}
            onClick={() => actions.setFilter(type)}
          >
            {type}
          </SegmentedOption>
        ))}
      </Segmented>
      {find && (
        <SearchField
          aria-label={playCopy('findAnAction')}
          placeholder={playCopy('find')}
          value={actions.find}
          onChange={(event) => actions.setFind(event.target.value)}
          containerClassName="su-play-act-find"
        />
      )}
    </div>
  )
}

/** A group of what is on hand: an action type's rows, or the controls that close the list. */
type Group = { key: ActionTypeKey | 'controls'; label: string; entries: ListEntry[] }

/**
 * What is on hand, grouped by when it can be used, in the list's own order
 * (`ACTION_TYPE_ORDER`); the Reactor and Mount, which are controls, close it.
 * Empty groups are left out.
 */
function onHandGroups(onHand: readonly ListEntry[]): Group[] {
  const groups: Group[] = [
    ...ACTION_TYPE_ORDER.map((type) => ({
      key: type,
      label: type,
      entries: onHand.filter((entry) => entry.kind === 'action' && entry.type === type),
    })),
    {
      key: 'controls',
      label: playCopy('reactorAndMount'),
      entries: onHand.filter((entry) => entry.kind !== 'action'),
    },
  ]
  return groups.filter((group) => group.entries.length > 0)
}

export function PlayActionsList({
  play,
  actions,
  head,
}: {
  play: Play
  actions: PlayActions
  /** A group's heading: under the column's "Actions" from `lg`, under the page's below it. */
  head: 'h2' | 'h3'
}) {
  const groups = onHandGroups(actions.onHand)
  return (
    <>
      <PlayOrphanResolve actions={actions} />
      {groups.length === 0 ? (
        <EmptyState variant="inline" body={playCopy('nothingOnHandMatches')} />
      ) : (
        <div className="su-play-timings">
          {groups.map((group) => (
            <SlabSection
              key={group.key}
              as={head}
              size="mini"
              title={group.label}
              count={group.entries.length}
            >
              <PlayEntryList
                entries={group.entries}
                play={play}
                actions={actions}
                label={group.label}
                grouped={group.key !== 'controls'}
              />
            </SlabSection>
          ))}
        </div>
      )}
      <PlayAwayGroup
        title={playCopy('notOnHand')}
        entries={actions.away}
        play={play}
        actions={actions}
      />
    </>
  )
}
