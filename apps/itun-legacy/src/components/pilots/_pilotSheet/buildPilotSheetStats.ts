import type { StatItem } from 'suref-react'
import { getHeatLevel, getHeatColorClass } from '../../../lib/heatUtils'
import type { PilotEditConfig } from '../../../hooks/usePilotSheet'
import type { PilotRow, MechRow, CrawlerRow } from '../../../types/common'

type BuildStatsInput = {
  pilot: PilotRow
  mech: MechRow | null | undefined
  crawler: CrawlerRow | null | undefined
  crawlerTlStats: { max_sp: number; upkeep: number; upgrade_cost: number | null } | undefined
  isBoarded: boolean
  isDowntime: boolean
  canEdit: boolean
  editConfig: PilotEditConfig | undefined
}

export function buildPilotSheetStats(input: BuildStatsInput): StatItem[] | undefined {
  const { pilot, mech, crawler, crawlerTlStats, isBoarded, isDowntime, canEdit, editConfig } = input

  if (!editConfig) return undefined

  if (isBoarded && mech) {
    return [
      {
        key: 'sp',
        label: 'SP',
        value: mech.current_sp,
        outOfMax: mech.max_sp,
        onChange: (v: number) => editConfig.onUpdateMech({ current_sp: v }),
        canEdit,
      },
      {
        key: 'ep',
        label: 'EP',
        value: mech.current_ep,
        outOfMax: mech.max_ep,
        onChange: (v: number) => editConfig.onUpdateMech({ current_ep: v }),
        canEdit,
      },
      {
        key: 'heat',
        label: 'Heat',
        value: mech.current_heat,
        outOfMax: mech.heat_capacity,
        valueColor: getHeatColorClass(getHeatLevel(mech.current_heat, mech.heat_capacity)),
        ariaLabel: `Heat: ${mech.current_heat} of ${mech.heat_capacity}`,
        onChange: (v: number) => editConfig.onUpdateMech({ current_heat: v }),
        canEdit,
      },
    ]
  }

  if (isDowntime && crawler) {
    return [
      {
        key: 'hp',
        label: 'HP',
        value: pilot.hp,
        outOfMax: pilot.max_hp,
        onChange: (v: number) => editConfig.onStatChange('hp', v),
        canEdit,
      },
      { key: 'ap', label: 'AP', value: pilot.ap, outOfMax: pilot.max_ap },
      {
        key: 'upgrade',
        label: 'Upgrade',
        bottomLabel: 'Pool',
        value: crawler.upgrade_pool,
        outOfMax: crawlerTlStats?.upgrade_cost ?? undefined,
      },
    ]
  }

  return [
    {
      key: 'hp',
      label: 'HP',
      value: pilot.hp,
      outOfMax: pilot.max_hp,
      onChange: (v: number) => editConfig.onStatChange('hp', v),
      canEdit,
    },
    { key: 'ap', label: 'AP', value: pilot.ap, outOfMax: pilot.max_ap },
  ]
}
