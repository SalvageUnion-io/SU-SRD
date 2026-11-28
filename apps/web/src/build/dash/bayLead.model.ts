/** A crawler bay's crew lead as the dashboard's manifest prints them (`bayLead.tsx`). */

import type { CrawlerNpcState } from 'game-domain/schemas/crawler'
import type { ChoiceSelections } from '../../components/index'
import type { ResolvedNpc } from '../../lib/crawlerRefs'
import { findNpcChoiceByName } from '../../lib/crawlerRefs'
import type { CrewAssignment } from '../../lib/npcs/npcModel'

export type Lead = { name: string; position: string; hp: string; keepsake: string; motto: string }

/** A slot's crew lead as the manifest prints them: the built NPC, else what the sheet wrote. */
export function leadOf(
  npc: ResolvedNpc | undefined,
  state: CrawlerNpcState | undefined,
  selections: ChoiceSelections | undefined,
  assigned: CrewAssignment | undefined
): Lead {
  const pick = (name: 'Keepsake' | 'Motto') => {
    const choice = findNpcChoiceByName(npc, name)
    return choice ? (selections?.[choice.id]?.[0] ?? '') : ''
  }
  const maxHp = npc?.hitPoints ?? 0
  return {
    name: assigned?.npc?.name ?? state?.npcName?.trim() ?? '',
    position: npc?.position ?? '',
    hp: maxHp > 0 ? `${state?.npcCurrentHP ?? maxHp}/${maxHp}` : '',
    keepsake: pick('Keepsake'),
    motto: pick('Motto'),
  }
}
