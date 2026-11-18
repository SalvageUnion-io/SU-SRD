import type { CSSProperties } from 'react'
import { useState } from 'react'
import type { RefCrawler, RefEntity } from 'salvageunion-reference'
import { getEntitySlug } from 'salvageunion-reference'
import { Field, tokens } from '../../components/index'
import type { ResolvedNpc } from '../../lib/crawlerRefs'
import { findNpcChoiceByName } from '../../lib/crawlerRefs'
import type { CrawlerWizardFormState, CrewNpcForm } from '../../lib/wizard/crawlerFormState'
import { crawlerCopy } from '../../messages/build-crawler'
import type { PickColumn } from '../wizard/PickList'
import { PickList } from '../wizard/PickList'

/** The step's lede, in the surrounding text colour. */
const LEDE = {
  margin: 0,
  fontFamily: tokens.font.body,
  fontSize: tokens.fontSize.body,
  lineHeight: 'calc(1.25 / 0.875)',
  color: 'currentcolor',
} satisfies CSSProperties

/** An open row's crew fields; the column count is `.su-wiz-crew-fields`. */
const CREW_FIELDS = {
  display: 'grid',
  gap: tokens.space[12],
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

  function updateNpc(ref: string, patch: Partial<CrewNpcForm>) {
    onChange({ crew: { ...crew, [ref]: { ...crew[ref], ...patch } } })
  }

  // MOCK (Working Manual, wave 2): the crew as one list in the Ledger form
  // (`PickList`): a line a crewed Bay (its lead, their HP, the name given),
  // the open line's fields under it. It replaces a Mini with its own band a
  // row, eleven bands down the step.
  const open = sources.find((source) => expanded.has(source.ref))
  const fieldsFor = (source: NpcSource) => {
    const value = crew[source.ref] ?? {}
    const showKeepsake = findNpcChoiceByName(source.npc, 'Keepsake') !== undefined
    const showMotto = findNpcChoiceByName(source.npc, 'Motto') !== undefined
    return (
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
    )
  }
  return (
    <div className="su-wiz-stack su-wiz-stack--12">
      <p style={LEDE}>{crawlerCopy('eachCrewedBayIsRun')}</p>
      <PickList
        title={crawlerCopy('crew')}
        note="Optional"
        rows={sources}
        rowKey={(source) => source.ref}
        rowName={(source) => source.entity.name}
        columns={CREW_COLUMNS(crew)}
        selected={open?.ref}
        onSelect={(ref) => setExpanded(new Set([ref]))}
        detail={fieldsFor}
        detailAt="always"
      />
    </div>
  )
}

/** A crew line's columns: who leads the Bay, their HP, the name given so far. */
const CREW_COLUMNS = (
  crew: Record<string, CrewNpcForm>
): readonly PickColumn<NpcSource>[] => [
  {
    key: 'lead',
    label: 'Lead',
    kind: 'text',
    phone: true,
    value: (source) => source.npc.position ?? '',
  },
  {
    key: 'hp',
    label: 'HP',
    title: 'Hit Points',
    phone: true,
    value: (source) => (source.npc.hitPoints ? source.npc.hitPoints : ''),
  },
  {
    key: 'name',
    label: 'Name',
    kind: 'quiet',
    value: (source) => crew[source.ref]?.name ?? '',
  },
]
