/*
 * Ported from the CrawlerEconFrame cluster in
 * packages/component-lib/src/components/sheet/SheetPresentation.stories.tsx.
 * It ships from `./CrawlerEcon` and has no story file of its own.
 */
import { CrawlerEconFrame, Stat, VitalGauge } from 'component-lib'
import type { CSSProperties } from 'react'
import { Caption } from '../preview-lib/harness'

const CRAWLER_TONE = {
  '--tone': 'var(--color-crawler)',
  '--tone-deep': 'var(--color-sheet-crawler-deep)',
} as CSSProperties

/**
 * The crawler economy lozenges — the SP gauge alongside the things that accrue
 * against a cap (upkeep, cargo).
 */
export function Economy() {
  return (
    <div className="sheet--crawler flex flex-col gap-4 bg-paper p-4" style={CRAWLER_TONE}>
      <Caption>SP gauge plus the economy lozenges</Caption>
      <CrawlerEconFrame
        gauge={<Stat label="SP" value={20} max={25} />}
        items={[
          { label: 'Upkeep', value: 12, caption: 'Scrap · Tech 2+' },
          { label: 'Cargo', value: 6, max: 10 },
        ]}
      />
    </div>
  )
}

/**
 * With the Upgrade pool — the second thing that fills toward a cap, which is
 * what the `upgrade` slot exists for.
 */
export function WithUpgradePool() {
  return (
    <div className="sheet--crawler flex flex-col gap-4 bg-paper p-4" style={CRAWLER_TONE}>
      <Caption>SP and the Upgrade pool side by side</Caption>
      <CrawlerEconFrame
        gauge={<VitalGauge label="SP" value={20} max={25} readOnly />}
        upgrade={<VitalGauge label="Upgrade" value={3} max={10} readOnly />}
        items={[
          { label: 'Upkeep', value: 12, caption: 'Scrap · Tech 2+' },
          { label: 'Cargo', value: 6, max: 10 },
          { label: 'Scrap', value: 48 },
        ]}
      />
    </div>
  )
}
