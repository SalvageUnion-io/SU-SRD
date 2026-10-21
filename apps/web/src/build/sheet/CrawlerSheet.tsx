/**
 * CrawlerSheet — the crawler variant BODY for the LiveSheet shell, in the
 * poster layout.
 *
 * The body OWNS the identity band now (Workshop-Manual crawler sheet):
 * This body renders `SheetHero` as its first region.
 * Following the printed sheet (`Editable_..._Crawler_Sheets.pdf`), the regions
 * stack in the columns every sheet shares (`SheetColumns`, ruleset §1.2):
 *
 *   Identity Band: edge wordmark ∥ Name/Type/Ability/Description fields ∥ the
 *     Economy rail (SP `VitalGauge` + Tech-LVL/Upkeep/Upgrade readouts, built
 *     by SheetCrawler and passed as `economy`) → Bays (2-column masonry, the
 *     Armament Bay's weapons inside their bay) → Assigned Units.
 *   The Storage Bay, what the crawler carries, is the permanent right
 *     sidebar: beside the sheet from the 64rem rung, under the opening on a
 *     phone.
 *
 * Economy (SP `VitalGauge` + Tech-LVL/Upkeep/Upgrade lozenges) is built by
 * `SheetCrawler` (it owns the economy-dialog state + `patch`) and handed
 * down as the `economy` slot, rendered inside the Identity card below the
 * identity fields.
 *
 * Bays stay ONE unified grid (no crew/functional split; the poster's
 * homebrew/custom-bay split needs a data-model flag the schema does not have)
 * as compact entity cards (max 2
 * columns), each with Intact/Damaged status, its crew lead as a
 * contentful Mini (`CrewLeadMini`), a "Docks <mech>" one-liner on the Mech Bay, and a
 * function/Repair action pair. Repair decrements 5 Scrap from the
 * crawler-TL pool bucket, spilling into higher buckets — a short pool is
 * advisory, never a block.
 *
 * Armament Bay Weapons — collection section (unified edit language
 * archetype B): always-available '+ Add' opening the existing weapons
 * picker (CrawlerSystemsEditModal), per-card remove (✕). The poster has no
 * region for this (it's live mounted loadout, not a play-control panel, so
 * it's not part of the drop list below) — it gets its own content-column
 * card.
 *
 * Storage Bay (The Hold) — the unlimited StorageManifest (side='crawler'),
 * in the sidebar; Load is cap-checked against the docked mech. Keeps the
 * Stow/Load transfer feature.
 *
 * Dropped (the poster redesign — no poster counterpart; tracking issues filed for
 * re-homing as an off-sheet action surface):
 *   - the Tech Level stepper slab — Tech Level is the chapter band's TL
 *     chip (built by SheetCrawler), its stepper on the chip in Edit.
 *   - the Scrap Pool slab + `ScrapPoolSlab` — the scrapPool DATA/
 *     logic (`scrapPoolBucket` / `addToScrapPool`) is KEPT: bay Repair below
 *     still spends from it, and the same helpers feed mech repair/retire
 *     from the mech sheet.
 *   - the Downtime/Salvaging/Crafting slabs + `DowntimeControl` /
 *     `SalvageControl` / `CraftingControl` — deleted outright, no
 *     other consumer.
 * The always-live Vitals (SP `VitalGauge`, via `economy`) and per-card
 * activation (the bays' status/repair controls) are KEPT — only the
 * play-control PANELS drop.
 *
 * readOnly suppresses every edit affordance (snapshot contexts).
 */

