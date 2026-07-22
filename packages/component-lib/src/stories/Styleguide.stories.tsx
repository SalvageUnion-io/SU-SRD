import type { Story } from '@ladle/react'
import type { ReactNode } from 'react'
import { Caption } from './_harness'

export default {
  title: 'Foundations/Styleguide',
}

// The orientation front-door for the catalog. This page is DOCUMENTATION rendered
// as a story: it explains how to read the catalog and how to add to it, in the
// catalog's own voice (paper canvas, font-cond labels, canon tokens). The full
// contributor reference lives at docs/design-system/ladle-styleguide.md.

function Title({ children }: { children: ReactNode }) {
  return <h1 className="font-cond text-2xl uppercase tracking-caps-tight text-ink">{children}</h1>
}

function SectionHeading({ children }: { children: ReactNode }) {
  return <h2 className="font-cond text-lg uppercase tracking-caps-tight text-ink">{children}</h2>
}

function Prose({ children }: { children: ReactNode }) {
  return <p className="max-w-[68ch] text-sm leading-relaxed text-ink-2">{children}</p>
}

function Rule({ children }: { children: ReactNode }) {
  return (
    <li className="max-w-[68ch] text-sm leading-relaxed text-ink-2">
      <span className="text-ink">{children}</span>
    </li>
  )
}

/** A square ink stamp — the catalog's canonical label chip. */
function Stamp({ children }: { children: ReactNode }) {
  return (
    <span className="inline-block rounded-none bg-ink px-2 py-1 font-cond text-xs uppercase tracking-caps-tight text-paper">
      {children}
    </span>
  )
}

// --- Overview: what this catalog is, and how to read it -------------------

export const Overview: Story = () => (
  <div className="flex max-w-[80ch] flex-col gap-6 p-2">
    <div className="flex flex-col gap-2">
      <Caption>Salvage Union · component-lib</Caption>
      <Title>The Styleguide</Title>
    </div>

    <Prose>
      This is the single, authoritative catalog for the design system. Every UI primitive the apps
      ship — <span className="text-ink">srd</span> and <span className="text-ink">itun</span> — is
      rendered here, in its real states, with the real design tokens and real Salvage Union data. If
      a component is public, it appears here; if it drifts, the catalog shows it. Read the sidebar
      top-to-bottom: it runs from raw material to finished game components.
    </Prose>

    <div className="flex flex-col gap-3">
      <SectionHeading>The four groups (+ a Legacy drain)</SectionHeading>
      <Caption>sidebar order, top-to-bottom — composition level rising as you descend</Caption>
      <div className="flex flex-col gap-3">
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

    <div className="flex flex-col gap-3">
      <SectionHeading>The one rule that makes it trustworthy</SectionHeading>
      <Prose>
        Every story renders <span className="text-ink">real SRD data or real game terms</span> —
        never lorem, placeholder, or invented content. Stories are driven from{' '}
        <code className="text-ink">SalvageUnionReference.*</code> fixtures and fed through the real
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
    <div className="flex items-start gap-3">
      <div className="w-[120px] shrink-0">
        <Stamp>{stamp}</Stamp>
      </div>
      <p className="max-w-[60ch] text-sm leading-relaxed text-ink-2">{body}</p>
    </div>
  )
}

// --- Conventions: how a story is written ----------------------------------

export const Conventions: Story = () => (
  <div className="flex max-w-[80ch] flex-col gap-6 p-2">
    <div className="flex flex-col gap-2">
      <Caption>writing a story</Caption>
      <Title>Conventions</Title>
    </div>

    <Prose>
      Stories are plain function components typed <code className="text-ink">Story</code>, in a file
      that carries its meta via a static default export. No args, argTypes, controls, decorators, or
      MSW — interactivity is plain <code className="text-ink">useState</code>. The shape:
    </Prose>

    <pre className="max-w-full overflow-x-auto rounded-card bg-ink p-4 text-xs leading-relaxed text-paper">
      {`import type { Story } from '@ladle/react'
import { SalvageUnionReference } from 'salvageunion-reference'
import { Stat } from './Stat'

export default { title: 'Atoms/Stat' }

const chassis = SalvageUnionReference.Chassis.all()[0]   // REAL data, module top level

export const Anatomies: Story = () => (
  <Stat label="Structure Pts" value={chassis.structurePts} />
)`}
    </pre>

    <ul className="flex list-disc flex-col gap-2 pl-6">
      <Rule>
        <span className="font-semibold">Title is Group/Title Case</span> and matches the component's
        display name — <code>Atoms/Stat</code>, <code>Containers/Card</code>. Slashes become sidebar
        nesting.
      </Rule>
      <Rule>
        <span className="font-semibold">The file keeps the component symbol name</span> —{' '}
        <code>Stat.stories.tsx</code> — so a symbol grep finds it, and it is co-located beside the
        component.
      </Rule>
      <Rule>
        <span className="font-semibold">title, storyName, and meta must be static literals</span> —
        they are statically analyzed and cannot be built from variables.
      </Rule>
      <Rule>
        <span className="font-semibold">
          A catch-all "show everything" page is exported as Default
        </span>{' '}
        — not Variants / Costs / etc.
      </Rule>
      <Rule>
        <span className="font-semibold">No outer bg-paper wrapper</span> — the global canvas
        (.ladle/components.tsx) already frames every story on paper with a mono font and the data
        preload gate.
      </Rule>
      <Rule>
        <span className="font-semibold">Import shared helpers</span> (Caption, frames) from{' '}
        <code>src/stories/_harness.tsx</code> — don't re-declare a local copy. Lead each gallery
        with one line of prose stating the rule it demonstrates.
      </Rule>
    </ul>
  </div>
)

// --- Contributing: the enforced contract ----------------------------------

export const Contributing: Story = () => (
  <div className="flex max-w-[80ch] flex-col gap-6 p-2">
    <div className="flex flex-col gap-2">
      <Caption>adding a component</Caption>
      <Title>The catalog is a contract</Title>
    </div>

    <Prose>
      Coverage is enforced by <code className="text-ink">src/story-coverage.test.ts</code>: every
      barrel-exported (<code className="text-ink">src/index.ts</code>) visual component must be
      referenced by at least one <code className="text-ink">*.stories.tsx</code>. Add a public
      component and you add its story in the same change — CI fails otherwise. That guard is what
      lets the catalog claim to be complete, not "most things, probably."
    </Prose>

    <div className="flex flex-col gap-2">
      <SectionHeading>Checklist</SectionHeading>
      <ul className="flex list-disc flex-col gap-2 pl-6">
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
      </ul>
    </div>

    <div className="flex flex-wrap items-end gap-6">
      <div className="flex flex-col gap-1">
        <Stamp>Reference</Stamp>
        <Caption>full contributor guide</Caption>
      </div>
      <p className="max-w-[52ch] text-sm leading-relaxed text-ink-2">
        The complete reference — config options, the GlobalProvider, addons, visual-regression, and
        the load-bearing version pin — lives at{' '}
        <code className="text-ink">docs/design-system/ladle-styleguide.md</code>.
      </p>
    </div>
  </div>
)
