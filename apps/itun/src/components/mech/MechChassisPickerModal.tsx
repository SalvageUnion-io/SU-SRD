/**
 * MechChassisPickerModal — inline "Change chassis" flow for the mech live
 * sheet's edit mode. Uses the shared `EntitySearcher` in a bare ModalShell, the
 * same picker every other "choose a reference entity" modal runs on.
 *
 * It previously ran a bespoke master/detail pair (a 220px option rail beside a
 * preview pane) which the searcher replaces. A chassis is one of the largest
 * entities in the data — artwork, stat block, chassis ability, patterns — and a
 * 220px column is narrower than the card's own artwork, so every option in the
 * master pane rendered clipped and unreadably tall. The searcher's two-column
 * masonry gives each card its natural width, and `hide.patterns` drops the one
 * section a picker has no use for (patterns are chosen in the next step).
 *
 * Changing chassis is DESTRUCTIVE (the wizard's selectChassis wipes the
 * pattern/systems/modules), so a confirmed selection is required before the
 * caller's onConfirm fires. The picker shell hides while the confirm dialog
 * is up so the two base-ui dialogs never fight over the focus trap.
 */

import { Button, EntitySearcher, ModalShell } from 'component-lib'
import { useEffect, useState } from 'react'
import { nameToSlug } from 'salvageunion-reference'

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
        maxWidth="max-w-5xl"
        bare
      >
        <EntitySearcher
          schema="chassis"
          mode="single"
          selected={selected ? [selected] : []}
          // Single-select: picking replaces the prior pick, picking the current
          // one clears it back to "nothing chosen" (Apply then disables).
          onToggle={(ref) => setSelected((prev) => (prev === ref ? '' : ref))}
          idOf={(item) => nameToSlug(item.name)}
          // Patterns are a step of their own and swapping chassis wipes them —
          // rendering the pattern list here would be the tallest section of the
          // tallest card, for a choice this modal cannot make.
          hide={{ patterns: true }}
          // "Chosen only / Not yet added" is meaningless when the answer is
          // always exactly one entity.
          facets={{ status: false }}
          chosenLabel="Chosen"
          title="Change Chassis"
          subtitle="Swapping chassis clears the current loadout."
          emptyMessage="No matching chassis."
          onClose={() => onOpenChange(false)}
          railActions={
            <>
              <Button variant="ghost" size="compact" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button size="compact" disabled={!changed} onClick={apply}>
                Apply chassis
              </Button>
            </>
          }
        />
      </ModalShell>

      <ModalShell
        open={confirming}
        onOpenChange={(next) => {
          if (!next) setConfirming(false)
        }}
        title="Change chassis?"
        tone="danger"
        maxWidth="max-w-md"
      >
        <div className="flex flex-col gap-4 bg-paper p-5">
          <div className="font-body text-sm text-wk-muted">
            Changing chassis clears the current loadout (pattern, systems, and modules). Continue?
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="compact" onClick={() => setConfirming(false)}>
              Cancel
            </Button>
            <Button variant="danger" size="compact" onClick={confirmChange}>
              Change chassis
            </Button>
          </div>
        </div>
      </ModalShell>
    </>
  )
}
