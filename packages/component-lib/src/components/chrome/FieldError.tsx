import type { ReactNode } from 'react'
import { cn } from '../../utils/cn'

type FieldErrorProps = {
  /** The message. Renders nothing when null/undefined/false — call sites can pass a bare expression. */
  children?: ReactNode
  /** Call-site spacing only (`mt-1`, `mb-0 mt-2`, …). Never restyle colour or type here. */
  className?: string
  /**
   * DOM id, so an input can point at this message with `aria-describedby` —
   * the standard way to associate an error with the control it describes.
   *
   * It currently has no production caller, and was removed once on that basis
   * before being restored here. "No caller yet" is the wrong test for an
   * ACCESSIBILITY affordance: without it, wiring an error to its input is
   * impossible without editing this component, in a codebase held to WCAG 2.1
   * AA. That no call site uses it today is a gap to close, not evidence the
   * capability is unwanted. The Ladle story demonstrates the wiring.
   */
  id?: string
}

/**
 * FieldError — the ONE single-message validation / advisory line.
 *
 * This gap was previously filled by 22 hand-rolled `<p role="alert">` spellings
 * across itun, srd and this package, in ~8 different class combinations and
 * split across TWO colour tokens for one semantic (6× `text-rust`, 10×
 * `text-status-bad`). Rust is the ACTION colour (buttons, AP costs, primary CTAs),
 * so spending it on errors overloaded it — `danger` is canonical here.
 *
 * The type scale is likewise unified: call sites ran 9× `text-sm` (14px), 6×
 * `text-xs` (12px) and 1× `text-note`. They collapse onto `text-caption` (13px),
 * the house token for secondary explanatory copy — the same one `EmptyState`
 * uses for its body — so an error reads at one size everywhere.
 *
 * Distinct from its neighbours, deliberately:
 *   - `Banner`  — a LIST of soft warnings with severity pills.
 *   - `Callout` — a 3px accent-framed CONTENT note; no aria role.
 *   - `FieldError` — one inline message, announced via `role="alert"`.
 */
export function FieldError({ children, className, id }: FieldErrorProps) {
  // A falsy child is the common shape at call sites (`{error && <p…>}` becomes
  // `<FieldError>{error}</FieldError>`), so absorb it rather than rendering an
  // empty alert — an empty live region still announces on some screen readers.
  if (children === null || children === undefined || children === false || children === '') {
    return null
  }

  // A block-level <span>, not a <p>: several call sites sit inside phrasing
  // content (InlineEditField wraps its editor and error in a <span>), where a
  // <p> is invalid nesting. A span carries role="alert" identically and, having
  // no default margin, matches the `m-0` most call sites already specified.
  return (
    <span
      id={id}
      role="alert"
      className={cn('block font-body text-caption text-status-bad', className)}
    >
      {children}
    </span>
  )
}
