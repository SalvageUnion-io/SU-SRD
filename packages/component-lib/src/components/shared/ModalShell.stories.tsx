import type { Story } from '@ladle/react'
import { useState } from 'react'
import { SalvageUnionReference } from 'salvageunion-reference'

import { ModalShell } from './ModalShell'
import { Button } from '../chrome/Button'
import { Text } from '../base/Text'

// biome-ignore lint/style/useComponentExportOnlyModules: Ladle stories require a default meta export alongside story components
export default {
  title: 'Containers/Modal Shell',
}

const chassis = SalvageUnionReference.Chassis.all()[0]
const name = chassis?.name ?? 'Mule'

function Trigger({ headerBg, label }: { headerBg?: string; label: string }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="flex flex-col gap-1.5">
      <Button onClick={() => setOpen(true)}>{label}</Button>
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
      <code className="font-body text-nano text-ink-2">
        {headerBg ? headerBg : 'default header'}
      </code>
    </div>
  )
}

/** The dialog shell — default vs rust header. Click a trigger; Esc / backdrop / × close it. */
export const Default: Story = () => (
  <div className="flex flex-col gap-4 bg-paper p-5 text-ink">
    <p className="max-w-2xl font-body text-xs leading-relaxed text-ink-2">
      A centered dialog on the DisplayCard shell. headerBg tones the header (bg-adversary uses the
      light close button). Modals overlay, so open one to see it.
    </p>
    <div className="flex flex-wrap gap-6">
      <Trigger label={`Open ${name}`} />
      <Trigger headerBg="bg-adversary" label={`Open ${name} (rust)`} />
    </div>
  </div>
)
