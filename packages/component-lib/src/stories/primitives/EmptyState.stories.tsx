import type { Story } from '@ladle/react'

import { EmptyState } from '../../components/chrome/EmptyState'
import { Button } from '../../components/chrome/Button'

// biome-ignore lint/style/useComponentExportOnlyModules: Ladle stories require a default meta export alongside story components
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
        <Button variant="primary" size="sm">
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
