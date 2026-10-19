import type { ReactNode } from 'react'
import type { EntityStatus } from '../atoms/entityStatus'

export type ReferenceEntityControlVariant = 'primary' | 'danger' | 'ghost'

export type ReferenceEntityControl = {
  key: string
  // --- Typed item variants -------------------------------------------------
  // When one of these is set the control renders that item via the matching
  // primitive instead of an action button. They let `controls` carry every
  // card affordance (quantity steppers, status pills, nav), so no action ever
  // renders in the footer. Precedence: stepper → badge → status → link → button.
  /**
   * A count's stepper: the rail draws it as `Stat` in edit mode (`[QTY | 1] − +`,
   * the one stepper, ruleset §6.2), never through `ControlButtons`.
   */
  stepper?: {
    /** The cell's label ("Qty", "Uses"). */
    label: string
    value: number
    onChange: (next: number) => void
    /** The noun the − / + are named by: "Decrease {subject}", "Increase {subject}". */
    subject: string
    /** A printed cap: the cell reads `value/max` ("Uses 3/5"). */
    max?: number
    /** An unprinted cap: `+` disables at it (what a wizard's budget still allows). */
    ceiling?: number
  }
  /** Renders a read-only status stamp (Badge) — e.g. "Used", "Uses 3/5". */
  badge?: ReactNode
  /** Renders the entity condition StatusBadge (Intact / Damaged / Destroyed),
   *  the clickable cycle toggle. */
  status?: {
    value: EntityStatus
    onClick?: () => void
    /** Entity name for the accessible label ("<subject> status: <Label>"). */
    subject?: string
  }
  /** Renders a navigation link (`Button href`, Mini); uses `label` as its text. */
  href?: string
  // --- Action button (used when no item variant above is set) --------------
  label?: string
  /** Required for button controls (omit for the item variants above). */
  onClick?: () => void
  /** Required for button controls (omit for the item variants above). */
  ariaLabel?: string
  /** A DISCLOSURE button's state (`aria-expanded`) — a folded card's chevron. */
  ariaExpanded?: boolean
  /** The id of the element the disclosure shows or hides (`aria-controls`).
   * On a card's rail the card wrapper itself takes this id: the fold chevron
   * controls the whole card (`resolveCardInteraction`). */
  ariaControls?: string
  /** Tooltip text (the `title` attribute). Defaults to `ariaLabel` when unset —
   * set it when you want a richer hover hint than the concise accessible name. */
  title?: string
  /** A glyph component, drawn at the Mini control's Size (`iconSize.mini`). */
  icon?: (props: { className?: string; size?: number }) => ReactNode
  variant?: ReferenceEntityControlVariant
  disabled?: boolean
  className?: string
  /** When true, the button is not rendered but still participates in header click behavior */
  hidden?: boolean
  /** When true, this control's onClick makes the entire card clickable (any mode).
   * A VISIBLE control stays the one keyboard path and the card a pointer
   * convenience only (no role or tab stop); a `hidden` one makes the card
   * itself the button. If multiple controls set cardClick, the last one wins. */
  cardClick?: boolean
}
