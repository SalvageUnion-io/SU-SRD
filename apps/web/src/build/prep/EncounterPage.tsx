/**
 * EncounterPage — `/encounters/:id`, one of the Mediator's encounters
 * (ADR-059), built ahead of the session and run later from a Game's Play.
 *
 * A Live Sheet as an NPC's is (hard rule R11): the Denizens navy band, hatched
 * as user-made with "Made by You", Read | Edit and the "⋯" (Delete) in its
 * corner. Read is the printed encounter, its empty sections left out; Edit
 * gives the name field, the + buttons and every row's "⋯" back. Then
 *
 *  - **Opposition**: what it fields, each a Compact with its HP or SP and a
 *    "⋯" menu (Rename…, Remove), drawn with + Add from the same picker
 *    Play's Opposition uses (`OppositionPicker`), the Mediator's own saved
 *    patterns included;
 *  - **Tables to hand**: the roll tables it pins in Play, found with "Pin a
 *    table…", each opening to read and try (`PlayRollTable`), Unpin beside it;
 *  - **Notes**: the Mediator's own, never shown to players;
 *  - **Briefing**: what the Pilots see, which Play offers to tell the table;
 *  - **Spoils**: what the opposition could leave behind (`EncounterThreat`).
 *
 * Opponents can be put in groups, each arriving in a wave (`EncounterGroups`).
 * Under the opposition, a threat read against a crew the Mediator picks.
 * Groups, the briefing, the threat read and the spoils are behind the
 * `encounterSheet` flag (ADR-060).
 *
 * Every edit is one store write (server-first, ADR-034), run one after
 * another so two quick adds both land.
 */

import type { Encounter, EncounterGroup, EncounterOpponent } from 'game-domain/schemas/encounter'
import {
  ENCOUNTER_MAX_BRIEFING,
  ENCOUNTER_MAX_NOTES,
  ENCOUNTER_MAX_TABLES,
} from 'game-domain/schemas/encounter'
import type { CSSProperties } from 'react'
import { useRef, useState } from 'react'
import { SalvageUnionReference } from 'salvageunion-reference'
import { RollMini } from '../../components/entity/forms/RollMini'
import type { HeaderMenuItem } from '../../components/index'
import {
  Button,
  CHAPTER_BAND_COLOR,
  EmptyState,
  Field,
  Grid,
  HeaderMenu,
  MiniGrid,
  SearchField,
  SlabSection,
  Stack,
  Stat,
  Text,
  toast,
  tokens,
} from '../../components/index'
import { NotFoundPanel } from '../../components/shared/RouteFallbacks'
import { UnitRow } from '../../components/shared/UnitRow'
import { useConfirm } from '../../components/shared/useConfirm'
import { useGo } from '../../components/shared/useGo'
import { useConnection } from '../../lib/connection/connectionContext'
import { flagOn } from '../../lib/flags'
import { ROW_ACTION_COPY } from '../../lib/games/rowActionCopy'
import { reportWriteFailure } from '../../lib/runWrite'
import { buildPrepCopy } from '../../messages/build-prep'
import { OppositionDialogs, OppositionPicker } from '../../play/mediator/OppositionPicker'
import type { SavedPattern, TrayNpc } from '../../play/mediator/opposition.model'
import { newTrayNpc } from '../../play/mediator/opposition.model'
import { PlayRollTable } from '../../play/PlayRollTable'
import { findTables } from '../../play/tables.model'
import { usePatternStore } from '../../stores/patternStore'
import { usePrepStore } from '../../stores/prepStore'
import { LiveSheet } from '../sheet/LiveSheet'
import { SheetActionsMenu } from '../sheet/SheetActionsMenu'
import { SheetModeToggle } from '../sheet/SheetModeToggle'
import { SheetPickerModal } from '../sheet/SheetPickerModal'
import { useSheetModeStore } from '../sheet/sheetMode.model'
import { GroupedOpposition, GroupNameDialog } from './EncounterGroups'
import { EncounterSpoils, ThreatReadLine } from './EncounterThreat'
import {
  addGroup,
  groupsOf,
  hasRoomFor,
  hasRoomForGroup,
  moveMenu,
  moveToGroup,
  opponentAsTray,
  opponentFrom,
  oppositionBlocks,
  pinTable,
  removeGroup,
  renameGroup,
  setGroupWave,
  unpinTable,
} from './encounter.model'

