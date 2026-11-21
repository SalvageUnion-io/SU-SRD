/**
 * The Storage Bay on a crawler's dashboard, as one deliberate object:
 * "Unlimited" on its head, Scrap as a six-cell board (a Tech Level chip over
 * its count) with the expansion resources beside it, then what is stored, a
 * row a lot.
 *
 * Edit adds its controls in place: Adjust turns the board's counts into
 * steppers (so the bay is not eighteen controls at rest; each step a Free
 * Edit of the pool, ADR-021), each lot's Load onto the docked mech and its
 * Unstow, and the Stow intake under the rows.
 */

import type { Crawler } from 'game-domain/schemas/crawler'
import type { Mech } from 'game-domain/schemas/mech'
import { useState } from 'react'
import { NUMERIC_TECH_LEVELS } from 'salvageunion-reference/rules'
import type { CSSVarStyle, OpenColumn } from '../../components/index'
import { Button, Facts, OpenLedger, Stat, TechLevel } from '../../components/index'
import { addToScrapPool, scrapPoolBucket } from '../../lib/cargo/cargoTransfer'
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
import { CargoLotControls } from '../sheet/CargoLotItem'
import { EXOTIC_NAME } from '../sheet/exoticNames.model'
import { HoldAdder } from '../sheet/HoldAdder'
import { DashGroup } from './Dash'

const STORED_COLUMNS: readonly OpenColumn[] = [
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
        <Facts
          className="su-scrap"
          itemClassName="su-scrap__cell"
          label={buildSheetCopy('scrapByTechLevel')}
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
                  onChange={(next) => setExotic(resource.key, next)}
                />
              ) : (
                exoticBucket(pool, resource.key)
              ),
            }))}
          />
        )}
        <OpenLedger
          as="h3"
          title={buildSheetCopy('stored')}
          columns={STORED_COLUMNS}
          groups={[
            {
              key: 'lots',
              rows: lots.map((lot) => ({
                id: lot.id,
                name: lot.name,
                meta: lot.cat === 'SCRAP' ? undefined : lot.cat,
                controls: edit ? (
                  <CargoLotControls
                    lot={lot}
                    side="crawler"
                    cargo={cargo}
                    linked={mech !== null}
                    onRemove={() => reportCargo(cargo.removeCrawlerLot(lot.id))}
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
