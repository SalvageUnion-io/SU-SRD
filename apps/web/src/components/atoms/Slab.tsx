import type { CSSProperties, ElementType, ReactNode } from 'react'
import { isValidElement } from 'react'
import { borderWidth, color, font, fontSize, space, tracking, weight } from '../../design/tokens'
import { POSTER_STAMP } from './posterStamp'
import type { StatBorderState } from './Stat'
import { Stat } from './Stat'

/**
 * A slab's count when it is a VALUE (`SLOTS | 3/6`, `INTACT | 10/10`): a
 * label-first horizontal `Stat` chip (ruleset §3.7, EDL E9), never trailing
 * text ("3/6 slots"). A word ("Choose 1", "Tree") stays a `ReactNode`.
 */
export type SlabCount = {
  /** The chip's label: what is counted ('Slots', 'Intact'). */
  label: string
  /** The reading; with `max` it reads `value/max`. */
  value: number | string
  max?: number
  /** The chip's border state: `critical` when the reading is over its cap. */
  state?: StatBorderState
  /** A muted word after the chip ("as printed"). */
  note?: ReactNode
  /** The chip's hover text (where an "as printed" count is printed). */
  title?: string
}

/** A `SlabCount`, not a node: an object with a label and a value. */
function isSlabCount(count: unknown): count is SlabCount {
  return (
    typeof count === 'object' &&
    count !== null &&
    !isValidElement(count) &&
    'label' in count &&
    'value' in count
  )
}

/** One value count or several (a loadout's `SYSTEMS | 3/4`, `MODULES | 2/3`). */
function slabCounts(count: unknown): readonly SlabCount[] | undefined {
  if (isSlabCount(count)) return [count]
  if (Array.isArray(count) && count.length > 0 && count.every(isSlabCount)) return count
  return undefined
}

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
   * lists — sections don't count themselves. A VALUE count is a
   * `SlabCount`, drawn as a label-first Stat chip (`SLOTS | 3/6`); several
   * draw side by side.
   */
  count?: ReactNode | SlabCount | readonly SlabCount[]
  /**
   * The count's ink. 'muted' (default) is `wkMuted`, which clears AA on paper
   * and the workshop grounds only. 'inherit' prints it in the surrounding ink
   * (`currentcolor`), for a slab printed straight on a tinted ground: on
   * the app's wizard step card `wkMuted` measures 3.78 / 3.03 / 2.65:1 (pilot /
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
   * default) or beside its stamp (`label`) — the app's Shelves (board S1), whose
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

/**
 * A hint at the rule's end ("The Mediator runs it; …") wraps rather than
 * squeezing the stamp: it gives way first, right-aligned under itself.
 */
const HINT = { ...COUNT, flexShrink: 1, minWidth: 0, textAlign: 'right' } satisfies CSSProperties
const HINT_INHERIT = { ...HINT, color: 'currentcolor' } satisfies CSSProperties

/** A value count: the chip, then its muted note. */
const COUNT_STAT = {
  alignItems: 'center',
  display: 'inline-flex',
  flexShrink: 0,
  gap: space[6],
} satisfies CSSProperties

/** Composed with `POSTER_STAMP`, which supplies face, caps, weight and tracking. */
/* A label longer than its row wraps between its words rather than pushing the
   rule off the page; a word is never cut (`min-content`). */
const SOLID_LABEL = {
  flexShrink: 1,
  minWidth: 'min-content',
  fontSize: fontSize.sm,
  lineHeight: 1.625,
  paddingBottom: '3px',
  paddingInline: space[8],
  paddingTop: space[2],
} satisfies CSSProperties

const DASHED_LABEL = {
  color: 'var(--tone-deep, var(--color-ink))',
  flexShrink: 1,
  minWidth: 'min-content',
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
  const countInkStyle = countInk === 'inherit' ? COUNT_INHERIT : COUNT
  const chips = slabCounts(count)
  const countNode = chips ? (
    <span style={COUNT_STAT}>
      {chips.map((chip) => (
        <span key={chip.label} style={COUNT_STAT} title={chip.title}>
          <Stat
            orientation="horizontal"
            size="compact"
            label={chip.label}
            value={chip.value}
            max={chip.max}
            state={chip.state}
          />
          {chip.note != null && <span style={countInkStyle}>{chip.note}</span>}
        </span>
      ))}
    </span>
  ) : (
    count != null && (
      <span style={countInk === 'inherit' ? HINT_INHERIT : HINT}>{count as ReactNode}</span>
    )
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
