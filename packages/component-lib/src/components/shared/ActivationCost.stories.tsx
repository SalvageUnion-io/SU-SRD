import type { Story } from '@ladle/react'
import type { ReactNode } from 'react'
import { ActivationCost } from './ActivationCost'

// biome-ignore lint/style/useComponentExportOnlyModules: Ladle stories require a default meta export alongside story components
export default {
  title: 'Atoms/Activation Cost',
}

// AP / EP / Variable are the real Salvage Union activation currencies.
function Cell({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-1.5">
      <div className="flex min-h-[44px] items-center">{children}</div>
      <code className="text-nano text-ink-2">{label}</code>
    </div>
  )
}

/** Every currency × cost at a glance — the AP / EP / Variable activation costs. */
export const Default: Story = () => (
  <div className="flex flex-col gap-4 bg-paper p-5 font-body text-ink">
    <p className="max-w-2xl text-xs leading-relaxed text-ink-2">
      The activation-cost pennant. currency is AP or EP; a non-numeric cost (Variable) renders as X.
      compact tightens it for rails and listings.
    </p>
    <div className="flex flex-wrap items-start gap-x-6 gap-y-5">
      <Cell label="1 AP">
        <ActivationCost cost={1} currency="AP" />
      </Cell>
      <Cell label="2 AP">
        <ActivationCost cost={2} currency="AP" />
      </Cell>
      <Cell label="3 EP">
        <ActivationCost cost={3} currency="EP" />
      </Cell>
      <Cell label="Variable AP">
        <ActivationCost cost="Variable" currency="AP" />
      </Cell>
      <Cell label="compact 1 AP">
        <ActivationCost cost={1} currency="AP" compact />
      </Cell>
      <Cell label="compact 2 EP">
        <ActivationCost cost={2} currency="EP" compact />
      </Cell>
      <Cell label="compact Variable">
        <ActivationCost cost="Variable" currency="AP" compact />
      </Cell>
    </div>
  </div>
)
