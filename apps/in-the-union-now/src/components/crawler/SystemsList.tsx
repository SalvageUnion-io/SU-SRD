import type { SURefSystem } from 'salvageunion-reference'

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
    <fieldset>
      <legend className="mb-2 text-sm font-semibold">Systems</legend>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {systems.map((system) => {
          const isSelected = selectedSystemSlugs.includes(system.id)
          return (
            <button
              key={system.id}
              type="button"
              aria-pressed={isSelected}
              onClick={() => toggle(system.id)}
              className={[
                'rounded border p-2 text-left text-sm transition-colors',
                isSelected
                  ? 'border-primary bg-primary/10'
                  : 'border-input bg-background hover:bg-accent',
              ].join(' ')}
            >
              <span className="block font-medium">{system.name}</span>
              {system.techLevel !== undefined && (
                <span className="text-xs opacity-60">TL {system.techLevel}</span>
              )}
            </button>
          )
        })}
      </div>
    </fieldset>
  )
}
