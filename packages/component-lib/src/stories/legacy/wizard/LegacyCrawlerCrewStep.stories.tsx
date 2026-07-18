/**
 * Legacy "before" capture — ITUN crawler wizard `CrawlerCrewStep`.
 *
 * Reproduces the presentational shell of
 * apps/in-the-union-now/src/components/crawler/CrawlerCrewStep.tsx VERBATIM
 * (lines 45-146): a bay roster where each crewed base bay (and the crawler
 * type's special NPC) renders as its SRD entity card via `ReferenceEntityDisplay`
 * (`mode` head→compact + a `navigateControl`), expanding into a 2-col grid of
 * app-only `IdentityField`s for Name/Background/Keepsake/Motto (Keepsake/Motto
 * gated off the NPC's own choice set). Shared atoms come from `component-lib`;
 * the app-only `IdentityField` (sheet/IdentityField.tsx) + `findNpcChoiceByName`
 * / `ResolvedNpc` (lib/crawlerRefs.ts) are mirrored locally. APPROXIMATION:
 * IdentityField's InlineEditField/InlineEditTextArea save-on-blur editors are
 * stood in by plain controlled inputs with the same box chrome. Driven with the
 * real crewed `SalvageUnionReference.CrawlerBays` + the Battle type's special
 * NPC. L1 reconciliation: freeze the "before".
 */

import type { Story } from '@ladle/react'
import type { ReactNode } from 'react'
import { useState } from 'react'
import type { SURefCrawler, SURefEntity } from 'salvageunion-reference'
import { SalvageUnionReference } from 'salvageunion-reference'
import { cn, navigateControl, ReferenceEntityDisplay } from 'component-lib'
import { Caption } from '../../_harness'

// --- Mirror of ITUN's app-only types (lib/crawlerRefs.ts, lib/wizard/crawlerFormState.ts). ---
type ResolvedNpcChoice = { id: string; name: string }
type ResolvedNpc = {
  position?: string
  hitPoints?: number
  choices?: ReadonlyArray<ResolvedNpcChoice>
}
type CrewNpcForm = { name?: string; description?: string; keepsake?: string; motto?: string }

/** Verbatim mirror of findNpcChoiceByName (crawlerRefs.ts:62-67). */
function findNpcChoiceByName(
  npc: ResolvedNpc | undefined,
  name: string
): ResolvedNpcChoice | undefined {
  return npc?.choices?.find((c) => c.name === name)
}

/** Read the embedded NPC off a bay/type entity (verbatim, CrawlerCrewStep.tsx:29-31). */
function npcOf(entity: SURefEntity): ResolvedNpc | undefined {
  return 'npc' in entity && entity.npc != null ? (entity.npc as ResolvedNpc) : undefined
}

// --- Verbatim class strings from sheet/IdentityField.tsx (lines 48-78). ---
const READ_VALUE_BOX_CLASS =
  'flex min-h-[44px] items-center rounded-[8px] border-2 bg-paper px-3 py-2 font-body text-sm text-ink'
const EDIT_VALUE_BOX_CLASS =
  'relative flex min-h-[44px] items-center rounded-[8px] border-2 border-[color:var(--tone-deep,var(--color-ink))] bg-paper px-3 py-2 pr-9 font-body text-sm text-ink'
const EDIT_CUE_CLASS =
  'outline-dashed outline-2 outline-offset-2 outline-[color:var(--tone-deep,var(--color-rust))]'
const PEN_CLASS =
  'pointer-events-none absolute right-[10px] top-1/2 h-[15px] w-[15px] -translate-y-1/2 text-ink/55'

function PenIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="m16.5 3.5 4 4L7 21H3v-4z" />
    </svg>
  )
}

/**
 * Local mirror of sheet/IdentityField.tsx. APPROXIMATION: the editable branch
 * inlines a controlled input in place of the InlineEditField save-on-blur
 * editor — same label tab + box chrome + pen icon.
 */
function IdentityField({
  label,
  value,
  editing = false,
  onSave,
  placeholder = '—',
  ariaLabel,
  className,
}: {
  label: string
  value: string
  editing?: boolean
  onSave?: (next: string) => void
  placeholder?: string
  ariaLabel?: string
  className?: string
}) {
  const fieldLabel = ariaLabel ?? label
  const isEditable = editing && onSave !== undefined

  let valueNode: ReactNode
  if (isEditable && onSave) {
    valueNode = (
      <span className={cn(EDIT_VALUE_BOX_CLASS, EDIT_CUE_CLASS)}>
        <input
          value={value}
          aria-label={`Edit ${fieldLabel.toLowerCase()}`}
          placeholder={placeholder}
          onChange={(e) => onSave(e.target.value)}
          className="w-full bg-transparent text-left font-body text-sm font-normal text-ink outline-none"
        />
        <PenIcon className={PEN_CLASS} />
      </span>
    )
  } else {
    valueNode = (
      <span
        className={cn(READ_VALUE_BOX_CLASS, !value && 'text-wk-muted')}
        style={{
          borderColor: 'color-mix(in oklch, var(--tone-deep, var(--color-ink)) 50%, transparent)',
        }}
      >
        <span className="min-w-0 truncate">{value || placeholder}</span>
      </span>
    )
  }

  return (
    <div className={cn('flex min-w-0 flex-col', className)}>
      <span className="mb-[2px] flex items-center justify-between gap-2">
        <span className="bg-ink px-1.5 pb-px pt-[2px] font-cond text-label font-bold uppercase leading-none tracking-caps text-paper">
          {label}
        </span>
      </span>
      {valueNode}
    </div>
  )
}

type NpcSource = { ref: string; entity: SURefEntity; npc: ResolvedNpc }

// Verbatim reproduction of CrawlerCrewStep.tsx (lines 45-146).
function CrawlerCrewStep({
  bays,
  selectedType,
  crew,
  onChange,
}: {
  bays: ReadonlyArray<SURefEntity>
  selectedType: SURefCrawler | undefined
  crew: Record<string, CrewNpcForm>
  onChange: (patch: { crew: Record<string, CrewNpcForm> }) => void
}) {
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
            <ReferenceEntityDisplay
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

// biome-ignore lint/style/useComponentExportOnlyModules: Ladle stories require a default meta export alongside story components
export default { title: 'Legacy/Wizard/Crawler Crew Step' }

export const Default: Story = () => {
  const bays = SalvageUnionReference.CrawlerBays.all().filter(
    (b) => (b as unknown as { npc?: unknown }).npc != null
  ) as unknown as ReadonlyArray<SURefEntity>
  const selectedType = SalvageUnionReference.Crawlers.all().find((t) => t.name === 'Battle')
  const [crew, setCrew] = useState<Record<string, CrewNpcForm>>({})

  if (bays.length === 0) {
    return <Caption>Crewed crawler-bay fixtures missing</Caption>
  }

  return (
    <div>
      <Caption>
        CrawlerCrewStep — crewed-bay roster; Battle's Grizzled Veteran heads the list. Open a row
        for its NPC IdentityFields (CrawlerCrewStep.tsx:45-146). IdentityField mirrored locally.
      </Caption>
      <CrawlerCrewStep
        bays={bays}
        selectedType={selectedType}
        crew={crew}
        onChange={(patch) => setCrew(patch.crew)}
      />
    </div>
  )
}
