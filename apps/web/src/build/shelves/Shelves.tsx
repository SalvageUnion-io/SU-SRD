/**
 * Shelves — the Training Bay: everything you own, on your account (ADR-052 §1–2).
 * The page at `/` once you are signed in; signed out, `/` is the front door.
 *
 * A unit in a Game stays in your Training Bay too — it is one record whichever table
 * it plays at — so the page lists every pilot, mech and crawler of yours this
 * browser holds, wherever it is, and a relation chip on each names its Game
 * (`GAME | Rust Run`), opening that Game's page in Play. A Game is a tag here,
 * never a place and never a filter. The page reads only what is yours
 * (`useOwnUnits`), and the crawler of each Game you run (`useKeptCrawlers`):
 * a crewmate's units, unassigned ones and the crawler of a Game you only play
 * at show only on the Game's page, and a Game is started or joined from Your
 * Games, the header's Games tab (ADR-066).
 *
 *  - **The band** (ink, paper flecks): the notched title and, in the band's
 *    top-right corner, **Backups** (`BackupMenu`: **Import…** and **Export all**).
 *  - **Two columns of shelves**: Pilots (each with its mech and a Play door),
 *    Mechs and Crawlers; then the user-made, dashed Patterns (where a mech is
 *    planned), NPCs and Encounters (ruleset §3.9, `EncounterShelf`); then,
 *    folded, the read-only Starter Set, as the front door shows it (`StarterShelf`).
 *
 * Each item is a library Compact (`UnitRow`) with its chips and a ⋯ menu: Open, Move
 * to a Game…, Make a copy, Save as pattern (mechs), Export and Delete…. A verb
 * that takes something away asks first, through the page's one confirm, which
 * has to outlive the menu that asked; Make a copy only adds, so it runs at once
 * and its notice opens the copy (`makeACopy`).
 *
 * ## Modes
 *
 * Connected, the page reads your Games (for the chips' names and the move) and who can
 * see each pattern. Disconnected it shows the cached pile with what it knows,
 * and offers no writes: `canWrite` gates every verb that changes something.
 *
 * ## NPCs
 *
 * The NPC shelf lists the NPCs you have designed (`/npcs/new`):
 * dashed like everything players make, each with who can see it and a ⋯ menu,
 * and "+ Design an NPC" opens the designer. The personal encounter tray's NPCs,
 * when it holds any, are listed beside them. The opposition tray's reference
 * NPCs are not yours to keep and do not belong here.
 */

