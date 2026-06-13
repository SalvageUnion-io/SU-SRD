import type { SURefEntity, SURefMetaCrawlerTechLevel } from 'salvageunion-reference'
import { OptRow, ReferenceEntityDisplay } from 'suref-react'

type CrawlerTypeOptionListProps = {
  techLevels: SURefMetaCrawlerTechLevel[]
  selectedTechLevel: number | null
  onSelect: (techLevel: number) => void
}

/**
 * Master pane for the Crawler step (design §3.2b): one OptRow per crawler
 * tech level (Hamlet → Megalopolis), the active row driving the detail pane.
 */
export function CrawlerTypeOptionList({
  techLevels,
  selectedTechLevel,
  onSelect,
}: CrawlerTypeOptionListProps) {
  return (
    <div>
      {techLevels.map((tl) => (
        <OptRow
          key={tl.id}
          name={tl.name}
          desc={`Tech Level ${tl.techLevel} · ${tl.structurePoints} SP`}
          active={tl.techLevel === selectedTechLevel}
          onClick={() => onSelect(tl.techLevel)}
        />
      ))}
    </div>
  )
}

type CrawlerTypeDetailProps = {
  selected: SURefMetaCrawlerTechLevel | undefined
  /** SRD crawler bays — every crawler installs the full set on creation. */
  bays: SURefEntity[]
}

/**
 * Detail pane for the Crawler step (design §3.2c): the selected tech level's
 * entity card with the crawler's bay complement expanded inside it as a
 * 2-col grid of head-mode bay cards.
 */
export function CrawlerTypeDetail({ selected, bays }: CrawlerTypeDetailProps) {
  if (!selected) {
    return (
      <div className="flex h-full min-h-40 items-center justify-center rounded-[3px] border-[1.5px] border-dashed border-wk-faint p-6 text-center text-sm text-wk-muted">
        Select a crawler tech level to preview its bays.
      </div>
    )
  }
  return (
    <ReferenceEntityDisplay
      data={selected as unknown as SURefEntity}
      afterExtraContent={
        <div className="mt-4">
          <p className="mb-2 font-cond text-xs font-bold uppercase tracking-[0.1em] text-wk-muted">
            Structure Points · {selected.structurePoints} — Bays · {bays.length} (installed on every
            crawler)
          </p>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {bays.map((bay) => (
              <ReferenceEntityDisplay
                key={bay.id}
                data={bay}
                mode="head"
                hide={{ actions: true, choices: true }}
              />
            ))}
          </div>
        </div>
      }
    />
  )
}
