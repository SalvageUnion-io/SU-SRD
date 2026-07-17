import type { Story } from '@ladle/react'
import { Tooltip } from './tooltip'

// biome-ignore lint/style/useComponentExportOnlyModules: Ladle stories require a default meta export alongside story components
export default {
  title: 'Atoms/Tooltip',
}

const trigger = 'rounded-card bg-ink px-4 py-2 font-cond uppercase tracking-caps-tight text-paper'

/** Sides, rich content, and delay — every Tooltip mode on one page (hover each). */
export const Default: Story = () => (
  <div className="flex flex-col gap-6 bg-paper p-8 text-ink">
    <p className="max-w-2xl font-mono text-xs leading-relaxed text-ink-2">
      Hover a trigger. side positions the tip (top / right / bottom / left); content accepts rich
      nodes; delayDuration tunes the open delay.
    </p>
    <div className="flex flex-wrap items-center gap-8 p-8">
      <Tooltip content="Top" side="top">
        <button type="button" className={trigger}>
          Top
        </button>
      </Tooltip>
      <Tooltip content="Right" side="right">
        <button type="button" className={trigger}>
          Right
        </button>
      </Tooltip>
      <Tooltip content="Bottom" side="bottom">
        <button type="button" className={trigger}>
          Bottom
        </button>
      </Tooltip>
      <Tooltip content="Left" side="left">
        <button type="button" className={trigger}>
          Left
        </button>
      </Tooltip>
      <Tooltip
        content={
          <div className="p-1">
            <div className="font-bold">System: Laser Cutter</div>
            <div className="text-sm">Tech Level 2 · 1 EP</div>
          </div>
        }
      >
        <button type="button" className={trigger}>
          Rich content
        </button>
      </Tooltip>
      <Tooltip content="Instant" delayDuration={0}>
        <button type="button" className={trigger}>
          No delay
        </button>
      </Tooltip>
      <Tooltip content="Slow" delayDuration={1000}>
        <button type="button" className={trigger}>
          1s delay
        </button>
      </Tooltip>
    </div>
  </div>
)
