/**
 * MechChassisPickerModal — inline "Change chassis" flow for the mech live
 * sheet's edit mode. Uses the shared `EntitySearcher` in a bare ModalShell, the
 * same picker every other "choose a reference entity" modal runs on.
 *
 * A chassis is one of the largest entities in the data — artwork, stat block,
 * chassis ability, patterns — so the list is Minis and only the chassis being
 * read is a Card; `hide.patterns` drops the one section a picker has no use
 * for (patterns are chosen in the next step).
 *
 * The loadout goes with the mech where it fits the new chassis
 * (`loadoutOnChassis`); the picker says, for the chassis being read, what will
 * not fit before Apply. Apply is the one press, as every picker's (the caller
 * offers Undo), so no second confirm follows it.
 */

import { useEffect, useState } from 'react'
import { nameToSlug } from 'salvageunion-reference'
import { Button, EntitySearcher, ModalShell } from '../../components/index'
import { droppedNames, loadoutOnChassis } from '../../lib/rules/chassisSwap'
import { mechCopy } from '../../messages/build-mech'
import '../../styles/build/wizard.css'

type MechChassisPickerModalProps = {
  open: boolean
  /** The mech's current chassis slug — the live selection baseline. */
  currentChassisRef: string
  onOpenChange: (open: boolean) => void
  /** The mech's installed loadout, to say what a chassis will not hold. */
  loadout: { systems: readonly string[]; modules: readonly string[] }
  /** Fired with the new chassis slug on Apply. */
  onConfirm: (chassisRef: string) => void
}

export function MechChassisPickerModal({
  open,
  currentChassisRef,
  loadout,
  onOpenChange,
  onConfirm,
}: MechChassisPickerModalProps) {
  const [selected, setSelected] = useState(currentChassisRef)

  // Reset the preview to the live chassis whenever the modal (re)opens.
  useEffect(() => {
    if (open) setSelected(currentChassisRef)
  }, [open, currentChassisRef])

  // A mech must always HAVE a chassis, so "nothing selected" is not an applyable
  // state — only a different one is. The empty guard is load-bearing: single-select
  // clears on clicking the chosen card (and via the rail's Remove), and without it
  // Apply would enable on an empty ref and write `chassisRef: ''` — an unresolvable
  // chassis plus a wiped loadout, since applying also clears systems/modules.
  const changed = selected !== '' && selected !== currentChassisRef

  // What the chassis being read will not hold, said before Apply.
  const left = changed ? droppedNames(loadoutOnChassis(selected, loadout).dropped) : []
  const subtitle = !changed
    ? mechCopy('yourLoadoutStaysWhereItFits')
    : left.length === 0
      ? mechCopy('yourLoadoutFits')
      : mechCopy('willNotFit', { names: left.join(', ') })

  function apply() {
    if (changed) onConfirm(selected)
    onOpenChange(false)
  }

  return (
    <ModalShell
      open={open}
      onOpenChange={onOpenChange}
      title={mechCopy('changeChassis')}
      width="page"
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
        // Rendering the pattern list here would be the tallest section of the
        // tallest card, for a choice this modal cannot make.
        hide={{ patterns: true }}
        // Choosing a chassis needs its ability (E19's builder exception).
        showChassisAbility
        // "Chosen only / Not yet added" is meaningless when the answer is
        // always exactly one entity.
        facets={{ status: false }}
        chosenLabel={mechCopy('chosen')}
        title={mechCopy('changeChassis')}
        subtitle={subtitle}
        emptyMessage={mechCopy('noMatchingChassis')}
        onClose={() => onOpenChange(false)}
        railActions={
          <>
            <Button variant="ghost" size="compact" onClick={() => onOpenChange(false)}>
              {mechCopy('cancel')}
            </Button>
            <Button size="compact" disabled={!changed} onClick={apply}>
              {mechCopy('applyChassis')}
            </Button>
          </>
        }
      />
    </ModalShell>
  )
}
