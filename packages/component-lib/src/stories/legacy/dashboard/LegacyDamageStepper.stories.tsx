/**
 * Legacy "before" capture — ITUN Dashboard `DamageStepper`.
 *
 * Reproduces the hand-built `[− n +]` control from
 * apps/in-the-union-now/src/components/dashboard/ActiveItemBand.tsx (the
 * `DamageStepper` sub-component) VERBATIM — same `.pc-step` / `.pc-btn` /
 * `.pc-step-num` markup, styled by the co-located CSS slice (NOT Tailwind).
 * L1 of the reconciliation: freeze the "before", do not refactor.
 */

import type { Story } from '@ladle/react'
import { useState } from 'react'
import { Caption } from '../../_harness'
import './LegacyDamageStepper.css'

// Verbatim reproduction of ActiveItemBand.tsx's DamageStepper, wired to local
// state so the −/+ buttons are live in the story.
function DamageStepper({ amount, setAmount }: { amount: number; setAmount: (n: number) => void }) {
  return (
    <div className="pc-step">
      <button
        type="button"
        className="pc-btn"
        onClick={() => setAmount(Math.max(1, amount - 1))}
        aria-label="Decrease damage"
      >
        −
      </button>
      <span className="pc-step-num">{amount}</span>
      <button
        type="button"
        className="pc-btn"
        onClick={() => setAmount(amount + 1)}
        aria-label="Increase damage"
      >
        +
      </button>
    </div>
  )
}

// biome-ignore lint/style/useComponentExportOnlyModules: Ladle stories require a default meta export alongside story components
export default { title: 'Legacy/Dashboard/PC Damage Stepper' }

export const Default: Story = () => {
  const [amount, setAmount] = useState(1)
  return (
    <div style={{ maxWidth: 320 }}>
      <Caption>
        ITUN Dashboard damage stepper (ActiveItemBand `DamageStepper`) — duplicates the shared
        Stepper / count control. Shown on the dark instrument ground it lives on.
      </Caption>
      <div className="pc-root" style={{ background: 'var(--pc-ground)', padding: 24 }}>
        <DamageStepper amount={amount} setAmount={setAmount} />
      </div>
    </div>
  )
}
