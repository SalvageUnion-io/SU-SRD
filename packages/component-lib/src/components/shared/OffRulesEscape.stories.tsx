import type { Story } from '@ladle/react'
import { Caption } from '../../stories/_harness'
import { OffRulesEscape } from './OffRulesEscape'

// biome-ignore lint/style/useComponentExportOnlyModules: Ladle stories require a default meta export alongside story components
export default { title: 'Compositions/Off Rules Escape' }

/**
 * The in-wizard exit to the Free-Edit Live Sheet — a dotted-underline text
 * button shown in the WizShell action pill while a gate is blocking. Rendered
 * on ink here (its `text-paper/70` treatment) as it sits in the tone pill.
 */
export const Default: Story = () => (
  <div className="flex flex-col gap-3">
    <Caption>
      Subordinate escape hatch — shown only while a legality gate is blocking the build.
    </Caption>
    <div className="w-fit rounded bg-ink px-4 py-3">
      <OffRulesEscape onEscape={() => {}} />
    </div>
  </div>
)
