/**
 * CrawlerSheet — the crawler variant BODY for the LiveSheet shell (design
 * §4.4, plan 4.6; redesigned to the poster layout, Phase 2).
 *
 * The body OWNS the identity band now (Workshop-Manual crawler sheet):
 * SheetCrawler passes NO `renderHero`, and this body renders `SheetHero` in
 * band mode as its first region (wrapped with the shell's `heroRef`).
 * Following the printed sheet (`Editable_..._Crawler_Sheets.pdf`), the sheet is
 * a single-column region stack, inside the same `@container` shape
 * PilotSheet/MechSheet use:
 *
 *   Identity Band: edge wordmark ∥ Name/Type/Ability/Description fields ∥ the
 *     Economy rail (SP `VitalGauge` + Tech-LVL/Upkeep/Upgrade readouts, built
 *     by SheetCrawler and passed as `economy`) → Bays (3-column MASONRY
 *     `EntityGrid`) → Storage Bay (the full-width bay band) → the mounted
 *     Armament Bay weapons (standalone sealed cards) → Linked Units (bare
 *     section, no card frame).
 *   Storage Bay is the FULL-WIDTH band, and it sits WITH the rest of the bays
 *     rather than at the very bottom of the sheet. It is an installed bay like
 *     any other, so it used to render twice — once as a grid cell and once as
 *     this band, in two different regions. The band is the richer rendering
 *     (Scrap Pool + the unlimited manifest), so it is the only one, and it sits
 *     where the thing it renders belongs.
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
 * data-model flag, #403 — leave unified), each with Intact/Damaged status
 * (rules C8), its crew lead as an NpcInset, a "Docks <mech>" one-liner on the
 * Mech Bay, and a function/Repair action pair. Repair decrements 5 Scrap from
 * the crawler-TL pool bucket, spilling into higher buckets — a short pool is
 * advisory, never a block (S12). The grid is MASONRY: bays range from a couple
 * of lines to a full crew inset, and row alignment padded every short bay out
 * to its tallest neighbour.
 *
 * Armament Bay Weapons — NOT a section. Each mounted weapon is a standalone
 * reference card wearing an "Armament Bay" seam stampseal (top-left) and a
 * "Change" control on its top-right rail that opens the weapons picker
 * (CrawlerSystemsEditModal); the per-card remove (✕) rides the same rail. The
 * section frame that used to hold them restated, in chrome, exactly what the
 * seal and the Change control say on the card itself.
 *
 * Storage Bay (The Hold) — the unlimited StorageManifest (side='crawler') over
 * the Scrap Pool, as the full-width band beneath the bay grid; ← Load is
 * cap-checked against the docked mech. Keeps the Stow/Load transfer feature.
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
import type { ReactNode, Ref } from 'react'
import { Badge, ReferenceEntityCard, SheetHero, Stat } from 'component-lib'
import type { ReferenceEntityControl } from 'component-lib'

import { addToScrapPool, scrapPoolBucket } from '../../lib/cargo/cargoTransfer'
import { useCargo } from '../../lib/cargo/useCargo'
import { parseCrawlerTechLevel } from '../../lib/crawlerLevel'
import { resolveCrawlerBay } from '../../lib/crawlerRefs'
import type { Crawler, ScrapPool } from '../../lib/schemas/crawler'
import type { Mech } from '../../lib/schemas/mech'
import { useEntityStore } from '../../stores/entityStore'
import { CrawlerSystemsEditModal } from '../crawler/CrawlerSystemsEditModal'
import { CrawlerIdentityPanel } from './CrawlerIdentity'
import { EntityGrid, EntityGridRow } from 'component-lib'
import {
  CardRemoveButton,
  REMOVABLE_CARD_STYLE,
  SectionAddButton,
  SectionEditButton,
  Slab,
  cardRemoveControls,
} from 'component-lib'
import { SheetSectionCard } from 'component-lib'
import { StorageManifest } from './StorageManifest'

import { CrawlerBayCard } from './CrawlerSheetItems'
import type { CrawlerBayEntry } from './CrawlerSheetItems'
import { BAY_REPAIR_COST, SCRAP_TLS, resolveCrawlerSystem } from './crawlerSheetItemRules'

/**
 * The seam stampseal branding every mounted weapon as Armament Bay kit — the
 * card's own top-left seal slot, which is what replaces the section frame these
 * cards used to sit inside. Crawler tone, matching the sheet.
 */
