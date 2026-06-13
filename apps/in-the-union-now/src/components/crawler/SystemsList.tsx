import type { SURefSystem } from 'salvageunion-reference'
import { SelCard } from '../wizard/SelCard'

type SystemsListProps = {
  /** All available systems, already filtered by tech level by the parent. */
  systems: SURefSystem[]
  selectedSystemSlugs: string[]
  onChange: (slugs: string[]) => void
}

/**
 * Systems step grid — 3-col Sel-grid WizShell variant (design §3.2). The
 * parent owns the TL filter (systems at the crawler's tech level and below);
 * selection is uncapped — capacity is a soft warning, never a block.
 */
export function SystemsList({ systems, selectedSystemSlugs, onChange }: SystemsListProps) {
  function toggle(systemId: string) {
    if (selectedSystemSlugs.includes(systemId)) {
      onChange(selectedSystemSlugs.filter((s) => s !== systemId))
    } else {
      onChange([...selectedSystemSlugs, systemId])
    }
  }

  if (systems.length === 0) {
    return <p className="text-sm text-wk-muted">Select a tech level to see available systems.</p>
  }

  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(15rem,1fr))] gap-3.5">
      {systems.map((system) => (
        <SelCard
          key={system.id}
          entity={system}
          name={system.name}
          selected={selectedSystemSlugs.includes(system.id)}
          onToggle={() => toggle(system.id)}
        />
      ))}
    </div>
  )
}
