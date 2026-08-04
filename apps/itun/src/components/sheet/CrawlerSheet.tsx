/**
 * CrawlerSheet — the crawler variant BODY for the LiveSheet shell (design
 * §4.4, plan 4.6; redesigned to the poster layout, Phase 2).
 *
 * The body OWNS the identity band now (Workshop-Manual crawler sheet):
 * This body renders `SheetHero` in band mode as its first region.
 * Following the printed sheet (`Editable_..._Crawler_Sheets.pdf`), the sheet is
 * a single-column region stack, inside the same `@container` shape
 * PilotSheet/MechSheet use:
 *
 *   Identity Band: edge wordmark ∥ Name/Type/Ability/Description fields ∥ the
 *     Economy rail (SP `VitalGauge` + Tech-LVL/Upkeep/Upgrade readouts, built
 *     by SheetCrawler and passed as `economy`) → Bays (3-column masonry)
 *     → Armament Bay Weapons (3-column) → Linked Units (bare section, no card
 *     frame) → Storage Bay.
 *   Storage Bay is the FULL-WIDTH band at the very BOTTOM (printed sheet p.2 —
 *     Storage Bay spans the whole width beneath the bays), NOT a full-height
 *     right column.
 *
 * Economy (SP `VitalGauge` + Tech-LVL/Upkeep/Upgrade lozenges) is built by
 * `SheetCrawler` (it owns the economy-dialog state + `patch`) and handed
 * down as the `economy` slot, rendered inside the Identity card below the
 * identity fields. Full `.econ` magenta-frame + Pay/Fund action-lozenge
 * fidelity is Phase 3/4 — this slice only moves the region out of the hero
 * and into the body.
 *
 * Bays stay ONE unified grid (no crew/functional split — redesign
 * refinement; the poster's homebrew/custom-bay split is blocked on a
 * data-model flag, #403 — leave unified) as compact entity cards (max 2
 * columns), each with Intact/Damaged status (rules C8), its crew lead as an
 * NpcInset, a "Docks <mech>" one-liner on the Mech Bay, and a
 * function/Repair action pair. Repair decrements 5 Scrap from the
 * crawler-TL pool bucket, spilling into higher buckets — a short pool is
 * advisory, never a block (S12).
 *
 * Armament Bay Weapons — collection section (unified edit language
 * archetype B): always-available '+ Add' opening the existing weapons
 * picker (CrawlerSystemsEditModal), per-card remove (✕). The poster has no
 * region for this (it's live mounted loadout, not a play-control panel, so
 * it's not part of the D6 drop list below) — it gets its own content-column
 * card.
 *
 * Storage Bay (The Hold) — the unlimited StorageManifest (side='crawler'),
 * in the full-height right rail; ← Load is cap-checked against the docked
 * mech. Keeps the Stow/Load transfer feature.
 *
 * Dropped (redesign D6 — no poster counterpart; tracking issues filed for
 * re-homing as an off-sheet action surface):
 *   - the Tech Level stepper slab (#412) — Tech Level itself still reads
 *     live via the economy band's TL lozenge (built by SheetCrawler); only
 *     the hand-edit stepper UI drops.
 *   - the Scrap Pool slab + `ScrapPoolSlab` (#413) — the scrapPool DATA/
 *     logic (`scrapPoolBucket` / `addToScrapPool`) is KEPT: bay Repair below
 *     still spends from it, and the same helpers feed mech repair/retire
 *     from the mech sheet.
 *   - the Downtime/Salvaging/Crafting slabs + `DowntimeControl` /
 *     `SalvageControl` / `CraftingControl` (#414) — deleted outright, no
 *     other consumer.
 * The always-live Vitals (SP `VitalGauge`, via `economy`) and per-card
 * activation (the bays' status/repair controls) are KEPT — only the
 * play-control PANELS drop.
 *
 * readOnly suppresses every edit affordance (snapshot contexts).
 */

import { useState } from 'react'
import type { ReactNode } from 'react'
import { ReferenceEntityCard, SheetHero, Stat } from 'component-lib'

