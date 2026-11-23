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
 * The chassis being read says, beside its Choose, what will not fit
 * (`loadoutOnChassis`). Choose keeps it, over the slots and marked rule
 * breaking, and "Leave them off" is the second button (r6 E7,
 * `CHASSIS_SWAP_KEEPS_OVERFLOW`; the other ruling swaps the two). Choose is the one confirming press (r2 G3: a picker that holds
 * exactly one thing has no Apply step); the caller offers Undo.
 */

import { nameToSlug } from 'salvageunion-reference'
import { Button, EntitySearcher, ModalShell, Text } from '../../components/index'
import { droppedNames, loadoutOnChassis } from '../../lib/rules/chassisSwap'
import { mechCopy } from '../../messages/build-mech'
import { CHASSIS_SWAP_KEEPS_OVERFLOW } from '../rulings.model'
import '../../styles/build/wizard.css'

type MechChassisPickerModalProps = {
  open: boolean
  /** The mech's current chassis slug — the live selection baseline. */
  currentChassisRef: string
  onOpenChange: (open: boolean) => void
  /** The mech's installed loadout, to say what a chassis will not hold. */
  loadout: { systems: readonly string[]; modules: readonly string[] }
  /**
   * Fired with the new chassis slug on Choose; `keep` when the player keeps
   * the whole loadout, over the new chassis's slots (r5 C10).
   */
  onConfirm: (chassisRef: string, keep?: boolean) => void
  /** The pattern the Mech is linked to: a new chassis unlinks it, said first (r8 E3). */
  pattern?: string | undefined
}

export function MechChassisPickerModal({
  open,
  currentChassisRef,
  loadout,
  onOpenChange,
  onConfirm,
  pattern,
}: MechChassisPickerModalProps) {
  const loadoutLine = mechCopy(
    CHASSIS_SWAP_KEEPS_OVERFLOW ? 'yourLoadoutComesAlong' : 'yourLoadoutStaysWhereItFits'
  )
  /** What `chassisRef` will not hold of the loadout: said beside its Choose. */
  const leftOff = (chassisRef: string) =>
    chassisRef === currentChassisRef
      ? []
      : droppedNames(loadoutOnChassis(chassisRef, loadout).dropped)

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
        selected={currentChassisRef ? [currentChassisRef] : []}
        // Choose applies: the searcher only ever emits a chassis that is not
        // the current one, and never an empty ref (a mech keeps a chassis).
        onToggle={(ref) => {
          // Choose keeps what will not fit, over the slots (r6 E7, the ruling).
          if (ref !== '' && ref !== currentChassisRef) onConfirm(ref, CHASSIS_SWAP_KEEPS_OVERFLOW)
          onOpenChange(false)
        }}
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
        subtitle={
          pattern ? mechCopy('leavesPattern', { subtitle: loadoutLine, pattern }) : loadoutLine
        }
        emptyMessage={mechCopy('noMatchingChassis')}
        onClose={() => onOpenChange(false)}
        focusExtra={(item) => {
          const ref = nameToSlug(item.name)
          const left = leftOff(ref)
          return left.length === 0 ? undefined : (
            <>
              <Text variant="hint">
                {mechCopy(CHASSIS_SWAP_KEEPS_OVERFLOW ? 'overTheSlots' : 'willNotFit', {
                  names: left.join(', '),
                })}
              </Text>
              {/* The other way, second (r5 C10, r6 E7). */}
              <Button
                variant="ghost"
                size="compact"
                onClick={() => {
                  onConfirm(ref, !CHASSIS_SWAP_KEEPS_OVERFLOW)
                  onOpenChange(false)
                }}
              >
                {mechCopy(CHASSIS_SWAP_KEEPS_OVERFLOW ? 'leaveThemOff' : 'keepEverything')}
              </Button>
            </>
          )
        }}
        railActions={
          <Button variant="ghost" size="compact" onClick={() => onOpenChange(false)}>
            {mechCopy('cancel')}
          </Button>
        }
      />
    </ModalShell>
  )
}
