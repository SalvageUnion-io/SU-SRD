/**
 * Roster — the hub at `/` (design-spec §3.1, §3.7).
 *
 * One container on screen at a time, picked in the header's "Showing" select
 * (`ContainerSwitcher`, persisted in `activeContainerStore`):
 *
 *  - **My Stuff** — your builds that are in no Game, in three columns of
 *    `EntityRow`s. Each row: View, "Move to game…" (`MoveToGameSelect`), and
 *    Delete behind the shared confirm.
 *  - **A Game** — that table's roster, yours first, with every player and
 *    Mediator action below the lists (`GameHub`). There is no Games page any
 *    more; this is it.
 *
 * "+ New game" (`NewGameControl`) heads the band, beside the select it adds
 * to. Signed out — or in a build with no account service — there is no game
 * UI at all: no select, no New game, and the whole pile unfiltered (see
 * `inContainer`).
 *
 * On mount: hydrates all three entity types + softLinks. At the mobile
 * endpoint (≤ md) the columns collapse to one behind a segmented
 * Pilot/Mech/Crawler switch (`RosterColumn.tsx`), whose choice is kept here so
 * it survives switching between My Stuff and a Game.
 *
 * Delete flow:
 *   1. User clicks "Delete" on an EntityRow.
 *   2. The shared danger-tone confirm opens (`useConfirm` → component-lib
 *      `ConfirmDialog`, words from `lib/games/rowActionCopy.ts`).
 *   3. User confirms → entityStore.delete() is called, entity removed from
 *      listing immediately (Zustand in-memory update is synchronous). A failed
 *      delete keeps the dialog open with the reason.
 */

import type { EntityRowStat } from 'component-lib'
import {
  Button,
  buttonVariants,
  cn,
  EntityRow,
  PageShell,
  RosterSkeleton,
  Stat,
} from 'component-lib'
import { UserRound } from 'lucide-react'
import type { ReactNode } from 'react'
import { useState } from 'react'
import { resolveChassisRef } from 'salvageunion-reference/rules'
import {
  useCrawlers,
  useHydrateEntities,
  useMechs,
  usePilots,
  useSoftLinkList,
} from '../../hooks/entities'
import { resolveClassName } from '../../lib/classRef'
import { useConnection } from '../../lib/connection/connectionContext'
import type { ContainerFields } from '../../lib/container'
import { containerOf, sameContainer } from '../../lib/container'
import { ROW_ACTION_COPY } from '../../lib/games/rowActionCopy'
import { readReference } from '../../lib/readReference'
import type { SoftLink } from '../../lib/schemas/softLink'
import { copyStarterSetToRoster, isStarterSetSeeded } from '../../lib/starterSet/seedStarterSet'
import { setActiveContainer, useActiveContainer } from '../../stores/activeContainerStore'
import type { EntityType } from '../../stores/entityStore'
import { useEntityStore } from '../../stores/entityStore'
import { usePatternStore } from '../../stores/patternStore'
import { ContainerSwitcher } from '../container/ContainerSwitcher'
import { MoveToGameSelect } from '../container/MoveToGameSelect'
import { DashboardChooser } from '../dashboard/DashboardChooser'
import { ExportAllButton } from '../export/ExportAllButton'
import { ImportButton } from '../export/ImportButton'
import { GameHub } from '../games/GameHub'
import { InvitationsForYou } from '../games/InvitationsForYou'
import { NewGameControl } from '../games/NewGameControl'
import { AppLink } from '../shared/AppLink'
import { useConfirm } from '../shared/useConfirm'
import type { SegmentKind } from './RosterColumn'
import { RosterColumn, RosterGrid, RosterList, SegmentSwitch } from './RosterColumn'

// ---------------------------------------------------------------------------
// Row-meta helpers
// ---------------------------------------------------------------------------

