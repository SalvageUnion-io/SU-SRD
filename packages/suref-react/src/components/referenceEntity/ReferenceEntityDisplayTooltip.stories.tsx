import type { Story } from '@ladle/react'
import { ReferenceEntityDisplayTooltip } from './ReferenceEntityDisplayTooltip'
import { SalvageUnionReference } from 'salvageunion-reference'
import { Text } from '../base/Text'
import { StatDisplay } from '../shared/StatDisplay'

// biome-ignore lint/style/useComponentExportOnlyModules: Ladle stories require a default meta export alongside story components
export default {
  title: 'Compositions/Reference Entity Tooltip',
}

const system = SalvageUnionReference.Systems.all()[0]
const trait = SalvageUnionReference.Traits.all()[0]

/** Entity hovercards over different triggers — pseudoheader, a stat, a trait. */
export const Variants: Story = () => (
  <div className="flex flex-col gap-6 bg-paper p-8 text-ink">
    <p className="max-w-2xl font-mono text-xs leading-relaxed text-ink-2">
      Wrap any trigger to summon a dense entity hovercard (schemaName + entityId). Hover each below.
    </p>
    <div className="flex flex-wrap items-start gap-8">
      <ReferenceEntityDisplayTooltip schemaName="systems" entityId={system?.id ?? ''}>
        <Text variant="pseudoheader" className="cursor-help">
          Hover {system?.name}
        </Text>
      </ReferenceEntityDisplayTooltip>
      <ReferenceEntityDisplayTooltip schemaName="systems" entityId={system?.id ?? ''}>
        <StatDisplay orientation="horizontal" label={system?.name ?? 'System'} value="TL 2" />
      </ReferenceEntityDisplayTooltip>
      <ReferenceEntityDisplayTooltip schemaName="traits" entityId={trait?.id ?? ''}>
        <StatDisplay orientation="horizontal" label={trait?.name ?? 'Trait'} />
      </ReferenceEntityDisplayTooltip>
    </div>
  </div>
)
