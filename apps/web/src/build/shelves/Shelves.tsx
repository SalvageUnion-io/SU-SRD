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
 * at show only on the Game's page, and a Game is started or joined from the
 * Play hub.
 *
 *  - **The band** (ink, paper flecks): the notched title and, in the band's
 *    top-right corner, one "⋯" (`BackupMenu`: **Import…** and **Export all**).
 *  - **Three rows of shelves**: Pilots, Mechs and Crawlers; then the user-made,
 *    dashed NPCs, Patterns and Encounters (ruleset §3.9, `EncounterShelf`); then,
 *    folded, the read-only Starter Set, as the front door shows it (`StarterShelf`).
 *
 * Each item is a library Compact (`UnitRow`) with its chips and a ⋯ menu: Open, Move
 * to a Game…, Make a copy, Save as pattern (mechs), Export and Delete…. Every
 * verb that changes what you have asks first, through the page's one confirm,
 * which has to outlive the menu that asked.
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

import type { EntityKind } from 'game-domain/entityKinds'
import { gamePath } from 'game-domain/entityKinds'
import { PRODUCT } from 'game-domain/product'
import type { MechPattern } from 'game-domain/schemas/pattern'
import type { ReactNode } from 'react'
import { useState } from 'react'
import type { LedgerColumn } from '../../components/entity/Ledger'
import type { HeaderMenuItem } from '../../components/index'
import {
  Button,
  ChapterBand,
  HeaderMenu,
  PageShell,
  RosterSkeleton,
  toast,
} from '../../components/index'
import { useConfirm } from '../../components/shared/useConfirm'
import { useGo } from '../../components/shared/useGo'
import { useServerAction } from '../../lib/connection/useServerAction'
import { copyForShelf, copyName } from '../../lib/copyEntity'
import {
  useCrawlers,
  useHydrateEntities,
  useKeptCrawlers,
  useOwnUnits,
  useSoftLinkList,
} from '../../lib/entities'
import { useHydrateOnMount } from '../../lib/entities/useHydrateEntities'
import { buildEntityExport, buildPatternExport } from '../../lib/export/buildExportBundle'
import { downloadJson, exportFileName } from '../../lib/export/downloadJson'
import type { MoveTargetGame } from '../../lib/games/gameRoster'
import { ROW_ACTION_COPY } from '../../lib/games/rowActionCopy'
import { PAGE_MEASURE } from '../../lib/pageMeasure'
import { patternCopy, savedPatternHref } from '../../lib/patterns/patterns'
import { usePatternSharing, useSharedByLink } from '../../lib/sharing/reads'
import type { PatternSharing, ShelfGame } from '../../lib/shelves/shelfItems'
import {
  chassisFact,
  crawlerChips,
  crawlerFact,
  crawlerReading,
  crewLinked,
  encounterNpcChips,
  encounterNpcReading,
  gameRelation,
  linkChip,
  npcChips,
  npcReading,
  patternChips,
  patternReading,
  pilotFact,
} from '../../lib/shelves/shelfItems'
import { VITAL } from '../../lib/units/readings'
import type { UnitReading } from '../../lib/units/unitModel'
import { usePatterns, useTray } from '../../replica/collections'
import { useGamesQuery } from '../../replica/roomCalls'
import { useSync } from '../../replica/syncContext'
import { useUnits } from '../../replica/units'
import { BackupMenu } from '../export/BackupMenu'
import { SavePatternDialog } from '../mech/Pattern/SavePatternDialog'
import { crawlerRailItems, crewReadings, rowStats } from '../sheet/railStats.model'
import { EncounterShelf } from './EncounterShelf'
import type { MoveSubject } from './MoveToGameDialog'
import { MoveToGameDialog } from './MoveToGameDialog'
import { ShelfLedger, ShelfLink } from './ShelfLedger'
import { StarterShelf } from './StarterShelf'

// ---------------------------------------------------------------------------
// Layout
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// MOCK (wave 2 build): the shelves' columns and cells, in the Ledger form
// ---------------------------------------------------------------------------

