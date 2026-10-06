import type { CSSProperties } from 'react'
import { useState } from 'react'
import { SalvageUnionReference } from 'salvageunion-reference'
import { color, font, fontSize, space } from '../../design/tokens'
import type { Story } from '../../stories/_harness'
import { Caption } from '../../stories/_harness'
import { Button } from '../chrome/Button'
import { ConfirmDialog } from './ConfirmDialog'

export default {
  title: 'Containers/Confirm Dialog',
}

/** How long the demo actions take, so the pending state is visible. */
const WORK_MS = 1200

const wait = () => new Promise<void>((resolve) => setTimeout(resolve, WORK_MS))

type DemoProps = {
  trigger: string
  title: string
  body: string
  confirmLabel: string
  pendingLabel: string
  tone: 'danger' | 'default'
  /** Fail the first attempt, to show the inline failure line. */
  failFirst?: boolean
  failure?: string
}

function Demo({
  trigger,
  title,
  body,
  confirmLabel,
  pendingLabel,
  tone,
  failFirst,
  failure,
}: DemoProps) {
  const [open, setOpen] = useState(false)
  const [attempts, setAttempts] = useState(0)
  return (
    <div style={demoStyle}>
      <Caption>{tone}</Caption>
      <Button
        onClick={() => {
          setAttempts(0)
          setOpen(true)
        }}
      >
        {trigger}
      </Button>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title={title}
        body={body}
        confirmLabel={confirmLabel}
        pendingLabel={pendingLabel}
        tone={tone}
        onConfirm={async () => {
          await wait()
          setAttempts((n) => n + 1)
          if (failFirst && attempts === 0) throw new Error('demo failure')
        }}
        describeError={failure === undefined ? undefined : () => failure}
      />
    </div>
  )
}

const demoStyle = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'flex-start',
  gap: space[6],
} satisfies CSSProperties

const pageStyle = {
  display: 'flex',
  flexDirection: 'column',
  gap: space[16],
  color: color.ink,
} satisfies CSSProperties

const introStyle = {
  maxWidth: '42rem',
  margin: 0,
  fontFamily: font.body,
  fontSize: fontSize.xs,
  lineHeight: 1.6,
  color: color.wkMuted,
} satisfies CSSProperties

const rowStyle = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: space[24],
} satisfies CSSProperties

/**
 * The confirm in both tones, plus a failing action. Each confirm takes a
 * moment, so the locked, pending state shows; the third fails its first
 * attempt and keeps the dialog open with the reason.
 */
export const Default: Story = () => {
  const mech = SalvageUnionReference.Chassis.all()[0]?.name ?? 'Mule'
  const crawler = SalvageUnionReference.Crawlers.all()[0]?.name ?? 'Augmented'
  return (
    <div style={pageStyle}>
      <p style={introStyle}>
        An alert dialog on ModalShell. `danger` (rust header, focus on Cancel) for destructive
        confirms; `default` (pilot blue, focus on the confirm) for constructive ones. The body is
        the accessible description, and says what happens and whether it can be undone. Escape or ×
        cancels, except while the action runs.
      </p>
      <div style={rowStyle}>
        <Demo
          trigger={`Delete ${mech}`}
          title={`Delete ${mech}?`}
          body={`This action cannot be undone. ${mech} will be permanently removed.`}
          confirmLabel="Delete"
          pendingLabel="Deleting…"
          tone="danger"
        />
        <Demo
          trigger={`Copy ${mech}`}
          title={`Copy ${mech} to My stuff?`}
          body={`Makes “COPY OF ${mech}” in My stuff. It is a separate build: changes to it won't sync back.`}
          confirmLabel="Make a copy"
          pendingLabel="Copying…"
          tone="default"
        />
        <Demo
          trigger={`Scrap ${crawler} (fails once)`}
          title={`Scrap ${crawler}?`}
          body={`This deletes ${crawler} for everyone in the game and can't be undone.`}
          confirmLabel="Scrap"
          pendingLabel="Scrapping…"
          tone="danger"
          failFirst
          failure={`${crawler} could not be scrapped. Try again.`}
        />
      </div>
    </div>
  )
}
