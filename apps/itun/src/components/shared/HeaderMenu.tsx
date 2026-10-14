import { Menu } from '@base-ui/react/menu'
import { buttonVariants, cn, FOCUS_RING } from 'component-lib'
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
import { ChevronDown, Ellipsis } from 'lucide-react'
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
 * beside the bar's links as one of them. The second surface is a shelf item's
 * "⋯" on Shelves (board S1): `variant="overflow"` draws the trigger as a square
 * ink-outlined button on paper with the ellipsis glyph, and a row with
 * `tone: 'danger'` (Delete…) reads in the danger colour. Colour lives
 * in `.su-header-menu-trigger` / `.su-header-menu-item` (`styles/headerMenu.css`)
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
  /** `danger` for a row that destroys something (Delete…). */
  tone?: 'danger'
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
  /**
   * The menu is where you are: the trigger takes the nav links' here-state
   * (`aria-current`, full paper and a rule beneath), as a link to this page would.
   */
  active?: boolean
  /**
   * `masthead` (default) — the Union bar's nav-link trigger. `overflow` — a
   * square "⋯" button on paper (a shelf item's menu); it shows the glyph, so
   * pass `label` to name it, and `trigger` is not drawn. `button` — the shared
   * compact Button on paper, for a menu that is a page action (a shelf's
   * "+ From a mech").
   */
  variant?: 'masthead' | 'overflow' | 'button'
  /** Extra classes for the trigger of the `button` variant. */
  className?: string
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
  // The Union bar's one control height (`--su-union-bar-control`), so the
  // account menu matches the search and buttons beside it.
  height: 'var(--su-union-bar-control, auto)',
  letterSpacing: tracking.capsTight,
  padding: `${space[4]} 0`,
  textTransform: 'uppercase',
} satisfies CSSProperties

// The overflow trigger (board S1) is the sheet bar's "⋯": Button's icon rung
// at page-action height, a 40px ink-outlined square. Only its open state, the
// inverse plate, is `.su-header-menu-trigger--overflow`'s.
const OVERFLOW_TRIGGER_CLASS = cn(
  buttonVariants({ size: 'iconOnly' }),
  'su-page-action',
  'su-header-menu-trigger--overflow'
)

const POSITIONER = {
  // Above the masthead (z-50) and the sticky sheet bars beneath it.
  zIndex: 60,
} satisfies CSSProperties

const POPUP = {
  backgroundColor: color.paper,
  borderColor: color.ink,
  borderRadius: radius.card,
  borderStyle: 'solid',
  // Flat paper on an ink hairline, like every other piece of chrome (ruleset
  // §3.5): no drop shadow, the rule alone lifts it off the page.
  borderWidth: borderWidth.hairline,
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

export function HeaderMenu({
  trigger,
  label,
  sections,
  chevron = true,
  active = false,
  variant = 'masthead',
  className,
}: HeaderMenuProps) {
  const filled = sections.filter((section) => section.length > 0)
  const overflow = variant === 'overflow'
  // The button variant is the shared Button's own classes, focus ring included.
  const triggerClass =
    variant === 'button'
      ? `${buttonVariants({ size: 'compact' })}${className ? ` ${className}` : ''}`
      : overflow
        ? OVERFLOW_TRIGGER_CLASS
        : `su-header-menu-trigger ${FOCUS_RING}`
  const triggerStyle = variant === 'masthead' ? TRIGGER : undefined

  return (
    <Menu.Root>
      <Menu.Trigger
        className={triggerClass}
        style={triggerStyle}
        aria-label={label}
        aria-current={active ? 'page' : undefined}
      >
        {overflow ? (
          <Ellipsis size={18} aria-hidden="true" />
        ) : (
          <>
            {trigger}
            {chevron && <ChevronDown size={14} aria-hidden="true" />}
          </>
        )}
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Positioner side="bottom" align="end" sideOffset={8} style={POSITIONER}>
          <Menu.Popup style={POPUP}>
            {filled.map((section, index) => (
              <Fragment key={section[0]?.id}>
                {index > 0 && <Menu.Separator style={SEPARATOR} />}
                {section.map((item) => (
                  <Menu.Item
                    key={item.id}
                    className={
                      item.tone === 'danger'
                        ? 'su-header-menu-item su-header-menu-item--danger'
                        : 'su-header-menu-item'
                    }
                    style={ITEM}
                    disabled={item.onSelect === undefined}
                    onClick={item.onSelect}
                    // Typeahead matches on text; a node label falls back to the
                    // row's rendered text, which Base UI reads by default.
                    label={typeof item.label === 'string' ? item.label : undefined}
                  >
                    <span style={ITEM_LABEL}>{item.label}</span>
                    {item.hint != null && (
                      <span className="su-header-menu-item__hint" style={ITEM_HINT}>
                        {/* The two lines are separate blocks visually; this keeps
                            them separate words in the accessible name too. */}
                        <span className="su-sr-only">, </span>
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
