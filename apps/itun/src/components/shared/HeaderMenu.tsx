import { Menu } from '@base-ui/react/menu'
import { FOCUS_RING } from 'component-lib'
import {
  borderWidth,
  color,
  font,
  fontSize,
  radius,
  space,
  tracking,
  weight,
} from 'component-lib/design/tokens'
import { ChevronDown } from 'lucide-react'
import type { CSSProperties, ReactNode } from 'react'
import { Fragment } from 'react'

/**
 * HeaderMenu — a dropdown menu for the masthead's action slot (`AppBar`'s
 * `actions`, the mobile cluster beside the hamburger).
 *
 * Base UI's `Menu` supplies the menu-button contract, so nothing here
 * re-implements it: the trigger is a real `<button>` with
 * `aria-haspopup="menu"` and `aria-expanded`, the popup is `role="menu"` with
 * `role="menuitem"` rows, arrow keys and typeahead move between them, Enter or
 * Space activates one, and Escape or an outside press closes the menu and puts
 * focus back on the trigger.
 *
 * ## Data, not children
 *
 * Rows are `sections` of plain `{ id, label, hint?, onSelect }` records, with a
 * rule drawn between sections. That keeps the menu ignorant of what a row DOES
 * — its callers hand in closures over the router and the Convex session — while
 * the menu owns every pixel of the row, so the two menus in the masthead cannot
 * drift apart.
 *
 * A row with no `onSelect` is `disabled`: it is how an empty state ("No games
 * yet") or a loading row stays inside the `role="menu"` tree as a real, inert
 * menuitem rather than as loose text a screen reader would skip.
 *
 * ## Styling
 *
 * The trigger is the masthead's paper-on-ink nav-link treatment, so it sits
 * beside the bar's links as one of them. It is the only surface this renders on
 * today; a second surface earns its own modifier when it exists. Colour lives
 * in `.header-menu-trigger` / `.header-menu-item` (`styles/headerMenu.css`)
 * because it changes on hover, on open and on highlight (resting value included — the per-property split rule);
 * everything static is a style object.
 */

export type HeaderMenuItem = {
  /** Stable key. */
  id: string
  label: ReactNode
  /** A quieter second line (a role, a count). Announced after the label. */
  hint?: ReactNode
  /** Runs on click, Enter or Space; the menu closes afterwards. Omit for an inert row. */
  onSelect?: () => void
}

type HeaderMenuProps = {
  /** What the trigger shows: text, an `Avatar`, or both. */
  trigger: ReactNode
  /**
   * The trigger's accessible name, when its visible content is not one — an
   * avatar-only trigger. When the trigger shows text, include that text here
   * too (WCAG 2.5.3, label in name).
   */
  label?: string
  /** Rows, grouped; a rule separates each non-empty section from the next. */
  sections: HeaderMenuItem[][]
  /** Draw the ▾ after the trigger content. On by default; off for an avatar-only trigger. */
  chevron?: boolean
  /** Which edge of the trigger the popup lines up with. */
  align?: 'start' | 'center' | 'end'
  /**
   * The menu is where you are: the trigger takes the nav links' here-state
   * (`aria-current`, full paper and a rule beneath), as a link to this page would.
   */
  active?: boolean
}

const TRIGGER = {
  alignItems: 'center',
  background: 'none',
  border: 'none',
  borderRadius: radius.card,
  cursor: 'pointer',
  display: 'inline-flex',
  flexShrink: 0,
  fontFamily: font.cond,
  fontSize: fontSize.lede,
  fontWeight: weight.bold,
  gap: space[6],
  letterSpacing: tracking.capsTight,
  padding: `${space[4]} 0`,
  textTransform: 'uppercase',
} satisfies CSSProperties

const POSITIONER = {
  // Above the masthead (z-50) and the sticky sheet bars beneath it.
  zIndex: 60,
} satisfies CSSProperties

const POPUP = {
  backgroundColor: color.paper,
  borderColor: color.ink,
  borderRadius: radius.card,
  borderStyle: 'solid',
  borderWidth: borderWidth.chrome,
  boxShadow: `0 6px 18px ${color.ink20}`,
  boxSizing: 'border-box',
  color: color.ink,
  // Long game lists scroll inside the popup rather than off the screen.
  maxHeight: 'var(--available-height)',
  maxWidth: 'min(320px, var(--available-width))',
  minWidth: '200px',
  outline: 'none',
  overflowY: 'auto',
  padding: `${space[4]} 0`,
} satisfies CSSProperties

// No `outline` here: the highlight sets one for forced-colors mode, and an
// inline value would out-rank it.
const ITEM = {
  display: 'flex',
  flexDirection: 'column',
  gap: space[2],
  padding: `${space[8]} ${space[14]}`,
  userSelect: 'none',
} satisfies CSSProperties

const ITEM_LABEL = {
  fontFamily: font.body,
  fontSize: fontSize.sm,
  lineHeight: 1.3,
  overflowWrap: 'anywhere',
} satisfies CSSProperties

// No `color`: it flips with the row's highlight, so it lives in the class.
const ITEM_HINT = {
  fontFamily: font.cond,
  fontSize: fontSize.badge,
  fontWeight: weight.semibold,
  letterSpacing: tracking.caps,
  lineHeight: 1.2,
  textTransform: 'uppercase',
} satisfies CSSProperties

const SEPARATOR = {
  backgroundColor: color.ink15,
  height: borderWidth.hairline,
  margin: `${space[4]} 0`,
} satisfies CSSProperties

/** Clip to nothing without leaving the accessibility tree. */
const VISUALLY_HIDDEN = {
  border: 0,
  clip: 'rect(0 0 0 0)',
  clipPath: 'inset(50%)',
  height: '1px',
  margin: '-1px',
  overflow: 'hidden',
  padding: 0,
  position: 'absolute',
  whiteSpace: 'nowrap',
  width: '1px',
} satisfies CSSProperties

export function HeaderMenu({
  trigger,
  label,
  sections,
  chevron = true,
  align = 'end',
  active = false,
}: HeaderMenuProps) {
  const filled = sections.filter((section) => section.length > 0)

  return (
    <Menu.Root>
      <Menu.Trigger
        className={`header-menu-trigger ${FOCUS_RING}`}
        style={TRIGGER}
        aria-label={label}
        aria-current={active ? 'page' : undefined}
      >
        {trigger}
        {chevron && <ChevronDown size={14} aria-hidden="true" />}
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Positioner side="bottom" align={align} sideOffset={8} style={POSITIONER}>
          <Menu.Popup style={POPUP}>
            {filled.map((section, index) => (
              <Fragment key={section[0]?.id}>
                {index > 0 && <Menu.Separator style={SEPARATOR} />}
                {section.map((item) => (
                  <Menu.Item
                    key={item.id}
                    className="header-menu-item"
                    style={ITEM}
                    disabled={item.onSelect === undefined}
                    onClick={item.onSelect}
                    // Typeahead matches on text; a node label falls back to the
                    // row's rendered text, which Base UI reads by default.
                    label={typeof item.label === 'string' ? item.label : undefined}
                  >
                    <span style={ITEM_LABEL}>{item.label}</span>
                    {item.hint != null && (
                      <span className="header-menu-item__hint" style={ITEM_HINT}>
                        {/* The two lines are separate blocks visually; this keeps
                            them separate words in the accessible name too. */}
                        <span style={VISUALLY_HIDDEN}>, </span>
                        {item.hint}
                      </span>
                    )}
                  </Menu.Item>
                ))}
              </Fragment>
            ))}
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  )
}
