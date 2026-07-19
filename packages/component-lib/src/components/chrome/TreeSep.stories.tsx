import type { Story } from '@ladle/react'
import type { ReactNode } from 'react'
import { SalvageUnionReference } from 'salvageunion-reference'
import { TreeSep } from './TreeSep'

// biome-ignore lint/style/useComponentExportOnlyModules: Ladle stories require a default meta export alongside story components
export default {
  title: 'Atoms/Tree Sep',
}

// Real SRD content — reference data is preloaded by .ladle/components.tsx.
const classes = SalvageUnionReference.Classes.all()
const classA = classes[0]

// The `.all()` static return is a schema union that doesn't surface the
// class-only tree fields; read them through a narrow typed view (no `any`).
type ClassTrees = { coreTrees?: string[]; advancedTree?: string }
const classTrees = classA as unknown as ClassTrees | undefined
// Real ability-tree names off the first class (e.g. Mechanical Knowledge / Forging / …).
const coreTrees: string[] = classTrees?.coreTrees?.length
  ? classTrees.coreTrees
  : ['Mechanical Knowledge', 'Forging', 'Mech-Tech']
const advancedTreeName = classTrees?.advancedTree ?? 'Advanced Engineer'

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
 * `TreeSep` — the ability-tree section header: flanking rules around a solid
 * tree-name Tag + a ghost suffix Tag. Fed real class core-tree names.
 */
export const Default: Story = () => (
  <div className="bg-paper p-4">
    <div className="flex flex-col gap-5">
      {coreTrees.map((tree) => (
        <Cluster key={tree} label="core tree separator">
          <TreeSep name={tree} />
        </Cluster>
      ))}
      <Cluster label="custom suffix">
        <TreeSep name={advancedTreeName} suffix="Advanced" />
      </Cluster>
    </div>
  </div>
)
