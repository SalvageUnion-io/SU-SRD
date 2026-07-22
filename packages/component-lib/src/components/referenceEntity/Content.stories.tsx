import type { Story } from '@ladle/react'
import type { ReactNode } from 'react'
import { Content } from './Content'
import type { SURefObjectContentBlock } from 'salvageunion-reference'

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

function Row({
  label,
  width = 'w-[500px]',
  children,
}: {
  label: string
  width?: string
  children: ReactNode
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className={`${width} bg-paper p-3`}>{children}</div>
      <code className="font-body text-nano text-ink-2">{label}</code>
    </div>
  )
}

/** Every content-block type — headings, paragraphs, list-items, hints, labels. */
export const Default: Story = () => (
  <div className="flex flex-col gap-6 bg-paper p-5 text-ink">
    <p className="max-w-2xl font-body text-xs leading-relaxed text-ink-2">
      Renders a content-block array: headings, paragraphs, list-items, hints, and EFFECT/ON-CRITICAL
      labels. compact tightens spacing.
    </p>
    <Row label="mixed (heading · paragraph · list · hint)">
      <Content body={mixed} />
    </Row>
    <Row label="labels">
      <Content body={labels} />
    </Row>
    <Row label="compact" width="w-[400px]">
      <Content body={mixed} compact />
    </Row>
  </div>
)
