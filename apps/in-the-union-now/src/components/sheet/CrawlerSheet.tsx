/**
 * CrawlerSheet — the crawler variant body on the LiveSheet shell (design
 * §4.4, plan 4.6; redesigned to the poster layout, phase 3). The hero owns
 * identity (Name/Type fields + ability/type cards + description — see
 * CrawlerIdentity.tsx), the SP/Bays trackers and the economy lozenges; this
 * renders the body slabs:
 *
 *   - Tech Level — editable stepper (rules: upgraded on the live sheet).
 *   - Bays — ONE unified grid of ALL installed bays (no crew/functional
 *     split — redesign refinement) as compact entity cards (max 2 columns),
 *     each with Intact/Damaged status (rules C8), its crew lead as an
 *     NpcInset, a "Docks <mech>" one-liner on the Mech Bay, and a
 *     function/Repair action pair. Repair decrements 5 Scrap from the
 *     crawler-TL pool bucket, spilling into higher buckets — a short pool is
 *     advisory, never a block (S12).
 *     // TODO(redesign): the poster groups homebrew/custom bays in a separate
 *     // "Custom Bays" grid underneath — the data model has no custom-bay
 *     // distinction yet, so all bays render in the one standard grid.
 *   - Armament Bay Weapons — collection section (unified edit language
 *     archetype B): always-available '+ Add' opening the existing weapons
 *     picker (CrawlerSystemsEditModal), per-card remove (✕).
 *   - Scrap Pool — 6 editable TL buckets as cargo-toned spec lozenges
 *     (rules C5: the party economy).
 *   - Downtime / Salvaging / Crafting — live-play controls (R-2/R-3/R-7).
 *   - Storage Bay (The Hold) — the unlimited StorageManifest
 *     (side='crawler'), full-width BENEATH the bays grid (poster layout);
 *     ← Load is cap-checked against the docked mech.
 *
 * readOnly suppresses every edit affordance (snapshot contexts).
 */

import { useState } from 'react'
import { ReferenceEntityDisplay, Slab } from 'suref-react'

import { cn } from '../../lib/utils'
import { addToScrapPool, scrapPoolBucket } from '../../lib/cargo/cargoTransfer'
import { useCargo } from '../../lib/cargo/useCargo'
import { parseCrawlerTechLevel } from '../../lib/crawlerLevel'
import { resolveCrawlerBay } from '../../lib/crawlerRefs'
import type { Crawler, ScrapPool } from '../../lib/schemas/crawler'
import type { Mech } from '../../lib/schemas/mech'
import { useEntityStore } from '../../stores/entityStore'
import { CrawlerSystemsEditModal } from '../crawler/CrawlerSystemsEditModal'
import { CraftingControl } from './CraftingControl'
import { DowntimeControl } from './DowntimeControl'
import { Ecflow, Erow } from './Erow'
import { SalvageControl } from './SalvageControl'
import { CardRemoveButton, SectionAddButton } from './SheetSection'
import { StorageManifest } from './StorageManifest'

import {
  BAY_REPAIR_COST,
  CrawlerBayCard,
  SCRAP_TLS,
  ScrapPoolSlab,
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
}

