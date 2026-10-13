/** Chrome `EntitySearcher`'s sub-header and its rail share. */

import type { CSSProperties } from 'react'
import { space } from '../../design/tokens'

export const VISUALLY_HIDDEN = {
  position: 'absolute',
  width: '1px',
  height: '1px',
  margin: '-1px',
  padding: space[0],
  overflow: 'hidden',
  clip: 'rect(0, 0, 0, 0)',
  whiteSpace: 'nowrap',
  borderWidth: space[0],
} satisfies CSSProperties

export function chevronStyle(open: boolean): CSSProperties {
  return {
    width: space[16],
    height: space[16],
    flexShrink: 0,
    marginLeft: 'auto',
    transition: 'transform 150ms',
    transform: open ? 'rotate(0deg)' : 'rotate(-90deg)',
  }
}
