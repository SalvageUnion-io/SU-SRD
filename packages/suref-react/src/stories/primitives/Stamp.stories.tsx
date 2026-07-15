import type { Story } from '@ladle/react'
import type { ReactNode } from 'react'
import { SalvageUnionReference } from 'salvageunion-reference'

import { Stamp } from '../../components/chrome/Stamp'

// biome-ignore lint/style/useComponentExportOnlyModules: Ladle stories require a default meta export alongside story components
export default {
  title: 'Atoms/Stamp',
}

const chassis = SalvageUnionReference.Chassis.all()[0]
const chassisName = chassis?.name ?? 'Chassis'
const tl = chassis?.techLevel ?? 1

const Caption = ({ children }: { children: ReactNode }) => (
  <div className="mb-1 font-cond text-[10px] uppercase tracking-caps text-wk-muted">{children}</div>
)

/** surface — the plate the stamp sits on: on-ink / inverse / on-tone. */
export const Surfaces: Story = () => (
  <div className="space-y-3 bg-paper p-4">
    <Caption>surface · on-ink (default) / inverse / on-tone</Caption>
    <div className="flex flex-wrap items-center gap-3">
      <Stamp>{chassisName}</Stamp>
      <Stamp surface="inverse">Structure</Stamp>
      <div className="bg-su-green px-2 py-1">
        <Stamp surface="on-tone">On tone</Stamp>
      </div>
    </div>
  </div>
)

/** size — sm / md / lg text scale; the plate is always square (no radius). */
export const Sizes: Story = () => (
  <div className="space-y-3 bg-paper p-4">
    <Caption>size · sm / md / lg — stamps are square</Caption>
    <div className="flex flex-wrap items-end gap-3">
      <Stamp size="sm">SP</Stamp>
      <Stamp size="md">TL {tl}</Stamp>
      <Stamp size="lg">{chassisName}</Stamp>
    </div>
  </div>
)

/** seam — the stamp rides the container's top border (StampSeam), self-centred. */
export const Seam: Story = () => (
  <div className="bg-paper p-4">
    <Caption>seam · rides the top border (StampSeam)</Caption>
    <div className="relative mt-3 w-48 rounded-card border-2 border-ink bg-paper px-3 py-4">
      <Stamp seam className="left-3">
        {chassisName}
      </Stamp>
      <span className="font-body text-sm text-ink">Body content</span>
    </div>
  </div>
)
