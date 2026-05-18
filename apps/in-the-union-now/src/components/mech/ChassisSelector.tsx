/**
 * ChassisSelector — picks a chassis from salvageunion-reference.
 *
 * Renders a native <select> for accessibility and simplicity. The list is
 * loaded synchronously from the pre-loaded SalvageUnionReference.Chassis model.
 * Callers must ensure preload(['chassis']) has resolved before rendering.
 */
import { SalvageUnionReference } from 'salvageunion-reference'
import { cn } from '../../lib/utils'

type ChassisSelectorProps = {
  selectedChassis: string | null
  onSelect: (chassisName: string) => void
  className?: string
}

export function ChassisSelector({ selectedChassis, onSelect, className }: ChassisSelectorProps) {
  const allChassis = SalvageUnionReference.Chassis.all()

  return (
    <div className={cn('flex flex-col gap-1', className)}>
      <label htmlFor="chassis-select" className="text-sm font-medium">
        Chassis
      </label>
      <select
        id="chassis-select"
        aria-label="Chassis"
        value={selectedChassis ?? ''}
        onChange={(e) => {
          if (e.target.value) onSelect(e.target.value)
        }}
        className="rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
      >
        <option value="">— Select a chassis —</option>
        {allChassis.map((chassis) => (
          <option key={chassis.id} value={chassis.name}>
            {chassis.name}
          </option>
        ))}
      </select>
    </div>
  )
}
