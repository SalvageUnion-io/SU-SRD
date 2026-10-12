import type { CSSProperties, ReactNode } from 'react'
import { color, font, fontSize, radius, space, tracking } from '../design/tokens'
import { storyGroups, storySubgroups } from './_groups'
import type { Story } from './_harness'
import { Caption } from './_harness'

export default {
  title: 'Foundations/Styleguide',
}

// The catalog's front door: what it is, how the sidebar is ordered, and where
// the rules live. It restates none of them — the group definitions and story
// conventions are component-lib's CLAUDE.md, the contributor reference is
// docs/ARCHITECTURE.md#areas, and the groups below are read from
// `_groups.ts`, the list the coverage guard and the sidebar both use.

const REPO_URL = 'https://github.com/SalvageUnion-io/SU-SRD/blob/main'

const titleStyle = {
  color: color.ink,
  fontFamily: font.cond,
  fontSize: fontSize['2xl'],
  letterSpacing: tracking.capsTight,
  textTransform: 'uppercase',
} satisfies CSSProperties

const proseStyle = {
  color: color.wkMuted,
  fontSize: fontSize.sm,
  lineHeight: 1.625,
  maxWidth: '68ch',
} satisfies CSSProperties

const stampStyle = {
  backgroundColor: color.ink,
  borderRadius: radius.none,
  color: color.paper,
  display: 'inline-block',
  fontFamily: font.cond,
  fontSize: fontSize.xs,
  letterSpacing: tracking.capsTight,
  padding: `${space[4]} ${space[8]}`,
  textTransform: 'uppercase',
} satisfies CSSProperties

const column = (gap: string): CSSProperties => ({ display: 'flex', flexDirection: 'column', gap })

function DocLink({ path, children }: { path: string; children: ReactNode }) {
  return (
    <a href={`${REPO_URL}/${path}`} style={{ color: color.ink }}>
      {children}
    </a>
  )
}

export const Overview: Story = () => (
  <div style={{ ...column(space[24]), maxWidth: '80ch', padding: space[8] }}>
    <div style={column(space[8])}>
      <Caption>Salvage Union · component-lib</Caption>
      <h1 style={titleStyle}>The Styleguide</h1>
    </div>

    <p style={proseStyle}>
      The catalog of every UI primitive srd and ITUN ship, rendered in its real states with the real
      tokens and real Salvage Union data — never lorem. The sidebar runs from raw material to
      finished game components.
    </p>

    <div style={column(space[12])}>
      <Caption>the groups, in sidebar order</Caption>
      {storyGroups.map((group) => (
        <div key={group} style={{ alignItems: 'center', display: 'flex', gap: space[12] }}>
          <span style={{ width: '128px' }}>
            <span style={stampStyle}>{group}</span>
          </span>
          {storySubgroups[group] && (
            <span style={proseStyle}>{storySubgroups[group].join(' · ')}</span>
          )}
        </div>
      ))}
    </div>

    <p style={proseStyle}>
      What belongs in each group and how a story is written:{' '}
      <DocLink path="packages/component-lib/CLAUDE.md#stories">component-lib CLAUDE.md</DocLink>.
      The contributor reference:{' '}
      <DocLink path="docs/ARCHITECTURE.md#areas">component catalog</DocLink>. What the tokens are
      for: <DocLink path="docs/design-system/ruleset.md">the design ruleset</DocLink>.
    </p>
  </div>
)
