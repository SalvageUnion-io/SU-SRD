import type { CSSProperties, ReactNode } from 'react'
import { space } from '../../design/tokens'

const ACTIONS = {
  display: 'flex',
  flexWrap: 'wrap',
  justifyContent: 'flex-end',
  gap: space[8],
} satisfies CSSProperties

/**
 * DIALOG ACTIONS — a dialog's buttons: right-aligned, 8px apart, wrapping on
 * a narrow screen. Cancel first, the action last.
 */
export function DialogActions({ children }: { children: ReactNode }) {
  return <div style={ACTIONS}>{children}</div>
}