const fig = (key: string, title: string, phone = false): LedgerColumn => ({
  key,
  label: key,
  title,
  kind: 'figure',
  phone,
})
const word = (key: string, label: string, phone = false): LedgerColumn => ({
  key,
  label,
  kind: 'text',
  phone,
})
const GAME = word('game', 'Game')
const PILOT_COLUMNS = [
  word('class', 'Class', true),
  fig(VITAL.hp, 'Hit Points', true),
  fig(VITAL.ap, 'Ability Points'),
  word('mech', 'Mech'),
  GAME,
]
const MECH_COLUMNS = [
  word('chassis', 'Chassis', true),
  fig(VITAL.sp, 'Structure Points', true),
  fig(VITAL.ep, 'Energy Points'),
  fig(VITAL.heat, 'Heat'),
  word('pilot', 'Pilot'),
  GAME,
]
const CRAWLER_COLUMNS = [
  word('type', 'Type', true),
  fig('TL', 'Tech Level'),
  fig(VITAL.sp, 'Structure Points'),
  fig('Bays', 'Bays intact'),
  GAME,
]
const GAME_COLUMNS = [
  word('role', 'You are', true),
  fig('Pilots', 'Your pilots in it'),
  fig('Mechs', 'Your mechs in it'),
]
const NPC_COLUMNS = [
  word('position', 'Position'),
  fig('HP', 'Hit or Structure Points', true),
  word('who', 'Seen by'),
  GAME,
]
const PATTERN_COLUMNS = [
  word('chassis', 'Chassis', true),
  fig('Sys', 'System slots used'),
  word('who', 'Seen by'),
]

/** One reading's figure (`8/10`) by its label; none draws the dash. */
const read = (readings: readonly UnitReading[] | undefined, label: string): string =>
  String(readings?.find((r) => String(r.label) === label)?.value ?? '')

/** The unit it is crewed with, as a link to its sheet. */
const paired = (linked: readonly { name: string; href?: string | undefined }[]): ReactNode =>
  linked[0] ? <ShelfLink href={linked[0].href}>{linked[0].name}</ShelfLink> : ''

/** The Game it is in, as a link to that Game's page. */
const inGame = (relations: readonly { value: string; href: string }[]): ReactNode =>
  relations[0] ? <ShelfLink href={relations[0].href}>{relations[0].value}</ShelfLink> : ''

/** Who can see it, in words. */
const who = (chips: readonly { label: string }[]): string => chips.map((c) => c.label).join(', ')

/** A unit's own labels (`Shared by link`), under its name. */
const under = (chips: readonly { label: string }[]): string | undefined =>
  chips.length > 0 ? chips.map((c) => c.label).join(' · ') : undefined

