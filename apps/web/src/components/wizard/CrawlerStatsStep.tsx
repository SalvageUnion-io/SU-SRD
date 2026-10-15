import type { CSSProperties } from 'react'
import type { RefCrawler, RefMetaCrawlerTechLevel } from 'salvageunion-reference'
import { getEntitySlug } from 'salvageunion-reference'
import { crawlerMaxSPParts } from 'salvageunion-reference/rules'
import { EmptyState, Stat, tokens } from '../index'
import '../../styles/cantina/wizard.css'
import { fullWidthStyle } from './wizardStyles.model'

const statRowStyle = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: tokens.space[16],
} satisfies CSSProperties

const proseStyle = {
  color: 'currentcolor',
  fontFamily: tokens.font.body,
  fontSize: tokens.fontSize.sm,
  lineHeight: 1.625,
  maxWidth: '64ch',
} satisfies CSSProperties

const paragraphStyle = { margin: 0 } satisfies CSSProperties

type CrawlerStatsStepProps = {
  /** The Tech Level 1 (Hamlet Crawler) entity — creation is fixed there. */
  techLevel: RefMetaCrawlerTechLevel | undefined
  /** The chosen crawler type — its max_sp_bonus mutations surface at read. */
  selectedType: RefCrawler | undefined
}

/**
 * Step 2 · Note your Crawler Statistics (Union Crawler p.212) — display only.
 * A new crawler is FIXED at Tech Level 1 (a Hamlet Crawler): no input exists.
 * Max SP renders through the derived-at-read arithmetic (`crawlerMaxSPParts`)
 * so a Battle crawler shows its breakdown — `20 + 5 type bonus = 25` — while
 * the RECORD stores only the bare tech-level value.
 * The Upgrade Pool starts at 0 (no input — it accumulates in play) and every
 * bay starts Intact. Nothing to choose — Next always enabled.
 */
export function CrawlerStatsStep({ techLevel, selectedType }: CrawlerStatsStepProps) {
  if (!techLevel) {
    return (
      <EmptyState
        headline="Loading"
        body="Tech Level 1 statistics are loading — they appear here."
      />
    )
  }

  const sp = crawlerMaxSPParts({
    techLevel: `tech-${techLevel.techLevel}`,
    type: selectedType ? getEntitySlug(selectedType) : undefined,
  })

  return (
    <div className="su-wiz-stack su-wiz-stack--20" style={fullWidthStyle}>
      <div style={statRowStyle}>
        <Stat orientation="horizontal" label="TL" value={techLevel.techLevel} />
        <Stat orientation="horizontal" label="SP" value={sp.total} max={sp.total} />
        <Stat orientation="horizontal" label="UPKEEP" value={techLevel.upkeepCost ?? 0} />
        <Stat orientation="horizontal" label="UPG" value={techLevel.upgradeCost ?? 0} />
        <Stat orientation="horizontal" label="POOL" value={0} />
      </div>

      <div className="su-wiz-stack su-wiz-stack--6" style={proseStyle}>
        {sp.typeBonus > 0 && selectedType ? (
          <p style={paragraphStyle} data-testid="sp-breakdown">
            Structure Points: {sp.base} + {sp.typeBonus} type bonus ({selectedType.name}) ={' '}
            <strong>{sp.total}</strong> — the bonus derives from your Crawler type, so it follows a
            type change automatically.
          </p>
        ) : (
          <p style={paragraphStyle} data-testid="sp-breakdown">
            Structure Points: <strong>{sp.total}</strong> — the {techLevel.name} base.
          </p>
        )}
        <p style={paragraphStyle}>
          A new Crawler is a <strong>{techLevel.name}</strong>
          {typeof techLevel.populationMin === 'number' &&
          typeof techLevel.populationMax === 'number'
            ? ` — population ${techLevel.populationMin}–${techLevel.populationMax}`
            : ''}
          . The Upgrade Pool starts at 0 and fills during play; every Bay starts{' '}
          <strong>Intact</strong>.
        </p>
      </div>
    </div>
  )
}