import type { Crawler } from 'game-domain/schemas/crawler'
import type { Mech } from 'game-domain/schemas/mech'
import type { CSSProperties, ReactNode } from 'react'
import { useState } from 'react'
import { parseCrawlerTechLevel } from 'salvageunion-reference/rules'
import {
  Button,
  EmptyState,
  Entity,
  MiniGrid,
  SlabSection,
  Stack,
  Stat,
  tokens,
} from '../../components/index'
import { EntityPhoto } from '../../components/shared/EntityPhoto'
import { addToScrapPool, scrapPoolBucket } from '../../lib/cargo/cargoTransfer'
import { useCargo } from '../../lib/cargo/useCargo'
import type { CrewAssignment } from '../../lib/npcs/npcModel'
import { assignmentFor } from '../../lib/npcs/npcModel'
import { crawlerTypeArt } from '../../lib/photos/defaultArt'
import { SCRAP_TLS } from '../../lib/rules/crawlerEconomy'
import {
  bayRepairPatch,
  bayRepairShortfall,
  resolveCrawlerSystem,
} from '../../lib/rules/crawlerItems'
import { runWrite } from '../../lib/runWrite'
import { useEntityStore } from '../../stores/entityStore'
import { LIVE_SHEET_MANUAL, LIVE_SHEET_TXN } from '../../stores/surfaceProvenance'
import { CrawlerSystemsEditModal } from '../crawler/CrawlerSystemsEditModal'
import { CrawlerIdentityPanel } from './CrawlerIdentity'
import type { CrawlerBayEntry } from './CrawlerSheetItems'
import { CrawlerBayCard } from './CrawlerSheetItems'
import { SheetColumns } from './SheetColumns'
import { SheetHero } from './SheetHero'
import { StorageManifest } from './StorageManifest'
import { UnknownItemLine } from './UnknownItemLine'

/** A column that may shrink below its content inside the region grids. */
const SHRINK = { minWidth: 0 } satisfies CSSProperties

/** The section root: `@container` scopes the region grids to the sheet's own width. */
const ROOT = {
  containerType: 'inline-size',
  display: 'flex',
  flexDirection: 'column',
  gap: tokens.space[24],
} satisfies CSSProperties

const POOL_ROW = { display: 'flex', flexWrap: 'wrap', gap: tokens.space[8] } satisfies CSSProperties

type CrawlerSheetProps = {
  crawler: Crawler
  /**
   * The docked mech (the first mech assigned to this crawler by its own
   * `mech-to-crawler` link, resolved by the composition resolver) — the Hold's
   * Load target. Null when nothing is docked.
   */
  mech?: Mech | null
  /** The docked mech's sheet: the Hold's load target and the Mech Bay's Mini open it. */
  mechHref?: string
  /**
   * Injectable store — defaults to useEntityStore.
   * Pass a stub in tests to avoid Zustand side effects.
   */
  store?: typeof useEntityStore
  /** Suppresses every edit affordance (published snapshots). */
  readOnly?: boolean
  /**
   * The economy band content (SP `VitalGauge` + Tech-LVL/Upkeep/Upgrade
   * lozenges) — built by `SheetCrawler` (it owns the economy-dialog state
   * and `patch`), rendered as the identity band's vitals rail. Undefined
   * renders nothing extra (e.g. a bare test render with no economy slot wired).
   */
  economy?: ReactNode
  /**
   * The economy's action chips (Pay / Fund / Trade), built by `SheetCrawler`
   * beside `economy` and set on the vitals card's head, not in its body.
   */
  economyActions?: ReactNode
  /**
   * The Assigned Units rail content (docked mech + lead pilot rail row/
   * RailEmpty), built by SheetCrawler from `composition` — CrawlerSheet has
   * no composition access of its own, so this is passed straight through
   * into the content column's bottom section.
   */
  linkedUnits?: ReactNode
  /**
   * The crew slots built NPCs fill (ADR-044), resolved by the composition. A
   * filled slot shows its NPC in place of the inline crew (Q2).
   */
  crew?: readonly CrewAssignment[]
  /**
   * Where the Bays section's one "Crew…" link goes: the crew board for this
   * crawler (D8). Omitted, there is no link.
   */
  crewHref?: string
}

