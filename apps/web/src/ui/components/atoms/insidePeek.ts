import { createContext } from 'react'

/**
 * Whether the subtree is INSIDE a Peek. A Peek is read-only and terminal (E16):
 * no links, no modes, no Peek inside it, and no tooltip primitive arming a
 * popup of its own. The Peek provides it; every form, part and tooltip reads it.
 *
 * It lives with the atoms, not with the Peek in `entity/`, because `Tooltip`
 * reads it and an atom imports nothing from a higher layer.
 */
export const InsidePeekContext = createContext(false)
