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
 *  - **Tables to hand**: the roll tables it pins in Play (`EncounterTables`);
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
import { ENCOUNTER_MAX_BRIEFING, ENCOUNTER_MAX_NOTES } from 'game-domain/schemas/encounter'
import type { CSSProperties } from 'react'
import { useRef, useState } from 'react'
import { Grid } from '../../components/app'
import type { HeaderMenuItem } from '../../components/index'
import {
  Button,
  EmptyState,
  Field,
  HeaderMenu,
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
import { useOwnUnits } from '../../lib/entities/entities'
import { flagOn } from '../../lib/flags'
import { ROW_ACTION_COPY } from '../../lib/games/rowActionCopy'
import { areaTitle } from '../../lib/pageTitle'
import { reportWriteFailure } from '../../lib/runWrite'
import { useTabTitle } from '../../lib/useTabTitle'
import { buildPrepCopy } from '../../messages/build-prep'
import { routesCopy } from '../../messages/routes'
import { KIT_PATH } from '../../play/games/prep/gamePrep.model'
import { OppositionDialogs, OppositionPicker } from '../../play/mediator/OppositionPicker'
import type { SavedPattern, TrayNpc } from '../../play/mediator/opposition.model'
import { newBuiltTrayNpc, newTrayNpc } from '../../play/mediator/opposition.model'
import { useEncounters, usePatterns } from '../../replica/collections'
import { useSync } from '../../replica/syncContext'
import { LiveSheet } from '../sheet/LiveSheet'
import { SheetActionsMenu } from '../sheet/SheetActionsMenu'
import { SheetModeToggle } from '../sheet/SheetModeToggle'
import { SheetPickerModal } from '../sheet/SheetPickerModal'
import { useSheetModeStore } from '../sheet/sheetMode.model'
import { undoToast } from '../sheet/undoToast.model'
import { EncounterGameField } from './EncounterGame'
import { GroupedOpposition, GroupNameDialog } from './EncounterGroups'
import { EncounterTables } from './EncounterTables'
import { EncounterSpoils, ThreatReadLine } from './EncounterThreat'
import {
  addGroup,
  duplicateOpponent,
  groupsOf,
  hasRoomFor,
  hasRoomForGroup,
  moveMenu,
  moveToGroup,
  opponentAsTray,
  opponentFrom,
  opponentNote,
  oppositionBlocks,
  pinTable,
  removeGroup,
  renameGroup,
  restoredOpponent,
  setGroupWave,
  unpinTable,
} from './encounter.model'
import { useEncounterGame } from './useEncounterGame'

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

/** The page, or why there is none: the encounter is the owner's alone, so absent is not found. */
export function EncounterPage({ id }: { id: string }) {
  const encounter = useEncounters((s) => s.encounters.find((e) => e.id === id) ?? null)
  if (encounter === null) {
    return (
      <NotFoundPanel
        title={buildPrepCopy('notFound')}
        message={buildPrepCopy('notFoundBody')}
        back={{ href: KIT_PATH, label: buildPrepCopy('backToTheTrainingBay') }}
      />
    )
  }
  return <EncounterBody encounter={encounter} />
}

function EncounterBody({ encounter }: { encounter: Encounter }) {
  // The tab names the encounter, in the Mediator's Kit (MD-02); the route's head cannot.
  useTabTitle(areaTitle(routesCopy('mediatorsKit'), encounter.name || routesCopy('encounter')))
  const { canWrite: connected } = useSync()
  // Read until Edit is pressed, as on every sheet (R11); nothing writes in Read.
  const mode = useSheetModeStore()
  const canWrite = connected && mode.editing
  const go = useGo()
  const { confirm, dialog } = useConfirm()
  const patterns = usePatterns((s) => s.mechPatterns)
  const ownNpcs = useOwnUnits('npc')
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
      const current = useEncounters.getState().get(encounter.id)
      if (current === null) return
      await useEncounters.getState().update(encounter.id, change(current))
    })
    queue.current = next.catch(reportWriteFailure)
    return next
  }
  // A write nothing waits on: the queue above tells its refusal, once, so the
  // rejection stops here rather than escaping as an unhandled one.
  const fire = (change: (current: Encounter) => Partial<Encounter>) => {
    write(change).catch(() => undefined)
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

  // At once, as every edit here is, with the way back (MD2-20): Undo puts it
  // where it stood, unless it is back already.
  const remove = (opponent: EncounterOpponent) => {
    const at = encounter.opposition.findIndex((o) => o.id === opponent.id)
    fire((current) => ({
      opposition: current.opposition.filter((o) => o.id !== opponent.id),
    }))
    undoToast(buildPrepCopy('removedOpponent', { name: opponent.name }), () =>
      fire((current) => ({ opposition: restoredOpponent(current, opponent, at) }))
    )
  }

  const move = (opponent: EncounterOpponent, groupId: string | null) =>
    fire((current) => ({
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
        {
          id: 'copy',
          label: buildPrepCopy('makeACopy'),
          onSelect: hasRoomFor(encounter)
            ? () =>
                fire((current) => ({
                  opposition: duplicateOpponent(current, opponent.id, crypto.randomUUID()),
                }))
            : undefined,
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
      note={opponentNote(opponent)}
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

  const inGame = useEncounterGame(encounter, connected)
  // Where it is kept: its Game's Prep, else the Mediator's Kit.
  const home = inGame
    ? { href: inGame.href, label: buildPrepCopy('gamePrep') }
    : { href: KIT_PATH, label: buildPrepCopy('mediatorsKit') }

  const deleteEncounter = () =>
    confirm({
      ...ROW_ACTION_COPY.deleteBuild(encounter.name),
      onConfirm: async () => {
        await useEncounters.getState().delete(encounter.id)
        go(home.href)
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
            ? {
                actions: (
                  <>
                    {/* The way back to where it is kept: its Game's Prep, else the Kit. */}
                    <Button href={home.href} back variant="ink" size="compact">
                      {home.label}
                    </Button>
                    <SheetModeToggle mode={mode} kind={buildPrepCopy('encounterKind')} />
                  </>
                ),
                game: inGame,
              }
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
                onSave={(next) => {
                  const name = next.trim()
                  if (name === '') {
                    toast.error(buildPrepCopy('needsAName'))
                    return
                  }
                  fire(() => ({ name }))
                }}
              />
            )}
            {canWrite && (
              <EncounterGameField
                encounter={encounter}
                onChange={(gameId) => fire(() => ({ gameId, order: undefined }))}
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
                              fire((current) => ({
                                groups: setGroupWave(groupsOf(current), group.id, wave),
                              })),
                            remove: (group) => fire((current) => removeGroup(current, group.id)),
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
                      fire((current) => ({ tables: pinTable(current.tables, name) }))
                    }
                    onUnpin={(name) =>
                      fire((current) => ({ tables: unpinTable(current.tables, name) }))
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
                          ? (next) => {
                              fire(() => ({ notes: next.slice(0, ENCOUNTER_MAX_NOTES) }))
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
                          ? (next) => {
                              fire(() => ({
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
          yours={ownNpcs}
          onAddBuilt={(npc, name) =>
            fire((current) => {
              if (!hasRoomFor(current)) return {}
              const body = newBuiltTrayNpc(
                npc,
                current.opposition.map((o) => o.name),
                new Date().toISOString(),
                name
              )
              return {
                opposition: [...current.opposition, opponentFrom(body, crypto.randomUUID())],
              }
            })
          }
          onAdd={(schema, entity, draw) =>
            fire((current) => {
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
