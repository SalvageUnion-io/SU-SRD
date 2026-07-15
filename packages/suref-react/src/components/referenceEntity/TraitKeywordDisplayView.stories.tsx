import type { Story } from '@ladle/react'
import { TraitKeywordDisplayView } from './TraitKeywordDisplayView'

// biome-ignore lint/style/useComponentExportOnlyModules: Ladle stories require a default meta export alongside story components
export default {
  title: 'Legacy/TraitKeywordDisplayView',
}

/** Real trait/keyword tags — traits, keywords, compact, and inline in prose. */
export const Variants: Story = () => (
  <div className="flex flex-col gap-5 bg-paper p-5 text-ink">
    <p className="max-w-2xl font-mono text-xs leading-relaxed text-ink-2">
      Trait / keyword tags (schemaName distinguishes them); a value renders beside the label;
      compact tightens; inline flows in running prose.
    </p>
    <div className="flex flex-col gap-1.5">
      <div className="flex flex-wrap gap-3">
        <TraitKeywordDisplayView label="Blast" schemaName="traits" />
        <TraitKeywordDisplayView label="Melee" schemaName="traits" />
        <TraitKeywordDisplayView label="Range" value={2} schemaName="traits" />
      </div>
      <code className="font-mono text-nano text-ink-2">traits</code>
    </div>
    <div className="flex flex-col gap-1.5">
      <div className="flex flex-wrap gap-3">
        <TraitKeywordDisplayView label="Salvage" schemaName="keywords" />
        <TraitKeywordDisplayView label="Heavy" schemaName="keywords" />
      </div>
      <code className="font-mono text-nano text-ink-2">keywords</code>
    </div>
    <div className="flex flex-col gap-1.5">
      <div className="flex flex-wrap gap-2">
        <TraitKeywordDisplayView label="Blast" schemaName="traits" compact />
        <TraitKeywordDisplayView label="Range" value={2} schemaName="traits" compact />
      </div>
      <code className="font-mono text-nano text-ink-2">compact</code>
    </div>
    <div className="flex flex-col gap-1.5">
      <div className="font-body text-sm">
        This weapon has <TraitKeywordDisplayView label="Blast" schemaName="traits" inline /> and{' '}
        <TraitKeywordDisplayView label="Range" value={3} schemaName="traits" inline /> properties.
      </div>
      <code className="font-mono text-nano text-ink-2">inline</code>
    </div>
  </div>
)
