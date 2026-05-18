import { useMemo } from 'react'
import type { DisplayCardTab } from 'suref-react'
import { PilotDowntimeTab } from '../PilotDowntimeTab'
import { PilotMechTab } from '../PilotMechTab'
import { ActionsSection } from '../ActionsSection'
import { ComradesSection } from '../ComradesSection'
import { PilotCrawlerTab } from '../PilotCrawlerTab'
import { CombatGuidesPanel } from '../CombatGuidesPanel'
import { IsolatedStatValue } from '../../shared/IsolatedStatValue'
import { PilotAbilityTrees } from './PilotAbilityTrees'
import type { ComradeEntry } from '../../../lib/comradeUtils'
import type { PilotEditConfig } from '../../../hooks/usePilotSheet'
import type {
  PilotRow,
  MechRow,
  CrawlerRow,
  EntityRefRow,
  DowntimeRecordRow,
} from '../../../types/common'
import type { SURefChassis, SURefClass } from 'salvageunion-reference'

type UsePilotSheetTabsInput = {
  pilot: PilotRow
  pilotClass: SURefClass | undefined
  pilotRefs: EntityRefRow[]
  mech: MechRow | null | undefined
  mechRefs: EntityRefRow[] | undefined
  mechChassis: SURefChassis | undefined
  comrades: ComradeEntry[]
  crawler: CrawlerRow | null | undefined
  activeDowntime: DowntimeRecordRow | null | undefined
  compact: boolean
  canEdit: boolean
  isBoarded: boolean
  editConfig: PilotEditConfig | undefined
  onOpenPush: () => void
}

export function usePilotSheetTabs(input: UsePilotSheetTabsInput): DisplayCardTab[] {
  const {
    pilot,
    pilotClass,
    pilotRefs,
    mech,
    mechRefs,
    mechChassis,
    comrades,
    crawler,
    activeDowntime,
    compact,
    canEdit,
    isBoarded,
    editConfig,
    onOpenPush,
  } = input

  return useMemo(() => {
    const result: DisplayCardTab[] = []

    if (pilot.in_downtime) {
      result.push({
        key: 'downtime',
        label: 'Downtime',
        before: true,
        activeColor: 'rgb(206, 88, 152)',
        borderColor: 'rgb(206, 88, 152)',
        glowColor: 'rgba(206, 88, 152, 0.5)',
        content: (
          <div className={compact ? 'p-3' : 'p-4'}>
            <PilotDowntimeTab
              mechId={mech?.id}
              crawlerId={pilot.crawler_id ?? undefined}
              crawler={crawler}
              activeDowntime={activeDowntime}
            />
          </div>
        ),
      })
    }

    result.push({
      key: 'abilities',
      label: 'Abilities',
      activeColor: 'rgb(239, 137, 79)',
      content: pilotClass ? (
        <div className={compact ? 'p-3' : 'p-4'}>
          <IsolatedStatValue
            stats={[{ key: 'tp', label: 'TP', value: pilot.tp }]}
            className="mb-1.5 ml-auto"
          />
          <PilotAbilityTrees pilotClass={pilotClass} pilotRefs={pilotRefs} />
        </div>
      ) : null,
    })

    result.push({
      key: 'mech',
      label: mech?.active === false ? 'Mech (Offline)' : 'Mech',
      activeColor: 'rgb(122, 151, 138)',
      content: (
        <PilotMechTab
          pilot={pilot}
          mech={mech}
          mechRefs={mechRefs ?? []}
          canEdit={canEdit}
          compact
        />
      ),
    })

    if (comrades.length > 0) {
      result.push({
        key: 'comrades',
        label: 'Comrades',
        activeColor: 'rgb(140, 75, 56)',
        content: (
          <div className={compact ? 'p-3' : 'p-4'}>
            <ComradesSection
              comrades={comrades}
              mechRefs={mechRefs ?? []}
              mechId={mech?.id}
              userId={editConfig?.userId}
              readOnly={!canEdit}
              onConditionChange={
                editConfig
                  ? (refId, condition) => editConfig.onUpdateMechEntityRef(refId, { condition })
                  : undefined
              }
              headerBgColor="color-mix(in srgb, rgb(239, 137, 79) 35%, white)"
            />
          </div>
        ),
      })
    }

    result.push({
      key: 'actions',
      label: 'Actions',
      activeColor: 'rgb(239, 137, 79)',
      content: (
        <div className={compact ? 'p-3' : 'p-4'}>
          <ActionsSection
            pilotRefs={pilotRefs}
            pilot={pilot}
            compact={compact}
            readOnly={!canEdit}
            userId={editConfig?.userId}
            onUpdatePilot={editConfig?.onPilotUpdate ?? (() => {})}
            onUpdateEntityRef={editConfig?.onUpdateEntityRef ?? (() => {})}
            mechRefs={mechRefs}
            mech={mech}
            mechChassis={mechChassis}
            comrades={comrades}
            onUpdateMech={editConfig?.onUpdateMech}
            onUpdateMechEntityRef={editConfig?.onUpdateMechEntityRef}
            onUseAction={editConfig?.onUseAction}
          />
        </div>
      ),
    })

    if (isBoarded && mech) {
      result.push({
        key: 'procedures',
        label: 'Procedures',
        activeColor: 'rgb(122, 151, 138)',
        borderColor: 'rgb(122, 151, 138)',
        glowColor: 'rgba(122, 151, 138, 0.5)',
        content: (
          <div className={compact ? 'p-3' : 'p-4'}>
            <CombatGuidesPanel
              pilot={pilot}
              mech={mech}
              mechRefs={mechRefs ?? []}
              userId={editConfig?.userId}
              onPush={editConfig ? onOpenPush : undefined}
            />
          </div>
        ),
      })
    }

    result.push({
      key: 'crawler',
      label: 'Crawler',
      activeColor: 'rgb(206, 88, 152)',
      content: (
        <div className={compact ? 'p-3' : 'p-4'}>
          <PilotCrawlerTab crawlerId={pilot.crawler_id} />
        </div>
      ),
    })

    return result
  }, [
    pilotClass,
    pilotRefs,
    compact,
    pilot,
    mech,
    mechRefs,
    mechChassis,
    canEdit,
    comrades,
    editConfig,
    activeDowntime,
    crawler,
    isBoarded,
    onOpenPush,
  ])
}
