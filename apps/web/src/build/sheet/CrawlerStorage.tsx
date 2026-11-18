/**
 * CrawlerStorage — what a crawler's Storage Bay holds, on its Live Sheet: the
 * Scrap Pool, the crawler's abstract Tech-Level-bucketed scrap store (the
 * bucket a bay repair spends), the expansion resources beside it, and the
 * Crawler Hold (`StorageManifest side="crawler"`), each a section under its
 * Mini Slab (N5). Rendered INSIDE the Storage Bay's card on the sheet's
 * sidebar, and as a phone's Storage tab.
 *
 * Edit reads the pool as six counts until Adjust opens their steppers, so the
 * bay is not eighteen controls at rest; each step is a Free Edit of the pool
 * (ADR-021). Read leaves what is empty out (`storageShows`).
 */

import type { Crawler } from 'game-domain/schemas/crawler'
import type { Mech } from 'game-domain/schemas/mech'
import type { CSSProperties } from 'react'
import { useState } from 'react'
import { NUMERIC_TECH_LEVELS } from 'salvageunion-reference/rules'
import { Button, SlabSection, Stack, Stat, tokens } from '../../components/index'
import { addToScrapPool, scrapPoolBucket } from '../../lib/cargo/cargoTransfer'
import type { useCargo } from '../../lib/cargo/useCargo'
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
import type { UnitsState } from '../../replica/units'
import { storageShows } from './crawlerStorage.model'
import { EXOTIC_NAME } from './exoticNames.model'
import { StorageManifest } from './StorageManifest'

/** A column that may shrink below its content inside the region grids. */
const SHRINK = { minWidth: 0 } satisfies CSSProperties

const POOL_ROW = { display: 'flex', flexWrap: 'wrap', gap: tokens.space[8] } satisfies CSSProperties

export function CrawlerStorage({
  crawler,
  mech,
  mechHref,
  cargo,
  storeState,
  readOnly,
}: {
  crawler: Crawler
  /** The docked mech: the Hold's Load target. */
  mech: Mech | null
  mechHref?: string | undefined
  cargo: ReturnType<typeof useCargo>
  storeState: UnitsState
  readOnly: boolean
}) {
  const pool = crawler.scrapPool ?? {}
  const [adjustPool, setAdjustPool] = useState(false)
  const poolEditing = !readOnly && adjustPool
  const showExotic = poolEditing || hasExotic(pool)
  const shows = storageShows(crawler, readOnly)

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

  if (!shows.pool && !shows.hold) return null
  return (
    <Stack gap={16} style={SHRINK}>
      {/* Scrap Pool — the crawler's abstract TL-bucketed scrap store (the
          bucket bay-repair spends), a section of the bay under its Slab, as
          the Crawler Hold below it is (N5), both at the Mini Size of the
          bay's other sections. Per-tech-level `Stat` steppers let
          a crawler stow arbitrary scrap by hand (Free Edit). The
          physical-scrap-cargo path lives in the Hold add-form's Scrap kind. */}
      {shows.pool && (
        <SlabSection
          title={buildSheetCopy('scrapPool')}
          size="mini"
          bodyStyle={POOL_ROW}
          actions={
            readOnly ? undefined : (
              <Button size="mini" onClick={() => setAdjustPool((v) => !v)}>
                {adjustPool ? buildSheetCopy('done') : buildSheetCopy('adjust')}
              </Button>
            )
          }
        >
          {NUMERIC_TECH_LEVELS.map((t) => (
            <Stat
              key={t}
              label={buildSheetCopy('t', { t })}
              value={scrapPoolBucket(pool, t)}
              min={0}
              size={poolEditing ? undefined : 'mini'}
              mode={poolEditing ? 'edit' : 'read'}
              onChange={poolEditing ? (next) => setScrapBucket(t, next) : undefined}
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
              mode={poolEditing ? 'edit' : 'read'}
              onChange={poolEditing ? (next) => setExotic(r.key, next) : undefined}
            />
          ))}
        </SlabSection>
      )}
      {shows.hold && (
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
}
