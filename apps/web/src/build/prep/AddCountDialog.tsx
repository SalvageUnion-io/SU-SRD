/**
 * How many more of one already in the encounter (r7 C13, MD7-11): adding the
 * same NPC again asks for a count, so three Raiders are one add, not three.
 * Each copy is numbered as every add is (`withAdded`); the count stops at the
 * room the encounter has left.
 */

import { useId, useRef, useState } from 'react'
import { ConfirmDialog } from '../../components/app'
import { Eyebrow, Input, Stack } from '../../components/index'
import { buildPrepCopy } from '../../messages/build-prep'

export function AddCountDialog({
  name,
  room,
  onClose,
  onAdd,
}: {
  /** What is added again; null shuts the dialog. */
  name: string | null
  /** How many more the encounter can take. */
  room: number
  onClose: () => void
  onAdd: (count: number) => Promise<void>
}) {
  const id = useId()
  const [typed, setTyped] = useState('1')
  const field = useRef<HTMLInputElement | null>(null)
  const count = Math.min(room, Math.max(1, Math.floor(Number(typed)) || 1))
  return (
    <ConfirmDialog
      open={name !== null}
      onOpenChange={(next) => {
        if (!next) {
          setTyped('1')
          onClose()
        }
      }}
      title={buildPrepCopy('addHowMany', { name: name ?? '' })}
      body={
        <Stack gap={8}>
          <Eyebrow as="label" tone="muted" htmlFor={id}>
            {buildPrepCopy('howMany')}
          </Eyebrow>
          <Input
            ref={field}
            id={id}
            type="number"
            inputMode="numeric"
            min={1}
            max={room}
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
          />
        </Stack>
      }
      initialFocus={field}
      confirmLabel={buildPrepCopy('addCount', { count })}
      onConfirm={async () => {
        await onAdd(count)
        setTyped('1')
      }}
      describeError={() => buildPrepCopy('tryAgain')}
    />
  )
}
