/**
 * The crew slot form (board N2; P7 D2–D3): what the player writes for one of
 * a crawler's crew slots, and the NPC it makes.
 *
 * The slot fixes the template — its position and HP come from the bay's (or
 * the crawler type's) data and are shown, not typed (D2). The form is the
 * slot's own choices, in data order (D3): Name → `name`, Description →
 * `description`, Keepsake and Motto → `keepsake` / `motto` (matched by choice
 * name, as `findNpcChoiceByName` does), and any other choice → `choiceValues`
 * under its name (today only the Augmented A.I.'s "A.I. Personality").
 */

import type { CreateInput } from '../../stores/types'
import type { CrewSlotView, NpcView } from '../npcs/npcModel'
import type { Npc } from '../schemas/npc'

/** The typed values, keyed by choice name ("Name", "Keepsake", …). */
export type CrewDraft = Record<string, string>

/** Where a choice's value is stored on the NPC record. */
export type CrewChoiceField = 'name' | 'description' | 'keepsake' | 'motto' | 'choiceValue'

const FIELD_OF: Record<string, Exclude<CrewChoiceField, 'choiceValue'>> = {
  Name: 'name',
  Description: 'description',
  Keepsake: 'keepsake',
  Motto: 'motto',
}

export function crewChoiceField(choiceName: string): CrewChoiceField {
  return FIELD_OF[choiceName] ?? 'choiceValue'
}

/** The draft as the renderers read it, for the live preview. */
export function crewDraftView(slot: CrewSlotView, draft: CrewDraft): NpcView {
  const view: NpcView = {
    name: draft.Name ?? '',
    position: slot.position,
    hitPoints: slot.hitPoints,
    damageType: 'HP',
    actions: [],
    traits: [],
    templateRef: slot.templateRef,
  }
  const choiceValues: Record<string, string> = {}
  for (const choice of slot.choices) {
    const value = draft[choice.name]?.trim()
    if (!value) continue
    const field = crewChoiceField(choice.name)
    if (field === 'choiceValue') choiceValues[choice.name] = value
    else if (field !== 'name') view[field] = value
  }
  if (Object.keys(choiceValues).length > 0) view.choiceValues = choiceValues
  return view
}

/** The store's create input for the slot's NPC, in the crawler's container. */
export function crewDraftToCreateInput(
  slot: CrewSlotView,
  draft: CrewDraft,
  gameId: string | null
): CreateInput<'npc'> {
  const view = crewDraftView(slot, draft)
  const input: CreateInput<'npc'> = {
    schemaVersion: 1,
    name: view.name.trim(),
    position: slot.position,
    hitPoints: slot.hitPoints,
    damageType: 'HP',
    actions: [],
    traits: [],
    templateRef: slot.templateRef,
    gameId,
  }
  const optional: Partial<Npc> = {
    description: view.description,
    keepsake: view.keepsake,
    motto: view.motto,
    choiceValues: view.choiceValues,
  }
  for (const [key, value] of Object.entries(optional)) {
    if (value !== undefined) Object.assign(input, { [key]: value })
  }
  return input
}
