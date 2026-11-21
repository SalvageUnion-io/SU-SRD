/**
 * Saving a redesign (ADR-044, ADR-067 §1 as amended): the designer's form
 * written onto the saved NPC in place, then onto every encounter of the
 * maker's that fields it, so prep follows the design. A fight already on a
 * Game's field keeps the stat block it was run with.
 */

import type { Npc } from 'game-domain/schemas/npc'
import type { NpcFormState } from '../../lib/wizard/npcFormState'
import { npcFormToPatch } from '../../lib/wizard/npcFormState'
import { builtSnapshot } from '../../play/mediator/opposition.model'
import { useEncounters } from '../../replica/collections'
import { LIVE_SHEET_MANUAL } from '../../replica/provenance'
import { useUnits } from '../../replica/units'
import { redesignedOpposition } from '../prep/encounter.model'

export async function saveNpcRedesign(npc: Npc, form: NpcFormState): Promise<void> {
  const saved = await useUnits
    .getState()
    .update('npc', npc.id, npcFormToPatch(form, npc), LIVE_SHEET_MANUAL)
  const design = {
    built: builtSnapshot(saved),
    maxHp: saved.hitPoints,
    statKind: saved.damageType === 'SP' ? ('sp' as const) : ('hp' as const),
  }
  const encounters = useEncounters.getState()
  await encounters.hydrate()
  for (const encounter of useEncounters.getState().encounters) {
    const opposition = redesignedOpposition(encounter.opposition, npc.id, design)
    if (opposition !== null) await encounters.update(encounter.id, { opposition })
  }
}