import { containerOf, sameContainer } from 'game-domain/container'
import type { EntityKind } from 'game-domain/entityKinds'
import { cockpitPath } from 'game-domain/entityKinds'
import { pilotLabel } from 'game-domain/pilotLabel'
import { PRODUCT } from 'game-domain/product'
import type { MechPattern } from 'game-domain/schemas/pattern'
import { useContext, useState } from 'react'
import { PageShell, RosterSkeleton, RuleBreakMark } from '../../components/app'
import type { HeaderMenuItem } from '../../components/index'
import { Button, ChapterBand, HeaderMenu, toast } from '../../components/index'
import { useConfirm } from '../../components/shared/useConfirm'
import { useGo } from '../../components/shared/useGo'
import { Tagline } from '../../components/Tagline'
import { useServerAction } from '../../lib/connection/useServerAction'
import { copyAsking, keptMech } from '../../lib/copiedToast'
import {
  useCrawlers,
  useHydrateEntities,
  useKeptCrawlers,
  useOwnUnits,
  useSoftLinkList,
} from '../../lib/entities'
import { useHydrateOnMount } from '../../lib/entities/useHydrateEntities'
import { buildEntityExport } from '../../lib/export/buildExportBundle'
import { downloadJson, exportFileName } from '../../lib/export/downloadJson'
import type { MoveTargetGame } from '../../lib/games/gameRoster'
import { ROW_ACTION_COPY } from '../../lib/games/rowActionCopy'
import { crewLinkOf } from '../../lib/npcs/npcModel'
import { PAGE_MEASURE } from '../../lib/pageMeasure'
import { usePatternSharing, useSharedByLink } from '../../lib/sharing/reads'
import type { PatternSharing, ShelfGame } from '../../lib/shelves/shelfItems'
import {
  crewLinked,
  encounterNpcChips,
  encounterNpcReading,
  gameRelation,
  hpColumnCell,
  linkChip,
  npcChips,
  npcReading,
  pilotFact,
} from '../../lib/shelves/shelfItems'
import { VITAL } from '../../lib/units/readings'
import { buildShelvesCopy } from '../../messages/build-shelves'
import { useEncounters, usePatterns, useTray } from '../../replica/collections'
import { LIVE_SHEET_MANUAL } from '../../replica/provenance'
import { useGamesQuery } from '../../replica/roomCalls'
import { useSync } from '../../replica/syncContext'
import { useUnits } from '../../replica/units'
import { BackupMenu } from '../export/BackupMenu'
import { deleteMech } from '../mech/deleteMech.model'
import { SavePatternDialog } from '../mech/Pattern/SavePatternDialog'
import { npcDeleteConfirm } from '../npc/redesign.model'
import { ShelfLead } from '../roster/FrontDoor'
import { RailActs } from '../sheet/RailActs'
import { crewReadings } from '../sheet/railStats.model'
import { AddAMech } from './AddAMech'
import { CrawlerShelf } from './CrawlerShelf'
import { EncounterShelf } from './EncounterShelf'
import { MechShelf } from './MechShelf'
import type { MoveSubject } from './MoveToGameDialog'
import { MoveToGameDialog } from './MoveToGameDialog'
import { PatternShelf } from './PatternShelf'
import { buildFromPattern, patternMenuOf } from './patternMenu.model'
import { RenameDialog } from './RenameDialog'
import { ShelfLedger } from './ShelfLedger'
import { StarterShelf } from './StarterShelf'
import {
  inGame,
  NPC_COLUMNS,
  PILOT_COLUMNS,
  paired,
  read,
  underPilot,
  underWith,
  who,
} from './shelfColumns'
import type { RenameSubject } from './shelfMenu.model'
import { deleteItem, renameItem } from './shelfMenu.model'
import { showShelfRow } from './shelfRow.model'
import { ShelvesPart } from './shelvesPart.model'
import { TrayLeftovers } from './TrayLeftovers'

// ---------------------------------------------------------------------------
// Data: the server's facts, read only when there is a server to ask
// ---------------------------------------------------------------------------

type ServerFacts = {
  /** Your Games; undefined while they load, or with no server to ask. */
  games: (ShelfGame & MoveTargetGame)[] | undefined
  /** Who can see each of your patterns; undefined likewise. */
  sharing: PatternSharing[] | undefined
  /** The ids of your sheets anyone with the link may read; undefined likewise. */
  sharedByLink: readonly string[] | undefined
}

function ConnectedShelves() {
  const games = useGamesQuery('games.listMine', {})
  const sharing = usePatternSharing()
  const sharedByLink = useSharedByLink()
  return <ShelvesPage games={games} sharing={sharing} sharedByLink={sharedByLink} />
}

/** Shelves: the server's facts when Connected, the cached pile otherwise. */
export function Shelves() {
  const { status } = useSync()
  if (status === 'live') return <ConnectedShelves />
  return <ShelvesPage games={undefined} sharing={undefined} sharedByLink={undefined} />
}

// ---------------------------------------------------------------------------
// The page
// ---------------------------------------------------------------------------

