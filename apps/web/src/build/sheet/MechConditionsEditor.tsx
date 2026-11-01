import type { UnitsStore } from '../../replica/units'
/**
 * MechConditionsEditor — the mech's conditions editor: its one `conditions[]`
 * list through the one chip-well editor (`ChipListEditor`). The Reactor's
 * Shutdown, Vulnerable and Destroyed are chips here like any other, so
 * removing one is the manual clear.
 */

import type { Mech } from 'game-domain/schemas/mech'
import { LIVE_SHEET_MANUAL } from '../../replica/provenance'
import { useUnits } from '../../replica/units'
import { ChipListEditor } from './ChipListEditor'
import { CONDITION_DRAFT } from './chipWell.model'

type MechConditionsEditorProps = {
  mech: Mech
  /** Injectable store — defaults to useUnits. */
  store?: UnitsStore
}

export function MechConditionsEditor({ mech, store = useUnits }: MechConditionsEditorProps) {
  const storeState = store()

  async function handleChange(next: string[]) {
    await storeState.update('mech', mech.id, { conditions: next }, LIVE_SHEET_MANUAL)
  }

  return (
    <ChipListEditor
      items={mech.conditions}
      onChange={handleChange}
      noun="condition"
      draftWidth={CONDITION_DRAFT}
      unique
    />
  )
}
