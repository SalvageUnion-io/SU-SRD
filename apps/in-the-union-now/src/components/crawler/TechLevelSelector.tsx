import type { SURefMetaCrawlerTechLevel } from 'salvageunion-reference'

type TechLevelEntry = Pick<SURefMetaCrawlerTechLevel, 'id' | 'name' | 'techLevel'>

type TechLevelSelectorProps = {
  techLevels: TechLevelEntry[]
  selectedTechLevel: number | null
  onChange: (techLevel: number) => void
}

export function TechLevelSelector({
  techLevels,
  selectedTechLevel,
  onChange,
}: TechLevelSelectorProps) {
  return (
    <fieldset>
      <legend className="mb-2 text-sm font-semibold">Tech Level</legend>
      <div className="flex flex-wrap gap-2">
        {techLevels.map((tl) => {
          const isSelected = selectedTechLevel === tl.techLevel
          return (
            <button
              key={tl.id}
              type="button"
              aria-pressed={isSelected}
              onClick={() => onChange(tl.techLevel)}
              className={[
                'cursor-pointer rounded border px-3 py-2 text-sm font-medium transition-colors',
                isSelected
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-input bg-background hover:bg-accent hover:text-accent-foreground',
              ].join(' ')}
            >
              <span className="block font-bold">TL {tl.techLevel}</span>
              <span className="block text-xs opacity-80">{tl.name}</span>
            </button>
          )
        })}
      </div>
    </fieldset>
  )
}
