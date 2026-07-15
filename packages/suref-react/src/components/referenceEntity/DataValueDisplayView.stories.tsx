import type { Story } from '@ladle/react'
import { DataValueDisplayView } from './DataValueDisplayView'
import type { DataValue } from '../../types/common'

// biome-ignore lint/style/useComponentExportOnlyModules: Ladle stories require a default meta export alongside story components
export default {
  title: 'Legacy/DataValueDisplayView',
}

const costItem: DataValue = { label: '2 EP', type: 'cost' }
const traitItem: DataValue = { label: 'Blast', type: 'trait' }
const keywordItem: DataValue = { label: 'Salvage', type: 'keyword' }
const metaItem: DataValue = { label: 'RANGE 2', type: 'meta' }
const labelValue: DataValue = { label: 'SP', value: '8' }
const labelOnly: DataValue = { label: 'PASSIVE' }

export const AllTypes: Story = () => (
  <div className="flex gap-3 flex-wrap">
    <DataValueDisplayView item={costItem} />
    <DataValueDisplayView item={traitItem} />
    <DataValueDisplayView item={keywordItem} />
    <DataValueDisplayView item={metaItem} />
    <DataValueDisplayView item={labelValue} />
    <DataValueDisplayView item={labelOnly} />
  </div>
)

export const Compact: Story = () => (
  <div className="flex gap-2 flex-wrap">
    <DataValueDisplayView item={costItem} compact />
    <DataValueDisplayView item={traitItem} compact />
    <DataValueDisplayView item={labelValue} compact />
  </div>
)
