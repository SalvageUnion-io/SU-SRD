import { Field, navigateControl, ReferenceEntityCard, tokens } from 'component-lib'
import type { CSSProperties } from 'react'
import { useState } from 'react'
import type { SURefCrawler, SURefEntity } from 'salvageunion-reference'
import { getEntitySlug } from 'salvageunion-reference'
import type { ResolvedNpc } from '../../lib/crawlerRefs'
import { findNpcChoiceByName } from '../../lib/crawlerRefs'
import type { CrawlerWizardFormState, CrewNpcForm } from '../../lib/wizard/crawlerFormState'
import '../../styles/wizard.css'

/** The step's column (`max-w-3xl`). */
const COLUMN: CSSProperties = { maxWidth: '48rem' }

/** The step's lede, in the surrounding text colour. */
const LEDE: CSSProperties = {
  margin: 0,
  fontFamily: tokens.font.body,
  fontSize: tokens.fontSize.sm,
  lineHeight: 'calc(1.25 / 0.875)',
  color: 'currentcolor',
}

/** An open row's crew fields; the column count is `.wiz-crew-fields`. */
const CREW_FIELDS: CSSProperties = {
  display: 'grid',
  gap: tokens.space[12],
  paddingBottom: tokens.space[8],
  paddingLeft: tokens.space[12],
}

type NpcSource = {
  /** Stable key — the bay slug or the type slug. */
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
  /** Crew form state keyed by bay/type slug. */
  crew: Record<string, CrewNpcForm>
  onChange: (patch: Partial<CrawlerWizardFormState>) => void
}

/** Read the embedded NPC off a bay/type entity (data-shape check). */
function npcOf(entity: SURefEntity): ResolvedNpc | undefined {
  return 'npc' in entity && entity.npc != null ? entity.npc : undefined
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

  const typeNpc = selectedType ? npcOf(selectedType) : undefined
  if (selectedType && typeNpc) {
    sources.push({
      ref: getEntitySlug(selectedType),
      entity: selectedType,
      npc: typeNpc,
    })
  }

  for (const bay of bays) {
    const npc = npcOf(bay)
    if (!npc) continue
    sources.push({ ref: getEntitySlug(bay), entity: bay, npc })
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
    <div className="wiz-stack wiz-stack--12" style={COLUMN}>
      <p style={LEDE}>
        Each crewed Bay is run by its own lead, and your Crawler type brings a special NPC. Open a
        row to name and detail them now, or leave them blank and fill them in during play.
      </p>

      {sources.map((source) => {
        const value = crew[source.ref] ?? {}
        const isOpen = expanded.has(source.ref)
        const showKeepsake = findNpcChoiceByName(source.npc, 'Keepsake') !== undefined
        const showMotto = findNpcChoiceByName(source.npc, 'Motto') !== undefined
        return (
          <section key={source.ref} className="wiz-stack wiz-stack--12">
            <ReferenceEntityCard
              data={source.entity}
              size="medium"
              extent={isOpen ? 'full' : 'head'}
              hide={{ actions: true, choices: true }}
              controls={[navigateControl(() => toggle(source.ref))]}
            />
            {isOpen && (
              <div className="wiz-crew-fields" style={CREW_FIELDS}>
                <Field
                  label="Name"
                  value={value.name ?? ''}
                  onSave={(next) => updateNpc(source.ref, { name: next })}
                  placeholder="Name this crew lead"
                  ariaLabel={`${source.npc.position ?? 'crew'} name`}
                />
                <Field
                  label="Background"
                  value={value.description ?? ''}
                  onSave={(next) => updateNpc(source.ref, { description: next })}
                  placeholder="Appearance and personality"
                  ariaLabel={`${source.npc.position ?? 'crew'} background`}
                />
                {showKeepsake && (
                  <Field
                    label="Keepsake"
                    value={value.keepsake ?? ''}
                    onSave={(next) => updateNpc(source.ref, { keepsake: next })}
                    placeholder="A personal item"
                    ariaLabel={`${source.npc.position ?? 'crew'} keepsake`}
                  />
                )}
                {showMotto && (
                  <Field
                    label="Motto"
                    value={value.motto ?? ''}
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
