/**
 * The style objects srd's plain document pages share — `/about`, `/api`,
 * `/changelog`, `/discord` and the two `/bot` policies: a page column under
 * the `ChapterBand`, a reading column, prose at the reading size, inline code.
 *
 * Style objects over `tokens.ts`, not classes, because none of these has a
 * stateful or responsive variant (ADR-046). A part that does
 * — a hover, a breakpoint — is a `srd-*` class in `styles/pages.css`.
 */

import type { CSSProperties } from 'react'
import { borderWidth, color, font, fontSize, radius, space, weight } from '../design/tokens'

/** The page column: fills `<main>`, the band on top, a 48px foot. */
export const DOC_PAGE = {
  display: 'flex',
  flex: 1,
  flexDirection: 'column',
  paddingBottom: space[48],
  width: '100%',
} satisfies CSSProperties

/** The reading column inside the page body — 48rem (the policies) or 64rem —
 *  on the page's one gutter, as a guide's prose column is. */
export function docMeasure(maxWidth: '48rem' | '64rem', gap: string): CSSProperties {
  return {
    display: 'flex',
    flexDirection: 'column',
    gap,
    maxWidth,
    paddingTop: space[8],
    width: '100%',
  }
}

/** Body prose at the reading size. */
export const PROSE = { fontSize: fontSize.sm, lineHeight: 1.625 } satisfies CSSProperties

/** A column of prose blocks. */
export function proseColumn(gap: string): CSSProperties {
  return { ...PROSE, display: 'flex', flexDirection: 'column', gap }
}

/** A plain column with no type of its own. */
export function column(gap: string): CSSProperties {
  return { display: 'flex', flexDirection: 'column', gap }
}

/** A bulleted list, its items a column. */
export function bulletList(gap: string, indent: 'padding' | 'margin'): CSSProperties {
  return {
    display: 'flex',
    flexDirection: 'column',
    gap,
    listStyleType: 'disc',
    ...(indent === 'padding' ? { paddingLeft: space[20] } : { marginLeft: space[20] }),
  }
}

/** Inline code on the page ground (`onPaper` for code inside a ground-coloured block). */
export function inlineCode(onPaper = false): CSSProperties {
  return {
    backgroundColor: onPaper ? color.paper : color.wkBg,
    borderRadius: radius.card,
    // A long path breaks rather than pushing a phone-width page sideways.
    overflowWrap: 'anywhere',
    paddingBlock: space[2],
    paddingInline: space[4],
  }
}

/** The "last updated" stamp and small print of the policies, in `wkMuted`:
 *  12px text needs 4.5:1, which `ink60` misses on the page ground. */
export const SMALL_PRINT = {
  color: color.wkMuted,
  fontSize: fontSize.xs,
  lineHeight: 'calc(1 / 0.75)',
} satisfies CSSProperties

/** A bold prose link (`InlineRef`). */
export const BOLD = { fontWeight: weight.bold } satisfies CSSProperties

/** A Panel's header strip — the method or command over its hairline. */
export const PANEL_HEAD = {
  borderColor: color.wkFaint,
  borderStyle: 'solid',
  borderWidth: `0 0 ${borderWidth.chrome}`,
  paddingBlock: space[12],
  paddingInline: space[20],
} satisfies CSSProperties

/** The Panel header's endpoint or command line. */
export const PANEL_TITLE = {
  fontFamily: font.body,
  fontSize: fontSize.base,
  fontWeight: weight.bold,
  lineHeight: 1.5,
  marginTop: space[4],
} satisfies CSSProperties

/** A Panel's body: prose blocks in a column. */
export const PANEL_BODY = {
  ...proseColumn(space[12]),
  paddingBlock: space[16],
  paddingInline: space[20],
} satisfies CSSProperties

export const ITALIC = { fontStyle: 'italic' } satisfies CSSProperties

/** A tip or aside: a framed callout on the page ground — a full chrome-weight
 *  ink frame, never a left rail (ruleset §3.10). */
export const ASIDE = {
  backgroundColor: color.wkBg,
  borderColor: color.ink,
  borderRadius: radius.panel,
  borderStyle: 'solid',
  borderWidth: borderWidth.chrome,
  paddingBlock: space[12],
  paddingInline: space[16],
} satisfies CSSProperties
