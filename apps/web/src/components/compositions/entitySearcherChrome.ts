/** Chrome `EntitySearcher`'s sub-header and its rail share. */

import type { CSSProperties } from 'react'
import { duration, ease, space } from '../../design/tokens'

export function chevronStyle(open: boolean): CSSProperties {
  return {
    width: space[16],
    height: space[16],
    flexShrink: 0,
    marginLeft: 'auto',
    transition: `transform ${duration.base} ${ease}`,
    transform: open ? 'rotate(0deg)' : 'rotate(-90deg)',
  }
}
