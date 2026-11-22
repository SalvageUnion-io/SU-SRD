/**
 * UnloadDialog — "How many?" for Unload on a stack (r4 E10): the whole lot is
 * one press, and part of it is a count and a press. The sheet moves no Scrap
 * by itself (the owner's ruling: tables differ on when a refit is paid), so
 * this is how a player pays part of a lot.
 */

import type { CargoLot } from 'game-domain/schemas/cargoLot'
import type { CSSProperties } from 'react'
import { useState } from 'react'
import { DialogActions } from '../../components/app'
import { Button, ModalShell, Stat, tokens } from '../../components/index'
import { buildSheetCopy } from '../../messages/build-sheet'

const BODY = {
  alignItems: 'flex-start',
  display: 'flex',
  flexDirection: 'column',
  gap: tokens.space[12],
  padding: tokens.space[16],
} satisfies CSSProperties

export function UnloadDialog({
  lot,
  onClose,
  onUnload,
}: {
  lot: CargoLot
  onClose: () => void
  /** The count to unload; the whole lot's when all of it goes. */
  onUnload: (qty: number) => void
}) {
  const all = lot.qty ?? 1
  const [count, setCount] = useState(1)
  return (
    <ModalShell
      open
      onOpenChange={(next) => {
        if (!next) onClose()
      }}
      title={buildSheetCopy('howMany')}
      subtitle={lot.name}
      width="narrow"
    >
      <div style={BODY}>
        <Stat
          label={buildSheetCopy('qty')}
          value={count}
          min={1}
          max={all}
          mode="edit"
          stepperLabel={buildSheetCopy('unloadAmount')}
          onChange={setCount}
        />
        <DialogActions>
          <Button variant="ghost" size="compact" onClick={onClose}>
            {buildSheetCopy('cancel')}
          </Button>
          <Button size="compact" onClick={() => onUnload(all)}>
            {buildSheetCopy('unloadAll', { count: all })}
          </Button>
          <Button variant="primary" size="compact" onClick={() => onUnload(count)}>
            {buildSheetCopy('unloadCount', { count })}
          </Button>
        </DialogActions>
      </div>
    </ModalShell>
  )
}
