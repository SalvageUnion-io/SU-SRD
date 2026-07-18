import type { Story } from '@ladle/react'
import { Caption } from '../../stories/_harness'
import { MicroLabel } from './MicroLabel'

// biome-ignore lint/style/useComponentExportOnlyModules: Ladle stories require a default meta export alongside story components
export default { title: 'Legacy/Wizard/Micro Label' }

/** The stamp-voice count captions that sit under an entity card. */
export const Default: Story = () => (
  <div className="flex flex-col items-start gap-3">
    <Caption>Subordinate stamp-voice captions — plain tinted text, not a Badge plate.</Caption>
    <MicroLabel>Copy 2 of 3</MicroLabel>
    <MicroLabel tone="rust" className="text-badge">
      1 Installed
    </MicroLabel>
    <MicroLabel tone="ink">Legal Starting Pattern</MicroLabel>
  </div>
)
