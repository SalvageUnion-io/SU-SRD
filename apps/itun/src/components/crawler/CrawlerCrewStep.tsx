import { useState } from 'react'
import type { SURefCrawler, SURefEntity } from 'salvageunion-reference'
import { ReferenceEntityCard, navigateControl } from 'component-lib'

import { findNpcChoiceByName } from '../../lib/crawlerRefs'
import type { ResolvedNpc } from '../../lib/crawlerRefs'
import type { CrawlerWizardFormState, CrewNpcForm } from '../../lib/wizard/crawlerFormState'
import { IdentityField } from 'component-lib'

type NpcSource = {
  /** Stable key — the bay ref or the type ref. */
  ref: string
  /** The SRD entity (bay or crawler type) — rendered as its entity card. */
  entity: SURefEntity
  npc: ResolvedNpc
}

type CrawlerCrewStepProps = {
  /** Base bays that carry an NPC (the 10 crewed bays), as SRD entities. */
  bays: ReadonlyArray<SURefEntity>
  /** The selected crawler type (its special NPC heads the crew), if any. */
  selectedType: SURefCrawler | undefined
  /** Crew form state keyed by bay/type ref. */
  crew: Record<string, CrewNpcForm>
  onChange: (patch: Partial<CrawlerWizardFormState>) => void
}

/** Read the embedded NPC off a bay/type entity (data-shape check). */
function npcOf(entity: SURefEntity): ResolvedNpc | undefined {
  return 'npc' in entity && entity.npc != null ? (entity.npc as ResolvedNpc) : undefined
}

/**
 * Step 4 · Name your Crew (Union Crawler p.213) — the bay roster, restyled to
 * the poster idiom (wizard-refresh Phase 5): the 10 base bays auto-seed (not
 * choosable, not removable; expansion bays never appear) and each renders as
 * its SRD entity card (the universal entity-card rule), header-only until its
 * row expands into the sheets' IdentityFields for the NPC's four crew facts
 * (Name, Background, Keepsake, Motto — guarded off the NPC's own choice set:
 * Augmented's A.I. carries neither Keepsake nor Motto). NPC HP is fixed by
 * the data (4; Grizzled Veteran 10; the A.I. none) — nothing to input. The
 * type's special NPC heads the list. Every field is optional — the step
 * always advances.
 */
export function CrawlerCrewStep({ bays, selectedType, crew, onChange }: CrawlerCrewStepProps) {
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(new Set())

  const sources: NpcSource[] = []

  const typeNpc = selectedType ? npcOf(selectedType as unknown as SURefEntity) : undefined
  if (selectedType && typeNpc) {
    sources.push({
      ref: selectedType.id,
      entity: selectedType as unknown as SURefEntity,
      npc: typeNpc,
    })
  }

  for (const bay of bays) {
    const npc = npcOf(bay)
    if (!npc) continue
    sources.push({ ref: (bay as { id: string }).id, entity: bay, npc })
  }

  function toggle(ref: string) {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(ref)) {
        next.delete(ref)
      } else {
        next.add(ref)
      }
      return next
    })
  }

  function updateNpc(ref: string, patch: Partial<CrewNpcForm>) {
    onChange({ crew: { ...crew, [ref]: { ...crew[ref], ...patch } } })
  }

  return (
    <div className="max-w-3xl space-y-3">
      <p className="m-0 font-body text-sm text-current">
        Each crewed Bay is run by its own lead, and your Crawler type brings a special NPC. Open a
        row to name and detail them now, or leave them blank and fill them in during play.
      </p>

      {sources.map((source) => {
        const value = crew[source.ref] ?? {}
        const isOpen = expanded.has(source.ref)
        const showKeepsake = findNpcChoiceByName(source.npc, 'Keepsake') !== undefined
        const showMotto = findNpcChoiceByName(source.npc, 'Motto') !== undefined
        return (
          <section key={source.ref} className="space-y-3">
            <ReferenceEntityCard
              data={source.entity}
              mode={isOpen ? 'compact' : 'head'}
              hide={{ actions: true, choices: true }}
              controls={[navigateControl(() => toggle(source.ref))]}
            />
            {isOpen && (
              <div className="grid grid-cols-1 gap-3 pb-2 pl-3 sm:grid-cols-2">
                <IdentityField
                  label="Name"
                  value={value.name ?? ''}
                  editing
                  onSave={(next) => updateNpc(source.ref, { name: next })}
                  placeholder="Name this crew lead"
                  ariaLabel={`${source.npc.position ?? 'crew'} name`}
                />
                <IdentityField
                  label="Background"
                  value={value.description ?? ''}
                  editing
                  onSave={(next) => updateNpc(source.ref, { description: next })}
                  placeholder="Appearance and personality"
                  ariaLabel={`${source.npc.position ?? 'crew'} background`}
                />
                {showKeepsake && (
                  <IdentityField
                    label="Keepsake"
                    value={value.keepsake ?? ''}
                    editing
                    onSave={(next) => updateNpc(source.ref, { keepsake: next })}
                    placeholder="A personal item"
                    ariaLabel={`${source.npc.position ?? 'crew'} keepsake`}
                  />
                )}
                {showMotto && (
                  <IdentityField
                    label="Motto"
                    value={value.motto ?? ''}
                    editing
                    onSave={(next) => updateNpc(source.ref, { motto: next })}
                    placeholder="A personal saying"
                    ariaLabel={`${source.npc.position ?? 'crew'} motto`}
                  />
                )}
              </div>
            )}
          </section>
        )
      })}
    </div>
  )
}
