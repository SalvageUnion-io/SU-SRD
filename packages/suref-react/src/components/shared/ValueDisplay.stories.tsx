import type { Story } from '@ladle/react'
import { ValueDisplay } from './ValueDisplay'

// biome-ignore lint/style/useComponentExportOnlyModules: Ladle stories require a default meta export alongside story components
export default {
  title: 'Shared/ValueDisplay',
}

export const Default: Story = () => (
  <div className="flex flex-wrap gap-3">
    <ValueDisplay label="SP" value={8} />
    <ValueDisplay label="EP" value={3} />
    <ValueDisplay label="AP" value={2} />
    <ValueDisplay label="HEAT" value={4} />
  </div>
)

export const LabelOnly: Story = () => (
  <div className="flex gap-3">
    <ValueDisplay label="RANGE 2" />
    <ValueDisplay label="MELEE" />
    <ValueDisplay label="PASSIVE" />
  </div>
)

export const Compact: Story = () => (
  <div className="flex gap-2">
    <ValueDisplay label="SP" value={8} compact />
    <ValueDisplay label="EP" value={3} compact />
    <ValueDisplay label="TL" value={2} compact />
  </div>
)

export const Inverse: Story = () => (
  <div className="flex gap-3">
    <ValueDisplay label="SP" value={8} inverse />
    <ValueDisplay label="EP" value={3} inverse />
  </div>
)

export const Inline: Story = () => (
  <div>
    This system has <ValueDisplay label="SP" value={8} /> salvage points and costs{' '}
    <ValueDisplay label="EP" value={2} /> to activate.
  </div>
)
