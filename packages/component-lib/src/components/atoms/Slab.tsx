import type { CSSProperties, ElementType, ReactNode } from 'react'
import { borderWidth, color, font, fontSize, space, tracking, weight } from '../../design/tokens'
import { POSTER_STAMP } from './posterStamp'

type SlabProps = {
  /** Section label, e.g. 'Systems' */
  label: ReactNode
  /**
   * Element for the label. Defaults to `span`: inside an entity card a slab is
   * a visual separator, not a document heading. Prose pages (the about/back
   * pages) that use it as their real section head pass `h2` so the outline and
   * screen-reader navigation still work.
   */
  as?: ElementType
  /**
   * A muted note after the label or rule: a choice ('Choose 1'), a state
   * ('5/6 slots'), whose tree it is. Never a tally of the items the section
   * lists — sections don't count themselves.
   */
  count?: ReactNode
  /**
   * The count's ink. 'muted' (default) is `wkMuted`, which clears AA on paper
   * and the workshop grounds only. 'inherit' prints it in the surrounding ink
   * (`currentcolor`), for a slab printed straight on a tinted ground: on
   * ITUN's wizard step card `wkMuted` measures 3.78 / 3.03 / 2.65:1 (pilot /
   * mech / crawler), the card's own ink 10.13 / 8.12 / 7.11:1.
   */
  countInk?: 'muted' | 'inherit'
  /**
   * Trailing section controls after the leader rule (e.g. a per-section Edit
   * toggle or an always-available '+ Add'). Optional and additive — existing
   * consumers render unchanged.
   */
  actions?: ReactNode
  className?: string
  /** Merged over the row's own style — the way to retune its bottom margin. */
  style?: CSSProperties
  /** For a region that names itself by its slab (`aria-labelledby`). */
  id?: string
  /**
   * 'dashed' (default, unchanged) — tone-deep colored text label + dashed
   * leader rule, the original live-play control-panel shape. 'solid' — the
   * section stamp of the brand refresh (boards 06–10): a solid ink stamp,
   * paper text, then a dashed ink hairline running to its note at the far
   * end ("CRAWLER TYPES ┄┄┄ Choose 1"). It replaced the centred rust
   * `SectionHeader` and the roster's column headings.
   */
  variant?: 'dashed' | 'solid'
  /**
   * Where a SOLID slab's count sits: at the rule's far end (`end`, the
   * default) or beside its stamp (`label`) — ITUN's Shelves (board S1), whose
   * rule runs on to the shelf's "+ New…" button ("PILOTS 3 ┄┄┄ + NEW PILOT").
   * The dashed slab always counts beside its label.
   */
  countAt?: 'end' | 'label'
}

/**
 * The row, bottom margin included. The margin is inline on purpose: a slab
 * often sits in a `space-y-*` stack, whose child margin it must out-rank (as
 * the old `mb-3.5` utility did by specificity). A caller that retunes the
 * margin passes `style`, which merges over this.
 */
const ROW = {
  alignItems: 'center',
  display: 'flex',
  gap: space[12],
  marginBottom: space[14],
} satisfies CSSProperties

const COUNT = {
  color: color.wkMuted,
  flexShrink: 0,
  fontFamily: font.body,
  fontSize: fontSize.xs,
  fontWeight: weight.bold,
  letterSpacing: 'normal',
  lineHeight: 'calc(1 / 0.75)',
  textTransform: 'none',
} satisfies CSSProperties

/** `countInk="inherit"`: the count takes the ground's ink. */
const COUNT_INHERIT = { ...COUNT, color: 'currentcolor' } satisfies CSSProperties

/** Composed with `POSTER_STAMP`, which supplies face, caps, weight and tracking. */
const SOLID_LABEL = {
  flexShrink: 0,
  fontSize: fontSize.sm,
  lineHeight: 1.625,
  paddingBottom: '3px',
  paddingInline: space[8],
  paddingTop: space[2],
} satisfies CSSProperties

const DASHED_LABEL = {
  color: 'var(--tone-deep, var(--color-ink))',
  flexShrink: 0,
  fontFamily: font.cond,
  fontSize: fontSize.sm,
  fontWeight: weight.bold,
  letterSpacing: tracking.capsWide,
  lineHeight: 'calc(1.25 / 0.875)',
  textTransform: 'uppercase',
} satisfies CSSProperties

const SOLID_RULE = {
  borderTopColor: color.ink50,
  borderTopStyle: 'dashed',
  borderTopWidth: borderWidth.hairline,
  flex: '1 1 0%',
  height: 0,
  minWidth: space[12],
} satisfies CSSProperties

const DASHED_RULE = {
  background:
    'repeating-linear-gradient(90deg, var(--tone-deep, var(--color-ink)) 0 6px, transparent 6px 11px)',
  flex: '1 1 0%',
  height: space[2],
  opacity: 0.4,
} satisfies CSSProperties

const ACTIONS = {
  alignItems: 'center',
  display: 'flex',
  flexShrink: 0,
  gap: space[6],
} satisfies CSSProperties

/**
 * The section header (ruleset §5 atom 7, "section stamp + leader rule";
 * design-spec §2.10 `.slab`): an uppercase cond label with a leader rule.
 * Default ('dashed') keeps the original tone-deep text + dashed rule; 'solid'
 * is the ink section stamp with its count at the end of the rule.
 */
export function Slab({
  label,
  as,
  count,
  countInk = 'muted',
  actions,
  className,
  style,
  id,
  variant = 'dashed',
  countAt = 'end',
}: SlabProps) {
  const isSolid = variant === 'solid'
  const countByLabel = !isSolid || countAt === 'label'
  const Label = as ?? 'span'
  const countNode = count != null && (
    <span style={countInk === 'inherit' ? COUNT_INHERIT : COUNT}>{count}</span>
  )
  return (
    <div className={className} style={style ? { ...ROW, ...style } : ROW}>
      {isSolid ? (
        <Label id={id} className={POSTER_STAMP} style={SOLID_LABEL}>
          {label}
        </Label>
      ) : (
        <Label id={id} style={DASHED_LABEL}>
          {label}
        </Label>
      )}
      {/* The dashed slab counts beside its label; the solid one at the rule's
          end unless `countAt="label"` brings it beside the stamp. */}
      {countByLabel && countNode}
      {isSolid ? (
        <span aria-hidden="true" style={SOLID_RULE} />
      ) : (
        <span aria-hidden="true" style={DASHED_RULE} />
      )}
      {!countByLabel && countNode}
      {/* A div, not a span: actions carry block-level content (the Ko-fi widget
          renders a div), and a div inside a span is invalid HTML. Both are flex
          items of the same row, so nothing moves. */}
      {actions && <div style={ACTIONS}>{actions}</div>}
    </div>
  )
}
