import type { Story } from '@ladle/react'
import type { ReactNode } from 'react'
import { DisplayCard } from './DisplayCard'
import type { CardFootMeta } from './DisplayCard'
import type { StatItem } from './statsBarTypes'
import { Text } from '../base/Text'
import { Badge } from '../chrome/Badge'

// biome-ignore lint/style/useComponentExportOnlyModules: Ladle stories require a default meta export alongside story components
export default {
  title: 'Containers/Display Card',
}

// DisplayCard is the GENERIC container primitive — its stories demonstrate
// the shell (header / sub-header / body / footer) with abstract content,
// never real SRD entities. Entity-specific rendering lives one layer up, in
// ReferenceEntityCard's own stories. The only "real" content here is the
// status badge (intact/damaged/destroyed) — that's the primitive's own
// mechanic, not an entity concern.

const header = <Badge shape="stamp">Card Title</Badge>

const body = (
  <div className="p-3">
    <Text as="p" className="text-sm text-ink-2">
      This is the card&apos;s body — the main reading surface for descriptive content, notes, or any
      other prose the container needs to hold.
    </Text>
  </div>
)

// Abstract stat axis for the sub-header band demo — generic labels and
// numbers, not real SRD entity stats.
const genericStats: StatItem[] = [
  { key: 'alpha', label: 'Alpha', value: 12 },
  { key: 'beta', label: 'Beta', value: 7 },
  { key: 'gamma', label: 'Gamma', value: 3 },
]

const genericFootMeta: CardFootMeta[] = [
  { label: 'Ref', value: 'A1' },
  { label: 'Qty', value: 3 },
]

function Gallery({ rule, children }: { rule: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-4 bg-paper p-5 font-body text-ink">
      <p className="max-w-2xl text-xs leading-relaxed text-ink-2">{rule}</p>
      <div className="flex flex-wrap items-start gap-6">{children}</div>
    </div>
  )
}

function Cell({
  label,
  width = 'w-[360px]',
  children,
}: {
  label: string
  width?: string
  children: ReactNode
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className={width}>{children}</div>
      <code className="text-nano text-ink-2">{label}</code>
    </div>
  )
}

/**
 * Four-band model (design-spec §2.1): a required header, an optional
 * sub-header (a darker shade of the header tone, populated by `subHeader`
 * content and/or `stats`), an optional body, and an optional footer
 * (`footMeta`/`footerContent`). Sub-header and footer are each
 * independently opt-in — this gallery shows every combination, including
 * both present and absent, so their optionality is obvious.
 */
export const Bands: Story = () => (
  <Gallery rule="DisplayCard is a generic four-band shell: header (required) + optional sub-header + optional body + optional footer. Sub-header and footer are each independently opt-in — every combination below uses the same abstract content so the arrangement is the only thing changing.">
    <Cell label="header only (listing — body/sub-header/footer hidden)" width="w-[380px]">
      <DisplayCard headerBg="bg-mech" headerContent={header} extent="head">
        {body}
      </DisplayCard>
    </Cell>
    <Cell label="header + sub-header (stats — compact horizontal)" width="w-[380px]">
      <DisplayCard headerBg="bg-mech" headerContent={header} stats={genericStats} size="medium">
        {body}
      </DisplayCard>
    </Cell>
    <Cell label="header + sub-header (subHeader node, no stats)" width="w-[380px]">
      <DisplayCard
        headerBg="bg-mech"
        headerContent={header}
        subHeader={
          <Text
            as="span"
            className="font-cond text-micro font-bold uppercase tracking-caps text-paper"
          >
            Custom sub-header content
          </Text>
        }
      >
        {body}
      </DisplayCard>
    </Cell>
    <Cell label="header + footer (no sub-header)" width="w-[380px]">
      <DisplayCard headerBg="bg-mech" headerContent={header} footMeta={genericFootMeta}>
        {body}
      </DisplayCard>
    </Cell>
    <Cell label="header + sub-header + footer (all four bands)" width="w-[380px]">
      <DisplayCard
        headerBg="bg-mech"
        headerContent={header}
        stats={genericStats}
        footMeta={genericFootMeta}
        size="medium"
      >
        {body}
      </DisplayCard>
    </Cell>
    <Cell label="header only (no sub-header, no footer)" width="w-[380px]">
      <DisplayCard headerBg="bg-mech" headerContent={header}>
        {body}
      </DisplayCard>
    </Cell>
  </Gallery>
)

/** Density + interactivity: full → compact → listing (header-only) → disabled. */
export const Densities: Story = () => (
  <Gallery rule="Two booleans span the density range: compact (reduced spacing) and listing (header-only clickable row). disabled dims the whole card.">
    <Cell label="default">
      <DisplayCard headerBg="bg-mech" headerContent={header} footMeta={genericFootMeta}>
        {body}
      </DisplayCard>
    </Cell>
    <Cell label="compact">
      <DisplayCard headerBg="bg-mech" headerContent={header} size="medium">
        {body}
      </DisplayCard>
    </Cell>
    <Cell label="listing">
      <DisplayCard headerBg="bg-mech" headerContent={header} extent="head">
        {body}
      </DisplayCard>
    </Cell>
    <Cell label="compact listing">
      <DisplayCard headerBg="bg-mech" headerContent={header} size="medium" extent="head">
        {body}
      </DisplayCard>
    </Cell>
    <Cell label="disabled">
      <DisplayCard headerBg="bg-mech" headerContent={header} disabled>
        {body}
      </DisplayCard>
    </Cell>
  </Gallery>
)

/** Condition status: intact → damaged → destroyed (the warm state treatment). */
export const Status: Story = () => (
  <Gallery rule="status drives the condition treatment — intact is pristine; damaged/destroyed apply the warm brick-red state overlay (a treatment, never a second hue).">
    <Cell label='status="intact"'>
      <DisplayCard headerBg="bg-mech" headerContent={header} status="intact">
        {body}
      </DisplayCard>
    </Cell>
    <Cell label='status="damaged"'>
      <DisplayCard headerBg="bg-mech" headerContent={header} status="damaged">
        {body}
      </DisplayCard>
    </Cell>
    <Cell label='status="destroyed"'>
      <DisplayCard headerBg="bg-mech" headerContent={header} status="destroyed">
        {body}
      </DisplayCard>
    </Cell>
  </Gallery>
)

/** Composed features: the label callout stamp riding the top border. */
export const Features: Story = () => (
  <Gallery rule="Feature slots layer onto the same shell: a label callout stamp riding the top border.">
    <Cell label="label">
      <DisplayCard headerBg="bg-mech" headerContent={header} label="Category">
        {body}
      </DisplayCard>
    </Cell>
  </Gallery>
)
