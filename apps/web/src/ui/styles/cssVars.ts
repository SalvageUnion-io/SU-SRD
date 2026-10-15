import type { CSSProperties } from 'react'

/**
 * `CSSProperties` extended with `--custom-property` keys, so a style object
 * that sets CSS custom properties (`--tone`, `--tone-deep`, …) can be typed
 * with a plain annotation instead of an `as CSSProperties` assertion.
 *
 * React's `CSSProperties` deliberately omits custom properties; this
 * intersection admits exactly the `--*` template-literal keys and nothing
 * else, and stays assignable to `CSSProperties` wherever a `style` prop
 * expects one.
 */
export type CSSVarStyle = CSSProperties & Record<`--${string}`, string | number | undefined>
