import { Menu } from '@base-ui/react/menu'
import { ChevronDown, Ellipsis } from 'lucide-react'
import type { CSSProperties, ReactNode } from 'react'
import { Fragment } from 'react'
import {
  borderWidth,
  color,
  font,
  fontSize,
  iconSize,
  layer,
  radius,
  space,
} from '../../design/tokens'
import { cn } from '../../lib/cn'
import { buttonVariants } from '../atoms/buttonVariants'
import { capsLabel } from '../atoms/capsLabel'
import { Eyebrow } from '../atoms/Eyebrow'
import { FOCUS_RING } from '../atoms/interaction'
import { POPUP_SURFACE } from '../atoms/popupSurface'
import { SegmentedOption } from '../atoms/Segmented'

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
 * Compacts are `sections` of plain `{ id, label, hint?, onSelect }` records, with a
 * rule drawn between sections. That keeps the menu ignorant of what a row DOES
 * — its callers hand in closures over the router and the session — while
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
 * "⋯" in the Training Bay: `variant="overflow"` draws the trigger as an
 * action chip (Button's `mini` rung) with the ellipsis glyph, the last chip on
 * a listed unit's line, and a row with
 * `tone: 'danger'` (Delete…) reads in the danger colour. Colour lives
 * in `.su-header-menu-trigger` / `.su-header-menu-item` (`styles/partials/containers.css`)
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
  /** Compacts, grouped; a rule separates each non-empty section from the next. */
  sections: HeaderMenuItem[][]
  /** Draw the ▾ after the trigger content. On by default; off for an avatar-only trigger. */
  chevron?: boolean
  /**
   * The menu is where you are: the trigger takes the nav links' here-state
   * (`aria-current`, full paper and a rule beneath), as a link to this page would.
   */
  active?: boolean
  /**
   * `masthead` (default) — the Union bar's nav-link trigger. `overflow` — the
   * ⋯ (`Ellipsis`) action chip (a listed unit's menu, its Compact's last chip; a
   * bar's ⋯ at `size="compact"`); it shows the glyph, so pass `label` to
   * name it, and `trigger` is not drawn. `button` —
   * the shared Button as an action chip, for a menu that is a section's action
   * (a shelf's "+ From a mech"). `segment` — one option of a `Segmented`
   * control whose choice is a menu (Play's "Boarded · <mech> ▾"), pressed when
   * `pressed`.
   */
  variant?: 'masthead' | 'overflow' | 'button' | 'segment'
  /** Extra classes for the trigger of the `button` variant. */
  className?: string
  /**
   * The `button` and `overflow` variants' Size: `mini` (default), an action
   * chip; `compact` where it sits on a line of Compact controls (Play's bar,
   * ruleset §4.7). Its glyphs take the same Size (`iconSize`, hard rule R23).
   */
  size?: 'mini' | 'compact'
  /** The `segment` trigger is pressed (its `SegmentedOption`'s): its option is the chosen one. */
  pressed?: boolean
  /** The trigger opens nothing (a `segment` with nothing to choose). */
  disabled?: boolean
}

const TRIGGER = {
  alignItems: 'center',
  background: 'none',
  border: 'none',
  borderRadius: radius.card,
  cursor: 'pointer',
  display: 'inline-flex',
  flexShrink: 0,
  gap: space[6],
  // The Union bar's one control height (`--su-union-bar-control`), so the
  // account menu matches the search and buttons beside it.
  height: 'var(--su-union-bar-control, auto)',
  padding: `${space[4]} 0`,
} satisfies CSSProperties
const TRIGGER_CAPS = capsLabel({ size: 'lede' })

// The overflow trigger is an action chip, Button's `mini` rung, so it
// sits among a Compact's chips at their height. Only its open state, the inverse
// plate, is `.su-header-menu-trigger--overflow`'s.
const overflowTriggerClass = (size: 'mini' | 'compact') =>
  cn(buttonVariants({ size }), 'su-header-menu-trigger--overflow')

const POSITIONER = {
  // Above the masthead (z-50) and the sticky sheet bars beneath it.
  zIndex: layer.menu,
} satisfies CSSProperties

// The paper popup surface every floating panel shares (`POPUP_SURFACE`).
const POPUP = {
  ...POPUP_SURFACE.paper,
  boxSizing: 'border-box',
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
  size = 'mini',
  pressed,
  disabled,
}: HeaderMenuProps) {
  const filled = sections.filter((section) => section.length > 0)
  const overflow = variant === 'overflow'
  // The button variant is the shared Button's own classes, focus ring included;
  // the segment variant IS a `SegmentedOption` (its `render`), so `aria-pressed`
  // stays Segmented's (hard rule R29).
  const triggerClass =
    variant === 'button'
      ? `${buttonVariants({ size })}${className ? ` ${className}` : ''}`
      : variant === 'segment'
        ? undefined
        : overflow
          ? overflowTriggerClass(size)
          : `su-header-menu-trigger ${FOCUS_RING}`
  const triggerStyle = variant === 'masthead' ? TRIGGER : undefined

  return (
    <Menu.Root>
      <Menu.Trigger
        className={variant === 'masthead' ? cn(triggerClass, TRIGGER_CAPS) : triggerClass}
        style={triggerStyle}
        aria-label={label}
        aria-current={active ? 'page' : undefined}
        disabled={disabled}
        render={
          variant === 'segment'
            ? ({ className: _className, children, ...props }) => (
                <SegmentedOption {...props} pressed={pressed === true}>
                  {children}
                </SegmentedOption>
              )
            : undefined
        }
      >
        {overflow ? (
          <Ellipsis size={iconSize[size]} aria-hidden="true" />
        ) : (
          <>
            {trigger}
            {chevron && <ChevronDown size={iconSize[size]} aria-hidden="true" />}
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
                      // The hint's colour flips with the row's highlight:
                      // `.su-header-menu-item__hint` comes after the tone class.
                      <Eyebrow tone="muted" className="su-header-menu-item__hint">
                        {/* The two lines are separate blocks visually; this keeps
                            them separate words in the accessible name too. */}
                        <span className="su-sr-only">, </span>
                        {item.hint}
                      </Eyebrow>
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
