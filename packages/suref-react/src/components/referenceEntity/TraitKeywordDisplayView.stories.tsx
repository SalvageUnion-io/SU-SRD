import type { Story } from '@ladle/react'
import { TraitKeywordDisplayView } from './TraitKeywordDisplayView'

// biome-ignore lint/style/useComponentExportOnlyModules: Ladle stories require a default meta export alongside story components
export default {
  title: 'Reference Entity/TraitKeywordDisplayView',
}

export const Trait: Story = () => (
  <div className="flex gap-3">
    <TraitKeywordDisplayView label="Blast" schemaName="traits" />
    <TraitKeywordDisplayView label="Melee" schemaName="traits" />
    <TraitKeywordDisplayView label="Range" value={2} schemaName="traits" />
  </div>
)

export const Keyword: Story = () => (
  <div className="flex gap-3">
    <TraitKeywordDisplayView label="Salvage" schemaName="keywords" />
    <TraitKeywordDisplayView label="Heavy" schemaName="keywords" />
  </div>
)

export const Compact: Story = () => (
  <div className="flex gap-2">
    <TraitKeywordDisplayView label="Blast" schemaName="traits" compact />
    <TraitKeywordDisplayView label="Range" value={2} schemaName="traits" compact />
  </div>
)

export const Inline: Story = () => (
  <div>
    This weapon has <TraitKeywordDisplayView label="Blast" schemaName="traits" inline /> and{' '}
    <TraitKeywordDisplayView label="Range" value={3} schemaName="traits" inline /> properties.
  </div>
)
