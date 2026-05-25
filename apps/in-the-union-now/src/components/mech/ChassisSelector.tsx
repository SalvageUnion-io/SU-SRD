/**
 * ChassisSelector — picks a chassis from salvageunion-reference.
 *
 * Renders an SRD-styled selectable card grid via EntityChoiceCard. Callers
 * must ensure preload(['chassis']) has resolved before rendering (Chassis
 * data is read synchronously from the pre-loaded model).
 */
import { SalvageUnionReference } from 'salvageunion-reference'
import { EntityChoiceCard } from '../shared/EntityChoiceCard'
import { cn } from '../../lib/utils'

type ChassisSelectorProps = {
  selectedChassis: string | null
  onSelect: (chassisName: string) => void
  className?: string
}

export function ChassisSelector({ selectedChassis, onSelect, className }: ChassisSelectorProps) {
  const allChassis = SalvageUnionReference.Chassis.all()

  return (
    <fieldset className={cn('flex flex-col gap-2', className)}>
      <legend className="mb-1 text-sm font-medium">Chassis</legend>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {allChassis.map((chassis) => (
          <EntityChoiceCard
            key={chassis.id}
            entity={chassis}
            selected={chassis.name === selectedChassis}
            onSelect={() => onSelect(chassis.name)}
          />
        ))}
      </div>
    </fieldset>
  )
}
