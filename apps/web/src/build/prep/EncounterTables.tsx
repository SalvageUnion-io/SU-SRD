/**
 * EncounterTables — an encounter's "Tables to hand" (ADR-059): the roll tables
 * it pins in Play, found with "Pin a table…", each opening to read and try
 * (`PlayRollTable`), Unpin beside it.
 */

import { ENCOUNTER_MAX_TABLES } from 'game-domain/schemas/encounter'
import type { CSSProperties } from 'react'
import { useState } from 'react'
import { SalvageUnionReference } from 'salvageunion-reference'
import { RollMini } from '../../components/entity/forms/RollMini'
import {
  Button,
  CHAPTER_BAND_COLOR,
  EmptyState,
  MiniGrid,
  SearchField,
  SlabSection,
  Stack,
  tokens,
} from '../../components/index'
import { buildPrepCopy } from '../../messages/build-prep'
import { PlayRollTable } from '../../play/PlayRollTable'
import { findTables } from '../../play/tables.model'

/** Room inside a table list for the open table's ring, as Play's Tables give it. */
const TABLE_LIST = { padding: tokens.space[4] } satisfies CSSProperties

/** Tables to hand: the pinned ones, each opening to read and try, and "Pin a table…". */
export function EncounterTables({
  tables,
  canWrite,
  onPin,
  onUnpin,
}: {
  tables: readonly string[]
  canWrite: boolean
  onPin: (name: string) => void
  onUnpin: (name: string) => void
}) {
  const [open, setOpen] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const all = SalvageUnionReference.RollTables.all().map((t) => t.name)
  const found = findTables(
    all.filter((name) => !tables.includes(name)),
    query
  )
  const table = open === null ? undefined : SalvageUnionReference.RollTables.getByName(open)
  const full = tables.length >= ENCOUNTER_MAX_TABLES

  return (
    <SlabSection
      as="h2"
      id="encounter-tables"
      title={buildPrepCopy('tablesToHand')}
      count={String(tables.length)}
    >
      {canWrite && !full && (
        <SearchField
          type="search"
          placeholder={buildPrepCopy('pinATablePlaceholder')}
          aria-label={buildPrepCopy('pinATable')}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') setQuery('')
          }}
        />
      )}
      {found.length > 0 && (
        <MiniGrid label={buildPrepCopy('tablesFound')} style={TABLE_LIST}>
          {found.map((name) => (
            <li key={name} data-choice-toggle="">
              <RollMini
                name={name}
                toggle={{
                  pressed: false,
                  onToggle: () => {
                    onPin(name)
                    setQuery('')
                  },
                }}
              />
            </li>
          ))}
        </MiniGrid>
      )}
      {tables.length === 0 ? (
        <EmptyState variant="inline" body={buildPrepCopy('noTables')} />
      ) : (
        <MiniGrid label={buildPrepCopy('pinnedTables')} style={TABLE_LIST}>
          {tables.map((name) => (
            <li key={name} data-choice-toggle="">
              <RollMini
                name={name}
                toggle={{
                  pressed: open === name,
                  onToggle: () => setOpen((current) => (current === name ? null : name)),
                  dim: open !== null && open !== name,
                }}
              />
            </li>
          ))}
        </MiniGrid>
      )}
      {open !== null && tables.includes(open) && (
        <Stack gap={8}>
          {table && (
            <PlayRollTable
              key={table.name}
              table={table.table}
              name={table.name}
              size="mini"
              tone={CHAPTER_BAND_COLOR.rules}
            />
          )}
          {canWrite && (
            <div>
              <Button
                size="mini"
                variant="ghost"
                onClick={() => {
                  onUnpin(open)
                  setOpen(null)
                }}
              >
                {buildPrepCopy('unpin', { name: open })}
              </Button>
            </div>
          )}
        </Stack>
      )}
    </SlabSection>
  )
}
