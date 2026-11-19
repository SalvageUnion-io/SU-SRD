import { createContext } from 'react'
import type { Paint } from './parts/paint'

/**
 * MOCK (best, revision 6): never stack cut-outs. Under a titled strip (a
 * section's `Slab`, a guide step's head) an entity is a row, not a second
 * card: no band, no cut-out, no frame. The strip's body provides this; the
 * Mini and the Compact head read it and drop their paint.
 */
export const RowDress = createContext(false)

/** A row's head: its name in ink on the row's own ground. */
export function rowPaint(_paint: Paint): Paint {
  return { background: 'transparent', color: 'var(--color-ink)', ink: false }
}
