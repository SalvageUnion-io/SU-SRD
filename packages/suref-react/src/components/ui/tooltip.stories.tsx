import type { Story } from '@ladle/react'
import { Tooltip } from './tooltip'

// biome-ignore lint/style/useComponentExportOnlyModules: Ladle stories require a default meta export alongside story components
export default {
  title: 'Containers/Tooltip',
}

export const Basic: Story = () => (
  <div style={{ display: 'flex', gap: '1rem', padding: '2rem' }}>
    <Tooltip content="This is a tooltip">
      <button type="button" className="rounded bg-su-black px-4 py-2 text-su-white">
        Hover me
      </button>
    </Tooltip>
  </div>
)

export const Positions: Story = () => (
  <div style={{ display: 'flex', gap: '1rem', padding: '4rem' }}>
    <Tooltip content="Top tooltip" side="top">
      <button type="button" className="rounded bg-su-orange px-4 py-2 text-su-white">
        Top
      </button>
    </Tooltip>
    <Tooltip content="Right tooltip" side="right">
      <button type="button" className="rounded bg-su-green px-4 py-2 text-su-white">
        Right
      </button>
    </Tooltip>
    <Tooltip content="Bottom tooltip" side="bottom">
      <button type="button" className="rounded bg-su-blue px-4 py-2 text-su-white">
        Bottom
      </button>
    </Tooltip>
    <Tooltip content="Left tooltip" side="left">
      <button type="button" className="rounded bg-su-pink px-4 py-2 text-su-white">
        Left
      </button>
    </Tooltip>
  </div>
)

export const RichContent: Story = () => (
  <div style={{ display: 'flex', gap: '1rem', padding: '2rem' }}>
    <Tooltip
      content={
        <div style={{ padding: '0.25rem' }}>
          <div style={{ fontWeight: 'bold' }}>System: Laser Cutter</div>
          <div style={{ fontSize: '0.875rem' }}>Tech Level 2 - 1 EP</div>
        </div>
      }
    >
      <button type="button" className="rounded bg-tl-2 px-4 py-2 text-su-white">
        Rich Content
      </button>
    </Tooltip>
  </div>
)

export const CustomDelay: Story = () => (
  <div style={{ display: 'flex', gap: '1rem', padding: '2rem' }}>
    <Tooltip content="Instant tooltip" delayDuration={0}>
      <button type="button" className="rounded bg-su-brick px-4 py-2 text-su-white">
        No Delay
      </button>
    </Tooltip>
    <Tooltip content="Slow tooltip" delayDuration={1000}>
      <button type="button" className="rounded bg-su-grey-dark px-4 py-2 text-su-white">
        1s Delay
      </button>
    </Tooltip>
  </div>
)
