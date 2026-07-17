import type { Story } from '@ladle/react'
import { useState } from 'react'
import { ConfirmDialog } from './ConfirmDialog'
import { Btn } from '../chrome/Btn'

// biome-ignore lint/style/useComponentExportOnlyModules: Ladle stories require a default meta export alongside story components
export default {
  title: 'Legacy/ITUN/Confirm Dialog',
}

/**
 * The standard confirmation dialog (lifted from ITUN, pending review) — a thin
 * wrapper over `ModalShell`. The neutral variant confirms a routine action; the
 * `danger` variant (rust header + danger button) guards a destructive one like
 * unassigning a Mech from its Pilot.
 */
export const Default: Story = () => {
  const [open, setOpen] = useState<null | 'neutral' | 'danger'>(null)
  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-3">
        <Btn onClick={() => setOpen('neutral')}>Save Pilot</Btn>
        <Btn variant="danger" onClick={() => setOpen('danger')}>
          Unassign Mech
        </Btn>
      </div>

      <ConfirmDialog
        open={open === 'neutral'}
        title="Save Pilot?"
        confirmLabel="Save"
        onConfirm={() => setOpen(null)}
        onCancel={() => setOpen(null)}
      >
        This will overwrite the current draft of Ace with your changes.
      </ConfirmDialog>

      <ConfirmDialog
        open={open === 'danger'}
        title="Unassign this Mech?"
        confirmLabel="Unassign"
        cancelLabel="Keep it"
        danger
        onConfirm={() => setOpen(null)}
        onCancel={() => setOpen(null)}
      >
        The Iron Mongrel will be returned to the Crawler's storage bay.
      </ConfirmDialog>
    </div>
  )
}
