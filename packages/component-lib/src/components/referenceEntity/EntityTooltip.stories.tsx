import { SalvageUnionReference } from 'salvageunion-reference'
import type { Story } from '../../stories/_harness'
import { Badge } from '../chrome/Badge'
import { Stat } from '../shared/Stat'
import { EntityHovercardCard, EntityTooltip } from './EntityTooltip'
import { HOVERCARD_PLATE_FILTER } from './hovercardPlate'

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
      What the popup renders, shown statically for the catalog: the real hovercard plate
      (`EntityHovercardCard`, the small card at full extent inside the terminal context) on its
      lifted plate. A chassis makes the law visible: its pattern rows and trait refs still print,
      but nothing on the plate acts — no links, buttons, rows to open or nested hovercards — and,
      like the Dashboard, it is flat: no speckle (ruleset §3.5).
    </p>
    <div
      style={{ filter: HOVERCARD_PLATE_FILTER, maxWidth: 'min(500px, 100%)', paddingTop: '12px' }}
    >
      {chassis && <EntityHovercardCard entity={chassis} />}
    </div>
  </div>
)
