import type { CSSProperties, ReactNode } from 'react'
import { borderWidth, color, radius } from '../../design/tokens'

type PanelProps = {
  children: ReactNode
  /** Faint border instead of ink */
  soft?: boolean
  className?: string
  /** Test hook forwarded to the root (e.g. a named callout the tests query). */
  'data-testid'?: string
}

const PANEL = {
  backgroundColor: color.paper,
  borderRadius: radius.panel,
  borderStyle: 'solid',
  borderWidth: borderWidth.chrome,
} satisfies CSSProperties

/**
 * App-chrome panel (design-spec §2.10 `.panel`): 1.5px border, 6px radius,
 * paper ground. `soft` swaps to the faint border.
 */
export function Panel({ children, soft = false, className, 'data-testid': testId }: PanelProps) {
  return (
    <div
      data-testid={testId}
      className={className}
      style={{ ...PANEL, borderColor: soft ? color.wkFaint : color.ink }}
    >
      {children}
    </div>
  )
}
