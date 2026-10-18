/**
 * PlayTables — the Tables section of the Cockpit's right column (play.md §8):
 * "Roll a table…" to find any roll table, the tables the Situation needs
 * pinned as toggles (`pinnedTables`), the open table drawn by the shared roll
 * instrument (`PlayRollTable`, `RollTableInstrument` underneath), and
 * the screen's one Post toggle (§9).
 *
 * Every roll goes through `recordPlayRoll`, so it lands on the Feed, the
 * Game's log and, when the toggle says so, the bound Discord channel.
 *
 * The open table sits directly in the column (level 1, play.md §12).
 */

import type { CSSProperties } from 'react'
import { useId, useState } from 'react'
import { SalvageUnionReference } from 'salvageunion-reference'
import {
  CHAPTER_BAND_COLOR,
  Checkbox,
  SearchField,
  Toggle,
  ToggleGroup,
  tokens,
} from '../components/index'
import type { PlayBinding } from './channels.model'
import { postLabel } from './channels.model'
import { PlayRollTable } from './PlayRollTable'
import { recordPlayRoll } from './playRolls.model'
import { findTables, pinnedTables } from './tables.model'

const STACK = {
  display: 'flex',
  flexDirection: 'column',
  gap: tokens.space[8],
  minWidth: 0,
} satisfies CSSProperties

const PINS = { display: 'flex', flexWrap: 'wrap', gap: tokens.space[4] } satisfies CSSProperties

const FOUND = {
  display: 'flex',
  flexDirection: 'column',
  gap: tokens.space[2],
  listStyle: 'none',
  margin: 0,
  padding: 0,
} satisfies CSSProperties

const POST = {
  alignItems: 'center',
  color: tokens.color.ink,
  display: 'flex',
  fontFamily: tokens.font.body,
  fontSize: tokens.fontSize.caption,
  gap: tokens.space[8],
} satisfies CSSProperties

const HINT = {
  color: tokens.color.ink75,
  fontFamily: tokens.font.body,
  fontSize: tokens.fontSize.note,
  margin: 0,
} satisfies CSSProperties

type PlayTablesProps = {
  /** Downtime is running: its tables are the pinned ones. */
  downtime: boolean
  /** Solo: rolls post to my own channel. */
  solo: boolean
  /** The screen's Post toggle. */
  post: boolean
  onPostChange: (post: boolean) => void
  /** The bound channel: undefined while unknown, null when none. */
  binding: PlayBinding | null | undefined
}

export function PlayTables({ downtime, solo, post, onPostChange, binding }: PlayTablesProps) {
  const [open, setOpen] = useState<string | null>(null)
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
    setQuery('')
  }

  return (
    <div style={STACK}>
      <SearchField
        type="search"
        placeholder="Roll a table…"
        aria-label="Roll a table"
        // It controls the found list only while there is one to point at.
        aria-controls={found.length > 0 ? findId : undefined}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Escape') setQuery('')
        }}
      />
      {found.length > 0 && (
        <ul id={findId} style={FOUND} aria-label="Tables found">
          {found.map((name) => (
            <li key={name}>
              <Toggle pressed={open === name} onClick={() => pick(name)}>
                {name}
              </Toggle>
            </li>
          ))}
        </ul>
      )}
      <ToggleGroup label="Pinned tables" style={PINS}>
        {pinnedTables(downtime).map((name) => (
          <Toggle key={name} pressed={open === name} onClick={() => pick(name)}>
            {name}
          </Toggle>
        ))}
      </ToggleGroup>
      {table && (
        <PlayRollTable
          key={table.name}
          table={table.table}
          name={table.name}
          size="mini"
          tone={CHAPTER_BAND_COLOR.rules}
          onRollResult={(text, _key, dice) =>
            recordPlayRoll({ tableName: table.name, rolls: dice, label: table.name, outcome: text })
          }
        />
      )}
      <div style={POST}>
        <Checkbox
          id={postId}
          checked={post && binding != null}
          disabled={binding == null}
          onChange={(e) => onPostChange(e.target.checked)}
        />
        <label htmlFor={postId}>{postLabel(solo, binding)}</label>
      </div>
      {binding === null && (
        <p style={HINT}>
          No channel is bound yet, so rolls stay in Play. Connect one from the channel button.
        </p>
      )}
    </div>
  )
}
