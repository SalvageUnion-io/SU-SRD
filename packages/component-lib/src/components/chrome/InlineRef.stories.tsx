import type { CSSProperties } from 'react'
import { SalvageUnionReference } from 'salvageunion-reference'
import { color, font, fontSize, space } from '../../design/tokens'
import type { Story } from '../../stories/_harness'
import { InlineRef } from './InlineRef'

export default {
  title: 'Atoms/Inline Ref',
}

// A real SRD system drives the resolved reference + its slug href.
const system = SalvageUnionReference.Systems.all()[0]
const systemName = system?.name ?? '30mm Autocannon'
const systemSlug = systemName
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-|-$/g, '')
const systemHref = `/systems/${systemSlug}`

const PAGE = {
  backgroundColor: color.paper,
  color: color.ink,
  display: 'flex',
  flexDirection: 'column',
  gap: space[20],
  padding: space[20],
} satisfies CSSProperties

const INTRO = {
  color: color.wkMuted,
  fontFamily: font.body,
  fontSize: fontSize.xs,
  lineHeight: 1.625,
  maxWidth: '42rem',
} satisfies CSSProperties

/** `font-body text-sm`, with `text-sm`'s paired line-height. */
const PROSE = {
  fontFamily: font.body,
  fontSize: fontSize.sm,
  lineHeight: 'calc(1.25 / 0.875)',
} satisfies CSSProperties

const STANDALONE = {
  display: 'flex',
  flexDirection: 'column',
  gap: space[6],
} satisfies CSSProperties

const NOTE = {
  color: color.wkMuted,
  fontFamily: font.body,
  fontSize: fontSize.badge,
} satisfies CSSProperties

/** Navigable vs inert references, in prose and standalone — on one page. */
export const Default: Story = () => (
  <div style={PAGE}>
    <p style={INTRO}>
      An in-prose entity reference: navigable (rust border, a real keyboard-reachable link, from
      `href`) or inert (ink dashed border — only summons a tooltip).
    </p>
    <div style={{ ...PROSE, maxWidth: '28rem' }}>
      Mount a{' '}
      <InlineRef href={systemHref} title={`${systemName} — navigable`}>
        {systemName}
      </InlineRef>{' '}
      for close work, or an{' '}
      <InlineRef title="Inert — summons a tooltip">unresolved Widget</InlineRef> if the reference
      can&apos;t be found.
    </div>
    <div
      style={{
        ...PROSE,
        alignItems: 'flex-start',
        display: 'flex',
        flexWrap: 'wrap',
        gap: space[24],
      }}
    >
      <div style={STANDALONE}>
        <InlineRef href={systemHref} title={systemName}>
          {systemName}
        </InlineRef>
        <code style={NOTE}>navigable (href)</code>
      </div>
      <div style={STANDALONE}>
        <InlineRef title="No such entity">Phantom System</InlineRef>
        <code style={NOTE}>inert</code>
      </div>
    </div>
  </div>
)
