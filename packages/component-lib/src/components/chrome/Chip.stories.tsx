import type { Story } from '@ladle/react'
import { Caption } from '../../stories/_harness'
import { Chip } from './Chip'

// biome-ignore lint/style/useComponentExportOnlyModules: Ladle stories require a default meta export alongside story components
export default {
  title: 'Atoms/Chip',
}

// Real Salvage Union condition vocabulary (rules keywords: prone / blind / irradiated).
const activeConditions = ['Prone', 'Blind', 'Irradiated']

/**
 * The `Chip` — the `Badge` `quiet` preset (borderless, wk-bg-2 ground). A single
 * keyword — a label+value readout is a Stat, never a chip.
 */
export const Default: Story = () => (
  <div>
    <Caption>Keyword / status chips (borderless)</Caption>
    <div className="flex flex-wrap items-start gap-3">
      {activeConditions.map((condition) => (
        <Chip key={condition}>{condition}</Chip>
      ))}
    </div>
  </div>
)
