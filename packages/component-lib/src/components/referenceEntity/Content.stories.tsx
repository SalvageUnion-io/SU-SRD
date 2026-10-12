import type { CSSProperties, ReactNode } from 'react'
import type { SURefObjectContentBlock } from 'salvageunion-reference'
import { color, font, fontSize, space } from '../../design/tokens'
import type { Story } from '../../stories/_harness'
import { Content } from './Content'

export default {
  title: 'Compositions/Entity/Content',
}

const mixed: SURefObjectContentBlock[] = [
  { type: 'heading', value: 'System Overview', level: 1 },
  { type: 'paragraph', value: 'This system provides enhanced capabilities.' },
  { type: 'heading', value: 'Usage', level: 2 },
  { type: 'list-item', value: 'Activate during your turn' },
  { type: 'list-item', value: 'Costs 1 EP per use' },
  { type: 'list-item', value: 'Range 2 zones' },
  { type: 'hint', value: 'Tip: Combine with other systems for maximum effect.' },
]
const labels: SURefObjectContentBlock[] = [
  { type: 'label', label: 'EFFECT', value: 'Deals 3 damage to target in range.' },
  { type: 'label', label: 'ON CRITICAL', value: 'Deals double damage and applies Burning.' },
]

const rowStyle = {
  display: 'flex',
  flexDirection: 'column',
  gap: space[6],
} satisfies CSSProperties

const rowLabelStyle = {
  fontFamily: font.body,
  fontSize: fontSize.badge,
  color: color.wkMuted,
} satisfies CSSProperties

const pageStyle = {
  display: 'flex',
  flexDirection: 'column',
  gap: space[24],
  backgroundColor: color.paper,
  padding: space[20],
  color: color.ink,
} satisfies CSSProperties

const introStyle = {
  maxWidth: '42rem',
  fontFamily: font.body,
  fontSize: fontSize.xs,
  lineHeight: 1.625,
  color: color.wkMuted,
} satisfies CSSProperties

function Row({
  label,
  width = 500,
  children,
}: {
  label: string
  width?: number
  children: ReactNode
}) {
  return (
    <div style={rowStyle}>
      <div style={{ width, backgroundColor: color.paper, padding: space[12] }}>{children}</div>
      <code style={rowLabelStyle}>{label}</code>
    </div>
  )
}

/** Every content-block type — headings, paragraphs, list-items, hints, labels. */
export const Default: Story = () => (
  <div style={pageStyle}>
    <p style={introStyle}>
      Renders a content-block array: headings, paragraphs, list-items, hints, and EFFECT/ON-CRITICAL
      labels. compact tightens spacing.
    </p>
    <Row label="mixed (heading · paragraph · list · hint)">
      <Content body={mixed} />
    </Row>
    <Row label="labels">
      <Content body={labels} />
    </Row>
    <Row label="compact" width={400}>
      <Content body={mixed} compact />
    </Row>
  </div>
)
