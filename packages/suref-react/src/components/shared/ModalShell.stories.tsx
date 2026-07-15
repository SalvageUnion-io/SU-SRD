import type { Story } from '@ladle/react'
import { useState } from 'react'
import { SalvageUnionReference } from 'salvageunion-reference'

import { ModalShell } from './ModalShell'
import { Btn } from '../chrome/Btn'
import { Text } from '../base/Text'

// biome-ignore lint/style/useComponentExportOnlyModules: Ladle stories require a default meta export alongside story components
export default {
  title: 'Legacy/Modal',
}

const chassis = SalvageUnionReference.Chassis.all()[0]
const name = chassis?.name ?? 'Mule'

function Demo({ headerBg }: { headerBg?: string }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="p-4">
      <Btn onClick={() => setOpen(true)}>Open {name}</Btn>
      <ModalShell
        open={open}
        onOpenChange={setOpen}
        title={name}
        subtitle="Chassis"
        headerBg={headerBg}
        description={`${name} details`}
      >
        <div className="p-4">
          <Text as="p" className="text-sm text-ink-2">
            Structure {chassis?.structurePoints} · Cargo {chassis?.cargoCapacity} · Tech Level{' '}
            {chassis?.techLevel}
          </Text>
        </div>
      </ModalShell>
    </div>
  )
}

/** Default header (orange). Click to open; Esc / backdrop / × close it. */
export const Default: Story = () => <Demo />

/** Rust header — the light-close variant. */
export const RustHeader: Story = () => <Demo headerBg="bg-su-rust" />
