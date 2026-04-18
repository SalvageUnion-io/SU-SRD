import { useState } from 'react'
import { Text, ValueDisplay } from 'suref-react'
import { ChassisBadge } from '../ChassisBadge'
import { IsolatedStatValue } from '../../shared/IsolatedStatValue'
import { buildBadgeTextClass, buildChassisBadgeProps } from '../pilotDisplayUtils'
import type { PilotEditConfig } from '../../../hooks/usePilotSheet'
import type { PilotRow, MechRow, CrawlerRow } from '../../../types/common'

type PilotSheetHeaderProps = {
  pilot: PilotRow
  compact: boolean
  isBoarded: boolean
  isDowntime: boolean
  mech?: MechRow | null
  crawler?: CrawlerRow | null
  chassisName: string | undefined
  patternName: string | undefined
  pilotClassName: string
  abilityCount: number | undefined
  canEdit: boolean
  editConfig: PilotEditConfig | undefined
}

export function PilotSheetHeader({
  pilot,
  compact,
  isBoarded,
  isDowntime,
  mech,
  crawler,
  chassisName,
  patternName,
  pilotClassName,
  abilityCount,
  canEdit,
  editConfig,
}: PilotSheetHeaderProps) {
  const [crawlerNameDraft, setCrawlerNameDraft] = useState<string | null>(null)

  const badgeTextClass = buildBadgeTextClass(compact)
  const chassisBadgeProps = buildChassisBadgeProps(chassisName, patternName, compact)

  const titleText = isBoarded
    ? `\u201C${mech?.pattern_name || chassisName || 'Mech'}\u201D`
    : pilot.callsign

  const pilotBeforeStats =
    isBoarded && mech && editConfig ? (
      <IsolatedStatValue
        stats={[
          {
            key: 'hp',
            label: 'HP',
            value: pilot.hp,
            outOfMax: pilot.max_hp,
            canEdit,
            onChange: (v) => editConfig.onStatChange('hp', v),
          },
          { key: 'ap', label: 'AP', value: pilot.ap, outOfMax: pilot.max_ap },
        ]}
      />
    ) : undefined

  return (
    <>
      <div className="flex min-w-0 flex-col justify-center gap-0.5">
        {isDowntime && crawler && editConfig ? (
          <input
            type="text"
            value={crawlerNameDraft ?? crawler.name ?? ''}
            onChange={(e) => setCrawlerNameDraft(e.target.value)}
            onBlur={() => {
              if (crawlerNameDraft !== null && crawlerNameDraft !== crawler.name) {
                editConfig.onUpdateCrawler({ name: crawlerNameDraft })
              }
              setCrawlerNameDraft(null)
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
            }}
            placeholder="Name your crawler"
            className="bg-transparent font-mono text-xl font-bold uppercase text-su-white outline-none border-b border-su-white/50 placeholder:text-su-white/30"
          />
        ) : (
          <Text variant="pseudoheader" as="span" className={compact ? 'text-xl' : 'text-[1.75rem]'}>
            {titleText}
          </Text>
        )}
        <div className="flex flex-wrap items-center gap-1">
          {isBoarded ? (
            <>
              {chassisName && (
                <ValueDisplay label="Chassis" value={chassisName} compact={compact} />
              )}
              <span className="inline-flex shrink-0 cursor-default whitespace-nowrap border border-su-black">
                <Text
                  variant="pseudoheader"
                  as="span"
                  className={badgeTextClass}
                  style={{ backgroundColor: 'var(--color-su-orange)' }}
                >
                  {pilotClassName}
                </Text>
                <Text variant="pseudoheaderInverse" as="span" className={badgeTextClass}>
                  {`\u201C${pilot.callsign}\u201D`}
                </Text>
              </span>
            </>
          ) : isDowntime ? (
            <span className="inline-flex shrink-0 cursor-default whitespace-nowrap border border-su-black">
              <Text
                variant="pseudoheader"
                as="span"
                className={badgeTextClass}
                style={{ backgroundColor: 'var(--color-su-pink)' }}
              >
                {pilotClassName}
              </Text>
              <Text variant="pseudoheaderInverse" as="span" className={badgeTextClass}>
                {`\u201C${pilot.callsign}\u201D`}
              </Text>
            </span>
          ) : (
            <>
              <ValueDisplay label="The" value={pilotClassName} compact={compact} />
              {compact && abilityCount !== undefined && (
                <ValueDisplay label="Abilities" value={abilityCount} compact={compact} />
              )}
              {chassisBadgeProps && <ChassisBadge {...chassisBadgeProps} />}
            </>
          )}
        </div>
      </div>
      {pilotBeforeStats}
    </>
  )
}
