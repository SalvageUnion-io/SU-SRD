/**
 * PlayTables — the Tables section of the Cockpit's right column (play.md §8):
 * "Roll a table…" to find any roll table, the tables found, the Mediator's
 * running encounter's own (ADR-059) and the tables the Situation needs pinned
 * (`pinnedTables`), each a list of roll table Minis
 * in the Mini grid (`MiniGrid`; ruleset §1.3: Play's lists are Minis), the open table drawn by
 * the shared roll instrument (`PlayRollTable`, `RollTableInstrument`
 * underneath), and the screen's one Post toggle (§9).
 *
 * Choosing a table's Mini opens it (R8: the instrument, open, its stamp the
 * one roll); the open one is the pressed toggle Mini (EDL Modes), the rest
 * dimmed beside it, and choosing it again closes it.
 *
 * Every roll goes through `recordPlayRoll`, so it lands on the Feed, the
 * Game's log and, when the toggle says so, the bound Discord channel.
 *
 * The open table sits directly in the column (level 1, play.md §12).
 */

import type { CSSProperties } from 'react'
import { useId, useState } from 'react'
import type { RefObjectTable } from 'salvageunion-reference'
import { SalvageUnionReference } from 'salvageunion-reference'
import type { OverloadTable } from 'salvageunion-reference/rules'
import { RollMini } from '../components/entity/forms/RollMini'
import {
  Button,
  CHAPTER_BAND_COLOR,
  Checkbox,
  MiniGrid,
  SearchField,
  Text,
  tokens,
} from '../components/index'
import { playCopy } from '../messages/play'
import type { PlayBinding } from './channels.model'
import { postLabel } from './channels.model'
import type { RosterLine } from './mediator/encounterRoster.model'
import { readRoster } from './mediator/encounterRoster.model'
import { PlayRollTable } from './PlayRollTable'
import { recordPlayRoll } from './playRolls.model'
import { findTables, pinnedTables } from './tables.model'

const STACK = {
  display: 'flex',
  flexDirection: 'column',
  gap: tokens.space[8],
  minWidth: 0,
} satisfies CSSProperties

const POST = {
  alignItems: 'center',
  color: tokens.color.ink,
  display: 'flex',
  fontFamily: tokens.font.body,
  fontSize: tokens.fontSize.caption,
  gap: tokens.space[8],
} satisfies CSSProperties

type PlayTablesProps = {
  /** Downtime is running: its tables are the pinned ones. */
  downtime: boolean
  /** Which Damage and Overload tables the fight pins: a Bio-Chassis's own, or the reactor's. */
  mechTables?: OverloadTable | undefined
  /** Solo: rolls post to my own channel. */
  solo: boolean
  /** The screen's Post toggle. */
  post: boolean
  onPostChange: (post: boolean) => void
  /** The bound channel: undefined while unknown, null when none. */
  binding: PlayBinding | null | undefined
  /** The Mediator's running encounter's own tables (ADR-059), above the Situation's. */
  prepared?: readonly string[] | undefined
  /**
   * The Mediator's: field a rolled encounter row's roster on the Opposition
   * (the Workshop Manual's region tables, p.270). Absent for a player.
   */
  onField?: ((lines: readonly RosterLine[]) => Promise<number>) | undefined
}