const ARMAMENT_SEAL = { label: 'Armament Bay', tone: 'var(--color-crawler)' } as const

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
   * Condense sentinel from the LiveSheet shell — wraps the identity band (the
   * body's first region) so the sticky bar still condenses when it scrolls
   * away. Undefined in bare test renders (no shell).
   */
  heroRef?: Ref<HTMLElement>
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
  heroRef,
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
  const allBays = crawler.crawlerBays ?? []
  // The Storage Bay is rendered ONCE, as the full-width band below the grid —
  // it was appearing twice, because it is an installed bay like any other AND
  // the sheet gives it its own band for the manifest. The band is the richer of
  // the two (Scrap Pool + cargo lots), so the grid cell is what goes.
  const isStorageBay = (entry: CrawlerBayEntry) =>
    entry.bayRef === 'storage-bay' || resolveCrawlerBay(entry.bayRef)?.name === 'Storage Bay'
  // Carry each entry's ORIGINAL index through the filter. Bays are addressed
  // POSITIONALLY for writes (`updateCrawlerBay(..., index)`, because a crawler
  // may install the same bayRef twice), so re-deriving the index from the
  // filtered array would silently patch the wrong bay for every bay after
  // Storage — the exact bug a filter over a positionally-addressed list invites.
  const gridBays = allBays
    .map((entry, index) => ({ entry, index }))
    .filter(({ entry }) => !isStorageBay(entry))
  // The count still reads over ALL installed bays, Storage included — it is a
  // statement about the crawler, not about how many cells the grid drew.
  const intactBays = allBays.filter((b) => (b.condition ?? 'intact') === 'intact').length
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

  /**
   * A mounted weapon's top-right rail: "Change" opens the picker (the whole
   * armament loadout is edited there), and the remove ✕ stays as the direct
   * per-card action it already was.
   */
  function armamentControls(slug: string): ReferenceEntityControl[] {
    const system = resolveCrawlerSystem(slug)
    return [
      {
        key: 'change',
        label: 'Change',
        ariaLabel: `Change ${system?.name ?? slug}`,
        title: 'Open the crawler weapons picker',
        onClick: () => setSystemsModalOpen(true),
      },
      ...cardRemoveControls({
        name: system?.name ?? slug,
        onRemove: () => removeWeapon(slug),
      }),
    ]
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
    void storeState.update('crawler', crawler.id, {
      scrapPool: addToScrapPool(currentPool, tlBucket, delta),
    })
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
            toned frame — no name pseudoheader stamp. Carries the shell's
            condense sentinel (heroRef). */}
        <SheetHero
          heroRef={heroRef}
          cat="Crawler"
          name={crawler.name}
          controls={
            !readOnly ? (
              <SectionEditButton
                section="Identity"
                editing={identityEditing}
                onToggle={() => setIdentityEditing((v) => !v)}
              />
            ) : undefined
          }
          fields={
            <CrawlerIdentityPanel
              crawler={crawler}
              store={store}
              storeState={storeState}
              patch={readOnly ? undefined : patchCrawler}
              editing={identityEditing}
              readOnly={readOnly}
            />
          }
          vitals={economy}
        />

        {/* ----- Content region (Bays, Weapons) ----- */}
        <div className="flex min-w-0 flex-col gap-6">
          {/* Bays — ONE unified grid, all bays together (no crew/functional
              split). // TODO(redesign): render homebrew/custom bays in a
              separate "Custom Bays" group underneath once the data
              distinguishes them (#403). */}
          {gridBays.length > 0 && (
            <SheetSectionCard
              title="Bays"
              count={
                <span className="tabular-nums">
                  {intactBays}/{allBays.length} intact
                </span>
              }
            >
              {/* MASONRY — bays vary wildly in height (a Mech Bay carries a crew
                  inset and a docked-mech line; a Cantina is a couple of lines),
                  and row alignment padded every short bay out to its tallest
                  neighbour. */}
              <EntityGrid columns={3} masonry>
                {gridBays.map(({ entry, index }) => {
                  const isMechBay =
                    entry.bayRef === 'mech-bay' ||
                    resolveCrawlerBay(entry.bayRef)?.name === 'Mech Bay'
                  return (
                    <EntityGridRow key={`${entry.bayRef}-${index}`}>
                      <CrawlerBayCard
                        crawlerId={crawler.id}
                        entry={entry}
                        index={index}
                        crawlerTl={tl}
                        repairShortfall={repairShortfall}
                        onRepair={repairBay}
                        seedSelections={crawler.bayChoices?.[entry.bayRef]}
                        store={store}
                        readOnly={readOnly}
                        dockedMechName={isMechBay && mech ? mech.name : undefined}
                      />
                    </EntityGridRow>
                  )
                })}
              </EntityGrid>
            </SheetSectionCard>
          )}

          {/* ----- Storage Bay — the crawler's OTHER bay, rendered as the
              full-width band (Scrap Pool + the unlimited manifest) rather than
              a grid cell, and sitting directly beneath the rest of the bays. It
              used to render BOTH ways, in two different places on the sheet. ----- */}
          <SheetSectionCard
            title="Storage Bay"
            count={
              <span className="tabular-nums">
                {lots.length} {lots.length === 1 ? 'lot' : 'lots'} · unlimited
              </span>
            }
            className="min-w-0"
          >
            {/* Scrap Pool — the crawler's abstract TL-bucketed scrap store (rules
                S12; the bucket bay-repair spends). Per-tech-level `Stat` steppers
                let a crawler stow arbitrary scrap by hand (Free Edit). The
                physical-scrap-cargo path lives in the Hold add-form's Scrap kind. */}
            <div className="mb-4 border-b border-dashed border-[color-mix(in_srgb,var(--tone-deep)_40%,transparent)] pb-4">
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
          </SheetSectionCard>

          {/* Armament Bay weapons — crawler weapon systems mount here (Core
              Book p.213). NOT its own section row: each mounted weapon is a
              STANDALONE reference card branded with an "Armament Bay" seam
              stampseal (top-left) and a "Change" control on the top-right rail
              that opens the weapons picker. The section frame, its title, its
              count and the separate '+ Add' button were all chrome restating
              what the seal and the Change control already say. */}
          {crawler.systems.length > 0 && (
            <div className="flex min-w-0 flex-col gap-6">
              {crawler.systems.map((slug) => {
                const system = resolveCrawlerSystem(slug)
                return system ? (
                  <ReferenceEntityCard
                    key={slug}
                    data={system}
                    size="medium"
                    parentSeal={ARMAMENT_SEAL}
                    controls={readOnly ? undefined : armamentControls(slug)}
                    cardStyle={readOnly ? undefined : REMOVABLE_CARD_STYLE}
                  />
                ) : (
                  <div
                    key={slug}
                    className="flex items-center justify-between gap-2 rounded border border-ink px-2 py-1 text-sm text-wk-muted"
                  >
                    <span className="min-w-0 truncate">{slug}</span>
                    {!readOnly && (
                      <CardRemoveButton name={slug} onRemove={() => removeWeapon(slug)} />
                    )}
                  </div>
                )
              })}
            </div>
          )}
          {/* Nothing mounted — the Change affordance still has to exist, so the
              empty state IS the seal + Change, with no card under it. */}
          {crawler.systems.length === 0 && !readOnly && (
            <div className="flex items-center justify-between gap-3">
              <Badge shape="stamp" size="mini">
                Armament Bay
              </Badge>
              <SectionAddButton label="weapons system" onClick={() => setSystemsModalOpen(true)} />
            </div>
          )}
        </div>

        {/* Linked Units — poster renders this as a bare section header +
            rail stack (no `.dcard` frame), matching PilotSheet/MechSheet. */}
        <div>
          <Slab variant="solid" label="Linked Units" />
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
