import type { Story } from '@ladle/react'
import { SalvageUnionReference } from 'salvageunion-reference'
import { Badge } from '../chrome/Badge'
import { Stat } from '../shared/Stat'
import { InsideTooltipContext } from '../ui/insideTooltipContext'
import { ReferenceEntityCard } from './card/ReferenceEntityCard'
import { EntityTooltip } from './EntityTooltip'

export default {
  title: 'Compositions/Entity/Entity Tooltip',
}

const system = SalvageUnionReference.Systems.all()[0]
const trait = SalvageUnionReference.Traits.all()[0]
const chassis = SalvageUnionReference.Chassis.all()[0]

/** Entity hovercards over different triggers, plus the popup body itself —
 * the §1 Tooltip context: dense, and TERMINAL. */
export const Default: Story = () => (
  <div className="flex flex-col gap-6 text-ink">
    <p className="max-w-2xl font-body text-xs leading-relaxed text-wk-muted">
      Wrap any trigger to summon an entity hovercard (schemaName + entityId). Hover each below. The
      hovercard obeys the Tooltip context law (ruleset §1): dense, and TERMINAL — no buttons, links,
      nested tooltips, or steppers, ever.
    </p>
    <div className="flex flex-wrap items-start gap-8">
      <EntityTooltip schemaName="systems" entityId={system?.id ?? ''}>
        <Badge shape="stamp" className="cursor-help">
          Hover {system?.name}
        </Badge>
      </EntityTooltip>
      <EntityTooltip schemaName="systems" entityId={system?.id ?? ''}>
        <Stat orientation="horizontal" label={system?.name ?? 'System'} value="TL 2" />
      </EntityTooltip>
      <EntityTooltip schemaName="traits" entityId={trait?.id ?? ''}>
        <Stat orientation="horizontal" label={trait?.name ?? 'Trait'} />
      </EntityTooltip>
    </div>
    <p className="max-w-2xl font-body text-xs leading-relaxed text-wk-muted">
      What the popup renders, shown statically for the catalog: the DENSE catalog-extent card inside
      the terminal context. A chassis makes the law visible — its full card would carry pattern and
      system cards, expandable listings and trait hover-refs; the hovercard suppresses all of them
      (nested elements via the catalog extent, nested tooltips via InsideTooltipContext).
    </p>
    <div className="max-w-[500px]">
      <InsideTooltipContext.Provider value={true}>
        <ReferenceEntityCard data={chassis} size="medium" extent="catalog" />
      </InsideTooltipContext.Provider>
    </div>
  </div>
)
