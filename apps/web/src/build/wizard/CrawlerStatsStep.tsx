import { crawlerTechLevelSlug } from 'game-domain/crawlerLevel'
import type { CSSProperties } from 'react'
import type { RefCrawler, RefMetaCrawlerTechLevel } from 'salvageunion-reference'
import { getEntitySlug } from 'salvageunion-reference'
import { crawlerMaxSPParts } from 'salvageunion-reference/rules'
import { Pending, Stat, tokens } from '../../components/index'
import '../../styles/build/wizard.css'
import { buildWizardCopy } from '../../messages/build-wizard'
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
    return <Pending label={buildWizardCopy('techLevel1Statistics')} />
  }

  const sp = crawlerMaxSPParts({
    techLevel: crawlerTechLevelSlug(techLevel.techLevel),
    type: selectedType ? getEntitySlug(selectedType) : undefined,
  })

  return (
    <div className="su-wiz-stack su-wiz-stack--20" style={fullWidthStyle}>
      <div style={statRowStyle}>
        <Stat label={buildWizardCopy('tl3')} value={techLevel.techLevel} />
        <Stat label={buildWizardCopy('sp')} value={sp.total} max={sp.total} />
        <Stat label={buildWizardCopy('upkeep')} value={techLevel.upkeepCost ?? 0} />
        <Stat label={buildWizardCopy('upg')} value={techLevel.upgradeCost ?? 0} />
        <Stat label={buildWizardCopy('pool')} value={0} />
      </div>

      <div className="su-wiz-stack su-wiz-stack--6" style={proseStyle}>
        {sp.typeBonus > 0 && selectedType ? (
          <p style={paragraphStyle} data-testid="sp-breakdown">
            {sp.base} + {sp.typeBonus} type bonus ({selectedType.name}) ={' '}
            <strong>{sp.total}</strong> Structure Points — the bonus derives from your Crawler type,
            so it follows a type change automatically.
          </p>
        ) : (
          <p style={paragraphStyle} data-testid="sp-breakdown">
            <strong>{sp.total}</strong> Structure Points — the {techLevel.name} base.
          </p>
        )}
        <p style={paragraphStyle}>
          A new Crawler is a <strong>{techLevel.name}</strong>
          {typeof techLevel.populationMin === 'number' &&
          typeof techLevel.populationMax === 'number'
            ? buildWizardCopy('population', {
                populationMin: techLevel.populationMin,
                populationMax: techLevel.populationMax,
              })
            : ''}
          . The Upgrade Pool starts at 0 and fills during play; every Bay starts{' '}
          <strong>{buildWizardCopy('intact')}</strong>.
        </p>
      </div>
    </div>
  )
}
