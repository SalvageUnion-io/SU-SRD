import type { SURefCrawler, SURefEntity } from 'salvageunion-reference'
import { OptRow, ReferenceEntityDisplay } from 'suref-react'

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
