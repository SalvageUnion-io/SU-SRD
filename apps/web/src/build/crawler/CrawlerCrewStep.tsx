import type { CSSProperties } from 'react'
import { useState } from 'react'
import type { RefCrawler, RefEntity, RefMetaEntity } from 'salvageunion-reference'
import { getEntitySlug } from 'salvageunion-reference'
import { Entity, Field, navigateControl, ReferenceEntityCard, tokens } from '../../components/index'
import type { ResolvedNpc } from '../../lib/crawlerRefs'
import { findNpcChoiceByName } from '../../lib/crawlerRefs'
import type { CrawlerWizardFormState, CrewNpcForm } from '../../lib/wizard/crawlerFormState'
import { crawlerCopy } from '../../messages/build-crawler'

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
 * SRD entity's Mini (header-only is a Mini, EDL N2) until it opens into its
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
      <p style={LEDE}>{crawlerCopy('eachCrewedBayIsRun')}</p>

      {sources.map((source) => {
        const value = crew[source.ref] ?? {}
        const isOpen = expanded.has(source.ref)
        const showKeepsake = findNpcChoiceByName(source.npc, 'Keepsake') !== undefined
        const showMotto = findNpcChoiceByName(source.npc, 'Motto') !== undefined
        return (
          <section key={source.ref} className="su-wiz-stack su-wiz-stack--12">
            {isOpen ? (
              <ReferenceEntityCard
                data={source.entity}
                size="compact"
                hide={{ actions: true, choices: true }}
                controls={[navigateControl(() => toggle(source.ref))]}
              />
            ) : (
              // Shut, the row is its Mini, which opens it.
              <Entity
                size="mini"
                context="browse"
                entity={source.entity as RefMetaEntity}
                mode={{ kind: 'link', onOpen: () => toggle(source.ref) }}
              />
            )}
            {isOpen && (
              <div className="su-wiz-crew-fields" style={CREW_FIELDS}>
                <Field
                  label={crawlerCopy('name')}
                  value={value.name ?? ''}
                  onSave={(next) => updateNpc(source.ref, { name: next })}
                  placeholder={crawlerCopy('nameThisCrewLead')}
                  ariaLabel={`${source.npc.position ?? 'crew'} name`}
                />
                <Field
                  label={crawlerCopy('background')}
                  value={value.description ?? ''}
                  onSave={(next) => updateNpc(source.ref, { description: next })}
                  placeholder={crawlerCopy('appearanceAndPersonality')}
                  ariaLabel={`${source.npc.position ?? 'crew'} background`}
                />
                {showKeepsake && (
                  <Field
                    label={crawlerCopy('keepsake')}
                    value={value.keepsake ?? ''}
                    onSave={(next) => updateNpc(source.ref, { keepsake: next })}
                    placeholder={crawlerCopy('aPersonalItem')}
                    ariaLabel={`${source.npc.position ?? 'crew'} keepsake`}
                  />
                )}
                {showMotto && (
                  <Field
                    label={crawlerCopy('motto')}
                    value={value.motto ?? ''}
                    onSave={(next) => updateNpc(source.ref, { motto: next })}
                    placeholder={crawlerCopy('aPersonalSaying')}
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