/**
 * A mech row's stats: `CHASSIS | Iron Mongrel`, and `TL | 1` beside it.
 *
 * These used to be one caption string, "Iron Mongrel · TL 1" — two facts joined
 * by a separator, which is the shape `Stat` exists to replace. TL is its own
 * stat rather than a suffix for the same reason.
 *
 * resolveChassisRef is slug/name/id tolerant; stored refs are slugs, so a
 * name-only match here would fall through to the raw slug for every mech.
 * `readReference` falls back to the raw ref when the Chassis model isn't
 * preloaded (some test/snapshot contexts) rather than crash.
 */
function mechChassisStats(chassisRef: string): EntityRowStat[] | undefined {
  if (!chassisRef) return undefined
  const resolved = readReference(
    'Roster.mechChassisStats',
    () => resolveChassisRef(chassisRef) as { name: string; techLevel?: number } | null,
    null
  )

  const stats: EntityRowStat[] = [{ label: 'Chassis', value: resolved?.name ?? chassisRef }]
  if (resolved?.techLevel != null) stats.push({ label: 'TL', value: resolved.techLevel })
  return stats
}

/**
 * A crawler row's stats: `TL | 2`, `BAYS | 3`.
 *
 * Was the caption string "TL 2 · 3 bays" — the same two-facts-one-separator
 * shape the chassis had, and the same fix. These are the labels the crew roster
 * already used, so the two surfaces now read identically.
 */
function crawlerStats(techLevel: string, bayCount: number): EntityRowStat[] {
  const tl = techLevel.replace(/[^0-9]/g, '')
  const stats: EntityRowStat[] = []
  if (tl) stats.push({ label: 'TL', value: tl })
  stats.push({ label: 'Bays', value: bayCount })
  return stats
}

/**
 * A pilot row's header stats: `CLASS | Scavenger`, `CALLSIGN | Ghost`.
 *
 * These lived in the body as tone-tinted chips. They are `label | value` facts
 * like any other, so they belong in the band with the rest, on the plain ink
 * label plate every other stat uses — the tint was a second way of saying what
 * the band already says.
 *
 * No HP/AP here: a roster answers "what have I got", not "how hurt is it".
 */
function pilotStats(classRef: string, callsign?: string): EntityRowStat[] | undefined {
  const stats: EntityRowStat[] = []
  const className = resolveClassName(classRef)
  if (className) stats.push({ label: 'Class', value: className })
  if (callsign) stats.push({ label: 'Callsign', value: callsign })
  return stats.length > 0 ? stats : undefined
}

/**
 * The row's body details, blanks dropped.
 *
 * These used to be joined into one muted line with ' · ' separators, then became
 * chips, and are now `label | value` stats — each step removing an inference the
 * reader was making on the row's behalf.
 */
