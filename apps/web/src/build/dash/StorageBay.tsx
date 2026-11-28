/**
 * The Storage Bay on a crawler's dashboard, as one deliberate object:
 * "Unlimited" on its head, Scrap as a six-cell board (a Tech Level chip over
 * its count) with the expansion resources beside it, then what is stored, a
 * row a lot.
 *
 * Edit adds its controls in place: Adjust turns the board's counts into
 * steppers whose numbers are typed too (r6 E18: 8 Scrap is "8, Enter"; so
 * the bay is not eighteen controls at rest; each a Free Edit of the pool,
 * ADR-021), each lot's Load onto the docked mech and its
 * Unstow, and the Stow intake under the rows. Unstow asks how many and where
 * they go (`UnstowDialog`), and its toast carries Undo (r5 B4).
 */

import type { CargoLot } from 'game-domain/schemas/cargoLot'
import type { Crawler } from 'game-domain/schemas/crawler'
import type { Mech } from 'game-domain/schemas/mech'
import type { CSSProperties } from 'react'
import { lazy, Suspense, useState } from 'react'
import { NUMERIC_TECH_LEVELS } from 'salvageunion-reference/rules'
import { Facts } from '../../components/app'
import type { CSSVarStyle, LedgerColumn } from '../../components/index'
import { Button, capsLabel, Ledger, Stat, TechLevel } from '../../components/index'
import { color, space } from '../../design/tokens'
import {
  addToScrapPool,
  loadableQty,
  perUnitCost,
  scrapPoolBucket,
} from '../../lib/cargo/cargoTransfer'
import { reportCargo } from '../../lib/cargo/reportCargo'
import type { UseCargoResult } from '../../lib/cargo/useCargo'
import type { ExoticKey } from '../../lib/rules/exoticSalvage'
import {
  addToExotic,
  EXOTIC_RESOURCES,
  exoticBucket,
  hasExotic,
} from '../../lib/rules/exoticSalvage'
import { runWrite } from '../../lib/runWrite'
import { buildSheetCopy } from '../../messages/build-sheet'
import { LIVE_SHEET_MANUAL } from '../../replica/provenance'
import type { UnitsStore } from '../../replica/units'
import { CargoCatTag } from '../sheet/CargoCatTag'
import { CargoLotControls } from '../sheet/CargoLotItem'
import { EXOTIC_NAME } from '../sheet/exoticNames.model'
import { HoldAdder } from '../sheet/HoldAdder'
import { undoToast } from '../sheet/undoToast.model'
import { DashGroup } from './Dash'
import type { UnstowTo } from './UnstowDialog'

/** Fetched when Unstow is pressed: the sheet's page load carries none of it. */
const UnstowDialog = lazy(() => import('./UnstowDialog').then((m) => ({ default: m.UnstowDialog })))

/**
 * Unstow `qty` of a lot (r5 B4): onto the docked Mech, or out of the bay, and
 * say so with the way back.
 */
function unstow(
  cargo: UseCargoResult,
  crawlerId: string,
  lot: CargoLot,
  qty: number,
  to: UnstowTo
) {
  const part = lot.kind === 'bulk' && lot.qty !== undefined && qty < lot.qty
  if (to === 'mech') {
    const done = cargo.load(lot.id, qty)
    reportCargo(done)
    void done.then((result) => {
      if (!result.ok) return
      // A Load prepends what it moved: Undo stows that lot back.
      const moved = result.state.carrierLots[0]
      if (moved === undefined) return
      undoToast(
        buildSheetCopy('loadedName', { name: lot.name }),
        () => reportCargo(cargo.stow(moved.id)),
        crawlerId,
        { stack: true }
      )
    })
    return
  }
  const done = cargo.removeCrawlerLot(lot.id, part ? qty : undefined)
  reportCargo(done)
  void done.then((result) => {
    if (!result.ok) return
    const back: CargoLot = part ? { ...lot, qty, units: qty * perUnitCost(lot) } : lot
    undoToast(
      part
        ? buildSheetCopy('unstowedCount', { count: qty, name: lot.name })
        : buildSheetCopy('unstowedName', { name: lot.name }),
      () => reportCargo(cargo.addCrawlerLot(back)),
      crawlerId,
      { stack: true }
    )
  })
}

/** The Scrap board's caption: a caps label over its six cells. */
const POOL_HEAD = capsLabel()
const POOL_HEAD_STYLE = {
  margin: 0,
  padding: `${space[8]} ${space[8]} 0`,
  backgroundColor: color.paper,
} satisfies CSSProperties

const STORED_COLUMNS: readonly LedgerColumn[] = [
  { key: 'tl', label: buildSheetCopy('tl'), title: buildSheetCopy('techLevel') },
  { key: 'units', label: buildSheetCopy('units'), phone: true },
]

