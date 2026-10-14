/**
 * CrawlerSheet — the crawler variant BODY for the LiveSheet shell, in the
 * poster layout.
 *
 * The body OWNS the identity band now (Workshop-Manual crawler sheet):
 * This body renders `SheetHero` as its first region.
 * Following the printed sheet (`Editable_..._Crawler_Sheets.pdf`), the sheet is
 * a single-column region stack, inside the same `@container` shape
 * PilotSheet/MechSheet use:
 *
 *   Identity Band: edge wordmark ∥ Name/Type/Ability/Description fields ∥ the
 *     Economy rail (SP `VitalGauge` + Tech-LVL/Upkeep/Upgrade readouts, built
 *     by SheetCrawler and passed as `economy`) → Bays (3-column masonry)
 *     → Armament Bay Weapons (3-column) → Assigned Units (bare section, no card
 *     frame) → Storage Bay.
 *   Storage Bay is the FULL-WIDTH band at the very BOTTOM (printed sheet p.2 —
 *     Storage Bay spans the whole width beneath the bays), NOT a full-height
 *     right column.
 *
 * Economy (SP `VitalGauge` + Tech-LVL/Upkeep/Upgrade lozenges) is built by
 * `SheetCrawler` (it owns the economy-dialog state + `patch`) and handed
 * down as the `economy` slot, rendered inside the Identity card below the
 * identity fields.
 *
 * Bays stay ONE unified grid (no crew/functional split; the poster's
 * homebrew/custom-bay split needs a data-model flag the schema does not have)
 * as compact entity cards (max 2
 * columns), each with Intact/Damaged status, its crew lead as an
 * NpcInset, a "Docks <mech>" one-liner on the Mech Bay, and a
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
 * in the full-height right rail; ← Load is cap-checked against the docked
 * mech. Keeps the Stow/Load transfer feature.
 *
 * Dropped (the poster redesign — no poster counterpart; tracking issues filed for
 * re-homing as an off-sheet action surface):
 *   - the Tech Level stepper slab — Tech Level itself still reads
 *     live via the economy band's TL lozenge (built by SheetCrawler); only
 *     the hand-edit stepper UI drops.
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

import {
  buttonVariants,
  EmptyState,
  MasonryColumns,
  ReferenceEntityCard,
  SheetSectionSlab,
  Stat,
  tokens,
} from 'component-lib'
import type { Crawler } from 'itun-domain/schemas/crawler'
import type { Mech } from 'itun-domain/schemas/mech'
import type { CSSProperties, ReactNode } from 'react'
import { useState } from 'react'
import { parseCrawlerTechLevel } from 'salvageunion-reference/rules'
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
import { AppLink } from '../shared/AppLink'
import { EntityPhoto } from '../shared/EntityPhoto'
import { CrawlerIdentityPanel } from './CrawlerIdentity'
import type { CrawlerBayEntry } from './CrawlerSheetItems'
import { CrawlerBayCard } from './CrawlerSheetItems'
import { EntityGridRow } from './EntityGrid'
import { PhotoBeside } from './PhotoBeside'
import { SheetHero } from './SheetHero'
import { CardRemoveButton } from './SheetSection'
import { StorageManifest } from './StorageManifest'

/** A full-width column of the given gap. */
const column = (gap: string) =>
  ({ display: 'flex', minWidth: 0, flexDirection: 'column', gap }) satisfies CSSProperties

const STACK_16 = column(tokens.space[16])
const STACK_24 = column(tokens.space[24])

/** The section root: `@container` scopes the region grids to the sheet's own width. */
const ROOT = {
  containerType: 'inline-size',
  display: 'flex',
  flexDirection: 'column',
  gap: tokens.space[24],
} satisfies CSSProperties

/** A mounted weapon the catalog does not know: its slug and the remove ✕. */
const UNKNOWN_WEAPON = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: tokens.space[8],
  borderRadius: '0.25rem',
  border: `${tokens.borderWidth.hairline} solid ${tokens.color.ink}`,
  padding: `${tokens.space[4]} ${tokens.space[8]}`,
  fontSize: tokens.fontSize.sm,
  lineHeight: 1.25 / 0.875,
  color: tokens.color.wkMuted,
} satisfies CSSProperties

const TRUNCATE = {
  minWidth: 0,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
} satisfies CSSProperties

const POOL_LABEL = {
  marginBottom: tokens.space[8],
  display: 'block',
  fontFamily: tokens.font.cond,
  fontSize: tokens.fontSize.badge,
  fontWeight: tokens.weight.bold,
  textTransform: 'uppercase',
  lineHeight: 1,
  letterSpacing: tokens.tracking.caps,
  color: 'var(--tone-deep, var(--color-ink))',
} satisfies CSSProperties

const POOL_ROW = { display: 'flex', flexWrap: 'wrap', gap: tokens.space[8] } satisfies CSSProperties

const TABULAR = { fontVariantNumeric: 'tabular-nums' } satisfies CSSProperties

