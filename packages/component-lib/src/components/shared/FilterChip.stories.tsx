import type { Story } from '@ladle/react'
import { Caption } from '../../stories/_harness'
import { FilterChip } from './FilterChip'

// biome-ignore lint/style/useComponentExportOnlyModules: Ladle stories require a default meta export alongside story components
export default {
  title: 'Atoms/Filter Chip',
}

/**
 * `FilterChip` — facet toggle chip. Active vs inactive in three modes: plain,
 * with a `colorClass` override for the active fill, and `swatchStyle` (tlchip)
 * mode which renders a bordered colour swatch and switches to font-cond.
 */
export const Default: Story = () => (
  <div className="flex flex-col gap-5">
    <div>
      <Caption>plain</Caption>
      <div className="flex flex-wrap items-start gap-3">
        <FilterChip label="Inactive" active={false} onClick={() => {}} />
        <FilterChip label="Active" active onClick={() => {}} />
      </div>
    </div>
    <div>
      <Caption>colorClass (active fill override)</Caption>
      <div className="flex flex-wrap items-start gap-3">
        <FilterChip
          label="Pilot"
          active={false}
          onClick={() => {}}
          colorClass="bg-pilot text-paper"
        />
        <FilterChip label="Pilot" active onClick={() => {}} colorClass="bg-pilot text-paper" />
      </div>
    </div>
    <div>
      <Caption>swatchStyle (tlchip)</Caption>
      <div className="flex flex-wrap items-start gap-3">
        <FilterChip label="TL1" active={false} onClick={() => {}} swatchStyle="#8bbf5a" />
        <FilterChip label="TL1" active onClick={() => {}} swatchStyle="#8bbf5a" />
        <FilterChip label="TL6" active={false} onClick={() => {}} swatchStyle="#c0563b" />
      </div>
    </div>
  </div>
)
