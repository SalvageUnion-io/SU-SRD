/**
 * Shelves — the Hangar: everything you own, on your account (ADR-052 §1–2).
 * The page at `/` once you are signed in; signed out, `/` is the front door.
 *
 * A unit in a Game stays in your Hangar too — it is one record whichever table
 * it plays at — so the page lists every pilot, mech and crawler of yours this
 * browser holds, wherever it is, and a relation chip on each names its Game
 * (`GAME | Rust Run`), opening that Game's page in Play. A Game is a detail
 * here, never a place: unclaimed units and other players' units show only on
 * the Game's page, and a Game is started or joined from the Play hub.
 *
 *  - **The band** (ink, paper flecks): the notched title and, right of it on
 *    the band's foot, **Import**, **Export all** and the **Showing** select
 *    (Everything, Not in a Game, then one entry per Game); what does not fit
 *    beside the name wraps up over it (`asideAt="controls"`).
 *  - **Three rows of shelves**: Pilots, Mechs and Crawlers side by side; then
 *    NPCs and Patterns, which are user-made and so dashed (ruleset §3.9); then,
 *    folded, the Starter Set, read-only, as the front door shows it
 *    (`StarterShelf`).
 *
 * Each item is a library Row (`UnitRow`) with its chips and a ⋯ menu: Open, Move
 * to a Game…, Make a copy, Save as pattern (mechs), Export and Delete…. Every
 * verb that changes what you have asks first, through the page's one confirm,
 * which has to outlive the menu that asked.
 *
 * ## Modes
 *
 * Connected, the page reads your Games (for the chips and the move) and who can
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

import { useQuery } from 'convex/react'
import type { MechPattern } from 'game-domain/schemas/pattern'
import type { CSSProperties } from 'react'
import { useState } from 'react'
import { api } from '../../../convex/_generated/api'
import type { HeaderMenuItem } from '../../components/index'
import {
  Button,
  ChapterBand,
  Grid,
  HeaderMenu,
  PageShell,
  RosterSkeleton,
  Select,
  toast,
} from '../../components/index'
import { useConfirm } from '../../components/shared/useConfirm'
import { useGo } from '../../components/shared/useGo'
import { useConnection } from '../../lib/connection/connectionContext'
import { useServerAction } from '../../lib/connection/useServerAction'
import { copyForShelf, copyName } from '../../lib/copyEntity'
import {
  useCrawlers,
  useHydrateEntities,
  useMechs,
  useNpcs,
  usePilots,
  useSoftLinkList,
} from '../../lib/entities'
import { useHydrateOnMount } from '../../lib/entities/useHydrateEntities'
import { buildEntityExport, buildPatternExport } from '../../lib/export/buildExportBundle'
import { downloadJson, exportFileName } from '../../lib/export/downloadJson'
import type { MoveTargetGame } from '../../lib/games/gameRoster'
import { ROW_ACTION_COPY } from '../../lib/games/rowActionCopy'
import { patternCopy, patternHref } from '../../lib/patterns/patterns'
import type { PatternSharing, ShelfFilter, ShelfGame } from '../../lib/shelves/shelfItems'
import {
  chassisFact,
  crawlerChips,
  crawlerFact,
  crawlerIsKept,
  crawlerReading,
  encounterNpcChips,
  encounterNpcReading,
  gameRelation,
  linkChip,
  mechRelations,
  npcChips,
  npcReading,
  patternChips,
  patternReading,
  pilotFact,
  pilotRelations,
  shelfFilters,
  shownUnder,
} from '../../lib/shelves/shelfItems'
import { useEncounterStore } from '../../stores/encounterStore'
import { useEntityStore } from '../../stores/entityStore'
import { usePatternStore } from '../../stores/patternStore'
import type { AssignableType } from '../../stores/types'
import { ExportAllButton } from '../export/ExportAllButton'
import { ImportButton } from '../export/ImportButton'
import { crawlerRailItems, mechRailItems, pilotRailItems, rowStats } from '../sheet/railStats.model'
import type { MoveSubject } from './MoveToGameDialog'
import { MoveToGameDialog } from './MoveToGameDialog'
import { Shelf } from './Shelf'
import { ShelfItem } from './ShelfItem'
import { StarterShelf } from './StarterShelf'

// ---------------------------------------------------------------------------
// Layout
// ---------------------------------------------------------------------------

const MEASURE = '75rem'

/**
 * One row of shelves (owner, 2026-10-15): your units (Pilots, Mechs,
 * Crawlers), then what you made (NPCs, Patterns), side by side where there is
 * room, stacked on a phone. The Starter Set is the third row, folded.
 */