import { addToScrapPool, scrapPoolBucket } from '../../lib/cargo/cargoTransfer'
import { useCargo } from '../../lib/cargo/useCargo'
import { parseCrawlerTechLevel } from '../../lib/crawlerLevel'
import { resolveCrawlerBay } from '../../lib/crawlerRefs'
import type { Crawler, ScrapPool } from '../../lib/schemas/crawler'
import type { Mech } from '../../lib/schemas/mech'
import { useEntityStore } from '../../stores/entityStore'
import { CrawlerSystemsEditModal } from '../crawler/CrawlerSystemsEditModal'
import { CrawlerIdentityPanel } from './CrawlerIdentity'
import { EntityGridRow, MasonryColumns } from 'component-lib'
import { CardRemoveButton } from 'component-lib'
import { SheetSectionSlab } from 'component-lib'
import { StorageManifest } from './StorageManifest'

import { CrawlerBayCard } from './CrawlerSheetItems'
import type { CrawlerBayEntry } from './CrawlerSheetItems'
import { BAY_REPAIR_COST, SCRAP_TLS, resolveCrawlerSystem } from './crawlerSheetItemRules'
import { LIVE_SHEET_MANUAL } from '../../stores/surfaceProvenance'

type CrawlerSheetProps = {
  crawler: Crawler
  /**
   * The docked mech (the lead pilot's mech, resolved by the composition
   * resolver) — the Hold's ← Load target. Null when nothing is docked.
   */
  mech?: Mech | null
  /**
   * Injectable store — defaults to useEntityStore.
   * Pass a stub in tests to avoid Zustand/IndexedDB side effects.
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
   * The Linked Units rail content (docked mech + lead pilot RailChip/
   * RailEmpty), built by SheetCrawler from `composition` — CrawlerSheet has
   * no composition access of its own, so this is passed straight through
   * into the content column's bottom section.
   */
  linkedUnits?: ReactNode
}

