import { createContext } from 'react'

/**
 * Whether entity cards below this point wear the light speckle (ruleset §3.5).
 * On by default; a card given `texture={false}` turns it off for itself and
 * every card nested inside it — the Dashboard and tooltips, which stay flat.
 * A context rather than a threaded prop, because nested cards are also spawned
 * by sections (guide steps, choices, loadouts) that never see the host's props.
 */
export const CardTextureContext = createContext(true)
