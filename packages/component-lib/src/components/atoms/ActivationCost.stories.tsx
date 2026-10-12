import type { CSSProperties, ReactNode } from 'react'
import { color, font, fontSize, space } from '../../design/tokens'
import type { Story } from '../../stories/_harness'
import { ActivationCost } from './ActivationCost'

export default {
  title: 'Atoms/Activation Cost',
}

// AP / EP / Variable are the real Salvage Union activation currencies.
const CELL = {
  alignItems: 'center',
  display: 'flex',
  flexDirection: 'column',
  gap: space[6],
} satisfies CSSProperties

const CELL_SLOT = {
  alignItems: 'center',
  display: 'flex',
  minHeight: '44px',
} satisfies CSSProperties

const CELL_LABEL = { color: color.wkMuted, fontSize: fontSize.badge } satisfies CSSProperties

const PAGE = {
  backgroundColor: color.paper,
  color: color.ink,
  display: 'flex',
  flexDirection: 'column',
  fontFamily: font.body,
  gap: space[16],
  padding: space[20],
} satisfies CSSProperties

const LEDE = {
  color: color.wkMuted,
  fontSize: fontSize.xs,
  lineHeight: 1.625,
  maxWidth: '42rem',
} satisfies CSSProperties

const ROW = {
  alignItems: 'flex-start',
  columnGap: space[24],
  display: 'flex',
  flexWrap: 'wrap',
  rowGap: space[20],
} satisfies CSSProperties

function Cell({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div style={CELL}>
      <div style={CELL_SLOT}>{children}</div>
      <code style={CELL_LABEL}>{label}</code>
    </div>
  )
}

/** Every currency × cost at a glance — the AP / EP / Variable activation costs. */
export const Default: Story = () => (
  <div style={PAGE}>
    <p style={LEDE}>
      The activation-cost pennant. currency is AP or EP; a non-numeric cost (Variable) renders as X.
      compact tightens it for rails and listings.
    </p>
    <div style={ROW}>
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
