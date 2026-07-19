import type { Story } from '@ladle/react'
import { useState } from 'react'
import { SalvageUnionReference } from 'salvageunion-reference'
import { Caption } from '../../stories/_harness'
import { DeleteConfirmDialog } from './DeleteConfirmDialog'

// biome-ignore lint/style/useComponentExportOnlyModules: Ladle stories require a default meta export alongside story components
export default {
  title: 'Containers/Delete Confirm Dialog',
}

/** Destructive confirm — names the entity so the action is unambiguous. */
export const Default: Story = () => {
  const [open, setOpen] = useState(true)
  return (
    <div className="bg-paper p-4">
      <Caption>DeleteConfirmDialog</Caption>
      <DeleteConfirmDialog
        open={open}
        entityName={SalvageUnionReference.Chassis.all()[0]?.name ?? 'Mule'}
        onConfirm={() => setOpen(false)}
        onCancel={() => setOpen(false)}
      />
    </div>
  )
}
