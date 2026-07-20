import type { SURefCrawler, SURefEntity } from 'salvageunion-reference'
import { crawlerMaxSpBonus, crawlerWeaponSlots } from 'salvageunion-reference/rules'
import { EmptyState } from '../chrome/EmptyState'
import { OptRow } from '../chrome/OptRow'
import { Panel } from '../chrome/Panel'
import { TreeSep } from '../chrome/TreeSep'
import { MasonryColumns } from '../shared/MasonryColumns'
import { ReferenceEntityCard } from '../referenceEntity/card/ReferenceEntityCard'

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
      <EmptyState
        className="h-full"
        headline="No Crawler Selected"
        body="Select a crawler type to preview its features."
      />
    )
  }
  return <ReferenceEntityCard data={selected as unknown as SURefEntity} />
}

type CrawlerTypeSelectStepProps = {
  types: SURefCrawler[]
  selectedType: string | null
  onSelect: (id: string) => void
}

/** The Augmented crawler type's stable id (data/crawlers.json) — the one type
 * with the instructional +1 Training Point callout. Matched by id, never by
 * display name (the file's own "read from the data, never string-matched" rule). */
const AUGMENTED_CRAWLER_ID = '8bffb508-8c8f-418d-b6ce-f24f7266e41b'

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
  const isAugmented = selected?.id === AUGMENTED_CRAWLER_ID

  return (
    <div className="w-full space-y-5">
      <TreeSep name="Crawler Types" suffix="Choose 1" />
      <MasonryColumns maxColumns={2} radio ariaLabel="Crawler type">
        {types.map((type) => {
          const slots = crawlerWeaponSlots(type.mutations)
          const spBonus = crawlerMaxSpBonus(type.mutations)
          return (
            <ReferenceEntityCard
              key={type.id}
              data={type}
              size="medium"
              selected={type.id === selectedType}
              selectionRole="radio"
              cardClickLabel={type.name}
              onCardClick={() => onSelect(type.id)}
              hide={{ actions: true, choices: true }}
              footMeta={[
                { label: 'Weapon slots', value: String(slots) },
                ...(spBonus > 0 ? [{ label: 'Max SP', value: `+${spBonus}` }] : []),
              ]}
            />
          )
        })}
      </MasonryColumns>

      {selected ? (
        <>
          <TreeSep name="Your Crawler Type" suffix={selected.name} />
          <div className="max-w-3xl space-y-3">
            <ReferenceEntityCard data={selected as unknown as SURefEntity} />
            {isAugmented && (
              <Panel className="px-3 py-2.5 font-body text-sm text-ink">
                <span className="font-cond font-bold uppercase tracking-caps">
                  Augmented bonus —{' '}
                </span>
                every Pilot gains <strong>+1 Training Point</strong>, spendable on the{' '}
                <strong>Augment ability tree only</strong>. Apply it on each Pilot&rsquo;s sheet
                yourself — the wizard never writes to other characters.
              </Panel>
            )}
          </div>
        </>
      ) : (
        <EmptyState
          headline="No Type Selected"
          body="Pick a type to preview its unique Ability and special NPC."
        />
      )}
    </div>
  )
}
