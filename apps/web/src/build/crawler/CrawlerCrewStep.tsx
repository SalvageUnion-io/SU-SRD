import type { CSSProperties } from 'react'
import { useState } from 'react'
import type { RefCrawler, RefEntity } from 'salvageunion-reference'
import { getEntitySlug } from 'salvageunion-reference'
import { Field, navigateControl, ReferenceEntityCard, tokens } from '../../components/index'
import type { ResolvedNpc } from '../../lib/crawlerRefs'
import { findNpcChoiceByName } from '../../lib/crawlerRefs'
import type { CrawlerWizardFormState, CrewNpcForm } from '../../lib/wizard/crawlerFormState'
import '../../styles/build/wizard.css'

/** The step's column, capped at 48rem. */
const COLUMN = { maxWidth: '48rem' } satisfies CSSProperties

/** The step's lede, in the surrounding text colour. */
const LEDE = {
  margin: 0,
  fontFamily: tokens.font.body,
  fontSize: tokens.fontSize.sm,
  lineHeight: 'calc(1.25 / 0.875)',
  color: 'currentcolor',
} satisfies CSSProperties

/** An open row's crew fields; the column count is `.su-wiz-crew-fields`. */
const CREW_FIELDS = {
  display: 'grid',
  gap: tokens.space[12],
  paddingBottom: tokens.space[8],
  paddingLeft: tokens.space[12],
} satisfies CSSProperties satisfies CSSProperties

type NpcSource = {
  /** Stable key — the bay slug or the type slug. */
  ref: string
  /** The SRD entity (bay or crawler type) — rendered as its entity card. */
  entity: RefEntity
  npc: ResolvedNpc
}

type CrawlerCrewStepProps = {
  /** Base bays that carry an NPC (the 10 crewed bays), as SRD entities. */
  bays: ReadonlyArray<RefEntity>
  /** The selected crawler type (its special NPC heads the crew), if any. */
  selectedType: RefCrawler | undefined
  /** Crew form state keyed by bay/type slug. */
  crew: Record<string, CrewNpcForm>
  onChange: (patch: Partial<CrawlerWizardFormState>) => void
}

/** Read the embedded NPC off a bay/type entity (data-shape check). */
function npcOf(entity: RefEntity): ResolvedNpc | undefined {
  return 'npc' in entity && entity.npc != null ? entity.npc : undefined
}

/**
 * Step 4 · Name your Crew (Union Crawler p.213) — the bay roster, restyled to
 * the poster idiom: the 10 base bays auto-seed (not
 * choosable, not removable; expansion bays never appear) and each is its
 * SRD entity's Token (header-only is a Token, EDL N2) until it opens into its
 * compact card and the sheets' IdentityFields for the NPC's four crew facts
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
    <div className="su-wiz-stack su-wiz-stack--12" style={COLUMN}>
      <p style={LEDE}>
        Each crewed Bay is run by its own lead, and your Crawler type brings a special NPC. Open one
        to name and detail them now, or leave them blank and fill them in during play.
      </p>

      {sources.map((source) => {
        const value = crew[source.ref] ?? {}
        const isOpen = expanded.has(source.ref)
        const showKeepsake = findNpcChoiceByName(source.npc, 'Keepsake') !== undefined
        const showMotto = findNpcChoiceByName(source.npc, 'Motto') !== undefined
        return (
          <section key={source.ref} className="su-wiz-stack su-wiz-stack--12">
            <ReferenceEntityCard
              data={source.entity}
              size={isOpen ? 'compact' : 'mini'}
              extent={isOpen ? 'full' : 'head'}
              hide={{ actions: true, choices: true }}
              controls={[navigateControl(() => toggle(source.ref))]}
            />
            {isOpen && (
              <div className="su-wiz-crew-fields" style={CREW_FIELDS}>
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