const LIST = {
  display: 'flex',
  flexDirection: 'column',
  gap: tokens.space[8],
  listStyle: 'none',
  margin: 0,
  padding: 0,
} satisfies CSSProperties

const ROW = { alignItems: 'start' } satisfies CSSProperties

/** The sheet body, as an NPC's: its sections a column apart. */
const SHEET = {
  containerType: 'inline-size',
  display: 'flex',
  flexDirection: 'column',
  gap: tokens.space[24],
} satisfies CSSProperties

/** Room inside a table list for the open table's ring, as Play's Tables give it. */
const TABLE_LIST = { padding: tokens.space[4] } satisfies CSSProperties

/** The page, or why there is none: the encounter is the owner's alone, so absent is not found. */
export function EncounterPage({ id }: { id: string }) {
  const encounter = usePrepStore((s) => s.encounters.find((e) => e.id === id) ?? null)
  if (encounter === null) {
    return (
      <NotFoundPanel
        title={buildPrepCopy('notFound')}
        message={buildPrepCopy('notFoundBody')}
        back={{ href: '/', label: buildPrepCopy('backToTheTrainingBay') }}
      />
    )
  }
  return <EncounterBody encounter={encounter} />
}

function EncounterBody({ encounter }: { encounter: Encounter }) {
  const { canWrite: connected } = useConnection()
  // Read until Edit is pressed, as on every sheet (R11); nothing writes in Read.
  const mode = useSheetModeStore()
  const canWrite = connected && mode.editing
  const go = useGo()
  const { confirm, dialog } = useConfirm()
  const patterns = usePatternStore((s) => s.mechPatterns)
  const [picking, setPicking] = useState(false)
  const [renaming, setRenaming] = useState<TrayNpc | null>(null)
  // The group being named: `null` for a new one, absent when the dialog is shut.
  const [naming, setNaming] = useState<EncounterGroup | null | undefined>(undefined)
  const grouping = flagOn('encounterSheet')
  const groups = groupsOf(encounter)
  // Writes go one after another, each from the store's latest copy, so two
  // quick adds do not both start from the same opposition and drop one.
  const queue = useRef<Promise<unknown>>(Promise.resolve())

  const write = (change: (current: Encounter) => Partial<Encounter>) => {
    const next = queue.current.then(async () => {
      const current = usePrepStore.getState().get(encounter.id)
      if (current === null) return
      await usePrepStore.getState().update(encounter.id, change(current))
    })
    queue.current = next.catch(reportWriteFailure)
    return next
  }

  // The picker fields the Mediator's own saved patterns: an encounter is on
  // their shelf, in no Game whose crew could have shared one.
  const saved: SavedPattern[] = patterns.map((p) => ({
    id: p.id,
    name: p.name,
    chassisRef: p.chassisRef,
    systems: p.systems,
    modules: p.modules,
    madeBy: 'You',
  }))
  const fielded = encounter.opposition.map(opponentAsTray)

  const remove = (opponent: EncounterOpponent) =>
    void write((current) => ({
      opposition: current.opposition.filter((o) => o.id !== opponent.id),
    }))

  const move = (opponent: EncounterOpponent, groupId: string | null) =>
    void write((current) => ({
      opposition: moveToGroup(current.opposition, opponent.id, groupId),
    }))

  const opponentMenu = (opponent: EncounterOpponent): HeaderMenuItem[][] => {
    if (!canWrite) return []
    const moves = grouping ? moveMenu(opponent, groups, (groupId) => move(opponent, groupId)) : []
    return [
      [
        {
          id: 'rename',
          label: 'Rename…',
          onSelect: () => setRenaming(opponentAsTray(opponent)),
        },
        { id: 'remove', label: 'Remove', onSelect: () => remove(opponent) },
      ],
      ...(moves.length > 0 ? [moves] : []),
    ]
  }

  const opponentRow = (opponent: EncounterOpponent) => (
    <UnitRow
      kind="npc"
      name={opponent.name}
      readings={[{ label: opponent.statKind === 'sp' ? 'SP' : 'HP', value: opponent.maxHp }]}
      trailing={
        canWrite ? (
          <HeaderMenu
            variant="overflow"
            trigger={null}
            label={buildPrepCopy('moreFor', { name: opponent.name })}
            sections={opponentMenu(opponent)}
          />
        ) : undefined
      }
    />
  )

  const saveGroupName = async (name: string) => {
    if (naming === undefined) return
    const renamed = naming
    await write((current) =>
      renamed === null
        ? { groups: addGroup(current, name, crypto.randomUUID()) }
        : { groups: renameGroup(groupsOf(current), renamed.id, name) }
    )
  }

  const deleteEncounter = () =>
    confirm({
      ...ROW_ACTION_COPY.deleteBuild(encounter.name),
      onConfirm: async () => {
        await usePrepStore.getState().delete(encounter.id)
        go('/')
      },
    })

  return (
    <>
      <LiveSheet
        variant="encounter"
        name={encounter.name}
        userMade={{ madeBy: buildPrepCopy('you') }}
        band={
          connected
            ? { actions: <SheetModeToggle mode={mode} kind={buildPrepCopy('encounterKind')} /> }
            : undefined
        }
        actions={
          connected ? (
            <SheetActionsMenu>
              <Button
                variant="ghost"
                onClick={deleteEncounter}
                aria-label={buildPrepCopy('deleteNamed', { name: encounter.name })}
              >
                {buildPrepCopy('delete')}
              </Button>
            </SheetActionsMenu>
          ) : undefined
        }
        renderBody={() => (
          <section aria-label={encounter.name} className="su-sheet-section" style={SHEET}>
            {canWrite && <Text variant="note">{buildPrepCopy('lede')}</Text>}
            {canWrite && (
              <Field
                label={buildPrepCopy('name')}
                value={encounter.name}
                onSave={async (next) => {
                  const name = next.trim()
                  if (name === '') {
                    toast.error(buildPrepCopy('needsAName'))
                    return
                  }
                  await write(() => ({ name }))
                }}
              />
            )}
            <Grid min="20rem" gap={32} style={ROW}>
              <Stack gap={24}>
                {(canWrite || encounter.opposition.length > 0) && (
                  <SlabSection
                    as="h2"
                    id="encounter-opposition"
                    title={buildPrepCopy('opposition')}
                    count={String(encounter.opposition.length)}
                    actions={
                      canWrite ? (
                        <>
                          {grouping && (
                            <Button
                              size="mini"
                              disabled={!hasRoomForGroup(encounter)}
                              aria-label={buildPrepCopy('addAGroup')}
                              onClick={() => setNaming(null)}
                            >
                              {buildPrepCopy('addGroup')}
                            </Button>
                          )}
                          <Button
                            size="mini"
                            disabled={!hasRoomFor(encounter)}
                            aria-label={buildPrepCopy('addOppositionFromTheReference')}
                            onClick={() => setPicking(true)}
                          >
                            {buildPrepCopy('add')}
                          </Button>
                        </>
                      ) : undefined
                    }
                  >
                    <Stack gap={16}>
                      {grouping && groups.length > 0 ? (
                        <GroupedOpposition
                          blocks={oppositionBlocks(encounter)}
                          row={opponentRow}
                          canWrite={canWrite}
                          writes={{
                            rename: (group) => setNaming(group),
                            setWave: (group, wave) =>
                              void write((current) => ({
                                groups: setGroupWave(groupsOf(current), group.id, wave),
                              })),
                            remove: (group) =>
                              void write((current) => removeGroup(current, group.id)),
                          }}
                        />
                      ) : encounter.opposition.length === 0 ? (
                        <EmptyState variant="inline" body={buildPrepCopy('noOpposition')} />
                      ) : (
                        <ul style={LIST} aria-label={buildPrepCopy('opposition')}>
                          {encounter.opposition.map((opponent) => (
                            <li key={opponent.id}>{opponentRow(opponent)}</li>
                          ))}
                        </ul>
                      )}
                      {grouping && encounter.opposition.length > 0 && (
                        <ThreatReadLine encounter={encounter} editing={canWrite} />
                      )}
                    </Stack>
                  </SlabSection>
                )}
                {(canWrite || encounter.tables.length > 0) && (
                  <EncounterTables
                    tables={encounter.tables}
                    canWrite={canWrite}
                    onPin={(name) =>
                      void write((current) => ({ tables: pinTable(current.tables, name) }))
                    }
                    onUnpin={(name) =>
                      void write((current) => ({ tables: unpinTable(current.tables, name) }))
                    }
                  />
                )}
              </Stack>
              <Stack gap={24}>
                {(canWrite || encounter.notes.trim() !== '') && (
                  <SlabSection
                    as="h2"
                    id="encounter-notes"
                    title={buildPrepCopy('notes')}
                    actions={<Stat label={buildPrepCopy('onlyYou')} size="compact" />}
                  >
                    <Field
                      label={buildPrepCopy('yourNotes')}
                      value={encounter.notes}
                      multiline
                      fill
                      placeholder={buildPrepCopy('notesPlaceholder')}
                      onSave={
                        canWrite
                          ? async (next) => {
                              await write(() => ({ notes: next.slice(0, ENCOUNTER_MAX_NOTES) }))
                            }
                          : undefined
                      }
                    />
                  </SlabSection>
                )}
                {grouping && (canWrite || (encounter.briefing ?? '').trim() !== '') && (
                  <SlabSection
                    as="h2"
                    id="encounter-briefing"
                    title={buildPrepCopy('briefing')}
                    actions={<Stat label={buildPrepCopy('playersSeeThis')} size="compact" />}
                  >
                    <Field
                      label={buildPrepCopy('whatThePilotsSee')}
                      value={encounter.briefing ?? ''}
                      multiline
                      placeholder={buildPrepCopy('briefingPlaceholder')}
                      onSave={
                        canWrite
                          ? async (next) => {
                              await write(() => ({
                                briefing: next.slice(0, ENCOUNTER_MAX_BRIEFING),
                              }))
                            }
                          : undefined
                      }
                    />
                  </SlabSection>
                )}
                {grouping && <EncounterSpoils encounter={encounter} editing={canWrite} />}
              </Stack>
            </Grid>
          </section>
        )}
      />
      <SheetPickerModal
        open={picking}
        onClose={() => setPicking(false)}
        title={buildPrepCopy('addOppositionFromTheReference')}
        floating
      >
        <OppositionPicker
          npcs={fielded}
          saved={saved}
          onAdd={(schema, entity, draw) =>
            void write((current) => {
              if (!hasRoomFor(current)) return {}
              const body = newTrayNpc(
                schema,
                entity,
                current.opposition.map((o) => o.name),
                new Date().toISOString(),
                draw
              )
              return {
                opposition: [...current.opposition, opponentFrom(body, crypto.randomUUID())],
              }
            })
          }
        />
      </SheetPickerModal>
      <OppositionDialogs
        removing={null}
        renaming={renaming}
        onClose={() => setRenaming(null)}
        writes={{
          remove: async () => undefined,
          rename: (npc, name) =>
            write((current) => ({
              opposition: current.opposition.map((o) => (o.id === npc.id ? { ...o, name } : o)),
            })),
        }}
      />
      <GroupNameDialog
        key={naming === undefined ? 'shut' : (naming?.id ?? 'new')}
        open={naming !== undefined}
        group={naming ?? null}
        onClose={() => setNaming(undefined)}
        onSave={saveGroupName}
      />
      {dialog}
    </>
  )
}

/** Tables to hand: the pinned ones, each opening to read and try, and "Pin a table…". */
function EncounterTables({
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
