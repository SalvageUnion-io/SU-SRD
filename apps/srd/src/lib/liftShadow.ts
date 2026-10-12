/**
 * Tailwind's `shadow-lg`, carried verbatim for srd's two floating search
 * surfaces (the mobile search sheet and the search dropdown) when they moved
 * off Tailwind: neutral black at 10%, the tint component-lib's ports keep too.
 * Inline, because neither surface changes it on any state.
 */
const shadowTint = 'rgb(0 0 0 / 0.1)' // design-tokens-ignore: Tailwind's shadow-lg tint, ported verbatim

export const LIFT_SHADOW = `0 10px 15px -3px ${shadowTint}, 0 4px 6px -4px ${shadowTint}`