export function CrawlerSheet({
  crawler,
  mech = null,
  store = useEntityStore,
  readOnly = false,
}: CrawlerSheetProps) {
  const storeState = store()
  const cargo = useCargo({ mech, crawler, store, readOnly })

  // Weapons '+ Add' opens the existing picker modal (archetype B — always
  // available; the modal itself carries the p.213/p.216 mount cap).
  // TODO(redesign): rule-gate add/remove (scrap economy) — deferred; users
  // self-manage for now.
  const [systemsModalOpen, setSystemsModalOpen] = useState(false)

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
  const totalScrap = SCRAP_TLS.reduce((sum, t) => sum + scrapPoolBucket(pool, t), 0)
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

  /** Hand-edit one scrap bucket (±1), reading the freshest pool at call time. */
  function adjustScrapBucket(bucketTl: number, delta: number) {
    if (readOnly) return
    const fresh = storeState.get('crawler', crawler.id) ?? crawler
    void storeState.update('crawler', crawler.id, {
      scrapPool: addToScrapPool(fresh.scrapPool ?? {}, bucketTl, delta),
    })
  }

  /** Set the crawler's tech level (1–6), recomputing SP/capacity downstream. */
  function setTechLevel(next: number) {
    if (readOnly) return
    if (next < 1 || next > 6 || next === tl) return
    void storeState.update('crawler', crawler.id, { techLevel: `tech-${next}` })
  }

  /** Remove one mounted weapon (per-card ✕ — archetype B). */
  function removeWeapon(slug: string) {
    patchCrawler((current) => ({ systems: current.systems.filter((s) => s !== slug) }))
  }

  const TECH_LEVELS = [1, 2, 3, 4, 5, 6] as const

  return (
    <section aria-label={`${crawler.name} crawler sheet`} className="flex flex-col gap-7">
      {/* Tech Level — editable stepper (rules: upgraded on the live sheet) */}
      <div>
        <Slab label="Tech Level" count={`Tech ${tl} crawler`} />
        {readOnly ? (
          <p className="font-body text-sm text-ink">Tech Level {tl}</p>
        ) : (
          // biome-ignore lint/a11y/useSemanticElements: a fieldset would need a legend and carries min-content sizing quirks inside this inline-flex chrome; role="group" + aria-label conveys the same semantics
          <div
            role="group"
            aria-label="Crawler tech level"
            className="inline-flex items-stretch overflow-hidden rounded-[2px] border-chrome border-ink bg-paper"
          >
            {TECH_LEVELS.map((n) => (
              <button
                key={n}
                type="button"
                aria-label={`Set tech level ${n}`}
                aria-pressed={n === tl}
                onClick={() => setTechLevel(n)}
                className={cn(
                  'min-w-9 px-2 py-1 font-cond text-sm font-bold leading-none',
                  n === tl ? 'bg-ink text-su-white' : 'text-ink hover:bg-su-paper'
                )}
              >
                {n}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Bays — ONE unified grid, all bays together (no crew/functional split).
          // TODO(redesign): render homebrew/custom bays in a separate "Custom
          // Bays" group underneath once the data distinguishes them. */}
      {bays.length > 0 && (
        <div>
          <Slab
            label="Bays"
            count={`${intactBays} of ${bays.length} intact · each run by its own crew`}
          />
          <Ecflow>
            {bays.map((entry, i) => {
              const isMechBay =
                entry.bayRef === 'mech-bay' || resolveCrawlerBay(entry.bayRef)?.name === 'Mech Bay'
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
        </div>
      )}

      {/* Armament Bay weapons — crawler weapon systems mount here (Core Book
          p. 213). Collection section: '+ Add' is always available and opens
          the existing weapons picker; each card carries a remove (✕). */}
      {(crawler.systems.length > 0 || !readOnly) && (
        <div>
          <Slab
            label="Armament Bay Weapons"
            count={`${crawler.systems.length}`}
            actions={
              readOnly ? undefined : (
                <SectionAddButton
                  label="weapons system"
                  onClick={() => setSystemsModalOpen(true)}
                />
              )
            }
          />
          {crawler.systems.length === 0 ? (
            <p className="font-body text-caption text-wk-muted">No weapons mounted.</p>
          ) : (
            <Ecflow>
              {crawler.systems.map((slug) => {
                const system = resolveCrawlerSystem(slug)
                return (
                  <Erow
                    key={slug}
                    actions={
                      system && !readOnly ? (
                        <CardRemoveButton name={system.name} onRemove={() => removeWeapon(slug)} />
                      ) : undefined
                    }
                  >
                    {system ? (
                      <ReferenceEntityDisplay data={system} compact />
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
        </div>
      )}

      {/* Scrap Pool — the shared party economy (rules C5) */}
      <div>
        <Slab label="Scrap Pool" count={`${totalScrap} scrap · Tech ${tl} crawler`} />
        <ScrapPoolSlab
          pool={pool}
          onAdjust={readOnly ? undefined : adjustScrapBucket}
          readOnly={readOnly}
        />
      </div>

      {/* Downtime — the one-click p.227-228 checklist runner for the crew
          (design-review R-2). Live-play only: pure bookkeeping writes. */}
      {!readOnly && (
        <div>
          <Slab label="Downtime" count="restore · repair · heal · train · recharge · Upkeep" />
          <DowntimeControl crawler={crawler} store={store} />
        </div>
      )}

      {/* Salvaging — Area + Mech Salvage rollers (design-review R-3, pp.244-248).
          Live-play only: rolls are ephemeral, so snapshots have nothing to show. */}
      {!readOnly && (
        <div>
          <Slab label="Salvaging" count="Area & Mech Salvage · deposits to the pool and hold" />
          <SalvageControl crawler={crawler} store={store} />
        </div>
      )}

      {/* Crafting — the Crafting Bay flow (design-review R-7, p.222/p.244).
          Live-play only: crafting writes only pool/hold bookkeeping. */}
      {!readOnly && (
        <div>
          <Slab label="Crafting" count="salvage-value cost · deducts the pool, fills the hold" />
          <CraftingControl crawler={crawler} store={store} />
        </div>
      )}

      {/* Storage Bay (The Hold) — unlimited crawler storage (rules C6);
          full-width, stacked beneath the bays grid (poster layout). */}
      <div>
        <Slab
          label="Storage Bay"
          count={`${lots.length} ${lots.length === 1 ? 'lot' : 'lots'} · unlimited`}
        />
        <StorageManifest
          side="crawler"
          cargo={cargo}
          mechName={mech?.name ?? null}
          crawlerName={crawler.name}
          readOnly={readOnly}
        />
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
