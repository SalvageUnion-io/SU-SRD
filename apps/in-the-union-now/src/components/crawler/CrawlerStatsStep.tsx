import type { SURefCrawler, SURefMetaCrawlerTechLevel } from 'salvageunion-reference'
import { crawlerMaxSPParts } from 'salvageunion-reference/rules'
import { StatBlock } from 'suref-react'

type CrawlerStatsStepProps = {
  /** The Tech Level 1 (Hamlet Crawler) entity — creation is fixed there. */
  techLevel: SURefMetaCrawlerTechLevel | undefined
  /** The chosen crawler type — its max_sp_bonus mutations surface at read. */
  selectedType: SURefCrawler | undefined
}

/**
 * Step 2 · Note your Crawler Statistics (Union Crawler p.212) — display only.
 * A new crawler is FIXED at Tech Level 1 (a Hamlet Crawler): no input exists.
 * Max SP renders through the derived-at-read arithmetic (`crawlerMaxSPParts`)
 * so a Battle crawler shows its breakdown — `20 + 5 type bonus = 25` — while
 * the RECORD stores only the bare tech-level value (wizard-refresh Phase 5).
 * The Upgrade Pool starts at 0 (no input — it accumulates in play) and every
 * bay starts Intact. Nothing to choose — Next always enabled.
 */
export function CrawlerStatsStep({ techLevel, selectedType }: CrawlerStatsStepProps) {
  if (!techLevel) {
    return (
      <p className="m-0 font-body text-sm text-current">
        Tech Level 1 statistics are loading — they appear here.
      </p>
    )
  }

  const sp = crawlerMaxSPParts({
    techLevel: `tech-${techLevel.techLevel}`,
    type: selectedType?.id,
  })

  return (
    <div className="w-full space-y-5">
      <div className="flex flex-wrap gap-4">
        <StatBlock
          code="TL"
          name="Tech Level"
          size="sm"
          value={techLevel.techLevel}
          pips={false}
          editable={false}
        />
        <StatBlock
          code="SP"
          name="Structure Pts"
          stat="sp"
          size="sm"
          value={sp.total}
          max={sp.total}
          editable={false}
        />
        <StatBlock
          code="UPKEEP"
          name="Upkeep Cost"
          size="sm"
          value={techLevel.upkeepCost ?? 0}
          pips={false}
          editable={false}
        />
        <StatBlock
          code="UPG"
          name="Upgrade Cost"
          size="sm"
          value={techLevel.upgradeCost ?? 0}
          pips={false}
          editable={false}
        />
        <StatBlock
          code="POOL"
          name="Upgrade Pool"
          size="sm"
          value={0}
          pips={false}
          editable={false}
        />
      </div>

      <div className="max-w-[64ch] space-y-1.5 font-body text-sm leading-relaxed text-current">
        {sp.typeBonus > 0 && selectedType ? (
          <p className="m-0" data-testid="sp-breakdown">
            Structure Points: {sp.base} + {sp.typeBonus} type bonus ({selectedType.name}) ={' '}
            <strong>{sp.total}</strong> — the bonus derives from your Crawler type, so it follows a
            type change automatically.
          </p>
        ) : (
          <p className="m-0" data-testid="sp-breakdown">
            Structure Points: <strong>{sp.total}</strong> — the {techLevel.name} base.
          </p>
        )}
        <p className="m-0">
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
