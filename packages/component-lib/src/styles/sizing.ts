/**
 * The size ladder — FULL / COMPACT / MINI.
 *
 * One vocabulary for every three-step size axis in the system. Before this,
 * axes were spelled `sm | md | lg` (Badge) and `xs | sm | md | lg` (Button),
 * which named a size relative to *that component* rather than to a shared
 * scale — so `sm` meant one thing on a stamp and another on a button, and
 * nothing told you which rung a surface was supposed to be at.
 *
 * The rungs are defined by INTENT, not by pixel count:
 *
 *   FULL     The reading size. A surface the user is looking *at* — a sheet
 *            header, a primary action, a card the page is about. Type is set
 *            for comfortable reading; padding is generous enough that the
 *            element reads as a destination.
 *
 *   COMPACT  The default. A surface the user is scanning *past* on the way to
 *            something else — a listing row, a section label, a secondary
 *            control. This is where most of the system sits, which is why it
 *            is the default rung on every axis rather than the middle of a
 *            symmetric three.
 *
 *   MINI     The annotation size. Something attached to another element and
 *            never read on its own — a count, a tech-level tag, a stamp riding
 *            a card frame. Legible, but deliberately subordinate.
 *
 * A component does NOT have to offer all three. It should offer the rungs it
 * genuinely has, and name them from this list — a two-rung component with
 * `compact` and `mini` is correct and complete.
 */

export type SizeRung = 'full' | 'compact' | 'mini'

/**
 * The default rung for scan-past elements — stamps, chips, cells — stated once
 * so no component invents a different default. A component whose RESTING
 * anatomy is a destination readout (VitalGauge's poster bar, Callout's reading
 * note) instead documents an explicit `full` default on its own axis: the rung
 * NAMES are universal; which rung a component rests at follows its intent.
 */
export const DEFAULT_RUNG: SizeRung = 'compact'

/**
 * Type scale per rung, as theme tokens (see `theme.css`).
 *
 * `label` is the condensed-caps size used by stamps, eyebrows and column
 * headers; `body` is the prose size used for readable copy at that rung. They
 * are separate because a rung's *label* and its *prose* do not move together —
 * a compact row can carry mini labels above body-size text.
 */
export const RUNG_TYPE: Record<SizeRung, { label: string; body: string }> = {
  full: { label: 'text-sm', body: 'text-lede' },
  compact: { label: 'text-xs', body: 'text-caption' },
  mini: { label: 'text-badge', body: 'text-note' },
}

/**
 * Padding per rung for a stamp-like inline element. Components with different
 * geometry (a button has a larger tap target than a stamp) scale their own
 * padding, but keep the same rung NAMES so the vocabulary still reads.
 */
export const RUNG_INLINE_PADDING: Record<SizeRung, string> = {
  full: 'px-2 py-1',
  compact: 'px-1.5 py-0.5',
  mini: 'px-1 py-0.5',
}
