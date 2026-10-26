/**
 * The app's three Sizes — Full, Compact, Mini.
 *
 * One vocabulary for every size axis in the system: there are exactly these
 * three Sizes, and every component's `size` names its steps from them, never
 * a size relative to *that component* (`sm | md | lg`): so a step means one
 * thing on a stamp and on a button, and says which Size a surface is at.
 *
 * The Sizes are defined by INTENT, not by pixel count:
 *
 *   FULL     The reading size. A surface the user is looking *at* — a sheet
 *            header, a primary action, a card the page is about. Type is set
 *            for comfortable reading; padding is generous enough that the
 *            element reads as a destination.
 *
 *   COMPACT  The default. A surface the user is scanning *past* on the way to
 *            something else — a listing row, a section label, a secondary
 *            control. This is where most of the system sits, which is why it
 *            is the default Size on every axis rather than the middle of a
 *            symmetric three.
 *
 *   MINI     The annotation size. Something attached to another element and
 *            never read on its own — a count, a tech-level tag, a stamp riding
 *            a card frame. Legible, but deliberately subordinate.
 *
 * Each Size is also a HEIGHT for a control (a button, field, switch, search
 * box, chip): `--size-full` 44px, `--size-compact` 32px, `--size-mini` 18px in
 * `theme.css` (`size` in `design/tokens.ts`), whatever the component, on every
 * pointer and screen (hard rule R12): no invisible hit area, no touch lift; a
 * phone that needs a bigger target takes a bigger Size. Controls side by side
 * on one line share one Size (ruleset §4.7); `e2e/sibling-heights.e2e.ts`
 * fails any line whose heights differ.
 *
 * A component does NOT have to offer all three. It should offer the Sizes it
 * genuinely has, and name them from this list — a two-Size component with
 * `compact` and `mini` is correct and complete.
 */

export type Size = 'full' | 'compact' | 'mini'

/**
 * The default Size for scan-past elements — stamps, chips, cells — stated once
 * so no component invents a different default. A component whose RESTING
 * anatomy is a destination readout (VitalGauge's poster bar, Callout's reading
 * note) instead documents an explicit `full` default on its own axis: the Size
 * NAMES are universal; which Size a component rests at follows its intent.
 */
export const DEFAULT_SIZE: Size = 'compact'

/**
 * Type scale per Size, as `.su-rung-*` classes (rules in `styles/partials/atoms.css`,
 * over the `theme.css` type tokens). A class-string export, so stylesheet-only
 * and its class names are public API (ADR-046).
 *
 * `label` is the condensed-caps size used by stamps, eyebrows and column
 * headers; `body` is the prose size used for readable copy at that Size. They
 * are separate because a Size's *label* and its *prose* do not move together —
 * a compact row can carry mini labels above body-size text.
 */
export const SIZE_TYPE: Record<Size, { label: string; body: string }> = {
  full: { label: 'su-rung-label--full', body: 'su-rung-body--full' },
  compact: { label: 'su-rung-label--compact', body: 'su-rung-body--compact' },
  mini: { label: 'su-rung-label--mini', body: 'su-rung-body--mini' },
}

/**
 * Padding per Size for a stamp-like inline element, as `.su-rung-pad--*`
 * classes. Components with different
 * geometry (a button has a larger tap target than a stamp) scale their own
 * padding, but keep the same Size NAMES so the vocabulary still reads.
 */
export const SIZE_INLINE_PADDING: Record<Size, string> = {
  full: 'su-rung-pad--full',
  compact: 'su-rung-pad--compact',
  mini: 'su-rung-pad--mini',
}
