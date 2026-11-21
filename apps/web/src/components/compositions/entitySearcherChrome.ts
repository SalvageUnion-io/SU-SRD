/** Chrome `EntitySearcher`'s sub-header and its rail share. */

import type { CSSProperties } from 'react'
import { ease } from '../../design/tokens'

export function chevronStyle(open: boolean): CSSProperties {
  return {
    flexShrink: 0,
    marginLeft: 'auto',
    transitionDuration: 'var(--dur-base)',
    transitionProperty: 'transform',
    transitionTimingFunction: ease,
    transform: open ? 'rotate(0deg)' : 'rotate(-90deg)',
  }
}
