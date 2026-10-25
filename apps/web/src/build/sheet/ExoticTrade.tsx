/**
 * ExoticTrade — the Trading Bay dialog's section (`CrawlerEconomyControl`)
 * that trades the expansion resources for Scrap (`tradeExotic`). Its writes
 * are `LIVE_SHEET_TXN`, the crawler Trade on the closed Live-Sheet list
 * (`docs/ARCHITECTURE.md#live-sheet`).
 */

import type { Crawler } from 'game-domain/schemas/crawler'
import type { CSSProperties } from 'react'
import { useState } from 'react'
import { Button, Eyebrow, Select, Slab, Stat, tokens } from '../../components/index'
import type { ExoticKey } from '../../lib/rules/exoticSalvage'
import { EXOTIC_RESOURCES, exoticBucket, tradeExotic } from '../../lib/rules/exoticSalvage'
import { buildSheetCopy } from '../../messages/build-sheet'
import type { useEntityStore } from '../../stores/entityStore'
import { LIVE_SHEET_TXN } from '../../stores/surfaceProvenance'
import { EXOTIC_NAME } from './exoticNames.model'
import { freshEntity } from './freshEntity.model'

const TEXT = {
  fontFamily: tokens.font.body,
  fontSize: tokens.fontSize.sm,
  lineHeight: 1.25 / 0.875,
  color: tokens.color.ink,
} satisfies CSSProperties
const TEXT_TIGHT = { ...TEXT, margin: 0 } satisfies CSSProperties
const TEXT_AFTER = { ...TEXT, marginTop: tokens.space[8] } satisfies CSSProperties
const PICKERS = {
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'flex-end',
  gap: tokens.space[12],
} satisfies CSSProperties
const PICKER_LABEL = {
  display: 'flex',
  flexDirection: 'column',
  gap: tokens.space[4],
} satisfies CSSProperties
const PICKER = { padding: `${tokens.space[6]} ${tokens.space[8]}` } satisfies CSSProperties
const QTY = { display: 'inline-flex', paddingBottom: tokens.space[4] } satisfies CSSProperties
const ACTION_ROW = {
  marginTop: tokens.space[8],
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  gap: tokens.space[12],
} satisfies CSSProperties

/**
 * Trade Bio-Salvage, Chimerium or Meld Nanites for Scrap: each piece is one
 * Scrap of its trade Tech Level, Tech 1 or Tech 6 (Core Book p.275, p.288; We
 * Were Here First! p.9; False Flag p.66). Shown only while the pool holds any.
 */
export function ExoticTrade({
  crawler,
  store,
}: {
  crawler: Crawler
  store: typeof useEntityStore
}) {
  const storeState = store()
  const pool = crawler.scrapPool ?? {}
  const held = EXOTIC_RESOURCES.filter((r) => exoticBucket(pool, r.key) > 0)
  const [picked, setPicked] = useState<ExoticKey | null>(null)
  const [count, setCount] = useState(1)
  const [note, setNote] = useState<string | null>(null)
  const resource = held.find((r) => r.key === picked) ?? held[0]
  if (!resource)
    return note ? (
      <p role="status" style={TEXT_AFTER}>
        {note}
      </p>
    ) : null
  const bucket = exoticBucket(pool, resource.key)

  async function handleTrade() {
    if (!resource) return
    const fresh = freshEntity(storeState, 'crawler', crawler)
    const result = tradeExotic(fresh.scrapPool ?? {}, resource.key, count)
    if (!result) {
      setNote(buildSheetCopy('thePoolNoLongerCovers'))
      return
    }
    await storeState.update('crawler', crawler.id, { scrapPool: result.pool }, LIVE_SHEET_TXN)
    setNote(
      buildSheetCopy('tradedExotic', {
        count,
        name: EXOTIC_NAME[resource.key],
        scrap: result.scrap,
        tl: result.tl,
      })
    )
    setCount(1)
  }

  return (
    <div>
      <Slab
        label={buildSheetCopy('tradeBioAndNanites')}
        count={buildSheetCopy('eachPieceIsOneScrap')}
      />
      <div style={PICKERS}>
        <Eyebrow as="label" tone="ink" htmlFor="trade-exotic" style={PICKER_LABEL}>
          {buildSheetCopy('resource')}
          <Select
            id="trade-exotic"
            style={PICKER}
            value={resource.key}
            onChange={(e) => {
              setPicked(e.target.value as ExoticKey)
              setCount(1)
            }}
          >
            {held.map((r) => (
              <option key={r.key} value={r.key}>
                {buildSheetCopy('exoticInPool', {
                  name: EXOTIC_NAME[r.key],
                  count: exoticBucket(pool, r.key),
                })}
              </option>
            ))}
          </Select>
        </Eyebrow>
        <span style={QTY}>
          <Stat
            size="compact"
            label={buildSheetCopy('qty')}
            value={count}
            min={1}
            max={bucket}
            mode="edit"
            stepperLabel={buildSheetCopy('exoticTradeAmount')}
            onChange={setCount}
          />
        </span>
      </div>
      <div style={ACTION_ROW}>
        <p style={TEXT_TIGHT} data-testid="exotic-trade-preview">
          {buildSheetCopy('exoticPreview', {
            count,
            name: EXOTIC_NAME[resource.key],
            scrap: count,
            tl: resource.tradeTl,
          })}
        </p>
        <Button
          size="compact"
          variant="primary"
          disabled={count < 1 || count > bucket}
          onClick={() => {
            void handleTrade()
          }}
        >
          {buildSheetCopy('trade')}
        </Button>
      </div>
      {note && (
        <p role="status" style={TEXT_AFTER}>
          {note}
        </p>
      )}
    </div>
  )
}
