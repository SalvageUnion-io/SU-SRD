import type { Story } from '@ladle/react'
import type { CSSProperties, ReactNode } from 'react'
import { color, font, fontSize, radius, space, tracking, weight } from '../design/tokens'
import { Caption } from './_harness'

export default {
  title: 'Foundations/Styleguide',
}

// The orientation front-door for the catalog. This page is DOCUMENTATION rendered
// as a story: it explains how to read the catalog and how to add to it, in the
// catalog's own voice (paper canvas, condensed caps labels, canon tokens). The
// full contributor reference lives at docs/design-system/ladle-styleguide.md.
//
// Migrated off Tailwind in #799 (epic #802). Every value is read from
// `design/tokens.ts`; the `ch`/`rem` measures are the Tailwind rungs ported
// verbatim, since a line-length measure is not a token on any scale here.

// ── Type roles ──────────────────────────────────────────────────────────────

const titleStyle = {
  color: color.ink,
  fontFamily: font.cond,
  fontSize: fontSize.xl2,
  letterSpacing: tracking.capsTight,
  textTransform: 'uppercase',
} satisfies CSSProperties

const sectionHeadingStyle = {
  color: color.ink,
  fontFamily: font.cond,
  fontSize: fontSize.lg,
  letterSpacing: tracking.capsTight,
  textTransform: 'uppercase',
} satisfies CSSProperties

/** Running documentation copy. `leading-relaxed` is 1.625. */
const proseStyle = {
  color: color.wkMuted,
  fontSize: fontSize.sm,
  lineHeight: 1.625,
  maxWidth: '68ch',
} satisfies CSSProperties

/** An inline term lifted back to primary ink inside muted prose. */
const inkStyle = { color: color.ink } satisfies CSSProperties

const emphasisStyle = { fontWeight: weight.semibold } satisfies CSSProperties

/** A square ink stamp — the catalog's canonical label chip. */
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

// ── Layout ──────────────────────────────────────────────────────────────────

/** The page column. `max-w-[80ch]` ported verbatim. */
const pageStyle = {
  display: 'flex',
  flexDirection: 'column',
  gap: space[24],
  maxWidth: '80ch',
  padding: space[8],
} satisfies CSSProperties

const stack = (gap: string): CSSProperties => ({
  display: 'flex',
  flexDirection: 'column',
  gap,
})

function Title({ children }: { children: ReactNode }) {
  return <h1 style={titleStyle}>{children}</h1>
}

function SectionHeading({ children }: { children: ReactNode }) {
  return <h2 style={sectionHeadingStyle}>{children}</h2>
}

function Prose({ children }: { children: ReactNode }) {
  return <p style={proseStyle}>{children}</p>
}

function Rule({ children }: { children: ReactNode }) {
  return (
    <li style={proseStyle}>
      <span style={inkStyle}>{children}</span>
    </li>
  )
}

function Stamp({ children }: { children: ReactNode }) {
  return <span style={stampStyle}>{children}</span>
}

/** A bulleted rule list. */
function Rules({ children }: { children: ReactNode }) {
  return (
    <ul style={{ ...stack(space[8]), listStyleType: 'disc', paddingLeft: space[24] }}>
      {children}
    </ul>
  )
}

// --- Overview: what this catalog is, and how to read it -------------------

export const Overview: Story = () => (
  <div style={pageStyle}>
    <div style={stack(space[8])}>
      <Caption>Salvage Union · component-lib</Caption>
      <Title>The Styleguide</Title>
    </div>

    <Prose>
      This is the single, authoritative catalog for the design system. Every UI primitive the apps
      ship — <span style={inkStyle}>srd</span> and <span style={inkStyle}>itun</span> — is rendered
      here, in its real states, with the real design tokens and real Salvage Union data. If a
      component is public, it appears here; if it drifts, the catalog shows it. Read the sidebar
      top-to-bottom: it runs from raw material to finished game components.
    </Prose>

    <div style={stack(space[12])}>
      <SectionHeading>The four groups (+ a Legacy drain)</SectionHeading>
      <Caption>sidebar order, top-to-bottom — composition level rising as you descend</Caption>
      <div style={stack(space[12])}>
        <GroupRow
          stamp="Foundations"
          body="Design tokens, layout scaffolding, and the QA harness. No product component — Theme, Layout, the Rendering Matrix, and this page."
        />
        <GroupRow
          stamp="Atoms"
          body="Indivisible primitives: one job, composing no other atom. Text, Slab, Badge, Button, Stat, Vital Gauge, Bay Status."
        />
        <GroupRow
          stamp="Containers"
          body="Content-agnostic wrappers and state shells that hold or announce arbitrary content. Card, Modal, Inset, Banner, Toast, Empty State, Skeleton."
        />
        <GroupRow
          stamp="Compositions"
          body="Domain / game components built from atoms. The Reference Entity family, Choice Groups, Roll Table, App Bar, the Dashboard instruments."
        />
        <GroupRow
          stamp="Legacy"
          body="The drain. A story sits here only while its component still uses pre-canon tokens; once refreshed onto the canon, its story moves out into the right group. Currently empty."
        />
      </div>
    </div>

    <div style={stack(space[12])}>
      <SectionHeading>The one rule that makes it trustworthy</SectionHeading>
      <Prose>
        Every story renders <span style={inkStyle}>real SRD data or real game terms</span> — never
        lorem, placeholder, or invented content. Stories are driven from{' '}
        <code style={inkStyle}>SalvageUnionReference.*</code> fixtures and fed through the real
        components exactly as the apps feed them. A story is a preview of what ships; fake data
        hides the overflow, wrapping, tone, and empty-state bugs a styleguide exists to catch. The
        one exception is a genuinely generic container primitive (e.g. Card), which may show
        abstract content because it is content-agnostic.
      </Prose>
    </div>
  </div>
)

