import type { UnitsStore } from '../../replica/units'
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
 *     by CrawlerLiveSheet and passed as `economy`) → Bays (2-column masonry, the
 *     Armament Bay's weapons inside their bay) → Assigned Units, under the
 *     bays (a crew of many pilots and mechs is a list that grows downward).
 *   The Storage Bay, what the crawler carries, is the permanent right
 *     sidebar: beside the sheet from the 64rem rung, under the opening on a
 *     phone.
 *
 * Economy (SP `VitalGauge` + Tech-LVL/Upkeep/Upgrade lozenges) is built by
 * `CrawlerLiveSheet` (it owns the economy-dialog state + `patch`) and handed
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
 * picker (CrawlerSystemsEditModal), per-card remove (✕). It is the live
 * mounted loadout, not a play-control panel, so it has its own
 * content-column card.
 *
 * Storage Bay (The Hold) — the unlimited StorageManifest (side='crawler'),
 * in the sidebar; Load is cap-checked against the docked mech. Keeps the
 * Stow/Load transfer feature.
 *
 * No play-control panel lives on the sheet. Tech Level is the chapter band's
 * TL chip (built by CrawlerLiveSheet), its stepper on the chip in Edit. The
 * scrap pool has no section of its own: bay Repair below spends from it
 * (`scrapPoolBucket` / `addToScrapPool`), as mech repair does from the mech
 * sheet. Downtime, Salvaging and Crafting are not the sheet's. The Vitals
 * (SP `VitalGauge`, via `economy`) and per-card activation (the bays'
 * status/repair controls) are live here.
 *
 * readOnly suppresses every edit affordance (a sheet the viewer cannot write (public, crewmate's, Starter Set, or Read)).
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
  Select,
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
import type { ExoticKey } from '../../lib/rules/exoticSalvage'
import {
  addToExotic,
  EXOTIC_RESOURCES,
  exoticBucket,
  hasExotic,
} from '../../lib/rules/exoticSalvage'
import { runWrite } from '../../lib/runWrite'
import { expansionCrawlerBays } from '../../lib/wizard/crawlerFormState'
import { buildSheetCopy } from '../../messages/build-sheet'
import { LIVE_SHEET_MANUAL, LIVE_SHEET_TXN } from '../../replica/provenance'
import { useUnits } from '../../replica/units'
import { CrawlerSystemsEditModal } from '../crawler/CrawlerSystemsEditModal'
import { CrawlerIdentityPanel } from './CrawlerIdentity'
import type { CrawlerBayEntry } from './CrawlerSheetItems'
import { CrawlerBayCard } from './CrawlerSheetItems'
import { EXOTIC_NAME } from './exoticNames.model'
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

/** The "+ Bay" picker at a compact button's height, beside Crew. */
const ADD_BAY = {
  height: 'var(--size-compact)',
  paddingInline: tokens.space[8],
  fontSize: tokens.fontSize.chip,
} satisfies CSSProperties

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
   * Injectable store — defaults to useUnits.
   * Pass a stub in tests to avoid Zustand side effects.
   */
  store?: UnitsStore
  /** Suppresses every edit affordance (a sheet the viewer cannot write (public, crewmate's, Starter Set, or Read)). */
  readOnly?: boolean
  /**
   * Read, on a sheet its owner may track (`CrawlerLiveSheet`'s `editable`): a
   * bay's condition still steps, as the SP gauge does.
   */
  liveCondition?: boolean
  /**
   * The economy band content (SP `VitalGauge` + Tech-LVL/Upkeep/Upgrade
   * lozenges) — built by `CrawlerLiveSheet` (it owns the economy-dialog state
   * and `patch`), rendered as the identity band's vitals rail. Undefined
   * renders nothing extra (e.g. a bare test render with no economy slot wired).
   */
  economy?: ReactNode
  /**
   * The economy's action chips (Pay / Fund / Trade), built by `CrawlerLiveSheet`
   * beside `economy` and set on the vitals card's head, not in its body.
   */
  economyActions?: ReactNode
  /**
   * The Assigned Units rail content (docked mech + lead pilot rail row/
   * RailEmpty), built by CrawlerLiveSheet from `composition` — CrawlerSheet has
   * no composition access of its own, so this is passed straight through
   * into the content column, under the Bays.
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
  store = useUnits,
  readOnly = false,
  liveCondition = false,
  economy,
  economyActions,
  linkedUnits,
  crew,
  crewHref,
}: CrawlerSheetProps) {
  const storeState = store()
  const cargo = useCargo({ mech, crawler, store, readOnly })

  // Weapons '+ Add' opens the existing picker modal (archetype B — always
  // available; the modal itself carries the p.213/p.216 mount cap). Free
  // Edit: add/remove is not rule-gated (ADR-021).
  const [systemsModalOpen, setSystemsModalOpen] = useState(false)
  // Identity is a FIELD section (unified edit language archetype A): its own
  // Edit/Done toggle, rendered in the `SheetHero` panel's action row.

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

  const expansionBays = expansionCrawlerBays()
  const expansionSlugs = new Set(expansionBays.map((b) => b.slug))
  const installable = expansionBays.filter((b) => !bays.some((e) => e.bayRef === b.slug))

  /** Set one expansion resource to `next` (Free Edit), as `setScrapBucket` does a Tech bucket. */
  function setExotic(key: ExoticKey, next: number) {
    if (readOnly) return
    const fresh = storeState.get('crawler', crawler.id) ?? crawler
    const currentPool = fresh.scrapPool ?? {}
    const delta = next - exoticBucket(currentPool, key)
    if (delta === 0) return
    runWrite(() =>
      storeState.update(
        'crawler',
        crawler.id,
        { scrapPool: addToExotic(currentPool, key, delta) },
        LIVE_SHEET_MANUAL
      )
    )
  }

  /**
   * Install an expansion bay (Free Edit): the Bio-Mech, Bio-Crafting and
   * Nanite Processing Bays and VR Tubes are built or found in play, so the
   * seed leaves them out. What it cost is the table's to take from the pool.
   */
  function addExpansionBay(slug: string) {
    const bay = expansionBays.find((b) => b.slug === slug)
    if (!bay) return
    patchCrawler((current) => ({ crawlerBays: [...(current.crawlerBays ?? []), bay.entry] }))
  }

  /** Uninstall the expansion bay at `index` (Free Edit). */
  function removeBay(index: number) {
    patchCrawler((current) => ({
      crawlerBays: (current.crawlerBays ?? []).filter((_, i) => i !== index),
    }))
  }

  // Read leaves what is empty out (ruleset §1.2): an empty state only where
  // Edit can fill it.
  const poolEmpty = SCRAP_TLS.every((t) => scrapPoolBucket(pool, t) === 0)
  const showExotic = !readOnly || hasExotic(pool)
  const holdEmpty = (crawler.cargoLots ?? []).length === 0
  const showPool = !readOnly || !poolEmpty
  const showHold = !readOnly || !holdEmpty

  /** The Armament Bay's mounted weapons — rendered INSIDE that bay. */
  const armamentContents =
    crawler.systems.length === 0 ? (
      readOnly ? undefined : (
        <EmptyState variant="quiet" body={buildSheetCopy('noWeaponsMounted')} />
      )
    ) : (
      // Header-only Minis across the bay, each Peeking its whole card.
      <MiniGrid label={buildSheetCopy('weaponsMounted')}>
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
          the Crawler Hold below it is (N5), both at the Mini Size of the
          bay's other sections. Per-tech-level `Stat` steppers let
          a crawler stow arbitrary scrap by hand (Free Edit). The
          physical-scrap-cargo path lives in the Hold add-form's Scrap kind. */}
      {showPool && (
        <SlabSection title={buildSheetCopy('scrapPool')} size="mini" bodyStyle={POOL_ROW}>
          {SCRAP_TLS.map((t) => (
            <Stat
              key={t}
              label={buildSheetCopy('t', { t })}
              value={scrapPoolBucket(pool, t)}
              min={0}
              mode={readOnly ? 'read' : 'edit'}
              onChange={readOnly ? undefined : (next) => setScrapBucket(t, next)}
            />
          ))}
        </SlabSection>
      )}
      {/* Bio-Salvage, Chimerium and Meld Nanites: not Scrap of any Tech
          Level, so each its own stepper beside the Tech buckets. */}
      {showExotic && (
        <SlabSection title={buildSheetCopy('bioAndNanites')} size="mini" bodyStyle={POOL_ROW}>
          {EXOTIC_RESOURCES.map((r) => (
            <Stat
              key={r.key}
              label={EXOTIC_NAME[r.key]}
              value={exoticBucket(pool, r.key)}
              min={0}
              mode={readOnly ? 'read' : 'edit'}
              onChange={readOnly ? undefined : (next) => setExotic(r.key, next)}
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
  function renderBay(entry: CrawlerBayEntry, i: number) {
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
        liveCondition={liveCondition}
        dockedMech={kind === 'mech' && mech ? { name: mech.name, href: mechHref } : undefined}
        // "Mount" opens the weapons picker — the thing the verb means — rather
        // than the bay's rules text.
        onFunction={kind === 'armament' && !readOnly ? () => setSystemsModalOpen(true) : undefined}
        contents={
          kind === 'armament' ? armamentContents : kind === 'storage' ? storageContents : undefined
        }
        onRemove={expansionSlugs.has(entry.bayRef) ? () => removeBay(i) : undefined}
      />
    )
  }

  /** The Storage Bay(s), by their place in the bay list: the sidebar's. */
  const storageBays = bays.flatMap((entry, i) =>
    bayKind(entry) === 'storage' ? [{ entry, i }] : []
  )

  return (
    <section
      aria-label={buildSheetCopy('crawlerSheet', { name: crawler.name })}
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
        asideLabel={buildSheetCopy('whatCarries', { name: crawler.name })}
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
        aside={
          storageBays.length > 0
            ? storageBays.map(({ entry, i }) => (
                <div key={`storage-${i}`} style={SHRINK}>
                  {renderBay(entry, i)}
                </div>
              ))
            : storageContents && (
                <SlabSection title={buildSheetCopy('storageBay')}>{storageContents}</SlabSection>
              )
        }
      >
        {/* Bays — ONE unified grid, every bay but the Storage Bay, which is
            the sidebar's (no crew/functional split). */}
        {bays.length > storageBays.length && (
          <SlabSection
            fold="open"
            title={buildSheetCopy('bays')}
            count={{ label: buildSheetCopy('intact'), value: intactBays, max: bays.length }}
            actions={
              crewHref === undefined && (readOnly || installable.length === 0) ? undefined : (
                <>
                  {!readOnly && installable.length > 0 && (
                    <Select
                      aria-label={buildSheetCopy('addAnExpansionBay')}
                      style={ADD_BAY}
                      value=""
                      onChange={(e) => addExpansionBay(e.target.value)}
                    >
                      <option value="">{buildSheetCopy('addBay')}</option>
                      {installable.map((b) => (
                        <option key={b.slug} value={b.slug}>
                          {b.name}
                        </option>
                      ))}
                    </Select>
                  )}
                  {crewHref !== undefined && (
                    <Button
                      href={crewHref}
                      size="compact"
                      aria-label={buildSheetCopy('crewDesignAndAssignCrawler', {
                        name: crawler.name,
                      })}
                    >
                      {buildSheetCopy('crew')}
                    </Button>
                  )}
                </>
              )
            }
          >
            {/* Each bay a contentful Mini and what belongs to it, in one
                subtle border (`MiniGroup`), a cell of the masonry grid. */}
            <MiniGrid label={buildSheetCopy('bays')}>
              {bays.map((entry, i) =>
                bayKind(entry) === 'storage' ? null : (
                  // biome-ignore lint/suspicious/noArrayIndexKey: a crawler may install the same bay type more than once, so bayRef alone is not unique; bays are addressed positionally throughout the sheet
                  <li key={`${entry.bayRef}-${i}`}>{renderBay(entry, i)}</li>
                )
              )}
            </MiniGrid>
          </SlabSection>
        )}
        {/* Assigned Units — under the Bays: a crawler's crew is every pilot
            and mech it homes, a list that grows down the content column. */}
        {linkedUnits}
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
