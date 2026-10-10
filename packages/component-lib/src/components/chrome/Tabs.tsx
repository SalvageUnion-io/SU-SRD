import { Tabs as BaseTabs } from '@base-ui/react/tabs'
import type { CSSProperties, ReactNode } from 'react'
import { borderWidth, font, fontSize, radius, space, tracking, weight } from '../../design/tokens'

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
 * only while its tab is open.
 *
 * Styling follows tailwind-removal.md §4: static geometry and type as style
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

const LIST: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  gap: space[4],
}

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

const TAB: CSSProperties = {
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
}

export function Tab({
  value,
  children,
  style,
}: {
  value: string
  children: ReactNode
  /**
   * Geometry over the default (the Dashboard's phone unit tabs fill a third of
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
}: {
  value: string
  children: ReactNode
  style?: CSSProperties
}) {
  return (
    <BaseTabs.Panel value={value} style={style}>
      {children}
    </BaseTabs.Panel>
  )
}