function GroupRow({ stamp, body }: { stamp: string; body: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: space[12] }}>
      <div style={{ width: '120px', flexShrink: 0 }}>
        <Stamp>{stamp}</Stamp>
      </div>
      <p style={{ ...proseStyle, maxWidth: '60ch' }}>{body}</p>
    </div>
  )
}

// --- Conventions: how a story is written ----------------------------------

export const Conventions: Story = () => (
  <div style={pageStyle}>
    <div style={stack(space[8])}>
      <Caption>writing a story</Caption>
      <Title>Conventions</Title>
    </div>

    <Prose>
      Stories are plain function components typed <code style={inkStyle}>Story</code>, in a file
      that carries its meta via a static default export. No args, argTypes, controls, decorators, or
      MSW — interactivity is plain <code style={inkStyle}>useState</code>. The shape:
    </Prose>

    <pre
      style={{
        backgroundColor: color.ink,
        borderRadius: radius.card,
        color: color.paper,
        fontSize: fontSize.xs,
        lineHeight: 1.625,
        maxWidth: '100%',
        overflowX: 'auto',
        padding: space[16],
      }}
    >
      {`import type { Story } from '@ladle/react'
import { SalvageUnionReference } from 'salvageunion-reference'
import { Stat } from './Stat'

export default { title: 'Atoms/Stat' }

const chassis = SalvageUnionReference.Chassis.all()[0]   // REAL data, module top level

export const Anatomies: Story = () => (
  <Stat label="Structure Pts" value={chassis.structurePts} />
)`}
    </pre>

    <Rules>
      <Rule>
        <span style={emphasisStyle}>Title is Group/Title Case</span> and matches the component's
        display name — <code>Atoms/Stat</code>, <code>Containers/Card</code>. Slashes become sidebar
        nesting.
      </Rule>
      <Rule>
        <span style={emphasisStyle}>The file keeps the component symbol name</span> —{' '}
        <code>Stat.stories.tsx</code> — so a symbol grep finds it, and it is co-located beside the
        component.
      </Rule>
      <Rule>
        <span style={emphasisStyle}>title, storyName, and meta must be static literals</span> — they
        are statically analyzed and cannot be built from variables.
      </Rule>
      <Rule>
        <span style={emphasisStyle}>A catch-all "show everything" page is exported as Default</span>{' '}
        — not Variants / Costs / etc.
      </Rule>
      <Rule>
        <span style={emphasisStyle}>No outer paper wrapper</span> — the global canvas
        (.ladle/components.tsx) already frames every story on paper with a mono font and the data
        preload gate.
      </Rule>
      <Rule>
        <span style={emphasisStyle}>Import shared helpers</span> (Caption, frames) from{' '}
        <code>src/stories/_harness.tsx</code> — don't re-declare a local copy. Lead each gallery
        with one line of prose stating the rule it demonstrates.
      </Rule>
    </Rules>
  </div>
)

// --- Contributing: the enforced contract ----------------------------------

export const Contributing: Story = () => (
  <div style={pageStyle}>
    <div style={stack(space[8])}>
      <Caption>adding a component</Caption>
      <Title>The catalog is a contract</Title>
    </div>

    <Prose>
      Coverage is enforced by <code style={inkStyle}>src/story-coverage.test.ts</code>: every
      barrel-exported (<code style={inkStyle}>src/index.ts</code>) visual component must be
      referenced by at least one <code style={inkStyle}>*.stories.tsx</code>. Add a public component
      and you add its story in the same change — CI fails otherwise. That guard is what lets the
      catalog claim to be complete, not "most things, probably."
    </Prose>

    <div style={stack(space[8])}>
      <SectionHeading>Checklist</SectionHeading>
      <Rules>
        <Rule>Component added to the src/index.ts barrel (if public).</Rule>
        <Rule>
          Story co-located beside it, titled with the correct group (not Legacy unless genuinely
          un-refreshed).
        </Rule>
        <Rule>Every example driven by real SRD data through the real components.</Rule>
        <Rule>Interactivity via useState, not args / controls.</Rule>
        <Rule>
          <code>bun run ladle</code> renders it; <code>bun --filter component-lib test</code> passes
          (coverage guard green); <code>ladle:build</code> succeeds.
        </Rule>
      </Rules>
    </div>

    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', gap: space[24] }}>
      <div style={stack(space[4])}>
        <Stamp>Reference</Stamp>
        <Caption>full contributor guide</Caption>
      </div>
      <p style={{ ...proseStyle, maxWidth: '52ch' }}>
        The complete reference — config options, the GlobalProvider, addons, visual-regression, and
        the load-bearing version pin — lives at{' '}
        <code style={inkStyle}>docs/design-system/ladle-styleguide.md</code>.
      </p>
    </div>
  </div>
)