function ShelvesPage({ games, sharing, sharedByLink }: ServerFacts) {
  const part = useContext(ShelvesPart)
  const { status, canWrite } = useSync()
  const { confirm, dialog } = useConfirm()
  const go = useGo()
  const [moving, setMoving] = useState<MoveSubject | null>(null)
  // The mech being saved as a pattern, in its dialog over the Hangar.
  const [savingPattern, setSavingPattern] = useState<string | null>(null)
  const [renaming, setRenaming] = useState<RenameSubject | null>(null)
  const [importResult, setImportResult] = useState<string | null>(null)
  // Menu items have no line of their own, so a failed export is a toast.
  const exportOne = useServerAction(
    async (type: EntityKind, id: string, name: string) => {
      const bundle = await buildEntityExport(type, id, useUnits.getState())
      downloadJson(exportFileName(type, name), bundle)
    },
    { failure: buildShelvesCopy('exportDidNotDownload'), toastId: 'shelf-export' }
  )

  const hydratedUnits = useHydrateEntities(['pilot', 'mech', 'crawler', 'npc', 'softLink'])
  const hydratedPatterns = useHydrateOnMount(() => usePatterns.getState().hydrate())
  const hydratedTray = useHydrateOnMount(() => useTray.getState().hydrate())
  const pilots = useOwnUnits('pilot')
  const mechs = useOwnUnits('mech')
  // A Game's crawler is the crew's: in your Training Bay only where you run the table.
  const crawlers = useKeptCrawlers((games ?? []).filter((g) => g.tableRunner).map((g) => g._id))
  const npcs = useOwnUnits('npc')
  const softLinks = useSoftLinkList()
  const patterns = usePatterns((s) => s.mechPatterns)
  const trayNpcs = useTray((s) => s.encounterNpcs)
  // The Kit's own list (`EncounterShelf` loads it): what an NPC's delete names.
  const encounters = useEncounters((s) => s.encounters)

  // Chip names from your own units alone: a link to a crewmate's names nothing here.
  const pilotNames = new Map(pilots.map((p) => [p.id, pilotLabel(p)]))
  const mechNames = new Map(mechs.map((m) => [m.id, m.name]))
  // A pilot's max HP and AP follow the crawler they are aboard, a Game's
  // crawler too, which is no shelf item of theirs (C13) but still read here.
  const anyCrawlers = useCrawlers()
  const { pilotReadings, mechReadings } = crewReadings(pilots, mechs, anyCrawlers, softLinks)
  const patternSource = mechs.find((m) => m.id === savingPattern)
  // A mech a pilot of yours flies rides that pilot's line (ADR-066: the pilot
  // is the anchor); the rest are the ones "+ Add a Mech" offers.
  const flown = new Set(
    softLinks
      .filter((l) => l.type === 'mech-to-pilot' && pilotNames.has(l.to.id))
      .map((l) => l.from.id)
  )
  const spareMechs = mechs.filter((m) => !flown.has(m.id))
  /** A pilot line's "+ Add a mech": the mech wizard, its mech assigned to that pilot. */
  const newMechFor = (pilotId: string) => `/mechs/new?pilot=${encodeURIComponent(pilotId)}`
  // The personal tray is in the Training Bay alone.
  const tray = trayNpcs.filter((n) => typeof n.gameId !== 'string')

  // -- the verbs ------------------------------------------------------------

  /** Write verbs exist only where a write could land. */
  const writable = (run: () => void): (() => void) | undefined => (canWrite ? run : undefined)

  async function exportUnit(type: EntityKind, id: string, name: string) {
    const result = await exportOne.run(type, id, name)
    if (result.ok) toast.success(`Exported ${name}.`)
  }

  function unitMenu(
    type: EntityKind,
    unit: { id: string; name: string; gameId?: string | null },
    copyBody: Record<string, unknown>
  ): HeaderMenuItem[][] {
    const inGame = typeof unit.gameId === 'string'
    return [
      [
        { id: 'open', label: 'Open', onSelect: () => go(`/${type}s/${unit.id}`) },
        {
          id: 'move',
          label: buildShelvesCopy('moveToAGame'),
          // Moves need the server's list of Games.
          onSelect:
            canWrite && status === 'live'
              ? () => setMoving({ type, id: unit.id, entity: unit })
              : undefined,
        },
        {
          id: 'copy',
          label: buildShelvesCopy('makeACopy'),
          // A copy only adds: it runs at once (a pilot with a mech is asked
          // whether the mech comes too), its notice opens it, and its new
          // line is brought into view.
          onSelect: writable(
            () =>
              void copyAsking(confirm, type, unit.name, copyBody, go, {
                landed: (id) => showShelfRow(type, id),
              })
          ),
        },
        ...(type === 'pilot' ? pilots.filter((p) => p.id === unit.id).map(renamePilot) : []),
        ...(type === 'mech'
          ? [
              renameItem(
                {
                  name: unit.name,
                  label: buildShelvesCopy('mechName'),
                  save: (name) =>
                    useUnits.getState().update('mech', unit.id, { name }, LIVE_SHEET_MANUAL),
                },
                canWrite ? setRenaming : undefined
              ),
              {
                id: 'pattern',
                label: buildShelvesCopy('saveAsPattern'),
                onSelect: writable(() => setSavingPattern(unit.id)),
              },
            ]
          : []),
        {
          id: 'export',
          label: 'Export',
          onSelect: () => void exportUnit(type, unit.id, unit.name),
        },
      ],
      [
        deleteItem(
          writable(() =>
            type === 'npc'
              ? // An NPC is its maker's alone: the confirm names the encounters it leaves (MD3-08).
                confirm(npcDeleteConfirm(unit, encounters))
              : type === 'mech' && !inGame
                ? // Its notice's Undo brings it back (r5 D9).
                  confirm({
                    ...ROW_ACTION_COPY.deleteMech(unit.name),
                    onConfirm: () => deleteMech(unit.id),
                  })
                : confirm({
                    ...(inGame
                      ? ROW_ACTION_COPY.deleteFromGame(unit.name, keptMech(type, unit.id))
                      : ROW_ACTION_COPY.deleteBuild(unit.name, keptMech(type, unit.id))),
                    onConfirm: () => useUnits.getState().delete(type, unit.id),
                  })
          )
        ),
      ],
    ]
  }

  /** A pilot's Rename…: its callsign and its name, the two it goes by (r4 E20). */
  const renamePilot = (pilot: (typeof pilots)[number]): HeaderMenuItem =>
    renameItem(
      {
        title: pilotLabel(pilot),
        name: pilot.callsign,
        label: buildShelvesCopy('callsign'),
        also: { name: pilot.name, label: buildShelvesCopy('pilotName') },
        save: (callsign, name) =>
          useUnits
            .getState()
            .update('pilot', pilot.id, { callsign, name: name ?? pilot.name }, LIVE_SHEET_MANUAL),
      },
      canWrite ? setRenaming : undefined
    )

  function trayMenu(npc: { id: string; name: string }): HeaderMenuItem[][] {
    return [
      [
        deleteItem(
          writable(() =>
            confirm({
              ...ROW_ACTION_COPY.deleteBuild(npc.name),
              onConfirm: () => useTray.getState().delete(npc.id),
            })
          )
        ),
      ],
    ]
  }

  const patternMenu = (pattern: MechPattern) =>
    patternMenuOf(pattern, { go, confirm, canWrite, rename: setRenaming })

  // -- the shelves ------------------------------------------------------------

  // + New is one act, outlined on every shelf (§3.14).
  const newLink = (href: string, label: string) =>
    canWrite ? (
      <Button href={href} variant="default" size="compact">
        {label}
      </Button>
    ) : undefined

  const fromAMech: HeaderMenuItem[] =
    mechs.length === 0
      ? [{ id: 'none', label: buildShelvesCopy('buildAMechFirst') }]
      : mechs.map((m) => ({
          id: m.id,
          label: m.name,
          onSelect: () => setSavingPattern(m.id),
        }))

  const ready = hydratedUnits && hydratedPatterns && hydratedTray

  // The Patterns shelf: the Training Bay's panel, and the Patterns page whole.
  const patternShelf = (
    <PatternShelf
      patterns={patterns}
      sharing={sharing}
      games={games}
      action={
        canWrite ? (
          <HeaderMenu
            variant="button"
            size="compact"
            trigger={buildShelvesCopy('fromAMech')}
            label={buildShelvesCopy('fromAMech')}
            chevron={false}
            sections={[fromAMech]}
          />
        ) : undefined
      }
      line={(p, over) => ({
        // Over its slots it wears the Mechs shelf's mark (r3 I2); its one act is on the row (r3 L5).
        under: over === undefined ? undefined : <RuleBreakMark what={over} />,
        act: buildFromPattern(p, { go, canWrite }),
        menu: patternMenu(p),
      })}
    />
  )
  const patternDialogs = (
    <>
      {dialog}
      <RenameDialog subject={renaming} onClose={() => setRenaming(null)} />
      <SavePatternDialog
        source={patternSource ?? { name: '', chassisRef: '', systems: [], modules: [] }}
        open={patternSource !== undefined}
        onOpenChange={(open) => {
          if (!open) setSavingPattern(null)
        }}
      />
    </>
  )

  // The Patterns page (`ShelvesPart`): this shelf alone, with everything it opens.
  if (part === 'patterns') {
    return (
      <>
        {hydratedUnits && hydratedPatterns ? patternShelf : <RosterSkeleton />}
        {patternDialogs}
      </>
    )
  }

  // The Mediator's Kit (NPCs, Encounters) on the Games front (`ShelvesPart`):
  // its two columns stand straight in the Kit's section, which lays them out.
  if (part === 'kit') {
    return (
      <>
        <div className="su-shelf-ledgers__col">
          <ShelfLedger
            id="shelf-npcs"
            foot={<TrayLeftovers tray={tray} confirm={canWrite ? confirm : undefined} />}
            title={buildShelvesCopy('npcs')}
            tone="adversary"
            homebrew
            columns={NPC_COLUMNS}
            action={newLink('/npcs/new', buildShelvesCopy('designAnNpc'))}
            empty={buildShelvesCopy('noNpcsYet')}
            rows={[
              ...npcs.map((n) => ({
                id: n.id,
                name: n.name,
                href: `/npcs/${n.id}`,
                cells: [
                  n.position ?? '',
                  who(
                    npcChips({
                      npc: n,
                      sharedByLink: sharedByLink?.includes(n.id) ?? false,
                      crews: crewLinkOf(softLinks, n.id) !== undefined,
                    })
                  ),
                  inGame(gameRelation(n, games)),
                  hpColumnCell(npcReading(n)),
                ],
                menu: unitMenu('npc', n, n),
              })),
              ...tray.map((n) => ({
                id: n.id,
                name: n.name,
                cells: [
                  buildShelvesCopy('tray'),
                  who(encounterNpcChips()),
                  '',
                  hpColumnCell(encounterNpcReading(n)),
                ],
                menu: trayMenu(n),
              })),
            ]}
          />
        </div>
        <div className="su-shelf-ledgers__col">
          <EncounterShelf confirm={confirm} games={games} />
        </div>
        <MoveToGameDialog
          subject={moving}
          onClose={() => setMoving(null)}
          games={games}
          confirm={confirm}
        />
        {dialog}
      </>
    )
  }

  return (
    <PageShell
      className="su-shelves"
      measure={PAGE_MEASURE}
      band={
        <ChapterBand
          tone="build"
          measure={PAGE_MEASURE}
          asideAt="notch"
          aside={<Tagline />}
          eyebrow={
            <p role="status" aria-live="polite" className="su-shelves-band__status">
              {importResult}
            </p>
          }
          corner={
            // The acts ride the area rail.
            <RailActs>
              <BackupMenu canImport={canWrite} onResult={setImportResult} />
            </RailActs>
          }
        >
          {PRODUCT.build}
        </ChapterBand>
      }
    >
      {!ready ? (
        <RosterSkeleton />
      ) : (
        <>
          {/* Every shelf is a Ledger, one framed list a kind. Your units on the
              left, pilots first (Play runs a pilot, its mech beside it); your
              plans and prep on the right, patterns first; one column on a phone. */}
          {/* A draft left mid-wizard; empty, the front door's way in. */}
          <ShelfLead empty={pilots.length + mechs.length + crawlers.length === 0} />
          <div className="su-shelf-ledgers">
            <div className="su-shelf-ledgers__col">
              <ShelfLedger
                id="shelf-pilots"
                title={buildShelvesCopy('pilots')}
                tone="pilot"
                columns={PILOT_COLUMNS}
                action={newLink('/pilots/new', buildShelvesCopy('newPilot'))}
                empty={buildShelvesCopy('noPilotsYet')}
                rows={pilots.map((p) => {
                  const r = pilotReadings.get(p.id)
                  const flies = crewLinked({ kind: 'pilot', id: p.id, softLinks, names: mechNames })
                  // Callsign first, then the name, as everywhere a pilot is named.
                  const name = pilotLabel(p)
                  return {
                    id: p.id,
                    name,
                    href: `/pilots/${p.id}`,
                    // On a phone its mech rides under the name (the column is hidden).
                    under: underWith(linkChip(sharedByLink, p.id), flies),
                    cells: [
                      pilotFact(p) ?? '',
                      // The pilot carries its mech; with none, Add a mech builds or assigns one.
                      paired(
                        flies,
                        canWrite ? (
                          <AddAMech
                            pilot={{ id: p.id, name }}
                            spares={spareMechs.filter((m) =>
                              sameContainer(containerOf(m), containerOf(p))
                            )}
                            newHref={newMechFor(p.id)}
                          />
                        ) : undefined
                      ),
                      inGame(gameRelation(p, games)),
                      read(r, VITAL.hp),
                      read(r, VITAL.ap),
                    ],
                    menu: unitMenu('pilot', { id: p.id, name, gameId: p.gameId }, p),
                    // Play runs a pilot (ADR-066): one press from the Training Bay.
                    ...(status === 'signedOut'
                      ? {}
                      : { play: cockpitPath(p.id), playGameId: p.gameId ?? null }),
                  }
                })}
              />
              {/* Every mech of yours: one a pilot flies is on that pilot's row
                  too, and says here whose it is (r4 E20). */}
              <MechShelf
                mechs={mechs}
                readings={mechReadings}
                action={newLink('/mechs/new', buildShelvesCopy('newMech'))}
                empty={buildShelvesCopy('noMechsYet')}
                line={(m) => ({
                  under: underPilot(
                    linkChip(sharedByLink, m.id),
                    crewLinked({ kind: 'mech', id: m.id, softLinks, names: pilotNames })
                  ),
                  game: gameRelation(m, games),
                  menu: unitMenu('mech', m, m),
                })}
              />
              <CrawlerShelf
                crawlers={crawlers}
                games={games}
                sharedByLink={sharedByLink}
                action={newLink('/crawlers/new', buildShelvesCopy('newCrawler'))}
                menu={(c) => unitMenu('crawler', c, c)}
              />
            </div>
            <div className="su-shelf-ledgers__col">
              {patternShelf}
              {/* The Mediator's Kit moved to Games. */}
              {/* The read-only crews stand under the
                  side column's Patterns, at its width. */}
              <StarterShelf />
            </div>
          </div>
        </>
      )}
      <MoveToGameDialog
        subject={moving}
        onClose={() => setMoving(null)}
        games={games}
        confirm={confirm}
      />
      {patternDialogs}
    </PageShell>
  )
}
