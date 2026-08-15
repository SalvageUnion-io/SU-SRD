import type { CSSProperties } from 'react'
import { borderWidth, color, font, fontSize, radius, space, tracking, weight } from './tokens'

/**
 * The shared chrome, as `CSSProperties` objects.
 *
 * Layer 1 of the Tailwind removal (#798, epic #802). These are the STATIC half
 * of the split rule — read this package's CLAUDE.md for the rule itself, and
 * `src/styles/index.css` for the other half. In one line:
 *
 *   style object  → static values: colour, padding, font, border, layout
 *   stylesheet class → anything stateful or conditional: `:hover`,
 *                      `:focus-visible`, `:disabled`, `@media`, pseudo-elements
 *
 * The boundary is not a preference, it is a capability: an inline `style={}`
 * object has no way to express any of the second list. A component uses both —
 * the object on `style=`, the class on `className=`.
 *
 * Every object is `satisfies CSSProperties`, so it keeps its literal type (a
 * caller can read `panel.borderRadius`) while still being checked as a real
 * style object. `as CSSProperties` would have thrown that away, and an
 * annotation would have widened every value to `string`.
 *
 * This is the STARTING set, not the finished one. It covers the surfaces,
 * type roles and layout primitives that recur across the package; the
 * migration layers (#799, #800) add to it as call sites move, and anything
 * that turns out to belong to exactly one component belongs in that component,
 * not here.
 */

// ── Surfaces ────────────────────────────────────────────────────────────────

/** The page ground. Paired with the `body` binding in `styles/index.css`. */
export const page = {
  backgroundColor: color.paper,
  color: color.ink,
  fontFamily: font.body,
} satisfies CSSProperties

/** App-chrome panel — the outer frame of a section of the app. */
export const panel = {
  backgroundColor: color.paper,
  border: `${borderWidth.chrome} solid ${color.ink}`,
  borderRadius: radius.panel,
  padding: space[12],
} satisfies CSSProperties

/** A card, input or button's shell: the 3px outer radius, chrome weight. */
export const card = {
  backgroundColor: color.paper,
  border: `${borderWidth.chrome} solid ${color.ink}`,
  borderRadius: radius.card,
  padding: space[8],
} satisfies CSSProperties

/** An entity card — the 3px frame that says "this is the thing the page is
 *  about" (design-spec §1.3). */
export const entityCard = {
  backgroundColor: color.paper,
  border: `${borderWidth.entity} solid ${color.ink}`,
  borderRadius: radius.card,
} satisfies CSSProperties

/** The step off-paper that makes a card read as a panel. */
export const workshopGround = {
  backgroundColor: color.wkBg,
  color: color.ink,
} satisfies CSSProperties

/** A 1px rule. `wkFaint` is non-text only, which is exactly what a divider is. */
export const hairline = {
  border: 'none',
  borderTop: `${borderWidth.hairline} solid ${color.wkFaint}`,
  margin: 0,
} satisfies CSSProperties

// ── Type roles ──────────────────────────────────────────────────────────────

/** Body copy. */
export const body = {
  color: color.ink,
  fontFamily: font.body,
  fontSize: fontSize.caption,
  fontWeight: weight.normal,
} satisfies CSSProperties

/** Small supporting copy — hints, empty states, subtitles. */
export const caption = {
  color: color.wkMuted,
  fontFamily: font.body,
  fontSize: fontSize.caption,
  fontWeight: weight.normal,
} satisfies CSSProperties

/** The condensed all-caps label — the workhorse of the chrome. */
export const capsLabel = {
  color: color.ink,
  fontFamily: font.cond,
  fontSize: fontSize.label,
  fontWeight: weight.bold,
  letterSpacing: tracking.capsTight,
  textTransform: 'uppercase',
} satisfies CSSProperties

/** The stamp's caps label — one rung up from `capsLabel`. */
export const stampLabel = {
  color: color.ink,
  fontFamily: font.cond,
  fontSize: fontSize.labelLg,
  fontWeight: weight.bold,
  letterSpacing: tracking.capsTight,
  textTransform: 'uppercase',
} satisfies CSSProperties

