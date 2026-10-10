/**
 * Shelves — everything you keep, on your account (issue 1279, board S1). The
 * page at `/` once you are signed in; signed out, `/` is the front door.
 *
 * "My Stuff" became Shelves: ADR-030 already called the personal container the
 * shelf, and now the page says so. A unit in a Game stays on your shelf too —
 * it is one record whichever table it plays at — so the page lists every pilot,
 * mech and crawler of yours this browser holds, wherever it is, and a chip
 * under each says where.
 *
 *  - **The band** (ink, paper flecks): the notched title, a line saying what
 *    the page is, the **Showing** toggle (Everything | Not in a Game),
 *    **Import** and **Export all**, and "+ New game", the one way to start a
 *    table.
 *  - **Invited**: an invitation addressed to you, above the shelves
 *    (`InvitationsForYou`), with Join the Game and Not now.
 *  - **One shelf per kind**: Pilots, Mechs and Crawlers; Patterns and NPCs,
 *    which are user-made and so dashed (ruleset §3.9); and the Starter Set,
 *    read-only in the rules blue (`StarterShelf`).
 *
 * Each item is one line (`ShelfPill`) with its chips and a ⋯ menu: Open, Move
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
 * The NPC designer (issue 1277) is not built yet, so the NPC shelf says so and
 * offers no "+ Design an NPC". The opposition tray's reference NPCs are not
 * yours to keep and do not belong here.
 */

import { useRouter } from '@tanstack/react-router'
import { buttonVariants, ChapterBand, RosterSkeleton, toast, tokens } from 'component-lib'
import { useQuery } from 'convex/react'
import type { CSSProperties } from 'react'
import { useState } from 'react'
import { api } from '../../../convex/_generated/api'
import {
  useCrawlers,
  useHydrateEntities,
  useMechs,
  usePilots,
  useSoftLinkList,
} from '../../hooks/entities'
import { useHydrateOnMount } from '../../hooks/entities/useHydrateEntities'
import { useConnection } from '../../lib/connection/connectionContext'
import { copyForShelf, copyName } from '../../lib/copyEntity'
import { buildEntityExport, buildPatternExport } from '../../lib/export/buildExportBundle'
import { downloadJson } from '../../lib/export/downloadJson'
import type { MoveTargetGame } from '../../lib/games/gameRoster'
import { ROW_ACTION_COPY } from '../../lib/games/rowActionCopy'
import { patternCopy, patternHref } from '../../lib/patterns/patterns'
import type { MechPattern } from '../../lib/schemas/pattern'
import type { PatternSharing, ShelfFilter, ShelfGame } from '../../lib/shelves/shelfItems'
import {
  chassisFact,
  crawlerChips,
  crawlerFact,
  crawlerIsKept,
  crawlerReading,
  kicker,
  mechChips,
  patternChips,
  patternReading,
  pilotChips,
  pilotFact,
  shownUnder,
} from '../../lib/shelves/shelfItems'
import { useEntityStore } from '../../stores/entityStore'
import { usePatternStore } from '../../stores/patternStore'
import type { AssignableType } from '../../stores/types'
import { ExportAllButton } from '../export/ExportAllButton'
import { ImportButton } from '../export/ImportButton'
import { InvitationsForYou } from '../games/InvitationsForYou'
import { NewGameControl } from '../games/NewGameControl'
import { AppLink } from '../shared/AppLink'
import type { HeaderMenuItem } from '../shared/HeaderMenu'
import { HeaderMenu } from '../shared/HeaderMenu'
import { useConfirm } from '../shared/useConfirm'
import { crawlerRailItems, mechRailItems, pilotRailItems, rowStats } from '../sheet/railStats'
import type { MoveSubject } from './MoveToGameDialog'
import { MoveToGameDialog } from './MoveToGameDialog'
import { Shelf } from './Shelf'
import { ShelfItem } from './ShelfItem'
import { StarterShelf } from './StarterShelf'