const CREW_LINK = { textDecoration: 'none' } satisfies CSSProperties

const STORAGE_BAY = { marginTop: tokens.space[24], minWidth: 0 } satisfies CSSProperties

type CrawlerSheetProps = {
  crawler: Crawler
  /**
   * The docked mech (the first mech assigned to this crawler by its own
   * `mech-to-crawler` link, resolved by the composition resolver) — the Hold's
   * ← Load target. Null when nothing is docked.
   */
  mech?: Mech | null
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
  store = useEntityStore,
  readOnly = false,
  economy,
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

  /** The Armament Bay's mounted weapons — rendered INSIDE that bay. */
  const armamentContents =
    crawler.systems.length === 0 ? (
      <EmptyState variant="quiet" body="No weapons mounted." />
    ) : (
      // A full-width STACK, not a 2-up masonry: a mounted weapon reads as a
      // listing row across the bay, and half a bay's width squeezed the card's
      // header stats onto a second line.
      <div style={STACK_16}>
        {crawler.systems.map((slug) => {
          const system = resolveCrawlerSystem(slug)
          return (
            <EntityGridRow key={slug}>
              {system ? (
                <ReferenceEntityCard data={system} size="medium" collapsible />
              ) : (
                <div style={UNKNOWN_WEAPON}>
                  <span style={TRUNCATE}>{slug}</span>
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
    <div style={STACK_16}>
      {/* Scrap Pool — the crawler's abstract TL-bucketed scrap store (the
          bucket bay-repair spends). Per-tech-level `Stat` steppers let
          a crawler stow arbitrary scrap by hand (Free Edit). The
          physical-scrap-cargo path lives in the Hold add-form's Scrap kind. */}
      <div>
        <span style={POOL_LABEL}>Scrap Pool</span>
        <div style={POOL_ROW}>
          {SCRAP_TLS.map((t) => (
            <Stat
              key={t}
              orientation="horizontal"
              label={`T${t}`}
              value={scrapPoolBucket(pool, t)}
              min={0}
              mode={readOnly ? 'read' : 'edit'}
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
      // width, not the viewport.
      className="sheet-section"
      style={ROOT}
    >
      {/* ===== Single-column region flow (Workshop-Manual crawler sheet):
          Identity → Bays → Armament Weapons → Assigned Units → Storage Bay.
          Storage is the FULL-WIDTH band at the very bottom (printed
          `Editable_..._Crawler_Sheets.pdf` p.2), not a full-height right
          column. ===== */}
      <div style={STACK_24}>
        {/* ===== Identity Band (Workshop-Manual crawler sheet top region) =====
            Edge wordmark ∥ Name/Type/Ability/Description fields ∥ the Economy
            rail (SP `VitalGauge` + Tech-LVL/Upkeep/Upgrade readouts), in one
            toned frame — no name pseudoheader stamp. */}
        <SheetHero
          name={crawler.name}
          surface={readOnly ? 'paper' : 'frame'}
          fields={
            <PhotoBeside
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
            >
              <div style={STACK_16}>
                <CrawlerIdentityPanel
                  crawler={crawler}
                  store={store}
                  storeState={storeState}
                  patch={readOnly ? undefined : patchCrawler}
                  readOnly={readOnly}
                  typeCrew={assignmentFor(crew, { kind: 'type' })}
                />
              </div>
            </PhotoBeside>
          }
          vitals={economy}
        />

        {/* ----- Content region (Bays, Weapons) ----- */}
        <div style={STACK_24}>
          {/* Bays — ONE unified grid, all bays together (no crew/functional
              split). // TODO(redesign): render homebrew/custom bays in a
              separate "Custom Bays" group underneath once the data
              distinguishes them. */}
          {bays.length > 0 && (
            <SheetSectionSlab
              title="Bays"
              count={
                <span style={TABULAR}>
                  {intactBays}/{bays.length} intact
                </span>
              }
              controls={
                crewHref === undefined ? undefined : (
                  <AppLink
                    href={crewHref}
                    className={buttonVariants({ variant: 'default', size: 'compact' })}
                    style={CREW_LINK}
                    aria-label={`Crew ${crawler.name}: design and assign crawler crew`}
                  >
                    Crew…
                  </AppLink>
                )
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
                  <div key={`storage-${i}`} style={STORAGE_BAY}>
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

        {/* Assigned Units — poster renders this as a bare section header +
            rail stack (no `.dcard` frame), matching PilotSheet/MechSheet. */}
        {linkedUnits && (
          <SheetSectionSlab
            id="linked-units"
            title="Assigned units"
            // A wrapping column, never a row: a row of full unit rows made the
            // page wider than the viewport. Read stacks one-line listing cards;
            // Edit stacks the full rows with their Assign controls.
            bodyClassName={
              readOnly ? 'su-sheet-crawler-linked-read' : 'su-sheet-crawler-linked-edit'
            }
          >
            {linkedUnits}
          </SheetSectionSlab>
        )}

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
