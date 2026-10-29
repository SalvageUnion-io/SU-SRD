/**
 * CrawlerCrewLead — the crew lead of a crawler bay or of the crawler type: a
 * contentful Mini (`CrewLeadMini`, N3) whose head Peeks the slot's SRD crew
 * NPC, embedded as its card nests it (`nestedEntityGroups`); its body is what
 * the sheet tracks about them, and in Edit their fields. A slot the book gives
 * no crew NPC still has a crew lead.
 *
 * Keepsake/Motto persist through the NPC's SRD freeform choices (the
 * crawler's bayChoices map, keyed by the slot's ref); the structured
 * name/HP/description/facts persist through `onPatch`.
 */

import type { CrawlerNpcState } from 'game-domain/schemas/crawler'
import type { ChoiceSelections } from '../../components/index'
import { embeddedPeekAddress } from '../../components/index'
import type { ResolvedNpc } from '../../lib/crawlerRefs'
import { findNpcChoiceByName } from '../../lib/crawlerRefs'
import type { CrewAssignment } from '../../lib/npcs/npcModel'
import { unitRowModel } from '../../lib/units/unitModel'
import { buildSheetCopy } from '../../messages/build-sheet'
import { LinkedCrewMini } from '../npc/LinkedCrewMini'
import { CrewLeadMini } from './CrewLeadMini'

type CrawlerCrewLeadProps = {
  /** The slot's SRD crew NPC; absent, a crew lead no reference record describes. */
  npc: ResolvedNpc | undefined
  /** The slot's SRD entity, the Peek's embedding parent. */
  slot: { schemaName: string; id: string; name: string }
  /** Its live state (`crawlerBays[i]` or `typeNpc`). */
  state: CrawlerNpcState | undefined
  selections: ChoiceSelections
  setSelections: (next: ChoiceSelections) => void
  /** Write its live state; absent, read-only. */
  onPatch: ((patch: Partial<CrawlerNpcState>) => void) | undefined
  /**
   * The built NPC crewing the slot (ADR-044). While set, the crew lead shows
   * that NPC, read-only, in place of the inline crew — which is never written,
   * so the unlink restores it byte for byte (Q2).
   */
  assigned?: CrewAssignment | undefined
}

export function CrawlerCrewLead({
  npc,
  slot,
  state,
  selections,
  setSelections,
  onPatch,
  assigned,
}: CrawlerCrewLeadProps) {
  const maxHP = npc?.hitPoints ?? 0

  function choiceField(name: 'Keepsake' | 'Motto') {
    const choice = findNpcChoiceByName(npc, name)
    const value = choice ? (selections[choice.id]?.[0] ?? '') : ''
    const set = choice
      ? (next: string) =>
          setSelections({ ...selections, [choice.id]: next.trim().length > 0 ? [next] : [] })
      : undefined
    return { value, set }
  }
  const keepsake = choiceField('Keepsake')
  const motto = choiceField('Motto')

  const patch = assigned === undefined ? onPatch : undefined
  const inlineCrew = (
    <CrewLeadMini
      {...(npc
        ? {
            npc,
            peekAt: embeddedPeekAddress(slot.schemaName, slot.id, 'npc'),
          }
        : { model: unitRowModel({ kind: 'npc', name: 'Crew' }) })}
      instance={{ title: state?.npcName?.trim() || npc?.position || buildSheetCopy('crew2') }}
      bayName={slot.name}
      title={npc?.position}
      name={state?.npcName ?? ''}
      hp={state?.npcCurrentHP ?? maxHP}
      maxHp={maxHP}
      keepsake={keepsake.value}
      motto={motto.value}
      detail={state?.npcDescription ?? ''}
      facts={state?.npcFacts ?? []}
      // Handler absence IS the read-only encoding: read-only branches once
      // here instead of per-handler ternaries + a second readOnly prop.
      {...(patch
        ? {
            onNameChange: (next: string) => patch({ npcName: next }),
            onHpChange: (next: number) => patch({ npcCurrentHP: next }),
            onKeepsakeChange: keepsake.set,
            onMottoChange: motto.set,
            onDetailChange: (next: string) => patch({ npcDescription: next }),
            onFactsChange: (next: string[]) => patch({ npcFacts: next }),
          }
        : {})}
    />
  )
  return assigned ? (
    <LinkedCrewMini slotName={slot.name} assignment={assigned} fallback={inlineCrew} />
  ) : (
    inlineCrew
  )
}
