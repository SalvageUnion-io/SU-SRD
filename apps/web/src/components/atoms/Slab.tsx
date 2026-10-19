import type { CSSProperties, ElementType, ReactNode } from 'react'
import { isValidElement } from 'react'
import { borderWidth, color, font, fontSize, space, weight } from '../../design/tokens'
import type { ChipSet } from '../entity'
import { Chips } from '../entity'
import { POSTER_STAMP } from './posterStamp'
import type { SlabCount } from './slabSummary'
import { slabSummary, summaryFacts } from './slabSummary'

export type { SlabCount } from './slabSummary'

const NO_CHIPS: ChipSet = { durations: [], facts: [], tags: [] }

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
   * Where the count sits: at the rule's far end (`end`, the default) or
   * beside its stamp (`label`) — the app's Shelves (board S1), whose rule runs
   * on to the shelf's "+ New…" button ("PILOTS 3 ┄┄┄ + NEW PILOT").
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
const LABEL = {
  flexShrink: 1,
  minWidth: 'min-content',
  fontSize: fontSize.sm,
  lineHeight: 1.625,
  paddingBottom: space[2],
  paddingInline: space[8],
  paddingTop: space[2],
} satisfies CSSProperties

const RULE = {
  borderTopColor: color.ink50,
  borderTopStyle: 'solid',
  borderTopWidth: borderWidth.hairline,
  flex: '1 1 0%',
  height: 0,
  minWidth: space[12],
} satisfies CSSProperties

const ACTIONS = {
  alignItems: 'center',
  display: 'flex',
  flexShrink: 0,
  gap: space[6],
} satisfies CSSProperties

/**
 * The section header (ruleset §5 atom 7, "section stamp + leader rule";
 * design-spec §2.10 `.slab`): the solid ink section stamp, paper text, then an
 * ink hairline leader running to its count at the far end ("CRAWLER TYPES ┄┄┄
 * Choose 1"). Every section head is this one Slab: it takes no variant, since
 * a dashed head would read as user-made (ruleset §3.9, hard rule R1). It
 * replaced the centred rust `SectionHeader` and the roster's column headings.
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
  countAt = 'end',
}: SlabProps) {
  const countByLabel = countAt === 'label'
  const Label = as ?? 'span'
  const countInkStyle = countInk === 'inherit' ? COUNT_INHERIT : COUNT
  const counts = slabCounts(count)
  // The summary (C10): at most two counts, drawn by `Chips` as measures; a
  // count's note ("as printed") follows the strip as muted text.
  const chips = counts && slabSummary(counts)
  const titles = chips?.flatMap((chip) => (chip.title ? [chip.title] : [])) ?? []
  const countNode = chips ? (
    <span style={COUNT_STAT} title={titles.length ? titles.join('; ') : undefined}>
      <Chips as="span" size="compact" chips={{ ...NO_CHIPS, facts: summaryFacts(chips) }} />
      {chips.map((chip) =>
        chip.note != null ? (
          <span key={chip.label} style={countInkStyle}>
            {chip.note}
          </span>
        ) : null
      )}
    </span>
  ) : (
    count != null && (
      <span style={countInk === 'inherit' ? HINT_INHERIT : HINT}>{count as ReactNode}</span>
    )
  )
  return (
    <div className={className} style={style ? { ...ROW, ...style } : ROW} data-slab="">
      <Label id={id} className={POSTER_STAMP} style={LABEL}>
        {label}
      </Label>
      {/* The count sits at the rule's end unless `countAt="label"` brings it
          beside the stamp. */}
      {countByLabel && countNode}
      <span aria-hidden="true" style={RULE} />
      {!countByLabel && countNode}
      {/* A div, not a span: actions carry block-level content (the Ko-fi widget
          renders a div), and a div inside a span is invalid HTML. Both are flex
          items of the same row, so nothing moves. */}
      {actions && <div style={ACTIONS}>{actions}</div>}
    </div>
  )
}
