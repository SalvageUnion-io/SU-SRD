import type { Story } from '@ladle/react'
import { ReferenceEntityDisplayTooltip } from './ReferenceEntityDisplayTooltip'
import { SalvageUnionReference } from 'salvageunion-reference'
import { Text } from '../base/Text'
import { StatDisplay } from '../shared/StatDisplay'

// biome-ignore lint/style/useComponentExportOnlyModules: Ladle stories require a default meta export alongside story components
export default {
  title: 'Reference Entity/ReferenceEntityDisplayTooltip',
}

const system = SalvageUnionReference.Systems.all()[0]
const trait = SalvageUnionReference.Traits.all()[0]

export const Default: Story = () => (
  <div className="p-8">
    <ReferenceEntityDisplayTooltip schemaName="systems" entityId={system?.id ?? ''}>
      <Text variant="pseudoheader" className="cursor-help">
        Hover to see {system?.name}
      </Text>
    </ReferenceEntityDisplayTooltip>
  </div>
)

export const WithValueDisplay: Story = () => (
  <div className="p-8">
    <ReferenceEntityDisplayTooltip schemaName="systems" entityId={system?.id ?? ''}>
      <StatDisplay orientation="horizontal" label={system?.name ?? 'System'} value="TL 2" />
    </ReferenceEntityDisplayTooltip>
  </div>
)

export const TraitTooltip: Story = () => (
  <div className="flex gap-4 p-8">
    <ReferenceEntityDisplayTooltip schemaName="traits" entityId={trait?.id ?? ''}>
      <StatDisplay orientation="horizontal" label={trait?.name ?? 'Trait'} />
    </ReferenceEntityDisplayTooltip>
  </div>
)
