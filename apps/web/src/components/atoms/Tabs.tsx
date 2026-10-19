import { Tabs as BaseTabs } from '@base-ui/react/tabs'
import type { CSSProperties, ReactNode } from 'react'
import { borderWidth, font, fontSize, radius, space, tracking, weight } from '../../design/tokens'

/**
 * Tabs — a row of tabs that switches what one region shows, over Base UI's
 * Tabs (chrome K10, hard rule R29): the only `role="tablist"` in the app. A
 * row that sets a value is a `Segmented`; one on/off is a `Toggle`. A tab's
 * label is never cut to "…" (EDL E18): it wraps or the tab widens.
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
  padding: `${space[6]} ${space[10]}`,
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
