/**
 * CrawlerSheet — the crawler variant body on the LiveSheet shell (design
 * §4.4, plan 4.6). The hero (SP/Bays trackers, UPKEEP/UPGRADE/CREW specs,
 * rail) lives in Sheet.tsx; this renders the body slabs:
 *
 *   - Crawler Bays — Erow'd entity cards (cb accent), each with its crew
 *     lead as an NpcInset `expand`, a status badge (Intact/Damaged ONLY,
 *     rules C8) and a function/Repair action pair. A Damaged bay disables
 *     its function action and promotes Repair to primary; Repair decrements
 *     5 Scrap from the crawler-TL pool bucket, spilling into higher buckets
 *     (rules: TL+ scrap allowed) — a short pool is advisory, never a block
 *     (S12).
 *   - Crawler Systems — proper entity cards [gap 20], not raw slugs.
 *   - Scrap Pool — 6 editable TL buckets as cargo-toned spec lozenges
 *     (rules C5: the party economy).
 *   - The Hold — unlimited StorageManifest (side='crawler'); ← Load is
 *     cap-checked against the docked mech, bulk lots partial-fill ('Load N').
 *
 * readOnly suppresses every edit affordance (snapshot contexts).
 */

import { ReferenceEntityDisplay, Slab } from 'suref-react'

import { cn } from '../../lib/utils'
import { addToScrapPool, scrapPoolBucket } from '../../lib/cargo/cargoTransfer'
import { useCargo } from '../../lib/cargo/useCargo'
import { parseCrawlerTechLevel } from '../../lib/crawlerLevel'
import type { Crawler, ScrapPool } from '../../lib/schemas/crawler'
import type { Mech } from '../../lib/schemas/mech'
import { useEntityStore } from '../../stores/entityStore'
import { CraftingControl } from './CraftingControl'
import { DowntimeControl } from './DowntimeControl'
import { Ecflow, Erow } from './Erow'
import { SalvageControl } from './SalvageControl'
import { StorageManifest } from './StorageManifest'

import {
  BAY_REPAIR_COST,
  CrawlerBayCard,
  CrawlerTypeCard,
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

  const TECH_LEVELS = [1, 2, 3, 4, 5, 6] as const

  return (
    <section aria-label={`${crawler.name} crawler sheet`} className="flex flex-col gap-7">
      {/* Crawler Type — only when a type was chosen (legacy crawlers have none) */}
      {crawler.type && (
        <div>
          <Slab label="Crawler Type" count="special action + special NPC" />
          <Ecflow>
            <Erow>
              <CrawlerTypeCard
                crawlerId={crawler.id}
                typeRef={crawler.type}
                typeNpc={crawler.typeNpc}
                seedSelections={crawler.bayChoices?.[crawler.type]}
                store={store}
                readOnly={readOnly}
              />
            </Erow>
          </Ecflow>
        </div>
      )}

      {/* Tech Level — editable stepper (rules: upgraded on the live sheet) */}
      <div>
        <Slab label="Tech Level" count={`Tech ${tl} crawler`} />
        {readOnly ? (
          <p className="font-body text-sm text-ink">Tech Level {tl}</p>
        ) : (
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

      {/* Crawler Bays */}
      {bays.length > 0 && (
        <div>
          <Slab
            label="Crawler Bays"
            count={`${intactBays} of ${bays.length} intact · each run by its own crew`}
          />
          <Ecflow>
            {bays.map((entry, i) => (
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
                />
              </Erow>
            ))}
          </Ecflow>
        </div>
      )}

      {/* Crawler Systems — proper entity cards [gap 20] */}
      {crawler.systems.length > 0 && (
        <div>
          <Slab label="Crawler Systems" count={`${crawler.systems.length}`} />
          <Ecflow>
            {crawler.systems.map((slug) => {
              const system = resolveCrawlerSystem(slug)
              return (
                <Erow key={slug}>
                  {system ? (
                    <ReferenceEntityDisplay data={system} compact />
                  ) : (
                    <div className="rounded border border-ink px-2 py-1 text-sm text-wk-muted">
                      {slug}
                    </div>
                  )}
                </Erow>
              )
            })}
          </Ecflow>
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

      {/* The Hold — unlimited crawler storage (rules C6) */}
      <div>
        <Slab
          label="The Hold"
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
    </section>
  )
}