export function CrawlerSheet({
  crawler,
  mech = null,
  mechHref,
  store = useEntityStore,
  readOnly = false,
  economy,
  economyActions,
  linkedUnits,
  crew,
  crewHref,
}: CrawlerSheetProps) {
  const storeState = store()
  const cargo = useCargo({ mech, crawler, store, readOnly })

  // Weapons '+ Add' opens the existing picker modal (archetype B — always
  // available; the modal itself carries the p.213/p.216 mount cap).
  // TODO(redesign): rule-gate add/remove (scrap economy) — deferred; users
  // self-manage for now.
  const [systemsModalOpen, setSystemsModalOpen] = useState(false)
  // Identity is a FIELD section (unified edit language archetype A): its own
  // Edit/Done toggle, rendered in the SheetSectionCard header.

  /**
   * Persist a partial patch on this crawler (fire-and-forget write). The
   * updater form receives the FRESHEST record so array edits (weapons) don't
   * race the async store.update round-trip and drop a selection.
   */
  function patchCrawler(input: Partial<Crawler> | ((current: Crawler) => Partial<Crawler>)) {
    if (readOnly) return
    const fields =
      typeof input === 'function' ? input(storeState.get('crawler', crawler.id) ?? crawler) : input
    runWrite(() => storeState.update('crawler', crawler.id, fields, LIVE_SHEET_MANUAL))
  }

  const tl = parseCrawlerTechLevel(crawler.techLevel) ?? 1
  const bays = crawler.crawlerBays ?? []
  const intactBays = bays.filter((b) => (b.condition ?? 'intact') === 'intact').length
  const pool = crawler.scrapPool ?? {}

  // Repair affordability is advisory only — TL+ buckets count.
  const repairShortfall = bayRepairShortfall(pool, tl)

  /**
   * Repair a damaged bay (`bayRepairPatch`: 5 Scrap from the crawler-TL
   * bucket up, then the bay flips Intact). A short pool still repairs — the
   * shortfall is surfaced on the button, never a block.
   *
   * Tagged `LIVE_SHEET_TXN`: Scrap leaves the pool by a rule, so the Change Log
   * should not call it a hand edit. One of the three sanctioned Live-Sheet
   * transactions in `docs/ARCHITECTURE.md#live-sheet`.
   */
  function repairBay(entry: CrawlerBayEntry, index: number) {
    if (readOnly) return
    const fresh = storeState.get('crawler', crawler.id) ?? crawler
    const { crawlerPatch, bayPatch } = bayRepairPatch(fresh.scrapPool ?? {}, tl)
    runWrite(() => storeState.update('crawler', crawler.id, crawlerPatch, LIVE_SHEET_TXN))
    runWrite(() =>
      storeState.updateCrawlerBay(crawler.id, entry.bayRef, bayPatch, index, LIVE_SHEET_TXN)
    )
  }

  /** Remove one mounted weapon (per-card ✕ — archetype B). */
  function removeWeapon(slug: string) {
    patchCrawler((current) => ({ systems: current.systems.filter((s) => s !== slug) }))
  }

  /**
   * Set one Scrap Pool tech-level bucket to `next` (Free Edit — hand-patch the
   * pool directly). Reads the FRESHEST record so rapid steps don't race the
   * async write, then applies the delta through `addToScrapPool` (floored at 0).
   */
  function setScrapBucket(tlBucket: number, next: number) {
    if (readOnly) return
    const fresh = storeState.get('crawler', crawler.id) ?? crawler
    const currentPool = fresh.scrapPool ?? {}
    const delta = next - scrapPoolBucket(currentPool, tlBucket)
    if (delta === 0) return
    runWrite(() =>
      storeState.update(
        'crawler',
        crawler.id,
        {
          scrapPool: addToScrapPool(currentPool, tlBucket, delta),
        },
        LIVE_SHEET_MANUAL
      )
    )
  }

  // Read leaves what is empty out (ruleset §1.2): an empty state only where
  // Edit can fill it.
  const poolEmpty = SCRAP_TLS.every((t) => scrapPoolBucket(pool, t) === 0)
  const holdEmpty = (crawler.cargoLots ?? []).length === 0
  const showPool = !readOnly || !poolEmpty
  const showHold = !readOnly || !holdEmpty

  /** The Armament Bay's mounted weapons — rendered INSIDE that bay. */
  const armamentContents =
    crawler.systems.length === 0 ? (
      readOnly ? undefined : (
        <EmptyState variant="quiet" body="No weapons mounted." />
      )
    ) : (
      // Header-only Minis across the bay, each Peeking its whole card (owner,
      // round 4: "Armament bay can be a header only mini").
      <MiniGrid label="Weapons mounted">
        {crawler.systems.map((slug) => {
          const system = resolveCrawlerSystem(slug)
          return (
            <li key={slug}>
              {system ? (
                <Entity size="mini" context="loadout" entity={system} mode={{ kind: 'link' }} />
              ) : (
                <UnknownItemLine
                  slug={slug}
                  schemaName="systems"
                  readOnly={readOnly}
                  onRemove={() => removeWeapon(slug)}
                />
              )}
            </li>
          )
        })}
      </MiniGrid>
    )

  /** The Storage Bay's scrap pool + the crawler hold — rendered INSIDE it. */
  const storageContents = !(showPool || showHold) ? undefined : (
    <Stack gap={16} style={SHRINK}>
      {/* Scrap Pool — the crawler's abstract TL-bucketed scrap store (the
          bucket bay-repair spends), a section of the bay under its Slab, as
          the Crawler Hold below it is (N5). Per-tech-level `Stat` steppers let
          a crawler stow arbitrary scrap by hand (Free Edit). The
          physical-scrap-cargo path lives in the Hold add-form's Scrap kind. */}
      {showPool && (
        <SlabSection title="Scrap Pool" bodyStyle={POOL_ROW}>
          {SCRAP_TLS.map((t) => (
            <Stat
              key={t}
              label={`T${t}`}
              value={scrapPoolBucket(pool, t)}
              min={0}
              mode={readOnly ? 'read' : 'edit'}
              onChange={readOnly ? undefined : (next) => setScrapBucket(t, next)}
            />
          ))}
        </SlabSection>
      )}
      {showHold && (
        <StorageManifest
          side="crawler"
          cargo={cargo}
          mechName={mech?.name ?? null}
          counterpartHref={mechHref}
          crawlerName={crawler.name}
          readOnly={readOnly}
        />
      )}
    </Stack>
  )

  /** Which special bay is this? Drives what gets rendered INSIDE it. */
  function bayKind(entry: CrawlerBayEntry): 'mech' | 'armament' | 'storage' | 'plain' {
    if (entry.bayRef === 'mech-bay') return 'mech'
    if (entry.bayRef === 'armament-bay') return 'armament'
    if (entry.bayRef === 'storage-bay') return 'storage'
    return 'plain'
  }

  /**
   * One bay card, with whatever that bay HOLDS rendered inside it: the
   * Armament Bay's mounted weapons, the Storage Bay's scrap pool and hold.
   * A bay's contents belong in the bay, not in a section elsewhere on the
   * sheet describing it from a distance.
   */
  function renderBay(entry: CrawlerBayEntry, i: number, inSidebar = false) {
    const kind = bayKind(entry)
    // A link names a bay by its slug, so only the first entry of a bay listed
    // twice is the slot it crews (ADR-044's known limit).
    const crewSlot = bays.findIndex((b) => b.bayRef === entry.bayRef) === i
    return (
      <CrawlerBayCard
        assigned={crewSlot ? assignmentFor(crew, { kind: 'bay', bayRef: entry.bayRef }) : undefined}
        crawlerId={crawler.id}
        entry={entry}
        index={i}
        crawlerTl={tl}
        repairShortfall={repairShortfall}
        onRepair={repairBay}
        seedSelections={crawler.bayChoices?.[entry.bayRef]}
        store={store}
        readOnly={readOnly}
        dockedMech={kind === 'mech' && mech ? { name: mech.name, href: mechHref } : undefined}
        // "Mount" opens the weapons picker — the thing the verb means — rather
        // than the bay's rules text.
        onFunction={kind === 'armament' && !readOnly ? () => setSystemsModalOpen(true) : undefined}
        contents={
          kind === 'armament' ? armamentContents : kind === 'storage' ? storageContents : undefined
        }
        inSidebar={inSidebar}
      />
    )
  }

  /** The Storage Bay(s), by their place in the bay list: the sidebar's. */
  const storageBays = bays.flatMap((entry, i) =>
    bayKind(entry) === 'storage' ? [{ entry, i }] : []
  )

  return (
    <section
      aria-label={`${crawler.name} crawler sheet`}
      // `.su-sheet-section` is a print-stylesheet target (page-break rules);
      // `@container` scopes the poster region grid below to the SHEET's own
      // width, not the viewport.
      className="su-sheet-section"
      style={ROOT}
    >
      {/* ===== The Workshop-Manual crawler sheet's regions, in the columns
          every sheet shares (`SheetColumns`): Identity → Bays (Armament
          weapons inside their bay) → Assigned Units, and the Storage Bay, what
          the crawler carries, in the sidebar (ruleset §1.2). ===== */}
      <SheetColumns
        asideLabel={`What ${crawler.name} carries`}
        hero={
          // ===== Identity Band (Workshop-Manual crawler sheet top region) =====
          // Edge wordmark ∥ Name/Type/Ability/Description fields ∥ the Economy
          // rail (SP `VitalGauge` + Tech-LVL/Upkeep/Upgrade readouts), in one
          // toned frame — no name pseudoheader stamp.
          <SheetHero
            name={crawler.name}
            fields={
              <CrawlerIdentityPanel
                crawler={crawler}
                store={store}
                storeState={storeState}
                patch={readOnly ? undefined : patchCrawler}
                readOnly={readOnly}
                typeCrew={assignmentFor(crew, { kind: 'type' })}
                photo={
                  <EntityPhoto
                    photo={crawler.photo}
                    fallback={crawlerTypeArt(crawler.type)}
                    name={crawler.name}
                    onChange={
                      readOnly
                        ? undefined
                        : (photo) =>
                            storeState.update('crawler', crawler.id, { photo }, LIVE_SHEET_MANUAL)
                    }
                  />
                }
              />
            }
            vitals={economy}
            vitalsActions={economyActions}
          />
        }
        // ----- The Storage Bay, the sidebar: the crawler's own BAY, its
        // card (the hold IS a bay, Core Book p.213), holding the scrap pool
        // and the crawler hold. With no Storage Bay installed both still have
        // to go somewhere: they are crawler-level data (the pool is what bay
        // REPAIRS spend), so hiding them with the bay would strand them; they
        // render under a Storage Bay Slab instead. -----
        // The Assigned Units follow it there (owner, 2026-10-20: "also a
        // good place for the sidebar").
        aside={
          storageBays.length > 0 || storageContents || linkedUnits ? (
            <>
              {storageBays.length > 0
                ? storageBays.map(({ entry, i }) => (
                    <div key={`storage-${i}`} style={SHRINK}>
                      {renderBay(entry, i, true)}
                    </div>
                  ))
                : storageContents && (
                    <SlabSection title="Storage Bay">{storageContents}</SlabSection>
                  )}
              {linkedUnits}
            </>
          ) : undefined
        }
      >
        {/* Bays — ONE unified grid, every bay but the Storage Bay, which is
            the sidebar's (no crew/functional split). // TODO(redesign): render
            homebrew/custom bays in a separate "Custom Bays" group underneath
            once the data distinguishes them. */}
        {bays.length > storageBays.length && (
          <SlabSection
            fold="open"
            title="Bays"
            count={{ label: 'Intact', value: intactBays, max: bays.length }}
            actions={
              crewHref === undefined ? undefined : (
                <Button
                  href={crewHref}
                  size="compact"
                  aria-label={`Crew ${crawler.name}: design and assign crawler crew`}
                >
                  Crew…
                </Button>
              )
            }
          >
            {/* Each bay a contentful Mini and what belongs to it, in one
                subtle border (`MiniGroup`), a cell of the masonry grid. */}
            <MiniGrid label="Bays">
              {bays.map((entry, i) =>
                bayKind(entry) === 'storage' ? null : (
                  // biome-ignore lint/suspicious/noArrayIndexKey: a crawler may install the same bay type more than once, so bayRef alone is not unique; bays are addressed positionally throughout the sheet
                  <li key={`${entry.bayRef}-${i}`}>{renderBay(entry, i)}</li>
                )
              )}
            </MiniGrid>
          </SlabSection>
        )}
      </SheetColumns>

      {/* The weapons picker — the existing master-detail modal, mounted
          lazily so its reference preload only runs once '+ Add' opens it. */}
      {!readOnly && systemsModalOpen && (
        <CrawlerSystemsEditModal
          open
          onClose={() => setSystemsModalOpen(false)}
          crawler={crawler}
          patch={patchCrawler}
        />
      )}
    </section>
  )
}
