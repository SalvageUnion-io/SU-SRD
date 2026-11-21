/**
 * CrawlerSheet — the crawler variant BODY for the LiveSheet shell: the
 * crawler's dashboard (`CrawlerDash`) in Read and in Edit, Edit's writes
 * handed to it (R11).
 *
 * It owns the writes the dashboard's controls make: a partial patch on the
 * crawler, bay Repair (5 Scrap from the crawler-TL bucket up, a short pool
 * said, never a block), installing and removing an expansion bay, removing a
 * mounted weapon, and the weapons picker (`CrawlerSystemsEditModal`) that
 * Mount opens. Free Edit throughout (ADR-021).
 *
 * readOnly suppresses every edit affordance (a sheet the viewer cannot write:
 * public, a crewmate's, the Starter Set, or Read).
 */

import type { Crawler } from 'game-domain/schemas/crawler'
import type { Mech } from 'game-domain/schemas/mech'
import type { CSSProperties, ReactNode } from 'react'
import { useState } from 'react'
import type { PhoneVital } from '../../components/index'
import { tokens } from '../../components/index'
import { useCargo } from '../../lib/cargo/useCargo'
import type { CrewAssignment } from '../../lib/npcs/npcModel'
import { poolShortfall } from '../../lib/rules/crawlerEconomy'
import { BAY_REPAIR_COST, bayRepairPatch } from '../../lib/rules/crawlerItems'
import { runWrite } from '../../lib/runWrite'
import { expansionCrawlerBays } from '../../lib/wizard/crawlerFormState'
import { buildSheetCopy } from '../../messages/build-sheet'
import { LIVE_SHEET_MANUAL, LIVE_SHEET_TXN } from '../../replica/provenance'
import type { UnitsStore } from '../../replica/units'
import { useUnits } from '../../replica/units'
import { CrawlerSystemsEditModal } from '../crawler/CrawlerSystemsEditModal'
import type { CrawlerDashEdit } from '../dash/CrawlerDash'
import { CrawlerDash } from '../dash/CrawlerDash'
import type { CrawlerBayEntry } from './CrawlerSheetItems'
import { usePhone } from './usePhone'

/** The section root: `@container` scopes the dashboard to the sheet's own width. */
const ROOT = {
  containerType: 'inline-size',
  display: 'flex',
  flexDirection: 'column',
  gap: tokens.space[24],
} satisfies CSSProperties

type CrawlerSheetProps = {
  crawler: Crawler
  /**
   * The docked mech (the first mech assigned to this crawler by its own
   * `mech-to-crawler` link): the hold's Load target. Null when nothing is docked.
   */
  mech?: Mech | null
  /** The docked mech's sheet: the Mech Bay's line opens it. */
  mechHref?: string
  /** Injectable store — defaults to useUnits. */
  store?: UnitsStore
  /** Suppresses every edit affordance. */
  readOnly?: boolean
  /**
   * Read, on a sheet its owner may track (`CrawlerLiveSheet`'s `editable`): a
   * bay's condition still steps, as SP does.
   */
  liveCondition?: boolean
  /** SP, the Upgrade Pool and Upkeep as rows, for the dashboard's strip. */
  vitalRows?: readonly PhoneVital[]
  /** The economy's dialogs (Pay Upkeep, Fund, Trade), on the strip's foot. */
  vitalActions?: readonly { key: string; label: string; onClick: () => void }[]
  /** The Assigned Units, built by CrawlerLiveSheet from `composition`. */
  linkedUnits?: ReactNode
  /** The crew slots built NPCs fill (ADR-044). */
  crew?: readonly CrewAssignment[]
  /** The crew board for this crawler (D8): the bays' Crew link in Edit. */
  crewHref?: string
}

export function CrawlerSheet({
  crawler,
  mech = null,
  mechHref,
  store = useUnits,
  readOnly = false,
  liveCondition = false,
  vitalRows = [],
  vitalActions = [],
  linkedUnits,
  crew,
  crewHref,
}: CrawlerSheetProps) {
  const storeState = store()
  const cargo = useCargo({ mech, crawler, store, readOnly })
  const phone = usePhone()
  // Mount opens the weapons picker; the modal carries the mount cap.
  const [systemsModalOpen, setSystemsModalOpen] = useState(false)

  /**
   * Persist a partial patch on this crawler. The updater form receives the
   * FRESHEST record so array edits (weapons) don't race the store round-trip.
   */
  function patchCrawler(input: Partial<Crawler> | ((current: Crawler) => Partial<Crawler>)) {
    if (readOnly) return
    const fields =
      typeof input === 'function' ? input(storeState.get('crawler', crawler.id) ?? crawler) : input
    runWrite(() => storeState.update('crawler', crawler.id, fields, LIVE_SHEET_MANUAL))
  }

  const tl = crawler.techLevel
  const bays = crawler.crawlerBays ?? []

  /**
   * Repair a damaged bay (`bayRepairPatch`). Tagged `LIVE_SHEET_TXN`: Scrap
   * leaves the pool by a rule, so the Change Log should not call it a hand
   * edit (`docs/ARCHITECTURE.md#live-sheet`).
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

  // The Bio-Mech, Bio-Crafting and Nanite Processing Bays and VR Tubes are
  // built or found in play, so the seed leaves them out: Edit installs them.
  const expansionBays = expansionCrawlerBays()
  const edit: CrawlerDashEdit | undefined = readOnly
    ? undefined
    : {
        patch: patchCrawler,
        repairBay,
        repairShortfall: poolShortfall(crawler.scrapPool ?? {}, tl, BAY_REPAIR_COST),
        installable: expansionBays.filter((b) => !bays.some((e) => e.bayRef === b.slug)),
        addBay: (slug) => {
          const bay = expansionBays.find((b) => b.slug === slug)
          if (bay)
            patchCrawler((current) => ({
              crawlerBays: [...(current.crawlerBays ?? []), bay.entry],
            }))
        },
        removable: new Set(expansionBays.map((b) => b.slug)),
        removeBay: (index) =>
          patchCrawler((current) => ({
            crawlerBays: (current.crawlerBays ?? []).filter((_, i) => i !== index),
          })),
        removeWeapon: (slug) =>
          patchCrawler((current) => ({ systems: current.systems.filter((s) => s !== slug) })),
        mountWeapons: () => setSystemsModalOpen(true),
        crewHref,
      }

  return (
    <section
      aria-label={buildSheetCopy('crawlerSheet', { name: crawler.name })}
      // `.su-sheet-section` is a print-stylesheet target (page-break rules).
      className="su-sheet-section"
      style={ROOT}
    >
      <CrawlerDash
        crawler={crawler}
        mech={mech}
        mechHref={mechHref}
        store={store}
        cargo={cargo}
        liveCondition={liveCondition}
        vitals={vitalRows}
        vitalActions={vitalActions}
        linkedUnits={linkedUnits}
        crew={crew}
        edit={edit}
        phone={phone}
      />
      {/* The weapons picker, mounted lazily so its reference preload only
          runs once Mount opens it. */}
      {edit && systemsModalOpen && (
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
