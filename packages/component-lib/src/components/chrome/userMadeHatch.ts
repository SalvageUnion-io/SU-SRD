/**
 * The user-made hatch (ruleset §3.9): the one mark a full page made by a
 * player wears on its colour bands — its chapter band, and the page's foot.
 *
 * A **pattern**, not shading (ruleset §3.5): `repeating-linear-gradient` with
 * coincident stops, so it paints hard ink rules at 135° on whatever colour the
 * band already is and never blends. That is why it may be a gradient at all,
 * and why it lives alone in this file: `tools/rules/designTokens.ts` exempts
 * this one file from the gradient rule, so a second gradient cannot ride in on
 * the exemption.
 *
 * It sits over the band's own colour (`background-color`) as a
 * `background-image`, so the chapter tone still names the chapter and the
 * hatch only says "a player made this".
 */
export const USER_MADE_HATCH =
  'repeating-linear-gradient(135deg, transparent 0 9px, var(--color-ink-20) 9px 11px)'
