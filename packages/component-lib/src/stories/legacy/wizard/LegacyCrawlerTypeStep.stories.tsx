/**
 * Legacy "before" capture — ITUN crawler wizard `CrawlerTypeSelectStep`.
 *
 * Reproduces the presentational shell of
 * apps/in-the-union-now/src/components/crawler/CrawlerTypeStep.tsx VERBATIM
 * (CrawlerTypeSelectStep, lines 80-138, plus the OptRow master pane from
 * CrawlerTypeOptionList, lines 22-40). The step is a `MasonryColumns` radio
 * grid of the five crawler-type SRD entity cards with data-driven `footMeta`
 * (weapon slots / +max SP from `mutations`), then the selected type's FULL
 * card below the grid — and, for Augmented, the TEXT-ONLY +1 Training Point
 * callout (ADR-007: the wizard never writes to other characters). Driven with
 * real `SalvageUnionReference` fixtures and the real creation rules. L1
 * reconciliation: freeze the "before".
 */

import type { Story } from '@ladle/react'
import { useState } from 'react'
import type { SURefCrawler, SURefEntity } from 'salvageunion-reference'
import { SalvageUnionReference } from 'salvageunion-reference'
import { crawlerMaxSpBonus, crawlerWeaponSlots } from 'salvageunion-reference/rules'
import { EmptyState, MasonryColumns, OptRow, ReferenceEntityDisplay, TreeSep } from 'component-lib'
import { Caption } from '../../_harness'

/** First paragraph of an entity's `content`, if any (verbatim helper). */
function firstParagraph(entity: SURefCrawler): string {
  const first = entity.content?.[0]
  return typeof first?.value === 'string' ? first.value : ''
}

// Verbatim reproduction of CrawlerTypeOptionList (CrawlerTypeStep.tsx:22-40).
function CrawlerTypeOptionList({
  types,
  selectedType,
  onSelect,
}: {
  types: SURefCrawler[]
  selectedType: string | null
  onSelect: (id: string) => void
}) {
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

// Verbatim reproduction of CrawlerTypeDetail (CrawlerTypeStep.tsx:50-61).
function CrawlerTypeDetail({ selected }: { selected: SURefCrawler | undefined }) {
  if (!selected) {
    return (
      <EmptyState
        className="h-full"
        headline="No Crawler Selected"
        body="Select a crawler type to preview its features."
      />
    )
  }
  return <ReferenceEntityDisplay data={selected as unknown as SURefEntity} />
}

// Verbatim reproduction of CrawlerTypeSelectStep (CrawlerTypeStep.tsx:80-138).
function CrawlerTypeSelectStep({
  types,
  selectedType,
  onSelect,
}: {
  types: SURefCrawler[]
  selectedType: string | null
  onSelect: (id: string) => void
}) {
  const selected = types.find((t) => t.id === selectedType)
  const isAugmented = selected?.name === 'Augmented'

  return (
    <div className="w-full space-y-5">
      <TreeSep name="Crawler Types" suffix="Choose 1" />
      <MasonryColumns maxColumns={2} radio ariaLabel="Crawler type">
        {types.map((type) => {
          const slots = crawlerWeaponSlots(type.mutations)
          const spBonus = crawlerMaxSpBonus(type.mutations)
          return (
            <ReferenceEntityDisplay
              key={type.id}
              data={type}
              compact
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

// biome-ignore lint/style/useComponentExportOnlyModules: Ladle stories require a default meta export alongside story components
export default { title: 'Legacy/Wizard/Crawler Type Step' }

export const Default: Story = () => {
  const types = SalvageUnionReference.Crawlers.all()
  const battleId = types.find((t) => t.name === 'Battle')?.id ?? null
  const augmentedId = types.find((t) => t.name === 'Augmented')?.id ?? null
  const [selectedType, setSelectedType] = useState<string | null>(battleId)

  if (types.length === 0) {
    return <Caption>Crawler type fixtures missing</Caption>
  }

  return (
    <div className="flex flex-col gap-10">
      <div>
        <Caption>
          CrawlerTypeSelectStep — masonry radio grid + selected type's full card
          (CrawlerTypeStep.tsx:80-138). Battle default (footMeta shows +5 Max SP).
        </Caption>
        <CrawlerTypeSelectStep
          types={types}
          selectedType={selectedType}
          onSelect={setSelectedType}
        />
      </div>

      <div>
        <Caption>CrawlerTypeSelectStep — Augmented selected: the +1 Training Point callout</Caption>
        <CrawlerTypeSelectStep types={types} selectedType={augmentedId} onSelect={() => {}} />
      </div>

      <div>
        <Caption>
          CrawlerTypeOptionList + CrawlerTypeDetail — the OptRow master/detail variant
          (CrawlerTypeStep.tsx:22-61)
        </Caption>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-[1fr_1.4fr]">
          <CrawlerTypeOptionList
            types={types}
            selectedType={selectedType}
            onSelect={setSelectedType}
          />
          <CrawlerTypeDetail selected={types.find((t) => t.id === selectedType)} />
        </div>
      </div>
    </div>
  )
}
