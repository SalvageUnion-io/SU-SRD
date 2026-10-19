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
  borderRadius: radius.card,
  borderStyle: 'solid',
  borderWidth: borderWidth.chrome,
} satisfies CSSProperties

/**
 * The pilot sheet's generic entry frame: 1.5px border, 3px radius (ruleset
 * §4.4), paper ground; `soft` swaps to the faint border. Nothing else takes
 * it: a frame is a `Box`, a note a `Callout`.
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