/** The brand eyebrow — the ONE place the 0.22em ladder rung is used. */
export const eyebrow = {
  color: color.wkMuted,
  fontFamily: font.cond,
  fontSize: fontSize.micro,
  fontWeight: weight.semibold,
  letterSpacing: tracking.eyebrow,
  textTransform: 'uppercase',
} satisfies CSSProperties

/** A section heading inside a panel. */
export const sectionTitle = {
  color: color.ink,
  fontFamily: font.cond,
  fontSize: fontSize.lede,
  fontWeight: weight.bold,
  letterSpacing: tracking.capsSnug,
  textTransform: 'uppercase',
} satisfies CSSProperties

/** A readout meant to be read across a table, not a label. */
export const readout = {
  color: color.ink,
  fontFamily: font.body,
  fontSize: fontSize.readout,
  fontWeight: weight.bold,
  lineHeight: 1,
} satisfies CSSProperties

// ── Layout ──────────────────────────────────────────────────────────────────

/** Horizontal run, vertically centred, on the 8px rhythm. */
export const row = {
  alignItems: 'center',
  display: 'flex',
  flexDirection: 'row',
  gap: space[8],
} satisfies CSSProperties

/** Vertical stack on the 8px rhythm. */
export const stack = {
  display: 'flex',
  flexDirection: 'column',
  gap: space[8],
} satisfies CSSProperties

/** Label on the left, value hard right — the KV row shape. */
export const spread = {
  alignItems: 'center',
  display: 'flex',
  flexDirection: 'row',
  gap: space[8],
  justifyContent: 'space-between',
} satisfies CSSProperties

// ── Controls ────────────────────────────────────────────────────────────────

/**
 * The static half of a button. Its `:hover`, `:focus-visible` and `:disabled`
 * treatments live in `styles/index.css` as `.su-button`, because none of the
 * three can be written here — that is the split rule in one object.
 */
export const buttonBase = {
  alignItems: 'center',
  border: `${borderWidth.chrome} solid ${color.ink}`,
  borderRadius: radius.card,
  cursor: 'pointer',
  display: 'inline-flex',
  fontFamily: font.cond,
  fontSize: fontSize.label,
  fontWeight: weight.bold,
  gap: space[6],
  justifyContent: 'center',
  letterSpacing: tracking.capsTight,
  padding: `${space[6]} ${space[12]}`,
  textTransform: 'uppercase',
} satisfies CSSProperties

/** The primary action. Rust is the ONE action colour (ruleset §3.1). */
export const buttonPrimary = {
  ...buttonBase,
  backgroundColor: color.rust,
  borderColor: color.rust,
  color: color.paper,
} satisfies CSSProperties

/** The secondary action — the same shape, on paper. */
export const buttonSecondary = {
  ...buttonBase,
  backgroundColor: color.paper,
  color: color.ink,
} satisfies CSSProperties

/**
 * The static half of a text input. Its `:focus` ring is `.su-input` in
 * `styles/index.css` — an editable control shows the ring on every focus, not
 * only on keyboard focus, which is why it is not the `:focus-visible` rung.
 */
export const inputBase = {
  backgroundColor: color.paper,
  border: `${borderWidth.chrome} solid ${color.ink}`,
  borderRadius: radius.card,
  color: color.ink,
  fontFamily: font.body,
  fontSize: fontSize.sm,
  padding: `${space[6]} ${space[8]}`,
  width: '100%',
} satisfies CSSProperties

// ── Utility ─────────────────────────────────────────────────────────────────

/**
 * Present to a screen reader, absent to the eye. The clip-rect idiom rather
 * than `display: none` or `visibility: hidden`, both of which remove the
 * element from the accessibility tree as well.
 */
export const visuallyHidden = {
  border: 0,
  clip: 'rect(0 0 0 0)',
  clipPath: 'inset(50%)',
  height: '1px',
  overflow: 'hidden',
  padding: 0,
  position: 'absolute',
  whiteSpace: 'nowrap',
  width: '1px',
} satisfies CSSProperties
