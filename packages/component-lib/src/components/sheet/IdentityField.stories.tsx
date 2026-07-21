import type { Story } from '@ladle/react'
import { useState } from 'react'
import { Caption } from '../../stories/_harness'
import { IdentityField } from './IdentityField'

// biome-ignore lint/style/useComponentExportOnlyModules: Ladle stories require a default meta export alongside story components
export default {
  title: 'Compositions/Identity Field',
}

/**
 * The live sheets' labelled identity row. `editing` is driven by the section's
 * own Edit toggle, so the field is read-only until its section is unlocked.
 */
export const Default: Story = () => {
  const [callsign, setCallsign] = useState('Rook')
  const [editing, setEditing] = useState(false)

  return (
    <div className="sheet--pilot flex flex-col gap-8 bg-paper p-4">
      <div>
        <Caption>IdentityField — read-only vs editing</Caption>
        <div className="flex flex-col gap-3">
          <IdentityField label="Callsign" value={callsign} />
          <IdentityField
            label="Callsign"
            value={callsign}
            editing={editing}
            onSave={setCallsign}
            onEditClick={() => setEditing((v) => !v)}
          />
        </div>
      </div>
    </div>
  )
}
