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
 *  - **Briefing**: what the Pilots see, which Play offers to tell the table
 *    (both save as they are typed, `AutosavedText`, r6 B2);
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
  ENCOUNTER_MAX_OPPOSITION,
} from 'game-domain/schemas/encounter'
import type { CSSProperties, ReactNode } from 'react'
import { useId, useRef, useState } from 'react'
import { Grid } from '../../components/app'
import type { HeaderMenuItem } from '../../components/index'
import {
  Button,
  EmptyState,
  Field,
  HeaderMenu,
  ReferenceEntityCard,
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
import { newBuiltTrayNpc, newTrayNpc, slugOf } from '../../play/mediator/opposition.model'
import { useEncounters, usePatterns } from '../../replica/collections'
import { useGameListing } from '../../replica/gameListing'
import { useSync } from '../../replica/syncContext'
import { LiveSheet } from '../sheet/LiveSheet'
import { SheetActionsMenu } from '../sheet/SheetActionsMenu'
import { SheetModeToggle } from '../sheet/SheetModeToggle'
import { SheetPickerModal } from '../sheet/SheetPickerModal'
import { useSheetModeStore } from '../sheet/sheetMode.model'
import { undoToast } from '../sheet/undoToast.model'
import { AddCountDialog } from './AddCountDialog'
import { AutosavedText } from './AutosavedText'
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
  opponentNote,
  oppositionBlocks,
  pinTable,
  removeGroup,
  renameGroup,
  restoredOpponent,
  setGroupWave,
  unpinTable,
  withCopies,
} from './encounter.model'
import { crawlerTech } from './threat.model'
import { useEncounterGame, useRunGames } from './useEncounterGame'

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

/** The open card sits under its row, one list gap below it. */
const OPEN_CARD = { marginTop: tokens.space[8] } satisfies CSSProperties

/**
 * One opponent in the list: its name opens its card under it (MD3-10), the
 * book's or the Mediator's own design, so what it does is read where it is
 * prepped; a second press shuts it. The one place a Compact expands in place
 * (ruleset §1.5, C8): the card is read-only, and the name says whether it is
 * open (`aria-expanded`). Its chip says what it is, so no kind follows its name.
 */
function OpponentRow({ opponent, menu }: { opponent: EncounterOpponent; menu: ReactNode }) {
  const { entity, pattern } = opponentAsTray(opponent)
  const [open, setOpen] = useState(false)
  const cardId = useId()
  return (
    <>
      <UnitRow
        kind="npc"
        name={opponent.name}
        note={opponentNote(opponent)}
        unkinded
        readings={[{ label: opponent.statKind === 'sp' ? 'SP' : 'HP', value: opponent.maxHp }]}
        trailing={menu}
        {...(entity !== null
          ? {
              mode: {
                kind: 'link',
                onOpen: () => setOpen((was) => !was),
                attrs: { 'aria-expanded': open, 'aria-controls': cardId },
              },
            }
          : {})}
      />
      {entity !== null && open && (
        <div id={cardId} data-prep-card style={OPEN_CARD}>
          <ReferenceEntityCard data={entity} pattern={pattern ?? undefined} disabled={false} />
        </div>
      )}
    </>
  )
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
  // One already in the encounter, added again: how many more (r7 C13).
  const [counting, setCounting] = useState<{
    name: string
    add: (count: number) => Promise<void>
  } | null>(null)
  // The group being named: `null` for a new one, absent when the dialog is shut.
  const [naming, setNaming] = useState<EncounterGroup | null | undefined>(undefined)
  const grouping = flagOn('encounterSheet')
  const groups = groupsOf(encounter)
  // The Game it is prepared for, where the viewer runs it: its Pilots are the crew a threat is read against.
  const gameCrew = useRunGames(connected).find((g) => g._id === encounter.gameId)?.pilotCount
  // Its crew's Tech Level: the Game's primary crawler's (r7 C13), which bounds what they field.
  const listing = useGameListing(gameCrew === undefined ? null : (encounter.gameId ?? null))
  const gameTech = crawlerTech(listing)
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
    undoToast(
      buildPrepCopy('removedOpponent', { name: opponent.name }),
      () => fire((current) => ({ opposition: restoredOpponent(current, opponent, at) })),
      encounter.id
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
    <OpponentRow
      opponent={opponent}
      menu={
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
                        <ThreatReadLine
                          encounter={encounter}
                          editing={canWrite}
                          gameCrew={gameCrew}
                          gameTech={gameTech}
                        />
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
                    {/* Saved as typed, as the Game's notes in Prep are (r6 B2). */}
                    {canWrite ? (
                      <AutosavedText
                        label={buildPrepCopy('yourNotes')}
                        value={encounter.notes}
                        max={ENCOUNTER_MAX_NOTES}
                        placeholder={buildPrepCopy('notesPlaceholder')}
                        onSave={(notes) => write(() => ({ notes }))}
                      />
                    ) : (
                      <Field label={buildPrepCopy('yourNotes')} value={encounter.notes} multiline />
                    )}
                  </SlabSection>
                )}
                {grouping && (canWrite || (encounter.briefing ?? '').trim() !== '') && (
                  <SlabSection
                    as="h2"
                    id="encounter-briefing"
                    title={buildPrepCopy('briefing')}
                    actions={<Stat label={buildPrepCopy('playersSeeThis')} size="compact" />}
                  >
                    {canWrite ? (
                      <AutosavedText
                        label={buildPrepCopy('whatThePilotsSee')}
                        value={encounter.briefing ?? ''}
                        max={ENCOUNTER_MAX_BRIEFING}
                        rows={3}
                        placeholder={buildPrepCopy('briefingPlaceholder')}
                        onSave={(briefing) => write(() => ({ briefing }))}
                      />
                    ) : (
                      <Field
                        label={buildPrepCopy('whatThePilotsSee')}
                        value={encounter.briefing ?? ''}
                        multiline
                      />
                    )}
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
          onAddBuilt={(npc, name) => {
            const add = (count: number) =>
              write((current) => ({
                opposition: withCopies(current.opposition, count, (names) =>
                  newBuiltTrayNpc(npc, names, new Date().toISOString(), name)
                ),
              }))
            // One already in it, added again: how many more (r7 C13).
            if (encounter.opposition.some((o) => o.built?.npcId === npc.id)) {
              setCounting({ name: npc.name, add })
            } else add(1).catch(() => undefined)
          }}
          onAdd={(schema, entity, draw) => {
            const add = (count: number) =>
              write((current) => ({
                opposition: withCopies(current.opposition, count, (names) =>
                  newTrayNpc(schema, entity, names, new Date().toISOString(), draw)
                ),
              }))
            const slug = slugOf(entity as { name: string })
            const again = encounter.opposition.some(
              (o) => o.built === undefined && o.refSchema === schema && o.refSlug === slug
            )
            if (again) setCounting({ name: entity.name, add })
            else add(1).catch(() => undefined)
          }}
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
      <AddCountDialog
        name={counting?.name ?? null}
        room={ENCOUNTER_MAX_OPPOSITION - encounter.opposition.length}
        onClose={() => setCounting(null)}
        onAdd={(count) => counting?.add(count) ?? Promise.resolve()}
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
