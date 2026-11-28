/**
 * UnstowDialog — what Unstow on a Storage Bay row asks first (r5 B4): how
 * many, for a stack, and where they go: onto the docked Mech's hold, when one
 * is docked and they fit, or out of the bay. Nothing moves until Unstow is
 * pressed. Fetched when Unstow is pressed (`StorageBay`), so the sheet's page
 * load carries none of it.
 */

import type { CargoLot } from 'game-domain/schemas/cargoLot'
import type { CSSProperties } from 'react'
import { useState } from 'react'
import { DialogActions, Radio } from '../../components/app'
import { Button, ModalShell, Stat, tokens } from '../../components/index'
import { buildSheetCopy } from '../../messages/build-sheet'

const BODY = {
  alignItems: 'stretch',
  display: 'flex',
  flexDirection: 'column',
  gap: tokens.space[12],
  padding: tokens.space[16],
} satisfies CSSProperties

/** Where an unstowed lot goes. */
export type UnstowTo = 'mech' | 'out'

export function UnstowDialog({
  lot,
  mechName,
  fits,
  onClose,
  onUnstow,
}: {
  lot: CargoLot
  /** The docked Mech, by name; null when none is docked. */
  mechName: string | null
  /** How many of the lot the Mech's hold has room for. */
  fits: number
  onClose: () => void
  onUnstow: (qty: number, to: UnstowTo) => void
}) {
  const all = lot.kind === 'bulk' && lot.qty !== undefined ? lot.qty : 1
  const [count, setCount] = useState(all)
  const canLoad = mechName !== null && fits > 0
  const [to, setTo] = useState<UnstowTo>(canLoad ? 'mech' : 'out')
  const max = to === 'mech' ? Math.min(all, lot.kind === 'bulk' ? fits : all) : all
  const qty = Math.min(count, max)
  return (
    <ModalShell
      open
      onOpenChange={(next) => {
        if (!next) onClose()
      }}
      title={buildSheetCopy('unstowName', { name: lot.name })}
      width="narrow"
    >
      <div style={BODY}>
        {all > 1 ? (
          <Stat
            label={buildSheetCopy('qty')}
            value={qty}
            min={1}
            max={max}
            mode="edit"
            stepperLabel={buildSheetCopy('unstowAmount')}
            onChange={setCount}
          />
        ) : null}
        <Radio
          name="unstow-to"
          checked={to === 'mech'}
          disabled={!canLoad}
          onChange={() => setTo('mech')}
          label={buildSheetCopy('unstowOnto', {
            mech: mechName ?? buildSheetCopy('theDockedMech'),
          })}
          description={
            mechName === null
              ? buildSheetCopy('noMechNothingToLoad')
              : fits > 0
                ? undefined
                : buildSheetCopy('doesNotFit', { name: lot.name, free: 0 })
          }
        />
        <Radio
          name="unstow-to"
          checked={to === 'out'}
          onChange={() => setTo('out')}
          label={buildSheetCopy('unstowOut')}
          description={buildSheetCopy('unstowOutHint')}
        />
        <DialogActions>
          <Button variant="ghost" size="compact" onClick={onClose}>
            {buildSheetCopy('cancel')}
          </Button>
          <Button variant="primary" size="compact" onClick={() => onUnstow(qty, to)}>
            {buildSheetCopy('unstowCount', { count: qty })}
          </Button>
        </DialogActions>
      </div>
    </ModalShell>
  )
}
