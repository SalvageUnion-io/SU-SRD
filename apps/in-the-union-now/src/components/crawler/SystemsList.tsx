import type { SURefSystem } from 'salvageunion-reference'
import { EntityChoiceCard } from '../shared/EntityChoiceCard'

type SystemsListProps = {
  /** All available systems, already filtered by tech level by the parent. */
  systems: SURefSystem[]
  selectedSystemSlugs: string[]
  onChange: (slugs: string[]) => void
}

export function SystemsList({ systems, selectedSystemSlugs, onChange }: SystemsListProps) {
  function toggle(systemId: string) {
    if (selectedSystemSlugs.includes(systemId)) {
      onChange(selectedSystemSlugs.filter((s) => s !== systemId))
    } else {
      onChange([...selectedSystemSlugs, systemId])
    }
  }

  if (systems.length === 0) {
    return (
      <fieldset>
        <legend className="mb-2 font-cond text-xs font-bold uppercase tracking-[0.08em] text-su-grey-dark">
          Systems
        </legend>
        <p className="text-sm opacity-50">Select a tech level to see available systems.</p>
      </fieldset>
    )
  }

  return (
    <fieldset className="w-full">
      <legend className="mb-2 font-cond text-xs font-bold uppercase tracking-[0.08em] text-su-grey-dark">
        Systems
      </legend>
      <div className="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-3">
        {systems.map((system) => (
          <EntityChoiceCard
            key={system.id}
            entity={system}
            selected={selectedSystemSlugs.includes(system.id)}
            onSelect={() => toggle(system.id)}
          />
        ))}
      </div>
    </fieldset>
  )
}
