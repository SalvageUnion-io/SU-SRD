/**
 * The large lift shadow for srd's two floating search surfaces (the mobile
 * search sheet and the search dropdown): neutral black at 10%, the tint
 * the UI library's lifts use too.
 * Inline, because neither surface changes it on any state.
 */
const shadowTint = 'rgb(0 0 0 / 0.1)' // design-tokens-ignore: the large lift shadow's tint, neutral black

export const LIFT_SHADOW = `0 10px 15px -3px ${shadowTint}, 0 4px 6px -4px ${shadowTint}`
