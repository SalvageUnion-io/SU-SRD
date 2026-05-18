import type { MapTier } from './mapTypes'
import { MOVEMENT_RULES, TIER_LABELS } from './mapConstants'

type MapLegendProps = {
  tier: MapTier
}

export function MapLegend({ tier }: MapLegendProps) {
  const rules = MOVEMENT_RULES[tier]

  return (
    <div className="flex flex-col gap-1 rounded border border-su-grey-light/20 bg-su-grey-dark/80 px-3 py-2 font-mono text-xs text-su-white/70">
      <span className="font-semibold uppercase text-su-white/90">{TIER_LABELS[tier]}</span>
      <span>
        Crawler: <span className="text-su-orange">{rules.crawler}</span>
      </span>
      <span>
        Pilot: <span className="text-su-green">{rules.pilot}</span>
      </span>
      <span>
        Mech: <span className="text-su-pink">{rules.mech}</span>
      </span>
    </div>
  )
}
