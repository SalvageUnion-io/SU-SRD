import { createContext } from 'react'

/**
 * Whether entity cards below this point wear the light speckle (ruleset §3.5),
 * as `ReferenceEntityCard` alone still reads it. The texture is the entity
 * SURFACE's (`EntitySurfaceProvider`'s `texture`, EDL E13), which sets this
 * too; nothing else provides or reads it, and it goes when the card reads the
 * surface.
 */
export const CardTextureContext = createContext(true)