export function CrawlerSheet({
  crawler,
  mech = null,
  store = useEntityStore,
  readOnly = false,
  economy,
  linkedUnits,
}: CrawlerSheetProps) {
  const storeState = store()
  const cargo = useCargo({ mech, crawler, store, readOnly })

  // Weapons '+ Add' opens the existing picker modal (archetype B — always
  // available; the modal itself carries the p.213/p.216 mount cap).
  // TODO(redesign): rule-gate add/remove (scrap economy) — deferred; users
  // self-manage for now.
  const [systemsModalOpen, setSystemsModalOpen] = useState(false)
  // Identity is a FIELD section (unified edit language archetype A): its own
  // Edit/Done toggle, rendered in the SheetSectionCard header (Phase 2).

  /**
   * Persist a partial patch on this crawler (fire-and-forget write). The
   * updater form receives the FRESHEST record so array edits (weapons) don't
   * race the async store.update round-trip and drop a selection.
   */
  function patchCrawler(input: Partial<Crawler> | ((current: Crawler) => Partial<Crawler>)) {
    if (readOnly) return
    const fields =
      typeof input === 'function' ? input(storeState.get('crawler', crawler.id) ?? crawler) : input
    void storeState.update('crawler', crawler.id, fields, LIVE_SHEET_MANUAL)
  }

  const tl = parseCrawlerTechLevel(crawler.techLevel) ?? 1
  const bays = crawler.crawlerBays ?? []
  const intactBays = bays.filter((b) => (b.condition ?? 'intact') === 'intact').length
  const pool = crawler.scrapPool ?? {}

  // Repair affordability is advisory only — TL+ buckets count (S12).
  const repairable = SCRAP_TLS.filter((t) => t >= tl).reduce(
    (sum, t) => sum + scrapPoolBucket(pool, t),
    0
  )
  const repairShortfall = Math.max(0, BAY_REPAIR_COST - repairable)

  /**
   * Repair a damaged bay: decrement 5 Scrap starting at the crawler-TL
   * bucket, spilling into higher buckets, then flip the bay Intact. A short
   * pool still repairs — the shortfall is surfaced on the button, never a
   * block (S12).
   */
  function repairBay(entry: CrawlerBayEntry, index: number) {
    if (readOnly) return
    const fresh = storeState.get('crawler', crawler.id) ?? crawler
    let nextPool: ScrapPool = { ...(fresh.scrapPool ?? {}) }
    let remaining = BAY_REPAIR_COST
    for (let t = tl; t <= 6 && remaining > 0; t++) {
      const take = Math.min(scrapPoolBucket(nextPool, t), remaining)
      if (take > 0) {
        nextPool = addToScrapPool(nextPool, t, -take)
        remaining -= take
      }
    }
    void storeState.update('crawler', crawler.id, { scrapPool: nextPool }, LIVE_SHEET_MANUAL)
    void storeState.updateCrawlerBay(
      crawler.id,
      entry.bayRef,
      { condition: 'intact' },
      index,
      LIVE_SHEET_MANUAL
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
    void storeState.update(
      'crawler',
      crawler.id,
      {
        scrapPool: addToScrapPool(currentPool, tlBucket, delta),
      },
      LIVE_SHEET_MANUAL
    )
  }

  /** The Armament Bay's mounted weapons — rendered INSIDE that bay. */
  const armamentContents =
    crawler.systems.length === 0 ? (
      <p className="font-body text-caption text-wk-muted">No weapons mounted.</p>
    ) : (
      // A full-width STACK, not a 2-up masonry: a mounted weapon reads as a
      // listing row across the bay, and half a bay's width squeezed the card's
      // header stats onto a second line.
      <div className="flex min-w-0 flex-col gap-4">
        {crawler.systems.map((slug) => {
          const system = resolveCrawlerSystem(slug)
          return (
            <EntityGridRow key={slug}>
              {system ? (
                <ReferenceEntityCard data={system} size="medium" collapsible />
              ) : (
                <div className="flex items-center justify-between gap-2 rounded border border-ink px-2 py-1 text-sm text-wk-muted">
                  <span className="min-w-0 truncate">{slug}</span>
                  {!readOnly && (
                    <CardRemoveButton name={slug} onRemove={() => removeWeapon(slug)} />
                  )}
                </div>
              )}
            </EntityGridRow>
          )
        })}
      </div>
    )

  /** The Storage Bay's scrap pool + the crawler hold — rendered INSIDE it. */
  const storageContents = (
    <div className="flex min-w-0 flex-col gap-4">
      {/* Scrap Pool — the crawler's abstract TL-bucketed scrap store (rules
          S12; the bucket bay-repair spends). Per-tech-level `Stat` steppers let
          a crawler stow arbitrary scrap by hand (Free Edit). The
          physical-scrap-cargo path lives in the Hold add-form's Scrap kind. */}
      <div>
        <span
          className="mb-2 block font-cond text-label font-bold uppercase leading-none tracking-caps"
          style={{ color: 'var(--tone-deep, var(--color-ink))' }}
        >
          Scrap Pool
        </span>
        <div className="flex flex-wrap gap-2">
          {SCRAP_TLS.map((t) => (
            <Stat
              key={t}
              label={`T${t}`}
              value={scrapPoolBucket(pool, t)}
              min={0}
              size="mini"
              mode={readOnly ? 'read' : 'edit'}
              ariaLabel={`Tech ${t} scrap`}
              onChange={readOnly ? undefined : (next) => setScrapBucket(t, next)}
            />
          ))}
        </div>
      </div>
      <StorageManifest
        side="crawler"
        cargo={cargo}
        mechName={mech?.name ?? null}
        crawlerName={crawler.name}
        readOnly={readOnly}
      />
    </div>
  )

  /** Which special bay is this? Drives what gets rendered INSIDE it. */
  function bayKind(entry: CrawlerBayEntry): 'mech' | 'armament' | 'storage' | 'plain' {
    const name = resolveCrawlerBay(entry.bayRef)?.name ?? entry.bayRef
    if (entry.bayRef === 'mech-bay' || name === 'Mech Bay') return 'mech'
    if (entry.bayRef === 'armament-bay' || name === 'Armament Bay') return 'armament'
    if (entry.bayRef === 'storage-bay' || name === 'Storage Bay') return 'storage'
    return 'plain'
  }

  /**
   * One bay card, with whatever that bay HOLDS rendered inside it: the
   * Armament Bay's mounted weapons, the Storage Bay's scrap pool and hold.
   * A bay's contents belong in the bay — they used to sit in sections
   * elsewhere on the sheet, describing a bay from a distance.
   */
  function renderBay(entry: CrawlerBayEntry, i: number) {
    const kind = bayKind(entry)
    return (
      <CrawlerBayCard
        crawlerId={crawler.id}
        entry={entry}
        index={i}
        crawlerTl={tl}
        repairShortfall={repairShortfall}
        onRepair={repairBay}
        seedSelections={crawler.bayChoices?.[entry.bayRef]}
        store={store}
        readOnly={readOnly}
        dockedMechName={kind === 'mech' && mech ? mech.name : undefined}
        // "Mount" opens the weapons picker — the thing the verb means — rather
        // than the bay's rules text.
        onFunction={kind === 'armament' && !readOnly ? () => setSystemsModalOpen(true) : undefined}
        contents={
          kind === 'armament' ? armamentContents : kind === 'storage' ? storageContents : undefined
        }
      />
    )
  }

  return (
    <section
      aria-label={`${crawler.name} crawler sheet`}
      // `.sheet-section` is a print-stylesheet target (page-break rules);
      // `@container` scopes the poster region grid below to the SHEET's own
      // width (redesign D7), not the viewport.
      className="sheet-section @container flex flex-col gap-6"
    >
      {/* ===== Single-column region flow (Workshop-Manual crawler sheet):
          Identity → Bays → Armament Weapons → Linked Units → Storage Bay.
          Storage is the FULL-WIDTH band at the very bottom (printed
          `Editable_..._Crawler_Sheets.pdf` p.2), not a full-height right
          column. ===== */}
      <div className="flex min-w-0 flex-col gap-6">
        {/* ===== Identity Band (Workshop-Manual crawler sheet top region) =====
            Edge wordmark ∥ Name/Type/Ability/Description fields ∥ the Economy
            rail (SP `VitalGauge` + Tech-LVL/Upkeep/Upgrade readouts), in one
            toned frame — no name pseudoheader stamp. */}
        <SheetHero
          cat="Crawler"
          name={crawler.name}
          fields={
            <div className="flex min-w-0 flex-col gap-4">
              <CrawlerIdentityPanel
                crawler={crawler}
                store={store}
                storeState={storeState}
                patch={readOnly ? undefined : patchCrawler}
                readOnly={readOnly}
              />
            </div>
          }
          vitals={economy}
        />

        {/* ----- Content region (Bays, Weapons) ----- */}
        <div className="flex min-w-0 flex-col gap-6">
          {/* Bays — ONE unified grid, all bays together (no crew/functional
              split). // TODO(redesign): render homebrew/custom bays in a
              separate "Custom Bays" group underneath once the data
              distinguishes them (#403). */}
          {bays.length > 0 && (
            <SheetSectionSlab
              title="Bays"
              count={
                <span className="tabular-nums">
                  {intactBays}/{bays.length} intact
                </span>
              }
            >
              {/* The Storage Bay is pulled OUT of the masonry and rendered
                  full-width below it: it holds the scrap pool and the whole
                  crawler hold, which no single column can carry. */}
              <MasonryColumns maxColumns={3}>
                {bays.map((entry, i) =>
                  bayKind(entry) === 'storage' ? null : (
                    // biome-ignore lint/suspicious/noArrayIndexKey: a crawler may install the same bay type more than once, so bayRef alone is not unique; bays are addressed positionally throughout the sheet
                    <EntityGridRow key={`${entry.bayRef}-${i}`}>
                      {renderBay(entry, i)}
                    </EntityGridRow>
                  )
                )}
              </MasonryColumns>

              {bays.map((entry, i) =>
                bayKind(entry) === 'storage' ? (
                  // biome-ignore lint/suspicious/noArrayIndexKey: positional, as above
                  <div key={`storage-${i}`} className="mt-6 min-w-0">
                    {renderBay(entry, i)}
                  </div>
                ) : null
              )}
            </SheetSectionSlab>
          )}
        </div>

        {/* No Storage Bay installed — the scrap pool and hold still have to go
            somewhere: both are crawler-level data (the pool is what bay REPAIRS
            spend), so hiding them with the bay would strand them. They render
            as their own full-width band instead. Lives OUTSIDE the Bays section
            because a crawler with no bays at all has no Bays section either. */}
        {!bays.some((entry) => bayKind(entry) === 'storage') && (
          <SheetSectionSlab title="Storage Bay">{storageContents}</SheetSectionSlab>
        )}

        {/* Linked Units — poster renders this as a bare section header +
            rail stack (no `.dcard` frame), matching PilotSheet/MechSheet. */}
        <SheetSectionSlab
          id="linked-units"
          title="Linked Units"
          // Side by side: each linked unit is one roster row, and two of them stack
          // to a wasteful column on a sheet that has the width for both.
          bodyClassName="flex flex-col gap-4 @3xl:flex-row"
        >
          {linkedUnits}
        </SheetSectionSlab>

        {/* ----- Storage Bay — the crawler's own BAY, rendered as a
            full-width box rather than a plain section: the hold IS a bay (Core
            Book p.213), so it wears the same frame its siblings above do
            instead of reading as loose furniture at the foot of the sheet. ----- */}
      </div>

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
