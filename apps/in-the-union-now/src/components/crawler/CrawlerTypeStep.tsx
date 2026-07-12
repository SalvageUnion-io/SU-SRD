import type { SURefCrawler, SURefEntity } from 'salvageunion-reference'
import { crawlerMaxSpBonus, crawlerWeaponSlots } from 'salvageunion-reference/rules'
import { OptRow, ReferenceEntityDisplay, TreeSep } from 'suref-react'
import { SelCard } from '../wizard/SelCard'
import { SelMasonry } from '../wizard/SelMasonry'

type CrawlerTypeOptionListProps = {
  types: SURefCrawler[]
  selectedType: string | null
  onSelect: (id: string) => void
}

/** First paragraph of an entity's `content`, if any. */
function firstParagraph(entity: SURefCrawler): string {
  const first = entity.content?.[0]
  return typeof first?.value === 'string' ? first.value : ''
}

/**
 * Master pane for the Crawler step: one OptRow per crawler type
 * (Augmented / Battle / Engineering / Exploratory / Trade Caravan), the active
 * row driving the detail pane.
 */
export function CrawlerTypeOptionList({
  types,
  selectedType,
  onSelect,
}: CrawlerTypeOptionListProps) {
  return (
    <div>
      {types.map((type) => (
        <OptRow
          key={type.id}
          name={type.name}
          desc={type.npc?.position ?? firstParagraph(type)}
          active={type.id === selectedType}
          onClick={() => onSelect(type.id)}
        />
      ))}
    </div>
  )
}

type CrawlerTypeDetailProps = {
  selected: SURefCrawler | undefined
}

/**
 * Detail pane for the Crawler step: the selected crawler type's entity card —
 * its description, special action(s) and special NPC.
 */
export function CrawlerTypeDetail({ selected }: CrawlerTypeDetailProps) {
  if (!selected) {
    return (
      <div className="flex h-full min-h-40 items-center justify-center rounded-[3px] border-chrome border-dashed border-wk-faint p-6 text-center text-sm text-wk-muted">
        Select a crawler type to preview its features.
      </div>
    )
  }
  return <ReferenceEntityDisplay data={selected as unknown as SURefEntity} />
}

type CrawlerTypeSelectStepProps = {
  types: SURefCrawler[]
  selectedType: string | null
  onSelect: (id: string) => void
}

/**
 * Step 1 · Choose a Crawler Type (Union Crawler p.212) — exactly one of the
 * five types, radio semantics, each rendered as the SRD entity card inside a
 * SelCard (the universal entity-card rule; wizard-refresh Phase 5). A type's
 * stored `mutations` surface as footMeta badges (Battle: 2 weapon slots ·
 * +5 max SP — read from the data, never string-matched). The selected type's
 * FULL card renders below the grid — its unique Ability, its special NPC, and
 * (Augmented) the A.I. Personality roll — plus the Augmented type's
 * instructional +1 Training Point callout (TEXT ONLY: the wizard never writes
 * to other characters — ADR-007 automation boundary).
 */
export function CrawlerTypeSelectStep({
  types,
  selectedType,
  onSelect,
}: CrawlerTypeSelectStepProps) {
  const selected = types.find((t) => t.id === selectedType)
  const isAugmented = selected?.name === 'Augmented'

  return (
    <div className="w-full space-y-5">
      <TreeSep name="Crawler Types" suffix="Choose 1" />
      <SelMasonry radio ariaLabel="Crawler type">
        {types.map((type) => {
          const slots = crawlerWeaponSlots(type.mutations)
          const spBonus = crawlerMaxSpBonus(type.mutations)
          return (
            <SelCard
              key={type.id}
              entity={type}
              name={type.name}
              selected={type.id === selectedType}
              onToggle={() => onSelect(type.id)}
              radio
              entityProps={{
                footMeta: [
                  { label: 'Weapon slots', value: String(slots) },
                  ...(spBonus > 0 ? [{ label: 'Max SP', value: `+${spBonus}` }] : []),
                ],
              }}
            />
          )
        })}
      </SelMasonry>

      {selected ? (
        <>
          <TreeSep name="Your Crawler Type" suffix={selected.name} />
          <div className="max-w-3xl space-y-3">
            <ReferenceEntityDisplay data={selected as unknown as SURefEntity} />
            {isAugmented && (
              <p className="m-0 rounded-[3px] border-chrome border-ink bg-paper px-3 py-2.5 font-body text-sm text-ink">
                <span className="font-cond font-bold uppercase tracking-caps">
                  Augmented bonus —{' '}
                </span>
                every Pilot gains <strong>+1 Training Point</strong>, spendable on the{' '}
                <strong>Augment ability tree only</strong>. Apply it on each Pilot&rsquo;s sheet
                yourself — the wizard never writes to other characters.
              </p>
            )}
          </div>
        </>
      ) : (
        <p className="m-0 font-body text-sm text-current">
          Pick a type to preview its unique Ability and special NPC.
        </p>
      )}
    </div>
  )
}
