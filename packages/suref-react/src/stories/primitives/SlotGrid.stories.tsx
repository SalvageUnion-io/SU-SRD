import type { Story } from '@ladle/react'
import type { ReactNode } from 'react'
import { SalvageUnionReference } from 'salvageunion-reference'

import { SlotGrid } from '../../components/shared/SlotGrid'

// biome-ignore lint/style/useComponentExportOnlyModules: Ladle stories require a default meta export alongside story components
export default {
  title: 'Atoms/Slot Grid',
}

const chassis = SalvageUnionReference.Chassis.all()[0]
const chassisName = chassis?.name ?? 'Chassis'
const cargo = chassis?.cargoCapacity ?? 16

const Caption = ({ children }: { children: ReactNode }) => (
  <div className="mb-1 font-cond text-label uppercase tracking-caps text-wk-muted">{children}</div>
)

/** scale=pip — dense inline cells for listings / tooltips. */
export const PipScale: Story = () => (
  <div className="bg-paper p-4">
    <Caption>
      scale=pip · {Math.ceil(cargo * 0.6)}/{cargo} filled · {chassisName} hold
    </Caption>
    <SlotGrid used={Math.ceil(cargo * 0.6)} cap={cargo} />
  </div>
)

/** scale=sheet — larger addressable cells for the Live Sheet / Dashboard. */
export const SheetScale: Story = () => (
  <div className="bg-paper p-4">
    <Caption>scale=sheet · addressable cells</Caption>
    <SlotGrid used={Math.ceil(cargo * 0.6)} cap={cargo} scale="sheet" />
  </div>
)

/** Empty & full — dashed = fillable; solid cargo = filled. */
export const EmptyAndFull: Story = () => (
  <div className="space-y-4 bg-paper p-4">
    <div>
      <Caption>empty · all dashed (fillable)</Caption>
      <SlotGrid used={0} cap={cargo} scale="sheet" />
    </div>
    <div>
      <Caption>full · all cargo</Caption>
      <SlotGrid used={cargo} cap={cargo} scale="sheet" />
    </div>
  </div>
)

/** Over capacity — used &gt; cap renders the overflow as status-bad cells. */
export const OverCapacity: Story = () => (
  <div className="bg-paper p-4">
    <Caption>over capacity · used &gt; cap → status-bad cells</Caption>
    <SlotGrid used={cargo + 2} cap={cargo} scale="sheet" />
  </div>
)
