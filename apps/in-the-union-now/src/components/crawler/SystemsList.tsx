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
        <legend className="mb-2 text-sm font-semibold">Systems</legend>
        <p className="text-sm opacity-50">Select a tech level to see available systems.</p>
      </fieldset>
    )
  }

  return (
    <fieldset className="mx-auto w-full max-w-[1400px]">
      <legend className="mb-2 text-sm font-semibold">Systems</legend>
      <div className="flex flex-col gap-2">
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