export function StorageBay({
  crawler,
  mech,
  cargo,
  store,
  edit,
}: {
  crawler: Crawler
  /** The docked mech: a lot's Load target. */
  mech: Mech | null
  cargo: UseCargoResult
  store: UnitsStore
  edit: boolean
}) {
  const storeState = store()
  const [adjusting, setAdjusting] = useState(false)
  const [unstowing, setUnstowing] = useState<CargoLot | null>(null)
  const stepping = edit && adjusting
  const pool = crawler.scrapPool ?? {}
  const lots = cargo.state.depotLots

  /** Write the freshest pool with one bucket moved to `next` (floored at 0). */
  function setPool(next: (current: NonNullable<Crawler['scrapPool']>) => Crawler['scrapPool']) {
    const fresh = storeState.get('crawler', crawler.id) ?? crawler
    runWrite(() =>
      storeState.update(
        'crawler',
        crawler.id,
        { scrapPool: next(fresh.scrapPool ?? {}) },
        LIVE_SHEET_MANUAL
      )
    )
  }
  const setScrap = (level: number, value: number) =>
    setPool((current) => addToScrapPool(current, level, value - scrapPoolBucket(current, level)))
  const setExotic = (key: ExoticKey, value: number) =>
    setPool((current) => addToExotic(current, key, value - exoticBucket(current, key)))

  return (
    <DashGroup
      title={buildSheetCopy('storageBay')}
      tally={buildSheetCopy('unlimited')}
      actions={
        edit ? (
          <Button size="compact" onClick={() => setAdjusting((value) => !value)}>
            {adjusting ? buildSheetCopy('done') : buildSheetCopy('adjust')}
          </Button>
        ) : undefined
      }
    >
      <div data-storage-side="crawler">
        {/* The board by its name, as the wizard asked for it (r8 D2, SB8-18). */}
        <p className={POOL_HEAD} style={POOL_HEAD_STYLE}>
          {buildSheetCopy('scrapPool')}
        </p>
        <Facts
          className={stepping ? 'su-scrap su-scrap--stepping' : 'su-scrap'}
          itemClassName="su-scrap__cell"
          label={buildSheetCopy('scrapPool')}
          facts={NUMERIC_TECH_LEVELS.map((level) => {
            const count = scrapPoolBucket(pool, level)
            return {
              key: String(level),
              label: <TechLevel level={level} />,
              value: stepping ? (
                <Stat
                  label={buildSheetCopy('t', { t: level })}
                  value={count}
                  min={0}
                  mode="edit"
                  typeable
                  stepperLabel={buildSheetCopy('tlScrap', { t: level })}
                  onChange={(next) => setScrap(level, next)}
                />
              ) : (
                count
              ),
              empty: count === 0,
              style: { '--tl': `var(--color-tl-${level})` } as CSSVarStyle,
            }
          })}
        />
        {(stepping || hasExotic(pool)) && (
          <Facts
            facts={EXOTIC_RESOURCES.map((resource) => ({
              key: resource.key,
              label: EXOTIC_NAME[resource.key],
              value: stepping ? (
                <Stat
                  label={EXOTIC_NAME[resource.key]}
                  value={exoticBucket(pool, resource.key)}
                  min={0}
                  mode="edit"
                  typeable
                  onChange={(next) => setExotic(resource.key, next)}
                />
              ) : (
                exoticBucket(pool, resource.key)
              ),
            }))}
          />
        )}
        <Ledger
          open
          as="h3"
          title={buildSheetCopy('stored')}
          columns={STORED_COLUMNS}
          groups={[
            {
              key: 'lots',
              rows: lots.map((lot) => ({
                id: lot.id,
                name: lot.name,
                meta: lot.cat === 'SCRAP' ? undefined : <CargoCatTag cat={lot.cat} />,
                controls: edit ? (
                  <CargoLotControls
                    lot={lot}
                    side="crawler"
                    cargo={cargo}
                    linked={mech !== null}
                    onRemove={() => setUnstowing(lot)}
                  />
                ) : undefined,
                cells: [
                  lot.tl !== undefined ? <TechLevel key="tl" level={lot.tl} /> : '',
                  lot.units,
                ],
              })),
            },
          ]}
          empty={buildSheetCopy('nothingStored')}
          className="su-open--sub"
        />
        {unstowing !== null && (
          <Suspense fallback={null}>
            <UnstowDialog
              lot={unstowing}
              mechName={mech?.name ?? null}
              fits={mech === null ? 0 : loadableQty(unstowing, cargo.usage.free)}
              onClose={() => setUnstowing(null)}
              onUnstow={(qty, to) => {
                const lot = unstowing
                setUnstowing(null)
                unstow(cargo, crawler.id, lot, qty, to)
              }}
            />
          </Suspense>
        )}
        {edit && (
          <HoldAdder
            verb="Stow"
            containerLabel={buildSheetCopy('storageBay')}
            onAdd={(lot) => reportCargo(cargo.addCrawlerLot(lot))}
          />
        )}
      </div>
    </DashGroup>
  )
}
