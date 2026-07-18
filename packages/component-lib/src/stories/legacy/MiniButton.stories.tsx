import type { Story } from '@ladle/react'
import { Button } from '../../components/chrome/Button'
import { Caption } from '../_harness'

// biome-ignore lint/style/useComponentExportOnlyModules: Ladle stories require a default meta export alongside story components
export default { title: 'Legacy/Mini Button' }

/**
 * MiniButton — the compact uppercase action chip (the former standalone
 * `MiniBtn`), now the `xs` size of the canonical `Button`: badge radius,
 * condensed caps, tight padding. Used for secondary controls like '⇄ Swap' /
 * '✕ Remove' / 'Details' beside an entity card.
 */
export const Default: Story = () => (
  <div className="flex flex-col gap-4">
    <Caption>Legacy · Mini Button — the former MiniBtn, now `Button size="xs"`</Caption>

    <div className="flex flex-wrap items-center gap-2">
      <Button size="xs">⇄ Swap</Button>
      <Button size="xs">✕ Remove</Button>
      <Button size="xs">Details</Button>
      <Button size="xs" disabled>
        Disabled
      </Button>
    </div>
  </div>
)
