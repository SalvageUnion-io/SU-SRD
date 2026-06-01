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
      <legend className="mb-2 font-cond text-xs font-bold uppercase tracking-[0.08em] text-su-grey-dark">
        Tech Level
      </legend>
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
                'flex flex-col items-center rounded-[3px] border px-4 py-2 transition-colors',
                isSelected
                  ? 'border-su-black bg-su-orange-dark text-white'
                  : 'border-su-black bg-white text-su-black hover:bg-su-blue-pale',
              ].join(' ')}
            >
              <span className="font-cond text-sm font-bold uppercase tracking-[0.04em]">
                TL {tl.techLevel}
              </span>
              <span className="text-xs opacity-80">{tl.name}</span>
            </button>
          )
        })}
      </div>
    </fieldset>
  )
}