export function PlayTables({
  downtime,
  mechTables = 'reactor',
  solo,
  post,
  onPostChange,
  binding,
  prepared = [],
  onField,
}: PlayTablesProps) {
  const [open, setOpen] = useState<string | null>(null)
  // The row the open table last landed on, by its range key.
  const [landed, setLanded] = useState<string | null>(null)
  const postId = useId()
  const [query, setQuery] = useState('')
  const findId = useId()
  const tables = SalvageUnionReference.RollTables.all()
  const found = findTables(
    tables.map((t) => t.name),
    query
  )
  const table = open === null ? undefined : SalvageUnionReference.RollTables.getByName(open)

  const pick = (name: string) => {
    setOpen((current) => (current === name ? null : name))
    setLanded(null)
    setQuery('')
  }
  const roster = onField && table && landed !== null ? rosterOf(table.table, landed) : []

  return (
    <div style={STACK}>
      <SearchField
        type="search"
        placeholder={playCopy('rollATable')}
        aria-label={playCopy('rollATable2')}
        // It controls the found list only while there is one to point at.
        aria-controls={found.length > 0 ? findId : undefined}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Escape') setQuery('')
        }}
      />
      {found.length > 0 && (
        <TableMinis
          id={findId}
          label={playCopy('tablesFound')}
          names={found}
          open={open}
          onPick={pick}
        />
      )}
      {prepared.length > 0 && (
        <TableMinis
          label={playCopy('thisEncountersTables')}
          names={prepared}
          open={open}
          onPick={pick}
        />
      )}
      <TableMinis
        label={playCopy('pinnedTables')}
        names={pinnedTables(downtime, mechTables)}
        open={open}
        onPick={pick}
      />
      {table && (
        <PlayRollTable
          key={table.name}
          table={table.table}
          name={table.name}
          size="mini"
          tone={CHAPTER_BAND_COLOR.rules}
          onRollResult={(text, key, dice) => {
            setLanded(key)
            recordPlayRoll({ tableName: table.name, rolls: dice, label: table.name, outcome: text })
          }}
        />
      )}
      {onField && roster.length > 0 && (
        <FieldRoster key={`${open}:${landed}`} lines={roster} onField={onField} />
      )}
      <div style={POST}>
        {/* Named by the words beside it, never a hand-rolled <label> (R16). */}
        <Checkbox
          id={postId}
          checked={post && binding != null}
          disabled={binding == null}
          onChange={(e) => onPostChange(e.target.checked)}
          aria-labelledby={`${postId}-label`}
          hitArea
        />
        <span id={`${postId}-label`}>{postLabel(solo, binding)}</span>
      </div>
      {binding === null && <Text variant="note">{playCopy('noChannelIsBoundYet')}</Text>}
    </div>
  )
}

/** A rolled row's roster, read, when the table is an encounter table. */
function rosterOf(table: RefObjectTable, key: string): RosterLine[] {
  if (table.type !== 'encounter') return []
  const row = (table as Record<string, unknown>)[key]
  const lines =
    row && typeof row === 'object' && Array.isArray((row as { roster?: unknown }).roster)
      ? ((row as { roster: string[] }).roster ?? [])
      : []
  return readRoster(lines)
}

/** The rolled row's opposition, and the one press that fields it. */
function FieldRoster({
  lines,
  onField,
}: {
  lines: RosterLine[]
  onField: (lines: readonly RosterLine[]) => Promise<number>
}) {
  const [state, setState] = useState<'idle' | 'adding' | { added: number }>('idle')
  const fieldable = lines.some((line) => line.draw !== null)
  async function field() {
    setState('adding')
    try {
      setState({ added: await onField(lines) })
    } catch {
      setState('idle')
    }
  }
  return (
    <section aria-label={playCopy('rolledRoster')} style={STACK}>
      <ul className="su-play-roster">
        {lines.map((line) => (
          <li key={line.text}>
            {line.draw === null ? `${line.text} (${playCopy('notAnNpc')})` : line.text}
          </li>
        ))}
      </ul>
      {typeof state === 'object' ? (
        <Text variant="note" aria-live="polite">
          {playCopy('addedToTheOpposition', { added: state.added })}
        </Text>
      ) : (
        <Button
          size="compact"
          disabled={!fieldable || state === 'adding'}
          onClick={() => void field()}
        >
          {state === 'adding' ? playCopy('addingToTheOpposition') : playCopy('addToTheOpposition')}
        </Button>
      )}
    </section>
  )
}

/** A list of tables, roll table Minis in the Mini grid, the open one pressed. */
function TableMinis({
  id,
  label,
  names,
  open,
  onPick,
}: {
  id?: string
  label: string
  names: readonly string[]
  /** The open table's name, if one is. */
  open: string | null
  onPick: (name: string) => void
}) {
  return (
    <MiniGrid label={label} play className="su-play-tables" id={id}>
      {names.map((name) => (
        <li key={name} data-choice-toggle="">
          <RollMini
            name={name}
            toggle={{
              pressed: open === name,
              onToggle: () => onPick(name),
              dim: open !== null && open !== name,
            }}
          />
        </li>
      ))}
    </MiniGrid>
  )
}