function metaParts(parts: Array<ReactNode | null | undefined>): ReactNode[] | undefined {
  const kept = parts.filter((part) => part != null && part !== '')
  return kept.length === 0 ? undefined : kept
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Label-plate tints for a cross-link, keyed to the TARGET's ontology — the same
 * `--color-sheet-*` tokens `EntityRow` bands itself with, so a link to a mech
 * is the green a mech row wears. Crawler takes paper text; it is the one dark
 * fill in the ramp.
 */
const TONE_BG: Record<SegmentKind, string> = {
  pilot: 'var(--color-sheet-pilot)',
  mech: 'var(--color-sheet-mech)',
  crawler: 'var(--color-sheet-crawler)',
}
const TONE_INK: Record<SegmentKind, string> = {
  pilot: 'var(--color-ink)',
  mech: 'var(--color-ink)',
  crawler: 'var(--color-paper)',
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function Roster() {
  const { confirm, dialog: confirmDialog } = useConfirm()
  /** The current container (global, persisted). Only consulted when Connected. */
  const activeContainer = useActiveContainer()
  const { mode } = useConnection()
  /** Mobile-endpoint segmented switch (design §3.7) — which column shows ≤ md */
  const [activeSegment, setActiveSegment] = useState<SegmentKind>('pilot')

  // Hydrate all three entity types + softLinks on mount.
  const hydratedAll = useHydrateEntities(['pilot', 'mech', 'crawler', 'softLink'])

  const allPilots = usePilots()
  const allMechs = useMechs()
  const allCrawlers = useCrawlers()
  const softLinks: SoftLink[] = useSoftLinkList()
  // Saved patterns are global (not container-scoped) — the Dashboard chooser
  // offers them as stand-in mechs, so their presence also enables a launch.
  const patterns = usePatternStore((s) => s.mechPatterns)
  usePatternStore.getState().list()

  // Name lookups for '↳ Name' cross-links — built from the UNFILTERED lists so
  // links resolve across container boundaries.
  const pilotNameById = new Map(allPilots.map((p) => [p.id, p.name]))
  const mechNameById = new Map(allMechs.map((m) => [m.id, m.name]))
  const crawlerNameById = new Map(allCrawlers.map((c) => [c.id, c.name]))
  // …and the one fact each cross-link states about its target, so a link reads
  // `IRON JAW | Titan` rather than naming a thing and saying nothing about it.
  const pilotClassById = new Map(allPilots.map((p) => [p.id, resolveClassName(p.classRef)]))
  const mechChassisNameById = new Map(
    allMechs.map((m) => [m.id, mechChassisStats(m.chassisRef)?.[0]?.value as string | undefined])
  )
  const crawlerTlById = new Map(
    allCrawlers.map((c) => {
      const tl = c.techLevel.replace(/[^0-9]/g, '')
      return [c.id, tl ? `TL ${tl}` : undefined]
    })
  )

  /**
   * A cross-link to another entity's live sheet, as a Badge tinted with THAT
   * entity's ontology tone (design review U-4).
   *
   * These used to be muted '↳ Name' underlined text. The row already tones its
   * own rail by ontology, so a monochrome cross-link was the one place on the
   * row where "which kind of thing is this?" had to be read rather than seen —
   * and a pilot linking to both a mech and a crawler rendered two visually
   * identical segments. The tone comes from the TARGET's kind, never the row's.
   *
   * Badge wrapped in the link rather than rendered `as={AppLink}`: its chip
   * props are typed for a span and carry no `href`. This is the same shape the
   * live-sheet header already uses for its linked-unit badges, so the two read
   * identically — one anchor, one focus stop.
   */
  function linkSegment(
    kind: SegmentKind,
    id: string | undefined,
    name: string | undefined,
    detail: string | undefined
  ): ReactNode | undefined {
    if (!id || !name) return undefined
    return (
      <AppLink
        href={`/sheet/${kind}/${id}`}
        className="inline-flex max-w-full align-middle no-underline"
        aria-label={`Open ${name}'s ${kind} sheet`}
      >
        {/* `NAME | detail` — the linked entity names ITSELF on the label plate
            (a mech's name IS its pattern, SU rules), with its defining fact as
            the value: a mech's chassis, a pilot's class, a crawler's TL. The
            plate is tinted with the TARGET's ontology, never the row's, so the
            kind of thing you are about to open is seen rather than read. */}
        <Stat
          label={name}
          value={detail ?? '—'}
          orientation="horizontal"
          size="mini"
          bgColor={TONE_BG[kind]}
          textColor={TONE_INK[kind]}
        />
      </AppLink>
    )
  }

  /**
   * Scope the roster to the current container — but ONLY when signed in.
   *
   * A Solo user has no Games (there is no account, so nothing to share with),
   * which makes their builds one pile and any filter of it a filter on a
   * distinction that does not exist for them. Worse, it would hide things:
   * migration v13 mapped every non-Default workspace onto `gameId: <that
   * workspace id>`, so a Solo user who once used Workspaces has entities
   * addressed by ids matching no real Game. Showing the pile whole is both
   * simpler and the only rendering that cannot lose a build.
   */
  const inContainer = <T extends ContainerFields>(list: T[]): T[] => {
    if (mode !== 'connected') return list
    return list.filter((e) => sameContainer(containerOf(e), activeContainer))
  }

  const pilots = inContainer(allPilots)
  const mechs = inContainer(allMechs)
  const crawlers = inContainer(allCrawlers)

  /**
   * Which container the body shows. A Game only when Connected: a Solo or
   * Disconnected viewer has no Games to show (see `inContainer`), so for them a
   * remembered Game selection falls through to the whole pile. While the
   * connection is still being worked out, a remembered Game shows a skeleton
   * rather than flashing that unfiltered pile first.
   */
  const shownGameId =
    mode === 'connected' && activeContainer.kind === 'game' ? activeContainer.gameId : null
  const settlingIntoGame = mode === 'connecting' && activeContainer.kind === 'game'

  /**
   * First-run welcome: a brand-new user with nothing at all. Deliberately keyed
   * to the UNFILTERED lists — an empty *container* belonging to someone who
   * already has builds elsewhere is not a first run, and the big welcome would
   * misfire there. Those fall through to the normal grid and its per-column
   * "create" empty states.
   */
  const isFirstRun = allPilots.length === 0 && allMechs.length === 0 && allCrawlers.length === 0

  /**
   * Copy the built-in Starter Set into this account (idempotent, opt-in).
   *
   * The templates are reference data that belong to nobody; this makes a copy
   * the player owns, through the ordinary create path so it reaches the server
   * of record like anything else they build.
   *
   * `isStarterSetSeeded` reads the entity store, so it re-evaluates on the
   * rehydrate the seed performs — the button disappears on its own once the
   * rows land, with no extra state to keep in sync.
   */
  const starterSeeded = allPilots.length > 0 && isStarterSetSeeded()
  const [seedingStarter, setSeedingStarter] = useState(false)
  async function handleLoadStarterSet() {
    setSeedingStarter(true)
    try {
      await copyStarterSetToRoster()
    } finally {
      setSeedingStarter(false)
    }
  }

  function openDeleteDialog(type: EntityType, id: string, name: string) {
    confirm({
      ...ROW_ACTION_COPY.deleteBuild(name),
      onConfirm: () => useEntityStore.getState().delete(type, id),
    })
  }

  return (
    <PageShell stack={false}>
      {/* Brand identity lives in the global AppHeader (routes/__root.tsx);
          the page keeps an accessible title only. Visible header row:
          Download all/Import · the "Showing" select · New game. */}
      <h1 className="sr-only">Saved Builds</h1>
      <div className="border-b-2 border-ink pb-5">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="flex flex-wrap items-start gap-2.5">
            <ExportAllButton />
            <ImportButton />
            {/* The built-in Starter Set, opt-in. It used to be an entry in the
                Workspace switcher; with no Workspaces to switch between it
                needs its own affordance, and it disappears once loaded so it
                never becomes permanent chrome. It copies into My Stuff, so it
                is not offered while a Game is showing: `create` stamps the
                active container, and the set would land in the Game instead. */}
            {!starterSeeded && shownGameId === null && (
              <Button
                variant="ghost"
                size="compact"
                disabled={seedingStarter}
                onClick={() => void handleLoadStarterSet()}
              >
                {seedingStarter ? 'Loading…' : 'Load Starter Set'}
              </Button>
            )}
            {/* Launch the Dashboard for a chosen pilot/mech/crawler crew
                (design-spec §8). Shown once the current view has a mech to run,
                or any saved pattern exists to launch as a stand-in — the
                chooser scopes saved mechs to the same container. */}
            {(mechs.length > 0 || patterns.length > 0) && (
              <DashboardChooser
                activeContainer={mode === 'connected' ? activeContainer : undefined}
              />
            )}
          </div>
          {/* What the hub shows, and how to get another table to show: the
              select lists My Stuff and every Game, and "+ New game" adds one.
              Both render nothing outside Connected. */}
          <div className="flex flex-wrap items-end gap-2.5">
            <ContainerSwitcher activeContainer={activeContainer} onSelect={setActiveContainer} />
            <NewGameControl />
          </div>
        </div>
        {/* Standing durability notice, next to the export controls. It said
            "your data lives only in this browser" to everybody, which since
            ADR-034 is true of nobody: a signed-in player's builds are on the
            server, and an anonymous visitor's are not even in the browser —
            only in this tab. */}
        <p className="mt-2.5 font-body text-xs text-wk-muted">
          {mode === 'solo'
            ? 'Nothing here is kept until you sign in — download a backup to keep it yourself.'
            : mode === 'connecting'
              ? 'Download a backup any time to keep a copy yourself.'
              : 'Saved to your account. A downloaded backup is still yours to keep.'}
        </p>
      </div>

      {/* Invites addressed to your Discord account (ADR-038), whichever
          container is showing — answering one is how you get a new one to
          show. Renders nothing when there are none. */}
      <InvitationsForYou />

      {/* Reserve a stable footprint so the grid replacing "Loading…" doesn't
          shift the rest of the page on hydration. */}
      <div className="min-h-[60vh]">
        {shownGameId !== null ? (
          <GameHub
            // Remount per Game, so one table's busy and error state never
            // shows on the next.
            key={shownGameId}
            gameId={shownGameId}
            activeSegment={activeSegment}
            onSegmentChange={setActiveSegment}
          />
        ) : !hydratedAll || settlingIntoGame ? (
          <RosterSkeleton />
        ) : isFirstRun ? (
          <FirstRunWelcome />
        ) : (
          <>
            <SegmentSwitch active={activeSegment} onChange={setActiveSegment} />

            <RosterGrid>
              <RosterColumn
                kind="pilot"
                title="Pilots"
                active={activeSegment === 'pilot'}
                create={{ href: '/pilots/new', label: 'Create Pilot' }}
                emptyMessage="No pilots yet."
                empty={pilots.length === 0}
              >
                <RosterList>
                  {pilots.map((p) => {
                    const mechLink = softLinks.find(
                      (l) => l.type === 'mech-to-pilot' && l.to.id === p.id
                    )
                    const crawlerLink = softLinks.find(
                      (l) => l.type === 'pilot-to-crawler' && l.from.id === p.id
                    )
                    return (
                      <li key={p.id} className="list-none">
                        <EntityRow
                          entityType="pilot"
                          name={p.name}
                          sheetHref={`/sheet/pilot/${p.id}`}
                          linkAs={AppLink}
                          onDeleteClick={() => openDeleteDialog('pilot', p.id, p.name)}
                          actions={
                            <MoveToGameSelect
                              entityType="pilot"
                              entityId={p.id}
                              entity={p}
                              confirm={confirm}
                            />
                          }
                          stats={pilotStats(p.classRef, p.callsign)}
                          metaLine={metaParts([
                            linkSegment(
                              'mech',
                              mechLink?.from.id,
                              mechLink && mechNameById.get(mechLink.from.id),
                              mechLink && mechChassisNameById.get(mechLink.from.id)
                            ),
                            linkSegment(
                              'crawler',
                              crawlerLink?.to.id,
                              crawlerLink && crawlerNameById.get(crawlerLink.to.id),
                              crawlerLink && crawlerTlById.get(crawlerLink.to.id)
                            ),
                          ])}
                        />
                      </li>
                    )
                  })}
                </RosterList>
              </RosterColumn>

              <RosterColumn
                kind="mech"
                title="Mechs"
                active={activeSegment === 'mech'}
                create={{ href: '/mechs/new', label: 'Create Mech' }}
                emptyMessage="No mechs yet."
                empty={mechs.length === 0}
                headExtra={
                  <AppLink
                    href="/mechs/patterns"
                    className={cn(
                      buttonVariants({ variant: 'ghost', size: 'compact' }),
                      'no-underline'
                    )}
                  >
                    Patterns
                  </AppLink>
                }
              >
                <RosterList>
                  {mechs.map((m) => {
                    const pilotLink = softLinks.find(
                      (l) => l.type === 'mech-to-pilot' && l.from.id === m.id
                    )
                    return (
                      <li key={m.id} className="list-none">
                        <EntityRow
                          entityType="mech"
                          name={m.name}
                          sheetHref={`/sheet/mech/${m.id}`}
                          linkAs={AppLink}
                          onDeleteClick={() => openDeleteDialog('mech', m.id, m.name)}
                          actions={
                            <MoveToGameSelect
                              entityType="mech"
                              entityId={m.id}
                              entity={m}
                              confirm={confirm}
                            />
                          }
                          // The chassis is a STAT (`CHASSIS | Iron Mongrel`), not
                          // a caption chip: it is a named property of the mech,
                          // and a bare chip left the reader to infer what the word
                          // was doing there. Same call the crew roster makes.
                          stats={mechChassisStats(m.chassisRef)}
                          metaLine={metaParts([
                            linkSegment(
                              'pilot',
                              pilotLink?.to.id,
                              pilotLink && pilotNameById.get(pilotLink.to.id),
                              pilotLink && pilotClassById.get(pilotLink.to.id)
                            ),
                          ])}
                        />
                      </li>
                    )
                  })}
                </RosterList>
              </RosterColumn>

              <RosterColumn
                kind="crawler"
                title="Crawlers"
                active={activeSegment === 'crawler'}
                create={{ href: '/crawlers/new', label: 'Create Crawler' }}
                emptyMessage="No crawlers yet."
                empty={crawlers.length === 0}
              >
                <RosterList>
                  {crawlers.map((c) => {
                    const crewLinks = softLinks.filter(
                      (l) => l.type === 'pilot-to-crawler' && l.to.id === c.id
                    )
                    return (
                      <li key={c.id} className="list-none">
                        <EntityRow
                          entityType="crawler"
                          name={c.name}
                          sheetHref={`/sheet/crawler/${c.id}`}
                          linkAs={AppLink}
                          onDeleteClick={() => openDeleteDialog('crawler', c.id, c.name)}
                          // Only into a Game you run (ADR-037); with none, no control.
                          actions={
                            <MoveToGameSelect
                              entityType="crawler"
                              entityId={c.id}
                              entity={c}
                              confirm={confirm}
                            />
                          }
                          stats={crawlerStats(c.techLevel, c.crawlerBays?.length ?? 0)}
                          metaLine={metaParts([
                            ...crewLinks.map((l) =>
                              linkSegment(
                                'pilot',
                                l.from.id,
                                pilotNameById.get(l.from.id),
                                pilotClassById.get(l.from.id)
                              )
                            ),
                          ])}
                        />
                      </li>
                    )
                  })}
                </RosterList>
              </RosterColumn>
            </RosterGrid>
          </>
        )}
      </div>

      {confirmDialog}
    </PageShell>
  )
}

// ---------------------------------------------------------------------------
// First-run welcome
// ---------------------------------------------------------------------------

/**
 * Aggregate empty state shown to a brand-new user (zero pilots + mechs +
 * crawlers). Orients them on what the app is and the pilot → mech → crawler
 * build order, with a single primary CTA (start a pilot). Styled as a sibling
 * of the per-column dashed Empty states (same dashed frame + rust accents),
 * not a bolted-on splash.
 */
function FirstRunWelcome() {
  return (
    <div className="mt-6 flex flex-col items-center gap-4 rounded-card border-chrome border-dashed border-wk-faint p-8 text-center sm:p-12">
      <UserRound aria-hidden="true" className="size-9 text-sheet-pilot-deep" />
      <h2 className="font-cond text-xl font-bold uppercase tracking-widest text-rust">
        Welcome to In the Union Now
      </h2>
      <p className="max-w-prose font-body text-sm text-wk-muted">
        Build and run your Salvage Union crew — start with a pilot, kit them out with a mech, then
        anchor your crew to a Union Crawler.
      </p>
      <AppLink
        href="/pilots/new"
        // Top rung deliberately: this is the Roster's page-level primary CTA. The
        // sm/md merge dropped the default to the app's secondary workhorse size,
        // which reads underweight for a primary page action.
        className={cn(buttonVariants({ variant: 'primary', size: 'full' }), 'no-underline')}
      >
        Build your first pilot
      </AppLink>
      <p className="max-w-prose font-body text-xs text-wk-muted">
        Sign in to keep what you build and share it with a Game — until then it lives only in this
        tab.
      </p>
    </div>
  )
}
