/**
 * The breakpoint ladder (chrome K2), phone-first: a stylesheet writes
 * `(width >= 40rem)` and its complement `not (width >= 40rem)`, media and
 * container queries alike; a script builds its query here (`widthAtLeast`).
 * No stylesheet twin: a custom property cannot stand in a query.
 */
export const breakpoint = {
  sm: '40rem',
  md: '48rem',
  lg: '64rem',
  xl: '80rem',
} as const

/** A rung as a media condition, `(width >= 48rem)`: for `matchMedia` and an image's `sizes`. */
export const widthAtLeast = (rung: keyof typeof breakpoint): string =>
  `(width >= ${breakpoint[rung]})`
