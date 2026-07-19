import type { Story } from '@ladle/react'
import type { ReactNode } from 'react'
import { SalvageUnionReference } from 'salvageunion-reference'
import { OptRow } from './OptRow'

// biome-ignore lint/style/useComponentExportOnlyModules: Ladle stories require a default meta export alongside story components
export default {
  title: 'Atoms/Opt Row',
}

// Real SRD content — reference data is preloaded by .ladle/components.tsx.
const classes = SalvageUnionReference.Classes.all()

/** First paragraph of an entity's `content` block, for descriptive copy. */
function firstParagraph(content: unknown): string {
  if (Array.isArray(content)) {
    const first = content[0]
    if (first && typeof first === 'object' && 'value' in first) {
      const value = (first as { value: unknown }).value
      if (typeof value === 'string') return value
    }
  }
  return ''
}

const classA = classes[0]
const classB = classes[1]
const classAName = classA?.name ?? 'Engineer'
const classBName = classB?.name ?? 'Hacker'
const classADesc = firstParagraph(classA?.content)
const classBDesc = firstParagraph(classB?.content)

/** Gauge-story caption: names the variant / prop above each cluster. */
function Label({ children }: { children: string }) {
  return (
    <div className="mb-1.5 font-cond text-label uppercase tracking-caps text-wk-muted">
      {children}
    </div>
  )
}

function Cluster({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <Label>{label}</Label>
      {children}
    </div>
  )
}

/**
 * `OptRow` — the wizard master-detail list row: 44px art slot, uppercase name,
 * clamped description. Inactive vs active (white bg + inset rust bar + caret).
 */
export const Default: Story = () => (
  <div className="bg-paper p-4">
    <div className="max-w-md">
      <Cluster label="a pick list (one row active)">
        <OptRow name={classAName} desc={classADesc} active onClick={() => {}} />
        <OptRow name={classBName} desc={classBDesc} onClick={() => {}} />
      </Cluster>
    </div>
  </div>
)
