import type { CSSProperties, ReactNode } from 'react'
import { color, font, fontSize, space, tracking, weight } from '../../design/tokens'
import type { Story } from '../../stories/_harness'
import { Badge } from '../atoms/Badge'
import { Text } from '../atoms/Text'
import { Card } from './Card'

export default {
  title: 'Containers/Card',
}

// Card is the GENERIC container primitive — its stories demonstrate
// the shell (header / sub-header / body / footer) with abstract content,
// never real SRD entities. Entity-specific rendering lives one layer up, in
// ReferenceEntityCard's own stories.

const header = <Badge shape="stamp">Card Title</Badge>

const body = (
  <div style={{ padding: space[12] }}>
    <Text as="p" style={{ fontSize: fontSize.sm, lineHeight: '20px', color: color.wkMuted }}>
      This is the card&apos;s body — the main reading surface for descriptive content, notes, or any
      other prose the container needs to hold.
    </Text>
  </div>
)

const footer = <span>Ref A1 · Qty 3</span>

const GALLERY = {
  display: 'flex',
  flexDirection: 'column',
  gap: space[16],
  backgroundColor: color.paper,
  padding: space[20],
  fontFamily: font.body,
  color: color.ink,
} satisfies CSSProperties

const RULE = {
  maxWidth: '42rem',
  fontSize: fontSize.xs,
  lineHeight: 1.625,
  color: color.wkMuted,
} satisfies CSSProperties

const CELLS = {
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'flex-start',
  gap: space[24],
} satisfies CSSProperties

function Gallery({ rule, children }: { rule: string; children: ReactNode }) {
  return (
    <div style={GALLERY}>
      <p style={RULE}>{rule}</p>
      <div style={CELLS}>{children}</div>
    </div>
  )
}

function Cell({
  label,
  width = 360,
  children,
}: {
  label: string
  width?: number
  children: ReactNode
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: space[6] }}>
      <div style={{ width }}>{children}</div>
      <code style={{ fontSize: fontSize.badge, color: color.wkMuted }}>{label}</code>
    </div>
  )
}

/**
 * Four-band model (design-spec §2.1): a required header, an optional
 * sub-header (a darker shade of the header tone, populated by `subHeader`
 * content), an optional body, and an optional footer (`footerContent`). Sub-header and footer are each
 * independently opt-in — this gallery shows every combination, including
 * both present and absent, so their optionality is obvious.
 */
export const Bands: Story = () => (
  <Gallery rule="Card is a generic four-band shell: header (required) + optional sub-header + optional body + optional footer. Sub-header and footer are each independently opt-in — every combination below uses the same abstract content so the arrangement is the only thing changing.">
    <Cell label="header only (listing — body/sub-header/footer hidden)" width={380}>
      <Card headerBgColor="var(--color-mech)" headerContent={header} extent="head">
        {body}
      </Card>
    </Cell>
    <Cell label="header + sub-header" width={380}>
      <Card
        headerBgColor="var(--color-mech)"
        headerContent={header}
        subHeader={
          <Text
            as="span"
            style={{
              fontFamily: font.cond,
              fontSize: fontSize.badge,
              fontWeight: weight.bold,
              textTransform: 'uppercase',
              letterSpacing: tracking.caps,
              color: color.paper,
            }}
          >
            Custom sub-header content
          </Text>
        }
      >
        {body}
      </Card>
    </Cell>
    <Cell label="header + footer (no sub-header)" width={380}>
      <Card headerBgColor="var(--color-mech)" headerContent={header} footerContent={footer}>
        {body}
      </Card>
    </Cell>
    <Cell label="header only (no sub-header, no footer)" width={380}>
      <Card headerBgColor="var(--color-mech)" headerContent={header}>
        {body}
      </Card>
    </Cell>
  </Gallery>
)

/** Density: full → compact → listing (header-only). */
export const Densities: Story = () => (
  <Gallery rule="Two booleans span the density range: compact (reduced spacing) and listing (header-only row).">
    <Cell label="default">
      <Card headerBgColor="var(--color-mech)" headerContent={header} footerContent={footer}>
        {body}
      </Card>
    </Cell>
    <Cell label="compact">
      <Card headerBgColor="var(--color-mech)" headerContent={header} size="medium">
        {body}
      </Card>
    </Cell>
    <Cell label="listing">
      <Card headerBgColor="var(--color-mech)" headerContent={header} extent="head">
        {body}
      </Card>
    </Cell>
    <Cell label="compact listing">
      <Card headerBgColor="var(--color-mech)" headerContent={header} size="medium" extent="head">
        {body}
      </Card>
    </Cell>
  </Gallery>
)

/** Composed features: the label callout stamp riding the top border. */
export const Features: Story = () => (
  <Gallery rule="Feature slots layer onto the same shell: a label callout stamp riding the top border.">
    <Cell label="label">
      <Card headerBgColor="var(--color-mech)" headerContent={header} label="Category">
        {body}
      </Card>
    </Cell>
  </Gallery>
)