// ---------------------------------------------------------------------------
// Layout
// ---------------------------------------------------------------------------

const MEASURE = '80rem'

const PAGE = {
  backgroundColor: tokens.color.wkBg,
  minHeight: '100%',
  paddingBottom: tokens.space[48],
} satisfies CSSProperties

/** The band's top row: what the page is at the start, its controls at the end. */
const BAND_ROW = {
  alignItems: 'center',
  display: 'flex',
  flex: '1 1 100%',
  flexWrap: 'wrap',
  gap: tokens.space[16],
  justifyContent: 'space-between',
} satisfies CSSProperties

const BAND_LEAD = {
  color: tokens.color.paper,
  fontFamily: tokens.font.body,
  fontSize: tokens.fontSize.sm,
  margin: 0,
} satisfies CSSProperties

const BAND_CONTROLS = {
  alignItems: 'flex-start',
  display: 'flex',
  flexWrap: 'wrap',
  gap: tokens.space[12],
} satisfies CSSProperties

const TOGGLE = {
  borderColor: tokens.color.paper,
  margin: 0,
  minInlineSize: 0,
  padding: 0,
  borderRadius: tokens.radius.card,
  borderStyle: 'solid',
  borderWidth: tokens.borderWidth.chrome,
  display: 'inline-flex',
  overflow: 'hidden',
} satisfies CSSProperties

const TOGGLE_OPTION = {
  border: 0,
  fontFamily: tokens.font.cond,
  fontSize: tokens.fontSize.caption,
  fontWeight: tokens.weight.bold,
  letterSpacing: tokens.tracking.capsTight,
  minHeight: '40px',
  padding: `0 ${tokens.space[14]}`,
  textTransform: 'uppercase',
} satisfies CSSProperties

const BODY = {
  display: 'flex',
  flexDirection: 'column',
  gap: tokens.space[24],
  margin: '0 auto',
  maxWidth: MEASURE,
  padding: `${tokens.space[20]} ${tokens.space[16]} 0`,
} satisfies CSSProperties

/** Two columns where there is room — your units, then what you made and the book's. */
const COLUMNS = {
  alignItems: 'start',
  display: 'grid',
  gap: tokens.space[32],
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 26rem), 1fr))',
} satisfies CSSProperties

const COLUMN = {
  display: 'flex',
  flexDirection: 'column',
  gap: tokens.space[32],
  minWidth: 0,
} satisfies CSSProperties

const NEW_LINK = { textDecoration: 'none' } satisfies CSSProperties

/** The on-ink outline the band's buttons wear (`styles/shelves.css`). */
const ON_INK_BUTTON = 'shelves-band__btn'

const FILTERS: { value: ShelfFilter; label: string }[] = [
  { value: 'everything', label: 'Everything' },
  { value: 'not-in-game', label: 'Not in a Game' },
]

// ---------------------------------------------------------------------------
// Data: the server's facts, read only when there is a server to ask
// ---------------------------------------------------------------------------

type ServerFacts = {
  /** Your Games; undefined while they load, or with no server to ask. */
  games: (ShelfGame & MoveTargetGame)[] | undefined
  /** Who can see each of your patterns; undefined likewise. */
  sharing: PatternSharing[] | undefined
}

function ConnectedShelves() {
  const games = useQuery(api.games.listMine, {})
  const sharing = useQuery(api.shelf.patternSharing, {})
  return <ShelvesPage games={games} sharing={sharing} />
}

/** Shelves: the server's facts when Connected, the cached pile otherwise. */
export function Shelves() {
  const { mode } = useConnection()
  if (mode === 'connected') return <ConnectedShelves />
  return <ShelvesPage games={undefined} sharing={undefined} />
}

// ---------------------------------------------------------------------------
// The page
// ---------------------------------------------------------------------------

