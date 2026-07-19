import type { Story } from '@ladle/react'
import { SalvageUnionReference } from 'salvageunion-reference'
import { ReferenceEntityCard } from '../referenceEntity/card/ReferenceEntityCard'
import { Caption } from '../../stories/_harness'
import { DualColumnLayout } from './DualColumnLayout'

/**
 * DualColumnLayout — two independent content columns split by a hairline
 * divider at lg, stacking to one column below. A side left empty collapses the
 * grid to a single full-width column (both empty renders nothing).
 */
// biome-ignore lint/style/useComponentExportOnlyModules: Ladle stories require a default meta export alongside story components
export default {
  title: 'Containers/Dual Column Layout',
}

// Real listing cards fill the columns so widths/wrapping read truthfully.
const systems = SalvageUnionReference.Systems.all().slice(0, 3)
const modules = SalvageUnionReference.Modules.all().slice(0, 3)

const systemColumn = (
  <div className="flex flex-col gap-2">
    {systems.map((s) => (
      <ReferenceEntityCard key={s.id} data={s} listing />
    ))}
  </div>
)
const moduleColumn = (
  <div className="flex flex-col gap-2">
    {modules.map((m) => (
      <ReferenceEntityCard key={m.id} data={m} listing />
    ))}
  </div>
)

export const Default: Story = () => (
  <div className="flex max-w-5xl flex-col gap-8">
    <div className="flex flex-col gap-1.5">
      <Caption>
        Both columns — Systems | Modules with the hairline divider (lg+; stacks below)
      </Caption>
      <DualColumnLayout left={systemColumn} right={moduleColumn} />
    </div>

    <div className="flex flex-col gap-1.5">
      <Caption>Left only — no divider, single full-width column</Caption>
      <DualColumnLayout left={systemColumn} />
    </div>

    <div className="flex flex-col gap-1.5">
      <Caption>Right only — same collapse from the other side</Caption>
      <DualColumnLayout right={moduleColumn} />
    </div>
  </div>
)
