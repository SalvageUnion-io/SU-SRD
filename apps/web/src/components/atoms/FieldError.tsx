import type { CSSProperties, ReactNode } from 'react'
import { font, fontSize, space } from '../../design/tokens'
import { cn } from '../../lib/cn'

type FieldErrorProps = {
  /** The message. Renders nothing when null/undefined/false/'' — call sites can pass a bare expression. */
  children?: ReactNode
  /** Call-site classes (spacing only). Never restyle colour or type here. */
  className?: string
  /** Call-site spacing: the margin above the line, a step of the space scale. */
  spaceAbove?: keyof typeof space
  /**
   * DOM id, so an input can point at this message with `aria-describedby` —
   * the standard way to associate an error with the control it describes.
   *
   * It currently has no production caller, and was removed once on that basis
   * before being restored here. "No caller yet" is the wrong test for an
   * ACCESSIBILITY affordance: without it, wiring an error to its input is
   * impossible without editing this component, in a codebase held to WCAG 2.1
   * AA. That no call site uses it today is a gap to close, not evidence the
   * capability is unwanted.
   */
  id?: string
}

const LINE = {
  display: 'block',
  fontFamily: font.body,
  fontSize: fontSize.caption,
} satisfies CSSProperties

/**
 * FieldError — the ONE single-message failure / validation / advisory line.
 *
 * Never a hand-rolled `<p role="alert">`. Its colour is `danger`, not rust:
 * rust is the ACTION colour (buttons, AP costs, primary CTAs), and spending it on
 * errors overloads it. Its size is `caption` (13px), the house token for
 * secondary explanatory copy — the same one `EmptyState` uses for its body — so
 * an error reads at one size everywhere. The ink is a class
 * (`.su-message--bad`) because the ground recolours it: `statusBad` clears AA
 * as text on paper, and on an ink ground (the frame's `data-ground`, chrome
 * K1) the line prints in paper.
 *
 * Distinct from its neighbours, deliberately:
 *   - `Banner`  — a LIST of soft warnings with severity pills.
 *   - `Callout` — a 3px accent-framed CONTENT note; no aria role.
 *   - `FieldError` — one inline message, announced via `role="alert"`.
 *
 * A block-level `<span>`, not a `<p>`, so it is valid inside phrasing content
 * such as a field's wrapper.
 */
export function FieldError({ children, className, spaceAbove, id }: FieldErrorProps) {
  // An empty live region still announces on some screen readers.
  if (children === null || children === undefined || children === false || children === '') {
    return null
  }
  return (
    <span
      id={id}
      role="alert"
      className={cn('su-message--bad', className)}
      style={spaceAbove === undefined ? LINE : { ...LINE, marginTop: space[spaceAbove] }}
    >
      {children}
    </span>
  )
}