/** Go to an address in the app — through the router when there is one. */
function useGo(): (to: string, search?: Record<string, string>) => void {
  const router = useRouter({ warn: false })
  return (to, search) => {
    if (router) {
      void router.navigate({ to, search } as never)
      return
    }
    const query = search ? `?${new URLSearchParams(search).toString()}` : ''
    window.location.assign(`${to}${query}`)
  }
}

/** A file-safe stem for an export: "itun-pilot-bonesaw.json". */
function fileStem(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .slice(0, 40)
}

function ShelvesPage({ games, sharing }: ServerFacts) {
  const { mode, canWrite } = useConnection()
  const { confirm, dialog } = useConfirm()
  const go = useGo()
  const [filter, setFilter] = useState<ShelfFilter>('everything')
  const [moving, setMoving] = useState<MoveSubject | null>(null)

  const hydratedUnits = useHydrateEntities(['pilot', 'mech', 'crawler', 'softLink'])
  const hydratedPatterns = useHydrateOnMount(() => usePatternStore.getState().hydrate())
  const allPilots = usePilots()
  const allMechs = useMechs()
  const allCrawlers = useCrawlers()
  const softLinks = useSoftLinkList()
  const patterns = usePatternStore((s) => s.mechPatterns)

  // Names for the chips, from the WHOLE pile, so a link names its other end
  // whichever way the toggle is set.
  const pilotNames = new Map(allPilots.map((p) => [p.id, p.name]))
  const mechNames = new Map(allMechs.map((m) => [m.id, m.name]))
  const patternNames = new Map(patterns.map((p) => [p.id, p.name]))

  const pilots = allPilots.filter((p) => shownUnder(filter, p))
  const mechs = allMechs.filter((m) => shownUnder(filter, m))
  // A Game's crawler is the crew's: on your shelf only where you run the table.
  const crawlers = allCrawlers.filter((c) => crawlerIsKept(c, games) && shownUnder(filter, c))

  // -- the verbs ------------------------------------------------------------

  /** Write verbs exist only where a write could land. */
  const writable = (run: () => void): (() => void) | undefined => (canWrite ? run : undefined)

  function exportUnit(type: AssignableType, id: string, name: string) {
    void buildEntityExport(type, id, useEntityStore.getState())
      .then((bundle) => {
        downloadJson(`itun-${type}-${fileStem(name)}.json`, bundle)
        toast.success(`Exported ${name}.`)
      })
      .catch((err: unknown) => toast.error(err instanceof Error ? err.message : 'Export failed.'))
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
        { id: 'export', label: 'Export', onSelect: () => exportUnit(type, unit.id, unit.name) },
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
            downloadJson(`itun-pattern-${fileStem(pattern.name)}.json`, buildPatternExport(pattern))
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
      <AppLink href={href} className={buttonVariants({ size: 'compact' })} style={NEW_LINK}>
        {label}
      </AppLink>
    ) : undefined

  const fromAMech: HeaderMenuItem[] =
    allMechs.length === 0
      ? [{ id: 'none', label: 'Build a mech first' }]
      : allMechs.map((m) => ({
          id: m.id,
          label: m.name,
          onSelect: () => go('/mechs/patterns/new', { from: m.id }),
        }))

  const ready = hydratedUnits && hydratedPatterns

  return (
    <main style={PAGE}>
      <ChapterBand
        tone="ink"
        measure={MEASURE}
        eyebrow={
          <div style={BAND_ROW}>
            <p style={BAND_LEAD}>
              Everything you keep, on your account. Units in a Game stay on your shelf too.
            </p>
            <div style={BAND_CONTROLS}>
              <fieldset aria-label="Showing" style={TOGGLE}>
                {FILTERS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    className="shelves-toggle__option su-focus-ring"
                    aria-pressed={filter === option.value}
                    onClick={() => setFilter(option.value)}
                    style={TOGGLE_OPTION}
                  >
                    {option.label}
                  </button>
                ))}
              </fieldset>
              {canWrite && <ImportButton className={ON_INK_BUTTON} onInk />}
              <ExportAllButton className={ON_INK_BUTTON} onInk />
              <NewGameControl className={ON_INK_BUTTON} />
            </div>
          </div>
        }
      >
        Shelves
      </ChapterBand>

      <div style={BODY}>
        <InvitationsForYou />

        {!ready ? (
          <RosterSkeleton />
        ) : (
          <div style={COLUMNS}>
            <div style={COLUMN}>
              <Shelf
                id="shelf-pilots"
                title="Pilots"
                count={pilots.length}
                action={newLink('/pilots/new', '+ New pilot')}
                isEmpty={pilots.length === 0}
                empty={filter === 'everything' ? 'No pilots yet.' : 'Every pilot is in a Game.'}
              >
                {pilots.map((p) => (
                  <ShelfItem
                    key={p.id}
                    kind="pilot"
                    kicker={kicker('Pilot', pilotFact(p))}
                    name={p.name}
                    reading={rowStats(pilotRailItems(p))[0]}
                    href={`/sheet/pilot/${p.id}`}
                    chips={pilotChips({ pilot: p, games, softLinks, mechNames })}
                    menu={unitMenu('pilot', p, p)}
                  />
                ))}
              </Shelf>

              <Shelf
                id="shelf-mechs"
                title="Mechs"
                count={mechs.length}
                action={newLink('/mechs/new', '+ New mech')}
                isEmpty={mechs.length === 0}
                empty={filter === 'everything' ? 'No mechs yet.' : 'Every mech is in a Game.'}
              >
                {mechs.map((m) => (
                  <ShelfItem
                    key={m.id}
                    kind="mech"
                    kicker={kicker('Mech', chassisFact(m.chassisRef))}
                    name={m.name}
                    reading={rowStats(mechRailItems(m))[0]}
                    href={`/sheet/mech/${m.id}`}
                    chips={mechChips({ mech: m, games, softLinks, pilotNames, patternNames })}
                    menu={unitMenu('mech', m, m)}
                  />
                ))}
              </Shelf>

              <Shelf
                id="shelf-crawlers"
                title="Crawlers"
                count={crawlers.length}
                action={newLink('/crawlers/new', '+ New crawler')}
                isEmpty={crawlers.length === 0}
                empty={filter === 'everything' ? 'No crawlers yet.' : 'Every crawler is in a Game.'}
              >
                {crawlers.map((c) => (
                  <ShelfItem
                    key={c.id}
                    kind="crawler"
                    kicker={kicker('Crawler', crawlerFact(c))}
                    name={c.name}
                    reading={crawlerReading(c) ?? rowStats(crawlerRailItems(c))[0]}
                    href={`/sheet/crawler/${c.id}`}
                    chips={crawlerChips({ crawler: c, games })}
                    menu={unitMenu('crawler', c, c)}
                  />
                ))}
              </Shelf>
            </div>

            <div style={COLUMN}>
              <Shelf
                id="shelf-patterns"
                title="Patterns"
                count={`${patterns.length} · yours`}
                note="User-made: dashed, like everything players make."
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
                    kicker={kicker('Pattern', chassisFact(p.chassisRef))}
                    name={p.name}
                    reading={patternReading(p)}
                    href={patternHref(p.id)}
                    userMade
                    chips={patternChips(sharing?.find((s) => s.appId === p.id))}
                    menu={patternMenu(p)}
                  />
                ))}
              </Shelf>

              <Shelf
                id="shelf-npcs"
                title="NPCs"
                count="0 · yours"
                note="Your NPCs, ready to drop into a Game you mediate."
                isEmpty
                empty="The NPC designer is on its way. The NPCs you design will be kept here."
              />

              <StarterShelf />
            </div>
          </div>
        )}
      </div>

      <MoveToGameDialog
        subject={moving}
        onClose={() => setMoving(null)}
        games={games}
        confirm={confirm}
      />
      {dialog}
    </main>
  )
}
