import type { CSSProperties } from 'react'
import { useState } from 'react'
import { SalvageUnionReference } from 'salvageunion-reference'
import { color, font, fontSize, space } from '../../design/tokens'
import type { Story } from '../../stories/_harness'
import { Text } from '../base/Text'
import { Button } from '../chrome/Button'
import { ModalShell } from './ModalShell'

export default {
  title: 'Containers/Modal Shell',
}

const chassis = SalvageUnionReference.Chassis.all()[0]
const name = chassis?.name ?? 'Mule'

const COLUMN = { display: 'flex', flexDirection: 'column', gap: space[6] } satisfies CSSProperties

const STAGE = {
  display: 'flex',
  flexDirection: 'column',
  gap: space[16],
  backgroundColor: color.paper,
  padding: space[20],
  color: color.ink,
} satisfies CSSProperties

const RULE = {
  maxWidth: '42rem',
  fontFamily: font.body,
  fontSize: fontSize.xs,
  lineHeight: 1.625,
  color: color.wkMuted,
} satisfies CSSProperties

function Trigger({ tone, label }: { tone?: 'action' | 'danger'; label: string }) {
  const [open, setOpen] = useState(false)
  return (
    <div style={COLUMN}>
      <Button onClick={() => setOpen(true)}>{label}</Button>
      <ModalShell
        open={open}
        onOpenChange={setOpen}
        title={name}
        subtitle="Chassis"
        tone={tone}
        description={`${name} details`}
      >
        <div style={{ padding: space[16] }}>
          <Text as="p" style={{ fontSize: fontSize.sm, lineHeight: '20px', color: color.wkMuted }}>
            Structure {chassis?.structurePoints} · Cargo {chassis?.cargoCapacity} · Tech Level{' '}
            {chassis?.techLevel}
          </Text>
        </div>
      </ModalShell>
      <code style={{ fontFamily: font.body, fontSize: fontSize.badge, color: color.wkMuted }}>
        {tone ?? 'action (default)'}
      </code>
    </div>
  )
}

/** The dialog shell — action (default) vs danger tone. Click a trigger; Esc / backdrop / × close it. */
export const Default: Story = () => (
  <div style={STAGE}>
    <p style={RULE}>
      A centered dialog on the Card shell. `tone` picks the header: 'action' (pilot blue) for
      constructive flows, 'danger' (adversary rust, light close button) for destructive confirms.
      Modals overlay, so open one to see it.
    </p>
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: space[24] }}>
      <Trigger label={`Open ${name}`} />
      <Trigger tone="danger" label={`Open ${name} (danger)`} />
    </div>
  </div>
)
