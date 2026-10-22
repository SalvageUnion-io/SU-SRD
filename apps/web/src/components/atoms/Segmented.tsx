import type { ComponentPropsWithRef, CSSProperties, ReactNode } from 'react'
import { cn } from '../../lib/cn'
import { capsLabel } from './capsLabel'
import { DISABLED, FOCUS_RING } from './interaction'

/**
 * Segmented — two or more `aria-pressed` options joined in one ink-ruled
 * frame, the one control that sets a value (chrome K10, hard rule R29): one
 * of them, or a set of them (a filter's chips, a Mech's effects). A row that
 * switches what a region shows is `Tabs`; one on/off is a `Toggle`. Its
 * frame, the pressed one the inverse plate: ink with paper text on paper, paper
 * with ink text on an ink ground (a state, never rust: ruleset §3.1). The
 * ground is the frame's `data-ground` (chrome K1), read in CSS: no prop.
 *
 * One control, one look, in both apps: a sheet's Read | Edit, Shelves'
 * Everything | Unassigned, a Game's Pilots | Mechs | Crawlers on a phone, a
 * hold's Cargo | Scrap, the SRD rail's View, Tech Level and Type, a picker's
 * filters and Play's effects and tables. Before it each was built on its own,
 * five ways. No option's label is cut to "…" (EDL E18): a long row wraps
 * (`wrap`) or scrolls, never ellipsizes.
 *
 * A `fieldset` named by a visually hidden `legend`, so a screen reader hears
 * the group's name before its options. Every colour changes on hover or press,
 * so all of them are `.su-seg*`'s (`styles/partials/controls.css`), as are the
 * heights, one of the app's Sizes (`styles/sizing.ts`): Full for the SRD
 * rail's controls, Compact for a page's head actions and a sheet's forms, so it
 * matches the buttons and fields beside it.
 */
export function Segmented({
  label,
  children,
  size = 'full',
  fill = false,
  wrap = false,
  id,
  className,
  style,
}: {
  /** The group's accessible name ("View", "Showing"). */
  label: string
  /** `SegmentedOption`s, and anything that leads them (the rail's TL stamp). */
  children: ReactNode
  /** The Size (`styles/sizing.ts`) of the line it sits on. */
  size?: 'full' | 'compact'
  /** The options share the row's width (a phone's segment switch). */
  fill?: boolean
  /** The options wrap onto more lines, for a row of many (a filter's chips). */
  wrap?: boolean
  /** For a control that points at the group (`aria-controls`). */
  id?: string
  className?: string
  /** Geometry over the default; never a colour. */
  style?: CSSProperties
}) {
  return (
    <fieldset
      className={className ? `su-seg ${className}` : 'su-seg'}
      data-size={size}
      data-fill={fill || undefined}
      data-wrap={wrap || undefined}
      id={id}
      style={style}
    >
      <legend className="su-sr-only">{label}</legend>
      {children}
    </fieldset>
  )
}

export function SegmentedOption({
  pressed,
  numeral = false,
  children,
  ...rest
}: Omit<ComponentPropsWithRef<'button'>, 'type' | 'className' | 'aria-pressed' | 'style'> & {
  pressed: boolean
  /** A bare numeral (a tech level): the body face at base size, squarer. */
  numeral?: boolean
  children: ReactNode
}) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      className={cn('su-seg__option', capsLabel(), FOCUS_RING, DISABLED)}
      data-numeral={numeral || undefined}
      {...rest}
    >
      {children}
    </button>
  )
}
