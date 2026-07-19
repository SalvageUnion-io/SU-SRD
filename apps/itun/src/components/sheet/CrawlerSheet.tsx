/**
 * CrawlerSheet — the crawler variant BODY for the LiveSheet shell (design
 * §4.4, plan 4.6; redesigned to the poster layout, Phase 2).
 *
 * Identity/Economy moved OUT of the hero (SheetCrawler.tsx now carries only
 * the name row + meta) and into this body's poster region grid — a 2-col
 * macro grid mirroring `clean-crawler.html`'s `.layout` (54fr content column
 * ∥ 46fr full-height Storage rail, split at the poster's 880px container
 * breakpoint), inside the same `@container` shape PilotSheet/MechSheet use:
 *
 *   Content column (54fr): Identity + Economy (one card) → Bays → Armament
 *     Bay Weapons → Linked Units (bare section, no card frame, matching
 *     PilotSheet/MechSheet).
 *   Storage rail (46fr): Storage Bay, one `SheetSectionCard` that stretches
 *     to match the content column's full height via the grid row's default
 *     stretch (the poster's "full-height Storage right rail").
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
import { ReferenceEntityCard } from 'component-lib'

import { addToScrapPool, scrapPoolBucket } from '../../lib/cargo/cargoTransfer'
import { useCargo } from '../../lib/cargo/useCargo'
import { parseCrawlerTechLevel } from '../../lib/crawlerLevel'
import { resolveCrawlerBay } from '../../lib/crawlerRefs'
import type { Crawler, ScrapPool } from '../../lib/schemas/crawler'
import type { Mech } from '../../lib/schemas/mech'
import { useEntityStore } from '../../stores/entityStore'
import { CrawlerSystemsEditModal } from '../crawler/CrawlerSystemsEditModal'
import { CrawlerIdentityPanel } from './CrawlerIdentity'
import { Ecflow, Erow } from './Erow'
import {
  CardRemoveButton,
  REMOVABLE_CARD_STYLE,
  SectionAddButton,
  SectionChead,
  SectionEditButton,
  cardRemoveControls,
} from './SheetSection'
import { SheetSectionCard } from 'component-lib'
import { StorageManifest } from './StorageManifest'

import {
  BAY_REPAIR_COST,
  CrawlerBayCard,
  SCRAP_TLS,
  resolveCrawlerSystem,
} from './CrawlerSheetItems'
import type { CrawlerBayEntry } from './CrawlerSheetItems'

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
   * and `patch`), rendered inside the Identity card. Undefined renders
   * nothing extra (e.g. a bare test render with no economy slot wired).
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
  const [identityEditing, setIdentityEditing] = useState(false)

  /**
   * Persist a partial patch on this crawler (fire-and-forget write). The
   * updater form receives the FRESHEST record so array edits (weapons) don't
   * race the async store.update round-trip and drop a selection.
   */
  function patchCrawler(input: Partial<Crawler> | ((current: Crawler) => Partial<Crawler>)) {
    if (readOnly) return
    const fields =
      typeof input === 'function' ? input(storeState.get('crawler', crawler.id) ?? crawler) : input
    void storeState.update('crawler', crawler.id, fields)
  }

  const tl = parseCrawlerTechLevel(crawler.techLevel) ?? 1
  const bays = crawler.crawlerBays ?? []
  const intactBays = bays.filter((b) => (b.condition ?? 'intact') === 'intact').length
  const pool = crawler.scrapPool ?? {}
  const lots = crawler.cargoLots ?? []

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
    void storeState.update('crawler', crawler.id, { scrapPool: nextPool })
    void storeState.updateCrawlerBay(crawler.id, entry.bayRef, { condition: 'intact' }, index)
  }

  /** Remove one mounted weapon (per-card ✕ — archetype B). */
  function removeWeapon(slug: string) {
    patchCrawler((current) => ({ systems: current.systems.filter((s) => s !== slug) }))
  }

  return (
    <section
      aria-label={`${crawler.name} crawler sheet`}
      // `.sheet-section` is a print-stylesheet target (page-break rules);
      // `@container` scopes the poster region grid below to the SHEET's own
      // width (redesign D7), not the viewport.
      className="sheet-section @container flex flex-col gap-6"
    >
      {/* ===== 2-col macro grid: content column ∥ full-height Storage rail
          (poster `.layout`, split at its 880px container breakpoint) =====
          DOM order is content-column, Storage, THEN Linked Units — the
          poster's own `grid-template-areas` stacks mobile rows as "id" "bays"
          "storage" "links" (clean-crawler.html:215-222), so Storage reads
          BEFORE Linked Units on a single column even though Storage is a
          separate full-height rail at the desktop breakpoint. Explicit
          `@[880px]:col-start-*`/`row-start-*` restores that desktop layout
          (Storage spans both rows on the right) without reordering the DOM. */}
      <div className="grid grid-cols-1 items-stretch gap-8 @[880px]:grid-cols-[minmax(0,54fr)_minmax(0,46fr)] @[880px]:gap-x-7">
        {/* ----- Content column (Identity/Economy, Bays, Weapons) ----- */}
        <div className="flex min-w-0 flex-col gap-6 @[880px]:col-start-1 @[880px]:row-start-1">
          {/* Identity + Economy */}
          <SheetSectionCard
            title="Identity"
            controls={
              !readOnly ? (
                <SectionEditButton
                  section="Identity"
                  editing={identityEditing}
                  onToggle={() => setIdentityEditing((v) => !v)}
                />
              ) : undefined
            }
          >
            <div className="flex min-w-0 flex-col gap-4">
              <CrawlerIdentityPanel
                crawler={crawler}
                store={store}
                storeState={storeState}
                patch={readOnly ? undefined : patchCrawler}
                editing={identityEditing}
                readOnly={readOnly}
              />
              {economy && (
                <div className="border-t border-dashed border-[color-mix(in_srgb,var(--tone-deep)_40%,transparent)] pt-4">
                  {economy}
                </div>
              )}
            </div>
          </SheetSectionCard>

          {/* Bays — ONE unified grid, all bays together (no crew/functional
              split). // TODO(redesign): render homebrew/custom bays in a
              separate "Custom Bays" group underneath once the data
              distinguishes them (#403). */}
          {bays.length > 0 && (
            <SheetSectionCard
              title="Bays"
              count={
                <span className="tabular-nums">
                  {intactBays}/{bays.length} intact
                </span>
              }
            >
              <Ecflow>
                {bays.map((entry, i) => {
                  const isMechBay =
                    entry.bayRef === 'mech-bay' ||
                    resolveCrawlerBay(entry.bayRef)?.name === 'Mech Bay'
                  return (
                    // biome-ignore lint/suspicious/noArrayIndexKey: a crawler may install the same bay type more than once, so bayRef alone is not unique; bays are addressed positionally throughout the sheet
                    <Erow key={`${entry.bayRef}-${i}`}>
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
                        dockedMechName={isMechBay && mech ? mech.name : undefined}
                      />
                    </Erow>
                  )
                })}
              </Ecflow>
            </SheetSectionCard>
          )}

          {/* Armament Bay weapons — crawler weapon systems mount here (Core
              Book p.213). Collection section: '+ Add' is always available
              and opens the existing weapons picker; each card carries a
              remove (✕). */}
          {(crawler.systems.length > 0 || !readOnly) && (
            <SheetSectionCard
              title="Armament Bay Weapons"
              count={<span className="tabular-nums">{crawler.systems.length}</span>}
              controls={
                readOnly ? undefined : (
                  <SectionAddButton
                    label="weapons system"
                    onClick={() => setSystemsModalOpen(true)}
                  />
                )
              }
            >
              {crawler.systems.length === 0 ? (
                <p className="font-body text-caption text-wk-muted">No weapons mounted.</p>
              ) : (
                <Ecflow>
                  {crawler.systems.map((slug) => {
                    const system = resolveCrawlerSystem(slug)
                    return (
                      <Erow key={slug}>
                        {system ? (
                          <ReferenceEntityCard
                            data={system}
                            compact
                            controls={
                              readOnly
                                ? undefined
                                : cardRemoveControls({
                                    name: system.name,
                                    onRemove: () => removeWeapon(slug),
                                  })
                            }
                            cardStyle={readOnly ? undefined : REMOVABLE_CARD_STYLE}
                          />
                        ) : (
                          <div className="flex items-center justify-between gap-2 rounded border border-ink px-2 py-1 text-sm text-wk-muted">
                            <span className="min-w-0 truncate">{slug}</span>
                            {!readOnly && (
                              <CardRemoveButton name={slug} onRemove={() => removeWeapon(slug)} />
                            )}
                          </div>
                        )}
                      </Erow>
                    )
                  })}
                </Ecflow>
              )}
            </SheetSectionCard>
          )}
        </div>

        {/* ----- Storage rail (full-height, spans both content-column rows
            at the desktop breakpoint) ----- */}
        <SheetSectionCard
          title="Storage Bay"
          count={
            <span className="tabular-nums">
              {lots.length} {lots.length === 1 ? 'lot' : 'lots'} · unlimited
            </span>
          }
          className="min-w-0 @[880px]:col-start-2 @[880px]:row-start-1 @[880px]:row-span-2"
        >
          <StorageManifest
            side="crawler"
            cargo={cargo}
            mechName={mech?.name ?? null}
            crawlerName={crawler.name}
            readOnly={readOnly}
          />
        </SheetSectionCard>

        {/* Linked Units — poster renders this as a bare section header +
            rail stack (no `.dcard` frame), matching PilotSheet/MechSheet. */}
        <div className="@[880px]:col-start-1 @[880px]:row-start-2">
          <SectionChead title="Linked Units" />
          <div className="flex flex-col gap-4">{linkedUnits}</div>
        </div>
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