/** How many of your units sit in a Game. */
const count = (units: readonly { gameId?: string | null }[], gameId: string): string =>
  String(units.filter((u) => u.gameId === gameId).length)

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
  const { status, canWrite } = useSync()
  const { confirm, dialog } = useConfirm()
  const go = useGo()
  const [moving, setMoving] = useState<MoveSubject | null>(null)
  // The mech being saved as a pattern, in its dialog over the Hangar.
  const [savingPattern, setSavingPattern] = useState<string | null>(null)
  const [importResult, setImportResult] = useState<string | null>(null)
  // Menu items have no line of their own, so a failed export is a toast.
  const exportOne = useServerAction(
    async (type: EntityKind, id: string, name: string) => {
      const bundle = await buildEntityExport(type, id, useUnits.getState())
      downloadJson(exportFileName(type, name), bundle)
    },
    { failure: 'That export did not download. Try again.', toastId: 'shelf-export' }
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

  // Chip names from your own units alone: a link to a crewmate's names nothing here.
  const pilotNames = new Map(pilots.map((p) => [p.id, p.name]))
  const mechNames = new Map(mechs.map((m) => [m.id, m.name]))
  // A pilot's max HP and AP follow the crawler they are aboard, a Game's
  // crawler too, which is no shelf item of theirs (C13) but still read here.
  const anyCrawlers = useCrawlers()
  const { pilotReadings, mechReadings } = crewReadings(pilots, mechs, anyCrawlers, softLinks)
  const patternSource = mechs.find((m) => m.id === savingPattern)
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
          label: 'Move to a Game…',
          // Moves need the server's list of Games.
          onSelect:
            canWrite && status === 'live'
              ? () => setMoving({ type, id: unit.id, entity: unit })
              : undefined,
        },
        {
          id: 'copy',
          label: 'Make a copy',
          onSelect: writable(() =>
            confirm({
              ...ROW_ACTION_COPY.copyOnShelf(unit.name),
              onConfirm: async () => {
                const created = await useUnits
                  .getState()
                  .create(type, copyForShelf(copyBody, unit.name) as never)
                toast.success(`Made ${created.name}.`)
              },
            })
          ),
        },
        ...(type === 'mech'
          ? [
              {
                id: 'pattern',
                label: 'Save as pattern',
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
        {
          id: 'delete',
          label: 'Delete…',
          tone: 'danger',
          onSelect: writable(() =>
            confirm({
              ...(inGame
                ? ROW_ACTION_COPY.deleteFromGame(unit.name)
                : ROW_ACTION_COPY.deleteBuild(unit.name)),
              onConfirm: () => useUnits.getState().delete(type, unit.id),
            })
          ),
        },
      ],
    ]
  }

  function trayMenu(npc: { id: string; name: string }): HeaderMenuItem[][] {
    return [
      [
        {
          id: 'delete',
          label: 'Delete…',
          tone: 'danger',
          onSelect: writable(() =>
            confirm({
              ...ROW_ACTION_COPY.deleteBuild(npc.name),
              onConfirm: () => useTray.getState().delete(npc.id),
            })
          ),
        },
      ],
    ]
  }

  function patternMenu(pattern: MechPattern): HeaderMenuItem[][] {
    return [
      [
        { id: 'open', label: 'Open', onSelect: () => go(savedPatternHref(pattern.id)) },
        {
          id: 'copy',
          label: 'Make a copy',
          onSelect: writable(() =>
            confirm({
              ...ROW_ACTION_COPY.copyOnShelf(pattern.name),
              onConfirm: async () => {
                const created = await usePatterns
                  .getState()
                  .create({ ...patternCopy(pattern), name: copyName(pattern.name) })
                toast.success(`Made ${created.name}.`)
              },
            })
          ),
        },
        {
          id: 'export',
          label: 'Export',
          onSelect: () => {
            downloadJson(exportFileName('pattern', pattern.name), buildPatternExport(pattern))
            toast.success(`Exported ${pattern.name}.`)
          },
        },
      ],
      [
        {
          id: 'delete',
          label: 'Delete…',
          tone: 'danger',
          onSelect: writable(() =>
            confirm({
              ...ROW_ACTION_COPY.deleteBuild(pattern.name),
              onConfirm: () => usePatterns.getState().delete(pattern.id),
            })
          ),
        },
      ],
    ]
  }

  // -- the shelves ------------------------------------------------------------

  const newLink = (href: string, label: string) =>
    canWrite ? (
      <Button href={href} variant="primary" size="compact">
        {label}
      </Button>
    ) : undefined

  const fromAMech: HeaderMenuItem[] =
    mechs.length === 0
      ? [{ id: 'none', label: 'Build a mech first' }]
      : mechs.map((m) => ({
          id: m.id,
          label: m.name,
          onSelect: () => setSavingPattern(m.id),
        }))

  const ready = hydratedUnits && hydratedPatterns && hydratedTray

  return (
    <PageShell
      className="su-shelves"
      measure={PAGE_MEASURE}
      band={
        <ChapterBand
          tone="build"
          measure={PAGE_MEASURE}
          eyebrow={
            <p role="status" aria-live="polite" className="su-shelves-band__status">
              {importResult}
            </p>
          }
          corner={<BackupMenu canImport={canWrite} onResult={setImportResult} />}
        >
          {PRODUCT.build}
        </ChapterBand>
      }
    >
      {!ready ? (
        <RosterSkeleton />
      ) : (
        <>
          {/* MOCK (wave 2 build): every shelf is a Ledger, one framed list a kind,
              not a stack of banded Compacts. Units on the left, what you run and
              what you made on the right; one column on a phone. */}
          <div className="su-shelf-ledgers">
            <div className="su-shelf-ledgers__col">
              <ShelfLedger
                id="shelf-pilots"
                title="Pilots"
                tone="pilot"
                columns={PILOT_COLUMNS}
                action={newLink('/pilots/new', '+ New pilot')}
                empty="No pilots yet."
                rows={pilots.map((p) => {
                  const r = pilotReadings.get(p.id)
                  return {
                    id: p.id,
                    name: p.name,
                    href: `/pilots/${p.id}`,
                    under: under(linkChip(sharedByLink, p.id)),
                    cells: [
                      pilotFact(p) ?? '',
                      read(r, VITAL.hp),
                      read(r, VITAL.ap),
                      paired(crewLinked({ kind: 'pilot', id: p.id, softLinks, names: mechNames })),
                      inGame(gameRelation(p, games)),
                    ],
                    menu: unitMenu('pilot', p, p),
                  }
                })}
              />
              <ShelfLedger
                id="shelf-mechs"
                title="Mechs"
                tone="mech"
                columns={MECH_COLUMNS}
                action={newLink('/mechs/new', '+ New mech')}
                empty="No mechs yet."
                rows={mechs.map((m) => {
                  const r = mechReadings.get(m.id)
                  return {
                    id: m.id,
                    name: m.name,
                    href: `/mechs/${m.id}`,
                    under: under(linkChip(sharedByLink, m.id)),
                    cells: [
                      chassisFact(m.chassisRef) ?? '',
                      read(r, VITAL.sp),
                      read(r, VITAL.ep),
                      read(r, VITAL.heat),
                      paired(crewLinked({ kind: 'mech', id: m.id, softLinks, names: pilotNames })),
                      inGame(gameRelation(m, games)),
                    ],
                    menu: unitMenu('mech', m, m),
                  }
                })}
              />
              <ShelfLedger
                id="shelf-crawlers"
                title="Crawlers"
                tone="crawler"
                columns={CRAWLER_COLUMNS}
                action={newLink('/crawlers/new', '+ New crawler')}
                empty="No crawlers yet."
                rows={crawlers.map((c) => {
                  const r = rowStats(crawlerRailItems(c))
                  return {
                    id: c.id,
                    name: c.name,
                    href: `/crawlers/${c.id}`,
                    under: under([
                      ...crawlerChips({ crawler: c, games }),
                      ...linkChip(sharedByLink, c.id),
                    ]),
                    cells: [
                      crawlerFact(c) ?? '',
                      String(crawlerReading(c).value),
                      read(r, VITAL.sp),
                      read(r, 'Bays'),
                      inGame(gameRelation(c, games)),
                    ],
                    menu: unitMenu('crawler', c, c),
                  }
                })}
              />
              <ShelfLedger
                id="shelf-games"
                title="Games"
                tone="ink"
                columns={GAME_COLUMNS}
                action={newLink('/play/', 'Start or join')}
                empty="No Games yet. Start or join one in Play."
                rows={(games ?? []).map((g) => ({
                  id: g._id,
                  name: g.name,
                  href: gamePath(g._id),
                  cells: [
                    g.mediator ? 'Mediator' : 'Player',
                    count(pilots, g._id),
                    count(mechs, g._id),
                  ],
                  menu: [],
                }))}
              />
            </div>
            <div className="su-shelf-ledgers__col">
              <ShelfLedger
                id="shelf-npcs"
                title="NPCs"
                tone="adversary"
                columns={NPC_COLUMNS}
                action={newLink('/npcs/new', '+ Design an NPC')}
                empty="No NPCs yet. Design one and it is kept here."
                note="Your NPCs, ready to drop into a Game you mediate."
                rows={[
                  ...npcs.map((n) => ({
                    id: n.id,
                    name: n.name,
                    href: `/npcs/${n.id}`,
                    cells: [
                      n.position ?? '',
                      String(npcReading(n).value),
                      who(
                        npcChips({ npc: n, sharedByLink: sharedByLink?.includes(n.id) ?? false })
                      ),
                      inGame(gameRelation(n, games)),
                    ],
                    menu: unitMenu('npc', n, n),
                  })),
                  ...tray.map((n) => ({
                    id: n.id,
                    name: n.name,
                    cells: [
                      'Tray',
                      String(encounterNpcReading(n).value),
                      who(encounterNpcChips()),
                      '',
                    ],
                    menu: trayMenu(n),
                  })),
                ]}
              />
              <ShelfLedger
                id="shelf-patterns"
                title="Patterns"
                tone="mech"
                columns={PATTERN_COLUMNS}
                action={
                  canWrite ? (
                    <HeaderMenu
                      variant="button"
                      size="compact"
                      trigger="+ From a mech"
                      label="+ From a mech"
                      chevron={false}
                      sections={[fromAMech]}
                    />
                  ) : undefined
                }
                empty="No patterns yet. Save one from a mech."
                note="Your patterns, ready to build a Mech from."
                rows={patterns.map((p) => ({
                  id: p.id,
                  name: p.name,
                  href: savedPatternHref(p.id),
                  cells: [
                    chassisFact(p.chassisRef) ?? '',
                    String(patternReading(p)?.value ?? ''),
                    who(
                      patternChips(
                        sharing?.find((s) => s.appId === p.id),
                        games
                      )
                    ),
                  ],
                  menu: patternMenu(p),
                }))}
              />
              <EncounterShelf confirm={confirm} />
            </div>
          </div>
        </>
      )}
      {ready && <StarterShelf />}
      <MoveToGameDialog
        subject={moving}
        onClose={() => setMoving(null)}
        games={games}
        confirm={confirm}
      />
      {dialog}
      <SavePatternDialog
        source={patternSource ?? { name: '', chassisRef: '', systems: [], modules: [] }}
        open={patternSource !== undefined}
        onOpenChange={(open) => {
          if (!open) setSavingPattern(null)
        }}
      />
    </PageShell>
  )
}
