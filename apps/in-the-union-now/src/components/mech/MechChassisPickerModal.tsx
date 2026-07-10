/**
 * MechChassisPickerModal — inline "Change chassis" flow for the mech live
 * sheet's edit mode. Reuses the wizard's Chassis step master/detail panes
 * (ChassisOptionList + ChassisDetail) inside a ModalShell, since the sheet
 * has no room for the wizard's 320px rail.
 *
 * Changing chassis is DESTRUCTIVE (the wizard's selectChassis wipes the
 * pattern/systems/modules), so a confirmed selection is required before the
 * caller's onConfirm fires. The picker shell hides while the confirm dialog
 * is up so the two base-ui dialogs never fight over the focus trap.
 */

import { useEffect, useState } from 'react'
import { Btn, ModalShell } from 'suref-react'

import { ConfirmDialog } from '../shared/ConfirmDialog'
import { ChassisDetail, ChassisOptionList } from './ChassisStep'

type MechChassisPickerModalProps = {
  open: boolean
  /** The mech's current chassis slug — the live selection baseline. */
  currentChassisRef: string
  onOpenChange: (open: boolean) => void
  /** Fired with the new chassis slug once the destructive change is confirmed. */
  onConfirm: (chassisRef: string) => void
}

export function MechChassisPickerModal({
  open,
  currentChassisRef,
  onOpenChange,
  onConfirm,
}: MechChassisPickerModalProps) {
  const [selected, setSelected] = useState(currentChassisRef)
  const [confirming, setConfirming] = useState(false)

  // Reset the preview to the live chassis whenever the modal (re)opens.
  useEffect(() => {
    if (open) {
      setSelected(currentChassisRef)
      setConfirming(false)
    }
  }, [open, currentChassisRef])

  const changed = selected !== currentChassisRef

  function apply() {
    if (!changed) {
      onOpenChange(false)
      return
    }
    setConfirming(true)
  }

  function confirmChange() {
    onConfirm(selected)
    setConfirming(false)
    onOpenChange(false)
  }

  return (
    <>
      <ModalShell
        open={open && !confirming}
        onOpenChange={onOpenChange}
        title="Change Chassis"
        subtitle="Swapping chassis clears the current loadout."
        maxWidth="max-w-4xl"
      >
        <div className="grid grid-cols-1 gap-4 bg-paper p-4 sm:grid-cols-[220px_minmax(0,1fr)]">
          <div className="max-h-[50vh] overflow-y-auto">
            <ChassisOptionList selectedChassis={selected} onSelect={setSelected} />
          </div>
          <div className="min-w-0">
            <ChassisDetail chassisName={selected} />
          </div>
        </div>
        <div className="flex justify-end gap-2 bg-paper px-4 pb-4">
          <Btn variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
            Cancel
          </Btn>
          <Btn size="sm" disabled={!changed} onClick={apply}>
            Apply chassis
          </Btn>
        </div>
      </ModalShell>

      <ConfirmDialog
        open={confirming}
        title="Change chassis?"
        confirmLabel="Change chassis"
        danger
        onConfirm={confirmChange}
        onCancel={() => setConfirming(false)}
      >
        Changing chassis clears the current loadout (pattern, systems, and modules). Continue?
      </ConfirmDialog>
    </>
  )
}
