import type { Story } from '@ladle/react'

import { EmptyState } from './EmptyState'
import { Button } from './Button'
import { Glyph } from './glyphs'

export default {
  title: 'Containers/Empty State',
}

/** headline + body + action — stamp voice, dashed = fillable, one rust action. */
export const Default: Story = () => (
  <div className="max-w-sm bg-paper p-4">
    <EmptyState
      headline="No mechs yet"
      body="Build your first chassis to see it here."
      action={
        <Button variant="primary" size="compact">
          New mech ▸
        </Button>
      }
    />
  </div>
)

/** headline only — the minimal empty slot. */
export const HeadlineOnly: Story = () => (
  <div className="max-w-sm bg-paper p-4">
    <EmptyState headline="No pilots yet" />
  </div>
)

/** quiet — the muted app-chrome placeholder (absorbed from `Panel`'s retired
 *  `Empty`): centered, faint dashed frame, decorative glyph, no stamp. */
export const Quiet: Story = () => (
  <div className="max-w-sm bg-paper p-4">
    <EmptyState
      variant="quiet"
      icon={<Glyph name="gear" className="size-7 text-wk-muted" />}
      body="No systems installed yet."
      action={
        <Button variant="primary" size="compact">
          + Add system
        </Button>
      }
    />
  </div>
)
