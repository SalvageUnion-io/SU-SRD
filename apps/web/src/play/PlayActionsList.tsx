/**
 * PlayActionsList — the Actions column outside Downtime (play.md §5,
 * wireframe pins 5–7): what is on hand ("On hand · In <mech>" or "On foot"),
 * then the collapsed Not on hand group, each row saying what it needs. The
 * type filter and Find (`PlayActionsTools`) ride the column's "Actions"
 * heading line (pin 5). Every heading here is a Slab, so each row stays
 * level 1 (play.md §12).
 *
 * `PlayAwayGroup` (the collapsed group) and `PlayEntryList` are shared with
 * the Downtime column, where the group is the Field actions.
 */

import {
  Button,
  Callout,
  EmptyState,
  SearchField,
  Segmented,
  SegmentedOption,
  Slab,
  SlabSection,
} from '../components/index'
import { PlayActionEntry } from './PlayActionEntry'
import type { ListEntry } from './playActions.model'
import { TYPE_FILTERS } from './playActions.model'
import type { Play } from './situation.model'
import type { PlayActions } from './usePlayActions'

/** A list of entries, one `<li>` each. */
export function PlayEntryList({
  entries,
  play,
  actions,
  label,
}: {
  entries: readonly ListEntry[]
  play: Play
  actions: PlayActions
  label: string
}) {
  return (
    <ul className="su-play-act-list" aria-label={label}>
      {entries.map((entry) => (
        <PlayActionEntry key={entry.key} entry={entry} play={play} actions={actions} />
      ))}
    </ul>
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
  const { resolve, resolvingKey } = actions
  if (resolve.kind === 'idle') return null
  if (resolve.kind === 'orphan') return <OrphanNote text={resolve.text} onClear={resolve.onClear} />
  // Resolving an action this Situation does not put on hand (Downtime began
  // mid-roll): its Row cannot open, so say so here, and let it go.
  const entry = actions.entries.find((e) => e.key === resolvingKey)
  if (entry !== undefined && entry.need === null) return null
  return (
    <OrphanNote
      text={`${entry?.name ?? 'An action'} is not on hand now.`}
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
        Clear
      </Button>
    </Callout>
  )
}

/**
 * The type filter and Find, for the "Actions" Slab's heading line: they wrap
 * under the heading, and onto two lines, when the column is too narrow for
 * one (`.su-play-act-head`).
 */
export function PlayActionsTools({ actions }: { actions: PlayActions }) {
  return (
    <div className="su-play-act-tools">
      <Segmented label="Filter actions by type" size="compact">
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
      <SearchField
        aria-label="Find an action"
        placeholder="Find…"
        value={actions.find}
        onChange={(event) => actions.setFind(event.target.value)}
        containerClassName="su-play-act-find"
      />
    </div>
  )
}

export function PlayActionsList({ play, actions }: { play: Play; actions: PlayActions }) {
  const where =
    play.situation === 'boarded' && actions.mech !== null ? `In ${actions.mech.name}` : 'On foot'
  return (
    <>
      <PlayOrphanResolve actions={actions} />
      <Slab label={`On hand · ${where}`} />
      {actions.onHand.length === 0 ? (
        <EmptyState variant="inline" body="Nothing on hand matches." />
      ) : (
        <PlayEntryList entries={actions.onHand} play={play} actions={actions} label="On hand" />
      )}
      <PlayAwayGroup title="Not on hand" entries={actions.away} play={play} actions={actions} />
    </>
  )
}
