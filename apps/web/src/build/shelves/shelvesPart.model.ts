/**
 * Which half of the Shelves a page draws (ADR-066): the Training Bay's unit
 * shelves (`bay`), or the Mediator's Kit, NPCs and Encounters, on the Games
 * front (`kit`).
 */

import { createContext } from 'react'

export const ShelvesPart = createContext<'bay' | 'kit'>('bay')
