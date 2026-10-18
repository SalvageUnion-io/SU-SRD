import { Tabs as BaseTabs } from '@base-ui/react/tabs'
import type { ComponentPropsWithRef, CSSProperties, ReactNode } from 'react'
import { borderWidth, font, fontSize, radius, space, tracking, weight } from '../../design/tokens'
import { cn } from '../../lib/cn'
import { DISABLED, FOCUS_RING } from './interaction'

/**
 * Tabs — a row of tabs that switches one panel, over Base UI's Tabs.
 *
 * It brings the WAI-ARIA tabs keyboard model with it, which is why it exists
 * rather than a row of buttons wearing `role="tab"`: ArrowLeft/ArrowRight move
 * between tabs (wrapping), Home/End jump to the ends, Tab moves into the open
 * panel, and each tab is tied to its panel by `aria-controls` /
 * `aria-labelledby`. Moving with the arrows also selects (`activateOnFocus`),
 * the behaviour a reader of a small, cheap-to-switch panel expects.
 *
 * Controlled only: the caller owns which tab is open, so it decides whether
 * that is component state, a URL or anything else. Compose it as
 * `Tabs` › `TabList` › `Tab`…, then one `TabPanel` per tab. A panel renders
 * only while its tab is open, unless it is `keepMounted`.
 *
 * Styling follows the per-property split (ADR-046): static geometry and type as style
 * objects, every colour (each of which changes on hover, focus or selection)
 * in `.su-tab` in `styles/index.css`.
 */

type TabsProps<Value extends string> = {
  value: Value
  onValueChange: (value: Value) => void
  children: ReactNode
  style?: CSSProperties
}

export function Tabs<Value extends string>({
  value,
  onValueChange,
  children,
  style,
}: TabsProps<Value>) {
  return (
    <BaseTabs.Root
      value={value}
      // Base UI types a tab's value as `any`; every Tab this root holds was
      // given a `Value`, so the one it reports is one.
      onValueChange={(next: Value) => onValueChange(next)}
      style={style}
    >
      {children}
    </BaseTabs.Root>
  )
}

const LIST = {
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  gap: space[4],
} satisfies CSSProperties

export function TabList({
  label,
  children,
  style,
}: {
  /** The accessible name of the tab row ("Display", "Filter by timing"). */
  label: string
  children: ReactNode
  style?: CSSProperties
}) {
  return (
    <BaseTabs.List activateOnFocus aria-label={label} style={{ ...LIST, ...style }}>
      {children}
    </BaseTabs.List>
  )
}

const TAB = {
  padding: `5px ${space[10]}`,
  borderRadius: radius.card,
  borderStyle: 'solid',
  borderWidth: borderWidth.chrome,
  cursor: 'pointer',
  fontFamily: font.cond,
  fontWeight: weight.bold,
  fontSize: fontSize.note,
  letterSpacing: tracking.capsTight,
  textTransform: 'uppercase',
  whiteSpace: 'nowrap',
} satisfies CSSProperties

export function Tab({
  value,
  children,
  style,
}: {
  value: string
  children: ReactNode
  /**
   * Geometry over the default (Play's phone tabs fill a quarter of
   * the row each). Never a colour: those change on hover and selection, so
   * they stay in `.su-tab`.
   */
  style?: CSSProperties
}) {
  return (
    <BaseTabs.Tab value={value} className="su-tab su-focus-ring" style={{ ...TAB, ...style }}>
      {children}
    </BaseTabs.Tab>
  )
}

/**
 * A Tab that switches nothing in a panel: an `aria-pressed` toggle in a row of
 * them (a list's type filter, a reference picker, a phone
 * deck's filter key). It is the Tab's look, one implementation, so a toggle row
 * and a tab row never drift apart; pressed is the Tab's selected plate, ink
 * with paper text (a state, never rust: ruleset §3.1).
 */
export function Toggle({
  pressed,
  onClick,
  children,
  style,
  ...rest
}: Omit<ComponentPropsWithRef<'button'>, 'type' | 'className' | 'aria-pressed'> & {
  pressed: boolean
  children: ReactNode
  /** Geometry over the default; never a colour (see `Tab`). */
  style?: CSSProperties
}) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      className={cn('su-tab', FOCUS_RING, DISABLED)}
      style={{ ...TAB, ...style }}
      onClick={onClick}
      {...rest}
    >
      {children}
    </button>
  )
}

/** A bare fieldset: the group, without the browser's frame around it. */
const TOGGLE_GROUP = { border: 0, margin: 0, minInlineSize: 0, padding: 0 } satisfies CSSProperties

/**
 * A row of `Toggle`s that answer one question (a deck's timing filter, its
 * engagement range, a reference picker): Segmented's shell, a
 * `fieldset` named by a visually hidden `legend`, so a screen reader hears the
 * group's name before its options — without Segmented's joined frame, since
 * each Toggle wears the Tab's own plate.
 */
export function ToggleGroup({
  label,
  children,
  className,
  style,
}: {
  /** The group's accessible name ("Filter actions by timing"). */
  label: string
  /** The `Toggle`s, and anything that rides the row with them (a reach line). */
  children: ReactNode
  className?: string
  /** Geometry over the bare fieldset (a row's flex and gap); never a colour. */
  style?: CSSProperties
}) {
  return (
    <fieldset className={className} style={style ? { ...TOGGLE_GROUP, ...style } : TOGGLE_GROUP}>
      <legend className="su-sr-only">{label}</legend>
      {children}
    </fieldset>
  )
}

export function TabPanel({
  value,
  children,
  style,
  keepMounted = false,
}: {
  value: string
  children: ReactNode
  style?: CSSProperties
  /**
   * Keep the panel mounted, `hidden`, while its tab is closed, so what it
   * holds (a half-typed Find, an open filter, a dialog's state) survives a
   * switch: Play's phone tabs (ADR-051 §10).
   */
  keepMounted?: boolean
}) {
  return (
    <BaseTabs.Panel value={value} style={style} keepMounted={keepMounted}>
      {children}
    </BaseTabs.Panel>
  )
}
