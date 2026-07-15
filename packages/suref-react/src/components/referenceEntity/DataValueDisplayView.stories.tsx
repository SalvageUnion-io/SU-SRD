import type { Story } from '@ladle/react'
import { DataValueDisplayView } from './DataValueDisplayView'
import type { DataValue } from '../../types/common'

// biome-ignore lint/style/useComponentExportOnlyModules: Ladle stories require a default meta export alongside story components
export default {
  title: 'Legacy/DataValueDisplayView',
}

// Real Salvage Union data-value vocabulary (cost / trait / keyword / meta / label|value).
const costItem: DataValue = { label: '2 EP', type: 'cost' }
const traitItem: DataValue = { label: 'Blast', type: 'trait' }
const keywordItem: DataValue = { label: 'Salvage', type: 'keyword' }
const metaItem: DataValue = { label: 'RANGE 2', type: 'meta' }
const labelValue: DataValue = { label: 'SP', value: '8' }
const labelOnly: DataValue = { label: 'PASSIVE' }

/** Every data-value type, at full and compact density, on one page. */
export const Variants: Story = () => (
  <div className="flex flex-col gap-5 bg-paper p-5 text-ink">
    <p className="max-w-2xl font-mono text-xs leading-relaxed text-ink-2">
      The datavalue tag by type — cost · trait · keyword · meta · label|value · label-only. compact
      tightens for rails.
    </p>
    <div className="flex flex-col gap-1.5">
      <div className="flex flex-wrap gap-3">
        <DataValueDisplayView item={costItem} />
        <DataValueDisplayView item={traitItem} />
        <DataValueDisplayView item={keywordItem} />
        <DataValueDisplayView item={metaItem} />
        <DataValueDisplayView item={labelValue} />
        <DataValueDisplayView item={labelOnly} />
      </div>
      <code className="font-mono text-nano text-ink-2">all types</code>
    </div>
    <div className="flex flex-col gap-1.5">
      <div className="flex flex-wrap gap-2">
        <DataValueDisplayView item={costItem} compact />
        <DataValueDisplayView item={traitItem} compact />
        <DataValueDisplayView item={labelValue} compact />
      </div>
      <code className="font-mono text-nano text-ink-2">compact</code>
    </div>
  </div>
)
