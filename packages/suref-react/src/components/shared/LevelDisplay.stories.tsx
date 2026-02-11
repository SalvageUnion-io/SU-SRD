import type { Story } from '@ladle/react'
import { LevelDisplay } from './LevelDisplay'

export default {
  title: 'Shared/LevelDisplay',
}

export const AllTechLevels: Story = () => (
  <div className="relative flex min-h-[60px] flex-wrap gap-4">
    {[1, 2, 3, 4, 5, 6].map((level) => (
      <div key={level} className="relative h-[50px] w-[50px]">
        <LevelDisplay level={level} />
      </div>
    ))}
  </div>
)

export const SpecialLevels: Story = () => (
  <div className="relative flex min-h-[60px] gap-4">
    <div className="relative h-[50px] w-[50px]">
      <LevelDisplay level="B" />
    </div>
    <div className="relative h-[50px] w-[50px]">
      <LevelDisplay level="N" />
    </div>
    <div className="relative h-[50px] w-[50px]">
      <LevelDisplay level="L" />
    </div>
  </div>
)

export const Compact: Story = () => (
  <div className="relative flex min-h-[40px] gap-3">
    {[1, 2, 3].map((level) => (
      <div key={level} className="relative h-[40px] w-[40px]">
        <LevelDisplay level={level} compact />
      </div>
    ))}
  </div>
)

export const Inline: Story = () => (
  <div className="flex items-center gap-3">
    <LevelDisplay level={2} inline />
    <LevelDisplay level={4} inline />
    <LevelDisplay level="B" inline />
  </div>
)
