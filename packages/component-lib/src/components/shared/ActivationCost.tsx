import type { CSSProperties } from 'react'
import { color, fontSize, space, weight } from '../../design/tokens'

type ActivationCostProps = {
  cost: string | number
  currency?: string | undefined | number
  compact?: boolean
}

const ROOT = {
  alignItems: 'center',
  display: 'inline-flex',
  overflow: 'visible',
  padding: 0,
} satisfies CSSProperties

// The 2px block padding matches the pseudoheader datavalue tags (TURN ACTION,
// …) so the AP badge box is the same height as the other datavalue cells.
const BOX = {
  alignItems: 'center',
  backgroundColor: color.ink,
  color: color.paper,
  display: 'inline-flex',
  justifyContent: 'center',
  lineHeight: 1,
  paddingBlock: space[2],
  textTransform: 'uppercase',
  whiteSpace: 'nowrap',
  zIndex: 2,
} satisfies CSSProperties

// Match the datavalue tags' weight (normal compact / semibold).
const BOX_COMPACT = {
  fontSize: fontSize.xs,
  fontWeight: weight.normal,
  paddingInline: space[4],
} satisfies CSSProperties

const BOX_FULL = {
  fontSize: fontSize.sm,
  fontWeight: weight.semibold,
  paddingInline: space[6],
} satisfies CSSProperties

const TIP = {
  alignSelf: 'center',
  height: 0,
  marginLeft: 0,
  width: 0,
  zIndex: 1,
} satisfies CSSProperties

export function ActivationCost({ cost, currency = 'AP', compact = false }: ActivationCostProps) {
  if (cost === undefined) return null
  const displayCost = cost === 'Variable' ? 'X' : cost

  return (
    <span style={ROOT}>
      <span style={{ ...BOX, ...(compact ? BOX_COMPACT : BOX_FULL) }}>
        {`${displayCost} ${currency}`}
      </span>
      <span
        aria-hidden="true"
        style={{
          ...TIP,
          // Pennant tip spans the full box height (font + 2×2px padding) so
          // the arrow matches the box and the neighbouring datavalue tags.
          borderTop: compact ? '8px solid transparent' : '9px solid transparent',
          borderBottom: compact ? '8px solid transparent' : '9px solid transparent',
          borderLeft: compact ? '7px solid var(--color-ink)' : '8px solid var(--color-ink)',
        }}
      />
    </span>
  )
}