const ROW = { alignItems: 'start' } satisfies CSSProperties

// ---------------------------------------------------------------------------
// Data: the server's facts, read only when there is a server to ask
// ---------------------------------------------------------------------------

type ServerFacts = {
  /** Your Games; undefined while they load, or with no server to ask. */
  games: (ShelfGame & MoveTargetGame)[] | undefined
  /** Who can see each of your patterns; undefined likewise. */
  sharing: PatternSharing[] | undefined
  /** The ids of your sheets anyone with the link may read; undefined likewise. */
  sharedByLink: string[] | undefined
}

function ConnectedShelves() {
  const games = useQuery(api.games.listMine, {})
  const sharing = useQuery(api.shelf.patternSharing, {})
  const sharedByLink = useQuery(api.shelf.sharedByLink, {})
  return <ShelvesPage games={games} sharing={sharing} sharedByLink={sharedByLink} />
}

/** Shelves: the server's facts when Connected, the cached pile otherwise. */
export function Shelves() {
  const { mode } = useConnection()
  if (mode === 'connected') return <ConnectedShelves />
  return <ShelvesPage games={undefined} sharing={undefined} sharedByLink={undefined} />
}

// ---------------------------------------------------------------------------
// The page
// ---------------------------------------------------------------------------

function ShelvesPage({ games, sharing, sharedByLink }: ServerFacts) {
  const { mode, canWrite } = useConnection()
  const { confirm, dialog } = useConfirm()
  const go = useGo()
  const [filter, setFilter] = useState<ShelfFilter>('everything')
  const [moving, setMoving] = useState<MoveSubject | null>(null)
  const [importResult, setImportResult] = useState<string | null>(null)
  // Menu items have no line of their own, so a failed export is a toast.
  const exportOne = useServerAction(
    async (type: AssignableType, id: string, name: string) => {
      const bundle = await buildEntityExport(type, id, useEntityStore.getState())
      downloadJson(exportFileName(type, name), bundle)
    },
    { failure: 'That export did not download. Try again.', toastId: 'shelf-export' }
  )

  const hydratedUnits = useHydrateEntities(['pilot', 'mech', 'crawler', 'npc', 'softLink'])
  const hydratedPatterns = useHydrateOnMount(() => usePatternStore.getState().hydrate())
  const hydratedTray = useHydrateOnMount(() => useEncounterStore.getState().hydrate())
  const allPilots = usePilots()
  const allMechs = useMechs()
  const allCrawlers = useCrawlers()
  const allNpcs = useNpcs()
  const softLinks = useSoftLinkList()
  const patterns = usePatternStore((s) => s.mechPatterns)
  const trayNpcs = useEncounterStore((s) => s.encounterNpcs)

  // Names for the chips, from the WHOLE pile, so a link names its other end
  // whichever way the toggle is set.
  const pilotNames = new Map(allPilots.map((p) => [p.id, p.name]))
  const mechNames = new Map(allMechs.map((m) => [m.id, m.name]))

  // The Showing select: a Game you have since left falls back to Everything.
  const filters = shelfFilters(games)
  const shown: ShelfFilter = filters.some((f) => f.value === filter) ? filter : 'everything'

  const pilots = allPilots.filter((p) => shownUnder(shown, p))
  const mechs = allMechs.filter((m) => shownUnder(shown, m))
  // A Game's crawler is the crew's: in your Hangar only where you run the table.
  const keptCrawlers = allCrawlers.filter((c) => crawlerIsKept(c, games))
  const crawlers = keptCrawlers.filter((c) => shownUnder(shown, c))
  const npcs = allNpcs.filter((n) => shownUnder(shown, n))
  // The personal tray is in the Hangar alone: it is in no Game to filter by.
  const tray = shown === 'everything' ? trayNpcs.filter((n) => typeof n.gameId !== 'string') : []

  /**
   * A filtered-out shelf says why: "Every pilot is in a Game." or "No pilot of
   * yours is in this Game." only when there are pilots at all, and "No pilots
   * yet." when there are none to filter.
   */
  const emptyText = (total: number, none: string, singular: string): string =>
    shown === 'everything' || total === 0
      ? none
      : shown === 'not-in-game'
        ? `Every ${singular} is in a Game.`
        : `No ${singular} of yours is in this Game.`

  // -- the verbs ------------------------------------------------------------

  /** Write verbs exist only where a write could land. */
  const writable = (run: () => void): (() => void) | undefined => (canWrite ? run : undefined)

  async function exportUnit(type: AssignableType, id: string, name: string) {
    const result = await exportOne.run(type, id, name)
    if (result.ok) toast.success(`Exported ${name}.`)
  }

  function unitMenu(
    type: AssignableType,
    unit: { id: string; name: string; gameId?: string | null },
    copyBody: Record<string, unknown>
  ): HeaderMenuItem[][] {
    const inGame = typeof unit.gameId === 'string'
    return [
      [
        { id: 'open', label: 'Open', onSelect: () => go(`/sheet/${type}/${unit.id}`) },
        {
          id: 'move',
          label: 'Move to a Game…',
          // Moves need the server's list of Games.
          onSelect:
            canWrite && mode === 'connected'
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
                const created = await useEntityStore
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
                onSelect: writable(() => go('/mechs/patterns/new', { from: unit.id })),
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
              onConfirm: () => useEntityStore.getState().delete(type, unit.id),
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
              onConfirm: () => useEncounterStore.getState().delete(npc.id),
            })
          ),
        },
      ],
    ]
  }

  function patternMenu(pattern: MechPattern): HeaderMenuItem[][] {
    return [
      [
        { id: 'open', label: 'Open', onSelect: () => go(patternHref(pattern.id)) },
        {
          id: 'copy',
          label: 'Make a copy',
          onSelect: writable(() =>
            confirm({
              ...ROW_ACTION_COPY.copyOnShelf(pattern.name),
              onConfirm: async () => {
                const created = await usePatternStore
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
              onConfirm: () => usePatternStore.getState().delete(pattern.id),
            })
          ),
        },
      ],
    ]
  }

  // -- the shelves ------------------------------------------------------------

  const newLink = (href: string, label: string) =>
    canWrite ? (
      <Button href={href} size="mini">
        {label}
      </Button>
    ) : undefined

  const fromAMech: HeaderMenuItem[] =
    allMechs.length === 0
      ? [{ id: 'none', label: 'Build a mech first' }]
      : allMechs.map((m) => ({
          id: m.id,
          label: m.name,
          onSelect: () => go('/mechs/patterns/new', { from: m.id }),
        }))

  const ready = hydratedUnits && hydratedPatterns && hydratedTray

  return (
    <PageShell
      className="su-shelves"
      measure={MEASURE}
      band={
        <ChapterBand
          tone="ink"
          measure={MEASURE}
          eyebrow={
            <p role="status" aria-live="polite" className="su-shelves-band__status">
              {importResult}
            </p>
          }
          // Beside the name while they fit, wrapping up over it when they do
          // not: the first in the list sit nearest the name.
          asideAt="controls"
          aside={
            <>
              {canWrite && <ImportButton onResult={setImportResult} />}
              <ExportAllButton />
              <Select
                chevron
                aria-label="Showing"
                value={shown}
                onChange={(e) => setFilter(e.target.value as ShelfFilter)}
                className="su-container-select"
              >
                {filters.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
            </>
          }
        >
          Hangar
        </ChapterBand>
      }
    >
      {!ready ? (
        <RosterSkeleton />
      ) : (
        <>
          <Grid min="20rem" gap={32} style={ROW}>
            <Shelf
              id="shelf-pilots"
              title="Pilots"
              action={newLink('/pilots/new', '+ New pilot')}
              isEmpty={pilots.length === 0}
              empty={emptyText(allPilots.length, 'No pilots yet.', 'pilot')}
            >
              {pilots.map((p) => (
                <ShelfItem
                  key={p.id}
                  kind="pilot"
                  note={pilotFact(p)}
                  name={p.name}
                  reading={rowStats(pilotRailItems(p))[0]}
                  href={`/sheet/pilot/${p.id}`}
                  chips={linkChip(sharedByLink, p.id)}
                  relations={[
                    ...pilotRelations({ pilot: p, softLinks, mechNames }),
                    ...gameRelation(p, games),
                  ]}
                  menu={unitMenu('pilot', p, p)}
                />
              ))}
            </Shelf>

            <Shelf
              id="shelf-mechs"
              title="Mechs"
              action={newLink('/mechs/new', '+ New mech')}
              isEmpty={mechs.length === 0}
              empty={emptyText(allMechs.length, 'No mechs yet.', 'mech')}
            >
              {mechs.map((m) => (
                <ShelfItem
                  key={m.id}
                  kind="mech"
                  note={chassisFact(m.chassisRef)}
                  name={m.name}
                  reading={rowStats(mechRailItems(m))[0]}
                  href={`/sheet/mech/${m.id}`}
                  chips={linkChip(sharedByLink, m.id)}
                  relations={[
                    ...mechRelations({ mech: m, softLinks, pilotNames }),
                    ...gameRelation(m, games),
                  ]}
                  menu={unitMenu('mech', m, m)}
                />
              ))}
            </Shelf>

            <Shelf
              id="shelf-crawlers"
              title="Crawlers"
              action={newLink('/crawlers/new', '+ New crawler')}
              isEmpty={crawlers.length === 0}
              empty={emptyText(keptCrawlers.length, 'No crawlers yet.', 'crawler')}
            >
              {crawlers.map((c) => (
                <ShelfItem
                  key={c.id}
                  kind="crawler"
                  note={crawlerFact(c)}
                  name={c.name}
                  reading={crawlerReading(c) ?? rowStats(crawlerRailItems(c))[0]}
                  href={`/sheet/crawler/${c.id}`}
                  chips={[...crawlerChips({ crawler: c, games }), ...linkChip(sharedByLink, c.id)]}
                  relations={gameRelation(c, games)}
                  menu={unitMenu('crawler', c, c)}
                />
              ))}
            </Shelf>
          </Grid>

          <Grid min="20rem" gap={32} style={ROW}>
            <Shelf
              id="shelf-npcs"
              title="NPCs"
              aside="Yours"
              note="Your NPCs, ready to drop into a Game you mediate."
              action={newLink('/npcs/new', '+ Design an NPC')}
              isEmpty={npcs.length + tray.length === 0}
              empty={emptyText(
                allNpcs.length + tray.length,
                'No NPCs yet. Design one and it is kept here.',
                'NPC'
              )}
            >
              {npcs.map((n) => (
                <ShelfItem
                  key={n.id}
                  kind="npc"
                  note={n.position}
                  name={n.name}
                  reading={npcReading(n)}
                  href={`/sheet/npc/${n.id}`}
                  userMade
                  chips={npcChips({
                    npc: n,
                    sharedByLink: sharedByLink?.includes(n.id) ?? false,
                  })}
                  relations={gameRelation(n, games)}
                  menu={unitMenu('npc', n, n)}
                />
              ))}
              {tray.map((n) => (
                <ShelfItem
                  key={n.id}
                  kind="npc"
                  note="Tray"
                  name={n.name}
                  reading={encounterNpcReading(n)}
                  userMade
                  chips={encounterNpcChips()}
                  menu={trayMenu(n)}
                />
              ))}
            </Shelf>

            <Shelf
              id="shelf-patterns"
              title="Patterns"
              aside="Yours"
              note="Your patterns, ready to build a Mech from."
              action={
                canWrite ? (
                  <HeaderMenu
                    variant="button"
                    trigger="+ From a mech"
                    label="+ From a mech"
                    chevron={false}
                    sections={[fromAMech]}
                  />
                ) : undefined
              }
              isEmpty={patterns.length === 0}
              empty="No patterns yet. Save one from a mech."
            >
              {patterns.map((p) => (
                <ShelfItem
                  key={p.id}
                  kind="pattern"
                  note={chassisFact(p.chassisRef)}
                  name={p.name}
                  reading={patternReading(p)}
                  href={patternHref(p.id)}
                  userMade
                  chips={patternChips(sharing?.find((s) => s.appId === p.id))}
                  menu={patternMenu(p)}
                />
              ))}
            </Shelf>
          </Grid>
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
    </PageShell>
  )
}
