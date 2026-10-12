/**
 * The style objects srd's plain document pages share — `/about`, `/api`,
 * `/changelog`, `/discord` and the two `/bot` policies: a page column under
 * the `ChapterBand`, a centred measure, prose at the reading size, inline code.
 *
 * Style objects over `tokens.ts`, not classes, because none of these has a
 * stateful or responsive variant (tailwind-removal plan §4.1). A part that does
 * — a hover, a breakpoint — is a `srd-*` class in `styles/pages.css`.
 */

import {
  borderWidth,
  color,
  font,
  fontSize,
  radius,
  space,
  tracking,
  weight,
} from 'component-lib/design/tokens'
import type { CSSProperties } from 'react'

/** The page column: fills `<main>`, the band on top, a 48px foot. */
export const DOC_PAGE = {
  display: 'flex',
  flex: 1,
  flexDirection: 'column',
  paddingBottom: space[48],
  width: '100%',
} satisfies CSSProperties

/** The centred measure under the band — 48rem (the policies) or 64rem. */
export function docMeasure(maxWidth: '48rem' | '64rem', gap: string): CSSProperties {
  return {
    display: 'flex',
    flexDirection: 'column',
    gap,
    marginInline: 'auto',
    maxWidth,
    paddingInline: space[24],
    paddingTop: space[32],
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
    paddingBlock: space[2],
    paddingInline: space[4],
  }
}

/** The "last updated" stamp and small print of the policies. */
export const SMALL_PRINT = {
  color: color.ink60,
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

/** The policies' "Last updated" stamp. */
export const LAST_UPDATED_STAMP = {
  ...SMALL_PRINT,
  letterSpacing: tracking.capsSnug,
  textTransform: 'uppercase',
} satisfies CSSProperties

/** A tip or aside: an ink rule down its left edge on the page ground. */
export const ASIDE = {
  backgroundColor: color.wkBg,
  borderColor: color.ink,
  borderRadius: radius.panel,
  borderStyle: 'solid',
  borderWidth: '0 0 0 4px',
  paddingBlock: space[12],
  paddingInline: space[16],
} satisfies CSSProperties
