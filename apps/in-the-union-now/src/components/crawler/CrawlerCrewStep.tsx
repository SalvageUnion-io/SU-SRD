import type { SURefCrawler } from 'salvageunion-reference'
import { Field, Input } from 'suref-react'

import { findNpcChoiceByName } from '../../lib/crawlerRefs'
import type { ResolvedNpc } from '../../lib/crawlerRefs'
import type { CrawlerWizardFormState, CrewNpcForm } from '../../lib/wizard/crawlerFormState'

type NpcSource = {
  /** Stable key — the bay ref or the type ref. */
  ref: string
  /** Heading label (bay name or 'Crawler Type'). */
  label: string
  npc: ResolvedNpc
}

type CrawlerCrewStepProps = {
  /** Base bays that carry an NPC (the 10 crewed bays). */
  bays: ReadonlyArray<{ id: string; name: string; npc?: ResolvedNpc }>
  /** The selected crawler type (its special NPC joins the crew), if any. */
  selectedType: SURefCrawler | undefined
  /** Crew form state keyed by bay/type ref. */
  crew: Record<string, CrewNpcForm>
  onChange: (patch: Partial<CrawlerWizardFormState>) => void
}

/**
 * Crew step (plan §3): name and detail each base bay's crew lead plus the
 * crawler-type's special NPC. Every field is optional — the step always
 * advances. Augmented's A.I. NPC only carries Name/Description (no
 * Keepsake/Motto), so those fields are guarded off the NPC's own choice set.
 */
export function CrawlerCrewStep({ bays, selectedType, crew, onChange }: CrawlerCrewStepProps) {
  const sources: NpcSource[] = []

  if (selectedType?.npc) {
    sources.push({
      ref: selectedType.id,
      label: `${selectedType.name} Crawler`,
      npc: selectedType.npc as ResolvedNpc,
    })
  }

  for (const bay of bays) {
    if (!bay.npc) continue
    sources.push({ ref: bay.id, label: bay.name, npc: bay.npc })
  }

  function updateNpc(ref: string, patch: Partial<CrewNpcForm>) {
    onChange({ crew: { ...crew, [ref]: { ...crew[ref], ...patch } } })
  }

  return (
    <div className="max-w-[760px] space-y-5">
      <p className="font-body text-xs text-wk-muted">
        Each crewed bay is run by its own lead, and your crawler type brings a special NPC. Name and
        detail them now, or leave them blank and fill them in during play.
      </p>

      {sources.map((source) => {
        const value = crew[source.ref] ?? {}
        const showKeepsake = findNpcChoiceByName(source.npc, 'Keepsake') !== undefined
        const showMotto = findNpcChoiceByName(source.npc, 'Motto') !== undefined
        const idBase = `crew-${source.ref}`
        return (
          <section
            key={source.ref}
            className="space-y-3 rounded-[3px] border-[1.5px] border-wk-faint p-4"
          >
            <header>
              <h3 className="font-cond text-[13px] font-bold uppercase tracking-[0.1em] text-ink">
                {source.label}
              </h3>
              {source.npc.position && (
                <p className="mt-0.5 font-body text-xs text-wk-muted">{source.npc.position}</p>
              )}
            </header>

            <Field label="Name" htmlFor={`${idBase}-name`}>
              <Input
                id={`${idBase}-name`}
                type="text"
                value={value.name ?? ''}
                onChange={(e) => updateNpc(source.ref, { name: e.target.value })}
                placeholder="Name this crew lead"
              />
            </Field>

            <Field label="Description" htmlFor={`${idBase}-description`}>
              <Input
                id={`${idBase}-description`}
                type="text"
                value={value.description ?? ''}
                onChange={(e) => updateNpc(source.ref, { description: e.target.value })}
                placeholder="Appearance and personality"
              />
            </Field>

            {showKeepsake && (
              <Field label="Keepsake" htmlFor={`${idBase}-keepsake`}>
                <Input
                  id={`${idBase}-keepsake`}
                  type="text"
                  value={value.keepsake ?? ''}
                  onChange={(e) => updateNpc(source.ref, { keepsake: e.target.value })}
                  placeholder="A personal item"
                />
              </Field>
            )}

            {showMotto && (
              <Field label="Motto" htmlFor={`${idBase}-motto`}>
                <Input
                  id={`${idBase}-motto`}
                  type="text"
                  value={value.motto ?? ''}
                  onChange={(e) => updateNpc(source.ref, { motto: e.target.value })}
                  placeholder="A personal saying"
                />
              </Field>
            )}
          </section>
        )
      })}
    </div>
  )
}
