import type { Story } from '@ladle/react'
import type { CSSProperties } from 'react'
import { SalvageUnionReference } from 'salvageunion-reference'
import { Badge } from '../components/chrome/Badge'
import { Card } from '../components/shared/Card'
import { FilterRow } from '../components/shared/FilterRow'
import { MasonryColumns } from '../components/shared/MasonryColumns'
import { color, font, space, weight } from '../design/tokens'

export default {
  title: 'Foundations/Layout',
}

/**
 * The stage each layout is demonstrated on. `maxWidth` is the Tailwind rung
 * ported verbatim — `max-w-4xl` is 56rem, `max-w-2xl` is 42rem.
 */
const stage = {
  backgroundColor: color.paper,
  padding: space[16],
} satisfies CSSProperties

const headerTitle = {
  fontFamily: font.cond,
  fontWeight: weight.bold,
  textTransform: 'uppercase',
  color: color.ink,
} satisfies CSSProperties

// Real SRD content fills every layout so wrapping/overflow read truthfully.
const chassis = SalvageUnionReference.Chassis.all().slice(0, 6)
const traits = SalvageUnionReference.Traits.all()
  .slice(0, 6)
  .map((t) => t.name)

function ChassisRow({ name }: { name: string }) {
  return (
    <Card
      extent="head"
      headerBg="bg-mech"
      headerContent={<span style={headerTitle}>{name}</span>}
    />
  )
}

/** MasonryColumns — viewport-driven column count; balances cards across columns. */
export const Masonry: Story = () => (
  <div style={{ ...stage, maxWidth: '56rem' }}>
    <MasonryColumns>
      {chassis.map((c) => (
        <ChassisRow key={c.name} name={c.name} />
      ))}
    </MasonryColumns>
  </div>
)

/** FilterRow — a labelled row of controls that wraps under its label on mobile. */
export const Filters: Story = () => (
  <div
    style={{
      ...stage,
      display: 'flex',
      flexDirection: 'column',
      gap: space[16],
      maxWidth: '42rem',
    }}
  >
    <FilterRow label="Traits">
      {traits.map((t) => (
        <Badge key={t}>{t}</Badge>
      ))}
    </FilterRow>
  </div>
)
