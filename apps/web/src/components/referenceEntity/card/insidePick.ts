import { createContext } from 'react'

/**
 * Whether the subtree is inside a card that IS the pick (`selectionRole`, a
 * radio or a toggle): there the card is the one control, so a nested entity
 * reads and opens nothing (`NestedToken`). `PickSurface` provides it.
 */
export const InsidePickContext = createContext(false)
