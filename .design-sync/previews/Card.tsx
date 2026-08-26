/*
 * Ported from packages/component-lib/src/components/shared/Card.stories.tsx.
 *
 * The story's abstract content is kept verbatim, and that is deliberate: Card is
 * the GENERIC four-band container, and its stories demonstrate the shell with
 * abstract content, never real SRD entities. Entity rendering lives one layer
 * up, in `ReferenceEntityCard`. The two are the design system's only card
 * shells and are deliberately not merged.
 */
import { Badge, Card, Text } from 'component-lib'
import type { ReactNode } from 'react'

const header = <Badge shape="stamp">Card Title</Badge>

const body = (
  <div className="p-3">
    <Text as="p" className="text-sm text-wk-muted">
      This is the card&apos;s body — the main reading surface for descriptive content, notes, or
      any other prose the container needs to hold.
    </Text>
  </div>
)

// Abstract stat axis for the sub-header band — generic labels and numbers, not
// real SRD entity stats.
const genericStats = [
  { key: 'alpha', label: 'Alpha', value: 12 },
  { key: 'beta', label: 'Beta', value: 7 },
  { key: 'gamma', label: 'Gamma', value: 3 },
]

const genericFootMeta = [
  { label: 'Ref', value: 'A1' },
  { label: 'Qty', value: 3 },
]

function Cell({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="w-[380px]">{children}</div>
      <code className="font-body text-nano text-wk-muted">{label}</code>
    </div>
  )
}

/**
 * The four-band model: a required header, an optional sub-header (a darker
 * shade of the header tone, populated by `subHeader` content and/or `stats`), an
 * optional body, and an optional footer (`footMeta` / `footerContent`).
 * Sub-header and footer are each independently opt-in.
 */
export function Bands() {
  return (
    <div className="flex flex-wrap items-start gap-6 bg-paper p-5 font-body text-ink">
      <Cell label="header only (listing — body/sub-header/footer hidden)">
        <Card headerBg="bg-mech" headerContent={header} extent="head">
          {body}
        </Card>
      </Cell>
      <Cell label="header + sub-header (stats — compact horizontal)">
        <Card headerBg="bg-mech" headerContent={header} stats={genericStats} size="medium">
          {body}
        </Card>
      </Cell>
      <Cell label="header + footer (no sub-header)">
        <Card headerBg="bg-mech" headerContent={header} footMeta={genericFootMeta}>
          {body}
        </Card>
      </Cell>
      <Cell label="all four bands">
        <Card
          headerBg="bg-mech"
          headerContent={header}
          stats={genericStats}
          footMeta={genericFootMeta}
          size="medium"
        >
          {body}
        </Card>
      </Cell>
    </div>
  )
}

/** A custom `subHeader` node, in place of the stats band. */
export function CustomSubHeader() {
  return (
    <div className="flex flex-wrap items-start gap-6 bg-paper p-5 font-body text-ink">
      <Cell label="header + sub-header (subHeader node, no stats)">
        <Card
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
        </Card>
      </Cell>
      <Cell label="pilot tone">
        <Card headerBg="bg-pilot" headerContent={header} footMeta={genericFootMeta}>
          {body}
        </Card>
      </Cell>
      <Cell label="crawler tone">
        <Card headerBg="bg-crawler" headerContent={header} footMeta={genericFootMeta}>
          {body}
        </Card>
      </Cell>
    </div>
  )
}
