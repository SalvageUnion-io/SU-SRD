import type { Story } from '@ladle/react'
import type { ReactNode } from 'react'
import { SalvageUnionReference } from 'salvageunion-reference'
import { Badge } from './Badge'
import { PickCard } from './PickCard'

// biome-ignore lint/style/useComponentExportOnlyModules: Ladle stories require a default meta export alongside story components
export default {
  title: 'Atoms/Pick Card',
}

// Real SRD content — reference data is preloaded by .ladle/components.tsx.
const chassis = SalvageUnionReference.Chassis.all()[0]
const classes = SalvageUnionReference.Classes.all()

const chassisName = chassis?.name ?? 'Chassis'
const techLevel = chassis?.techLevel ?? 1
const salvageValue = chassis?.salvageValue ?? 5
const systemSlots = chassis?.systemSlots ?? 6

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
const classAName = classA?.name ?? 'Engineer'
const classADesc = firstParagraph(classA?.content)
const chassisDesc = firstParagraph(chassis?.content)

// The `.all()` static return is a schema union that doesn't surface the
// class-only tree fields; read them through a narrow typed view (no `any`).
type ClassTrees = { coreTrees?: string[]; advancedTree?: string }
const classTrees = classA as unknown as ClassTrees | undefined
// Real ability-tree names off the first class (e.g. Mechanical Knowledge / Forging / …).
const coreTrees: string[] = classTrees?.coreTrees?.length
  ? classTrees.coreTrees
  : ['Mechanical Knowledge', 'Forging', 'Mech-Tech']

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
 * `PickCard` — the Class/Chassis/Crawler selection card (app chrome, NOT an
 * entity card). Unselected vs selected (3px rust ring + "Selected" chip), with
 * Quiet-badge stat row + footer.
 */
export const Default: Story = () => (
  <div className="bg-paper p-4">
    <Cluster label="unselected vs selected">
      <div className="flex flex-wrap items-start gap-4">
        <PickCard
          name={chassisName}
          className="w-64"
          chips={
            <>
              <Badge surface="quiet">{`TL${techLevel}`}</Badge>
              <Badge surface="quiet">{`SV ${salvageValue}`}</Badge>
              <Badge surface="quiet">{`${systemSlots} Sys`}</Badge>
            </>
          }
          foot={
            <span className="font-cond text-xs font-bold uppercase text-wk-muted">Chassis</span>
          }
          onSelect={() => {}}
        >
          {chassisDesc}
        </PickCard>
        <PickCard
          name={classAName}
          className="w-64"
          selected
          chips={coreTrees.map((tree) => (
            <Badge surface="quiet" key={tree}>
              {tree}
            </Badge>
          ))}
          foot={<span className="font-cond text-xs font-bold uppercase text-wk-muted">Class</span>}
          onSelect={() => {}}
        >
          {classADesc}
        </PickCard>
      </div>
    </Cluster>
  </div>
)
