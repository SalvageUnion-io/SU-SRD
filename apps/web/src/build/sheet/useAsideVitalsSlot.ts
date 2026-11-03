import { createContext, useContext } from 'react'

/**
 * The sidebar's top slot: from the 64rem rung the opening's Vitals panel is
 * drawn here (`SheetHero`, a portal), so the opening is as tall as its fields
 * and the sidebar starts with what a player checks most (R61).
 */
export const AsideVitalsSlot = createContext<HTMLElement | null>(null)

/** The sidebar's Vitals slot, or null where the sheet has no sidebar. */
export const useAsideVitalsSlot = () => useContext(AsideVitalsSlot)
