/**
 * Clearing the field (play.md §10): the Opposition's "Clear the field", and
 * what End asks while the tray still holds what an encounter fielded. Each
 * names how many NPCs go, and the choice is the Mediator's own (ADR-007):
 * nothing leaves the tray until they press it.
 */

import type { CSSProperties } from 'react'
import { useId, useState } from 'react'
import { ConfirmDialog, Radio } from '../../components/app'
import { capsLabel, tokens } from '../../components/index'
import { mediatorCopy } from '../../messages/play-mediator'
import { fieldCount } from './runEncounter.model'

const FIELDSET = {
  border: 0,
  display: 'flex',
  flexDirection: 'column',
  gap: tokens.space[8],
  margin: 0,
  minWidth: 0,
  padding: 0,
} satisfies CSSProperties

const LEGEND = { marginBottom: tokens.space[8], padding: 0 } satisfies CSSProperties
const LEGEND_CAPS = capsLabel({ size: 'badge' })

/** "Clear the field?": every NPC on the tray leaves it at once. */
export function ClearFieldDialog({
  open,
  onClose,
  onTray,
  onClear,
}: {
  open: boolean
  onClose: () => void
  /** How many NPCs are on the tray now. */
  onTray: number
  onClear: () => Promise<unknown>
}) {
  return (
    <ConfirmDialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose()
      }}
      tone="danger"
      title={mediatorCopy('clearTheFieldTitle')}
      body={mediatorCopy('clearTheFieldBody', { count: fieldCount(onTray) })}
      confirmLabel={mediatorCopy('clearTheField')}
      onConfirm={async () => {
        await onClear()
      }}
    />
  )
}

/**
 * "End <encounter>?": asked only while the tray holds something, so the
 * Mediator can clear the field with it. Leaving the Opposition is the default.
 */
export function EndEncounterDialog({
  name,
  onClose,
  onTray,
  onEnd,
}: {
  /** The running encounter's name; null shuts the dialog. */
  name: string | null
  onClose: () => void
  onTray: number
  onEnd: (clear: boolean) => Promise<unknown>
}) {
  const id = useId()
  const [clear, setClear] = useState(false)
  return (
    <ConfirmDialog
      open={name !== null}
      onOpenChange={(next) => {
        if (!next) onClose()
      }}
      tone={clear ? 'danger' : 'default'}
      title={mediatorCopy('endNamedTitle', { name: name ?? '' })}
      body={
        <>
          <span>{mediatorCopy('endLede')}</span>
          <fieldset style={FIELDSET}>
            <legend className={LEGEND_CAPS} style={LEGEND}>
              {mediatorCopy('theOppositionOnTheField')}
            </legend>
            <Radio
              name={`${id}-field`}
              checked={!clear}
              onChange={() => setClear(false)}
              label={mediatorCopy('leaveItOnTheField')}
            />
            <Radio
              name={`${id}-field`}
              checked={clear}
              onChange={() => setClear(true)}
              label={mediatorCopy('clearTheFieldToo', { count: fieldCount(onTray) })}
            />
          </fieldset>
        </>
      }
      confirmLabel={mediatorCopy('end')}
      onConfirm={async () => {
        await onEnd(clear)
        setClear(false)
      }}
    />
  )
}
