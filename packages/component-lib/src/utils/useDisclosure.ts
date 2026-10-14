import { useCallback, useId, useState } from 'react'

/** Spread on the toggle button: its state, the panel it names, and the toggle. */
type DisclosureToggleProps = {
  'aria-expanded': boolean
  'aria-controls': string
  onClick: () => void
}

export type Disclosure = {
  open: boolean
  toggle: () => void
  /** The panel's DOM id: the element the toggle's `aria-controls` names. */
  panelId: string
  toggleProps: DisclosureToggleProps
}

/**
 * THE show/hide fold: open state plus the toggle's `aria-expanded` /
 * `aria-controls`. The caller draws its own button (spreading `toggleProps`)
 * and gives `panelId` to the panel, which it either hides (`hidden={!open}`,
 * keeping the panel's own state) or unmounts while shut. A card's Row ⇄ Card
 * fold builds its chevron from one (`foldControl`).
 */
export function useDisclosure(defaultOpen: boolean | (() => boolean) = false): Disclosure {
  const [open, setOpen] = useState(defaultOpen)
  const panelId = useId()
  const toggle = useCallback(() => setOpen((was) => !was), [])
  return {
    open,
    toggle,
    panelId,
    toggleProps: { 'aria-expanded': open, 'aria-controls': panelId, onClick: toggle },
  }
}
