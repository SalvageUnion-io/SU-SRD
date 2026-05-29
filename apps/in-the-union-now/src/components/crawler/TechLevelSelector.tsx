import type { SURefMetaCrawlerTechLevel } from 'salvageunion-reference'
import { Button } from '../ui/button'

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
            <Button
              key={tl.id}
              type="button"
              variant={isSelected ? 'default' : 'outline'}
              aria-pressed={isSelected}
              onClick={() => onChange(tl.techLevel)}
              className="h-auto flex-col py-2"
            >
              <span className="block font-bold">TL {tl.techLevel}</span>
              <span className="block text-xs opacity-80">{tl.name}</span>
            </Button>
          )
        })}
      </div>
    </fieldset>
  )
}
