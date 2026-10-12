import type { CSSProperties, ReactNode } from 'react'
import { color, font, fontSize, space, tracking } from '../design/tokens'

/**
 * Page chrome for the Foundations token pages (Theme, Typography), whose
 * specimens come from `_themeTokens.ts`. What a token is FOR is the ruleset's
 * job; the pages link to its section rather than restating it (`RulesetRef`).
 */

import type { ThemeToken } from './_themeTokens'

const RULESET_URL =
  'https://github.com/SalvageUnion-io/SU-SRD/blob/main/docs/design-system/ruleset.md'

/** A citation of the design ruleset section that says what a token is for. */
export function RulesetRef({ section }: { section: string }) {
  return (
    <a href={RULESET_URL} style={{ color: color.ink }}>
      ruleset §{section}
    </a>
  )
}

const pageStyle = {
  display: 'flex',
  flexDirection: 'column',
  gap: space[16],
  padding: space[16],
} satisfies CSSProperties

const headingStyle = {
  color: color.ink,
  fontFamily: font.cond,
  fontSize: fontSize.lg,
  letterSpacing: tracking.capsTight,
  textTransform: 'uppercase',
} satisfies CSSProperties

const blurbStyle = {
  color: color.wkMuted,
  fontFamily: font.body,
  fontSize: fontSize.caption,
  maxWidth: '48rem',
} satisfies CSSProperties

/** A token page: a heading, one line naming the source and the rule, the specimens. */
export function FoundationPage({
  title,
  blurb,
  children,
}: {
  title: string
  blurb: ReactNode
  children: ReactNode
}) {
  return (
    <div style={pageStyle}>
      <h2 style={headingStyle}>{title}</h2>
      <p style={blurbStyle}>{blurb}</p>
      {children}
    </div>
  )
}

const tokenNameStyle = {
  color: color.ink,
  fontFamily: 'monospace',
  fontSize: fontSize.badge,
} satisfies CSSProperties

/** A token's name and its declared value, as the specimen's label. */
export function TokenLabel({ token }: { token: ThemeToken }) {
  return (
    <span style={{ display: 'flex', flexDirection: 'column', gap: space[2] }}>
      <span style={tokenNameStyle}>{token.name}</span>
      <span style={{ ...tokenNameStyle, color: color.wkMuted }}>{token.value}</span>
    </span>
  )
}
