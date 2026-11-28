/**
 * Which half of the Shelves a page draws (ADR-066): the Training Bay's unit
 * shelves (`bay`), the Mediator's Kit, NPCs and Encounters, on the Games
 * front (`kit`), or the Patterns shelf alone, on the Patterns page (`patterns`):
 * the same rows, menu and "+ From a Mech" as the Training Bay's panel.
 */

import { createContext } from 'react'

export const ShelvesPart = createContext<'bay' | 'kit' | 'patterns'>('bay')
